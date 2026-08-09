'use strict';

const fs = require('fs');
const path = require('path');

const { LauncherError, Codes } = require('./errors');

// Zip girdi adları ve uzak JSON alanları saldırgan kontrolünde olabilir. Bu modül
// tek doğrulama noktasıdır: hedef yol, kök klasörün ALTINDA kaldığı kanıtlanmadan
// hiçbir şey diske yazılmaz.
//
// Neden adm-zip'in kendi temizliğine güvenmiyoruz: 0.4.16'nın sanitize() işlevi
// `path.indexOf(prefix) === 0` ile karşılaştırma yapıyordu; ayırıcı eklenmediği
// için kök ile aynı harflerle başlayan komşu klasörler (C:\out → C:\out2) testi
// geçiyordu. Sürüm yükseltmesi bunu kapatır, ama kütüphane sürümü tek savunma
// hattı olmamalı — kontrolü kendi kodumuzda tutuyoruz.
//
// Bilinen sınır: kontrol sözlükseldir (realpath yapmaz). Oyun klasörünün İÇİNDE
// önceden oluşturulmuş bir junction/symlink varsa yazma onu takip eder. Bunu
// kapatmak, mods/ klasörünü başka bir sürücüye junction'layan meşru kurulumları
// da bozacağı için bilinçli olarak yapılmadı (denetim maddesi Y4 ile birlikte).
function resolveInside(rootDir, relativePath) {
  const raw = String(relativePath);
  // NUL, yolun geri kalanını kırpan katman farklarına yol açabilir.
  if (raw.includes('\0')) return null;

  // Platform BAĞIMSIZ kaçış tespiti. Aynı launcher hem Windows hem Linux/mac'te
  // çalışır; Windows'ta path ters bölüyü ayraç, "C:" yi sürücü sayıp kaçışları
  // reddeder ama posix (Linux/mac) "..\..\evil" i zararsız bir dosya adı,
  // "C:/x" i normal bir alt klasör sanıp İÇERİ ALIRDI. Meşru bir zip/manifest
  // girdisi ne ters bölü ne sürücü harfi içerir — ikisini de her yerde düşman say.
  // (Bu, K4 verify testlerinin Linux CI'da patlamasının da nedeniydi.)
  const unified = raw.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(unified)) return null; // "C:...", "C:/...", sürücü-göreli

  const root = path.resolve(rootDir);
  const dest = path.resolve(root, unified);

  // Aynı sürücü/kök zorunlu. `\\C:\kok\x` gibi UNC'ye çevrilen girdilerde
  // path.relative baştaki ters eğik çizgileri kırpıp "içeride" sonucu üretebiliyor.
  if (path.parse(dest).root !== path.parse(root).root) return null;

  const rel = path.relative(root, dest);
  if (!rel) return null;
  if (path.isAbsolute(rel)) return null;
  // Tam bileşen karşılaştırması: "..foo" adlı meşru bir dosya reddedilmemeli,
  // ".." ve "../" ile başlayan gerçek kaçışlar reddedilmeli. unified sayesinde
  // "..\x" posix'te de "../x" olarak yakalanır.
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || rel.startsWith('../')) return null;

  return dest;
}

function assertInside(rootDir, relativePath, message) {
  const dest = resolveInside(rootDir, relativePath);
  if (!dest) {
    throw new LauncherError(
      Codes.FILESYSTEM,
      message || `Arşiv güvenli değil: "${relativePath}" hedef klasörün dışına yazmaya çalışıyor.`
    );
  }
  return dest;
}

// ZIP girdi adlarında baştaki eğik çizgi bir kaçış değil, yaygın bir üretici
// artığıdır ("/assets/x.png"). Hem adm-zip 0.4.16 hem 0.5.x bunu kök-göreli
// kabul edip klasörün içine açar; aynısını yapmazsak meşru kaynak paketleri
// reddedilir ve özellik sessizce kaybolur.
function normalizeEntryName(entryName) {
  return String(entryName).replace(/\\/g, '/').replace(/^\/+/, '');
}

// adm-zip'in extractAllTo/extractEntryTo işlevlerinin yerine geçer.
// Önce TÜM girdiler doğrulanır, sonra yazılır: tek bir güvensiz girdi varsa
// diske hiçbir şey yazılmaz. (Tek geçişli bir döngüde, kötü girdiden önceki
// dosyalar diskte kalırdı — saldırgan yükünü başa koyup sonuna bir kaçış girdisi
// ekleyerek "kurulum başarısız" görünürken yükünü bırakabilirdi.)
function extractZipInside(zip, targetDir, options = {}) {
  const { stripPrefix = '', unsafeMessage } = options;
  const root = path.resolve(targetDir);

  const planned = [];
  for (const entry of zip.getEntries()) {
    const name = normalizeEntryName(entry.entryName);
    if (stripPrefix && !name.startsWith(stripPrefix)) continue;
    const rel = stripPrefix ? name.slice(stripPrefix.length) : name;
    if (!rel) continue;

    const dest = assertInside(root, rel, unsafeMessage ? unsafeMessage(rel) : undefined);
    planned.push({ entry, dest, isDirectory: !!entry.isDirectory });
  }

  fs.mkdirSync(root, { recursive: true });

  let written = 0;
  for (const item of planned) {
    try {
      if (item.isDirectory) {
        fs.mkdirSync(item.dest, { recursive: true });
        continue;
      }
      fs.mkdirSync(path.dirname(item.dest), { recursive: true });
      fs.writeFileSync(item.dest, item.entry.getData());
      written += 1;
    } catch (err) {
      // Ham fs hataları (EEXIST, ENOENT, ENAMETOOLONG) çağıranlara anlaşılır
      // biçimde ulaşsın; üst katmanlar LauncherError bekliyor.
      throw new LauncherError(
        Codes.FILESYSTEM,
        `Arşiv açılamadı: "${path.relative(root, item.dest)}" yazılamadı (${err.code || err.message}).`,
        err
      );
    }
  }
  return written;
}

module.exports = { resolveInside, assertInside, extractZipInside, normalizeEntryName };
