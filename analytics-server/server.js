'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createAnalyticsStore } = require('./store');

const PORT = Number(process.env.PORT || process.env.MARSANA_ANALYTICS_PORT || 3847);
const ENV_SECRET = process.env.MARSANA_ANALYTICS_ADMIN_TOKEN
  || process.env.MARSANALIZ_GATE_PASSWORD
  || '';
// Sabit varsayilan sifre yok: ortam degiskeni tanimsizsa her aciliste rastgele
// token uretilir ve konsola yazilir. Boylece bilinen bir sifreyle asla acilmaz.
const TOKEN_WAS_GENERATED = !ENV_SECRET;
const ADMIN_TOKEN = ENV_SECRET || crypto.randomBytes(24).toString('base64url');
const GATE_PASSWORD = process.env.MARSANALIZ_GATE_PASSWORD || ADMIN_TOKEN;
const DATA_DIR = process.env.MARSANA_ANALYTICS_DATA_DIR
  || path.join(__dirname, 'data');

// Sabit-zamanli string karsilastirma: token/sifre dogrulamasinda erken cikan
// `!==` zamanlama sizintisi verir. Uzunluk farkinda dogrudan false (yine sabit).
function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Basit bellek-ici hiz siniri (bagimlilik yok). Pencere basina IP'nin istek
// sayisini sinirlar; asilirsa 429. Undeployed/dusuk-trafik sunucu icin yeterli.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 20000) hits.clear(); // sinirsiz buyumeyi engelle
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (recent.length > max) {
      res.status(429).json({ error: 'Cok fazla istek, sonra tekrar deneyin' });
      return;
    }
    next();
  };
}

// Yetki: Bearer token gecerli tokenlardan biriyle SABIT-ZAMANLI esitse gecer.
// /stats hem admin token'i hem gate sifresini kabul eder (aksi halde gate
// sifresiyle giren panel /stats'ta 401 alirdi).
function requireAuth(validTokens) {
  const valid = validTokens.filter(Boolean);
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token && valid.some((v) => timingSafeEqualStr(token, v))) {
      next();
      return;
    }
    res.status(401).json({ error: 'Yetkisiz' });
  };
}

function createAnalyticsApp(options = {}) {
  const adminToken = options.adminToken || ADMIN_TOKEN;
  const gatePassword = options.gatePassword || GATE_PASSWORD;
  const dataDir = options.dataDir || DATA_DIR;
  const dashboardDir = options.dashboardDir || path.join(__dirname, '..', 'analytics');

  const store = createAnalyticsStore({ dataDir });
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  // Hiz sinirlayicilar: ingest yuksek, gate/stats brute-force'a karsi dusuk.
  const ingestLimiter = createRateLimiter({ windowMs: 60000, max: 120 });
  const authLimiter = createRateLimiter({ windowMs: 60000, max: 15 });

  // CORS: MARSANA_ANALYTICS_ALLOWED_ORIGINS (virgullu) ayarliysa yalnizca o
  // origin'lere izin verilir; bos ise geriye donuk uyumluluk icin '*' ama bir
  // kez uyarilir (panel ayni sunucudan servis edildiginde CORS gerekmez).
  const allowedOrigins = String(process.env.MARSANA_ANALYTICS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let warnedCors = false;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length) {
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (!warnedCors) {
        warnedCors = true;
        console.warn('[marsana-analytics] CORS acik (*). Kisitlamak icin MARSANA_ANALYTICS_ALLOWED_ORIGINS ayarlayin.');
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, service: 'marsana-analytics' });
  });

  app.post('/api/v1/gate', authLimiter, (req, res) => {
    const password = String(req.body.password || '').trim();
    if (password && (timingSafeEqualStr(password, gatePassword) || timingSafeEqualStr(password, adminToken))) {
      res.json({ ok: true });
      return;
    }
    res.status(401).json({ error: 'Gecersiz admin sifresi' });
  });

  app.post('/api/v1/event', ingestLimiter, (req, res) => {
    try {
      store.ingestEvent(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Gecersiz istek' });
    }
  });

  app.post('/api/v1/download', ingestLimiter, (req, res) => {
    try {
      store.ingestDownload(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Gecersiz istek' });
    }
  });

  app.get('/api/v1/stats', authLimiter, requireAuth([adminToken, gatePassword]), (_req, res) => {
    res.json(store.getStats());
  });

  if (fs.existsSync(dashboardDir)) {
    app.use('/', express.static(dashboardDir));
  }

  return { app, store, adminToken, gatePassword, dataDir, port: options.port || PORT };
}

const HOST = process.env.MARSANA_ANALYTICS_HOST || '0.0.0.0';

function startAnalyticsServer(options = {}) {
  const basePort = Number(options.port || PORT);
  const maxAttempts = Number(options.portRetryCount || 10);

  function tryListen(port, attempt) {
    const ctx = createAnalyticsApp({ ...options, port });
    return new Promise((resolve, reject) => {
      const server = ctx.app.listen(port, HOST, () => {
        const localUrl = `http://127.0.0.1:${port}`;
        console.log(`Marsana Analytics: ${localUrl} (dinleniyor: ${HOST}:${port})`);
        console.log(`Veri klasoru: ${ctx.dataDir}`);
        if (TOKEN_WAS_GENERATED) {
          console.warn(
            '[marsana-analytics] MARSANA_ANALYTICS_ADMIN_TOKEN tanimli degil. '
              + `Bu oturum icin uretilen gecici admin token: ${ctx.adminToken}`
          );
        }
        resolve({ ...ctx, server, url: localUrl, port, host: HOST });
      });
      server.on('error', (err) => {
        server.close();
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
          tryListen(port + 1, attempt + 1).then(resolve).catch(reject);
          return;
        }
        reject(err);
      });
    });
  }

  return tryListen(basePort, 0);
}

if (require.main === module) {
  startAnalyticsServer().catch((err) => {
    console.error('[marsana-analytics] Baslatilamadi:', err);
    process.exit(1);
  });
}

module.exports = { createAnalyticsApp, startAnalyticsServer, ADMIN_TOKEN, GATE_PASSWORD, PORT, DATA_DIR };
