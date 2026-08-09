'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LauncherError, Codes } = require('./errors');

const DEFAULT_USER_AGENT = 'MarsanaLauncher/0.1.0 (+https://github.com/marsana/launcher)';
const MAX_REDIRECTS = 5;

function httpModuleForUrl(urlString) {
  try {
    return new URL(urlString).protocol === 'http:' ? http : https;
  } catch {
    return https;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Windows'ta antivirüs/arama dizinleyici, kapatılan .part dosyasını rename'den
// hemen önce kısa süre kilitleyip EPERM/EBUSY üretebiliyor; bayt eksik olmadığı
// halde indirme "başarısız" görünür. Kısa geri çekilmelerle birkaç kez dene.
async function renameWithRetry(from, to) {
  const codes = new Set(['EPERM', 'EACCES', 'EBUSY']);
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (err) {
      if (!codes.has(err.code) || attempt >= 4) throw err;
      await sleep(50 * (attempt + 1));
    }
  }
}

// Aynı Windows kilidi .part temizliğinde de görülür: file.destroy() fd'yi
// asenkron kapatır, hemen ardından gelen unlink açık handle yüzünden EPERM/EBUSY
// alabilir. Kısa geri çekilmelerle birkaç kez dene; yine de silinemezse SESSIZCE
// bırak — geçici adın benzersiz pid+sayaç eki onu asla nihai/önbellek dosyası
// sanılmayacak hale getirir, bu yüzden asıl indirme hatasını maskeleme.
async function unlinkWithRetry(target) {
  const codes = new Set(['EPERM', 'EACCES', 'EBUSY']);
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.promises.unlink(target);
      return;
    } catch (err) {
      if (err.code === 'ENOENT') return;
      if (!codes.has(err.code) || attempt >= 4) return;
      await sleep(50 * (attempt + 1));
    }
  }
}

function createHttpClient({ userAgent = DEFAULT_USER_AGENT } = {}) {
  let tmpCounter = 0;

  function get(url, { headers = {}, timeoutMs = 45000 } = {}, redirects = 0) {
    return new Promise((resolve, reject) => {
      let absoluteUrl;
      try {
        absoluteUrl = new URL(url).href;
      } catch (e) {
        reject(new LauncherError(Codes.HTTP, `Geçersiz URL: ${url}`, e));
        return;
      }

      const mod = httpModuleForUrl(absoluteUrl);
      const req = mod.get(
        absoluteUrl,
        {
          headers: {
            'User-Agent': userAgent,
            ...headers,
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const loc = res.headers.location;
            res.resume();
            if (!loc) {
              reject(new LauncherError(Codes.HTTP, `Redirect without location: ${url}`));
              return;
            }
            if (redirects >= MAX_REDIRECTS) {
              reject(new LauncherError(Codes.HTTP, `Too many redirects: ${url}`));
              return;
            }
            let nextUrl;
            try {
              nextUrl = new URL(loc, absoluteUrl).href;
            } catch (err) {
              reject(new LauncherError(Codes.HTTP, `Redirect URL geçersiz: ${loc}`, err));
              return;
            }
            resolve(get(nextUrl, { headers }, redirects + 1));
            return;
          }
          resolve(res);
        }
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new LauncherError(Codes.NETWORK, `İstek zaman aşımına uğradı: ${absoluteUrl}`));
      });
      req.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  async function fetchText(url, opts = {}) {
    const res = await get(url, {
      headers: { Accept: 'text/html,*/*', ...(opts.headers || {}) },
    });
    return new Promise((resolve, reject) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const body = Buffer.concat(chunks).toString('utf8');
        if (status >= 400) {
          reject(new LauncherError(Codes.HTTP, `HTTP ${status}: ${url}`));
          return;
        }
        resolve(body);
      });
      res.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  async function fetchJson(url, opts = {}) {
    const res = await get(url, {
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
    });
    return new Promise((resolve, reject) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const body = Buffer.concat(chunks).toString('utf8');
        if (status >= 400) {
          reject(new LauncherError(Codes.HTTP, `HTTP ${status}: ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new LauncherError(Codes.HTTP, `Invalid JSON from ${url}: ${e.message}`, e));
        }
      });
      res.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  // integrity = { sha1, sha256, sha512, size } — hepsi opsiyonel. Kaynak bir
  // parmak izi/boyut YAYINLADIYSA doğrulanır ("varsa doğrula"): hash verilmeyen
  // (eski/eksik metadata) indirmeler eskisi gibi çalışır. Hash TUTMAZSA dosya
  // reddedilir ve nihai yola asla taşınmaz — çalıştırılan kurucu jar'ları,
  // modları ve Java çalıştırıcısını değiştirilmeye/bozulmaya karşı korur.
  // Not: sidecar hash'i indirilen dosyayla aynı sunucudan geliyorsa aktif bir
  // MITM ikisini birden değiştirebilir; bu doğrulama esas olarak CDN/ayna
  // bozulmasına ve kesik/karışık indirmeye karşı garanti verir (TLS zaten
  // pasif dinlemeyi engeller).
  async function download(url, destPath, integrity = {}) {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const res = await get(url);
    const status = res.statusCode || 0;
    // Sadece 200 kabul edilir. 204/205/300/304 gibi gövdesiz yanıtlar eskiden
    // "başarılı" sayılıp 0 baytlık dosya bırakıyordu; çağıranlar önbelleği
    // sadece "dosya var mı" ile denetlediği için o bozuk dosya kalıcı oluyordu.
    if (status !== 200) {
      res.resume();
      throw new LauncherError(Codes.HTTP, `Download ${status}: ${url}`);
    }

    // Yayınlanan hash'leri akış sırasında hesapla (dosya iki kez okunmaz). Boş
    // ya da hex olmayan değerler sessizce atlanır — bozuk metadata indirmeyi
    // bloklamaz, sadece o alan için doğrulama yapılmaz.
    const hashers = [];
    for (const algo of ['sha1', 'sha256', 'sha512']) {
      const raw = integrity[algo];
      if (raw == null) continue;
      const expected = String(raw).trim().toLowerCase();
      if (!/^[0-9a-f]+$/.test(expected)) continue;
      hashers.push({ algo, expected, h: crypto.createHash(algo) });
    }
    const expectedSize = Number(integrity.size);

    // Önce geçici dosyaya yaz, tamamlanınca atomik olarak taşı. Yarım kalan
    // indirme asla nihai yola düşmez; mevcut kod her yerde nihai dosyanın
    // varlığını önbellek anahtarı olarak kullanıyor. Geçici ada pid+sayaç
    // eklenir: aynı hedefe eşzamanlı iki indirme birbirinin .part'ını bozamaz.
    tmpCounter += 1;
    const tmpPath = `${destPath}.${process.pid}.${tmpCounter}.part`;
    // Content-Length verildiyse temiz biten ama kısa gövdeyi yakalamak için ikincil
    // güvence; kesilmelerin çoğu zaten aşağıdaki res 'error' (abort) yolunda düşer.
    const expectedLen = Number(res.headers['content-length']);
    let received = 0;

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpPath);
      const fail = (code, err) => {
        const e = err instanceof LauncherError ? err : new LauncherError(code, err.message, err);
        file.destroy();
        // fd kapanışını bekleyip .part'ı sil, SONRA reddet: "mismatch/hata sonrası
        // .part kalmaz" garantisi Windows'ta da deterministik olsun (yarış değil).
        unlinkWithRetry(tmpPath).finally(() => reject(e));
      };
      res.on('data', (c) => {
        received += c.length;
        for (const x of hashers) x.h.update(c);
      });
      res.pipe(file);
      file.on('finish', () => {
        // Content-Length verildiyse eksik gövdeyi yakala (sessiz kesilme).
        if (Number.isFinite(expectedLen) && received !== expectedLen) {
          fail(Codes.NETWORK, new LauncherError(
            Codes.NETWORK,
            `İndirme eksik: ${received}/${expectedLen} bayt — ${url}`
          ));
          return;
        }
        // Kaynak boyut yayınladıysa (Modrinth/Mojang) onu da doğrula.
        if (Number.isFinite(expectedSize) && received !== expectedSize) {
          fail(Codes.HTTP, new LauncherError(
            Codes.HTTP,
            `Boyut uyuşmuyor: ${received}/${expectedSize} bayt — ${url}`
          ));
          return;
        }
        // Parmak izlerini karşılaştır (büyük/küçük harf duyarsız).
        for (const x of hashers) {
          const got = x.h.digest('hex');
          if (got !== x.expected) {
            fail(Codes.HTTP, new LauncherError(
              Codes.HTTP,
              `${x.algo} doğrulaması başarısız — ${url} ` +
                `(beklenen ${x.expected.slice(0, 12)}…, gelen ${got.slice(0, 12)}…)`
            ));
            return;
          }
        }
        file.close((err) => (err ? fail(Codes.FILESYSTEM, err) : resolve()));
      });
      file.on('error', (err) => fail(Codes.FILESYSTEM, err));
      res.on('error', (err) => fail(Codes.NETWORK, err));
    });

    try {
      await renameWithRetry(tmpPath, destPath);
    } catch (err) {
      await unlinkWithRetry(tmpPath);
      throw new LauncherError(Codes.FILESYSTEM, `Dosya taşınamadı: ${destPath}`, err);
    }
  }

  return { fetchJson, fetchText, download };
}

module.exports = { createHttpClient };
