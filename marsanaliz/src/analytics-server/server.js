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

function requireAdmin(adminToken) {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== adminToken) {
      res.status(401).json({ error: 'Yetkisiz' });
      return;
    }
    next();
  };
}

function createAnalyticsApp(options = {}) {
  const adminToken = options.adminToken || ADMIN_TOKEN;
  const gatePassword = options.gatePassword || GATE_PASSWORD;
  const dataDir = options.dataDir || DATA_DIR;
  const dashboardDir = options.dashboardDir || path.join(__dirname, '..', 'analytics');

  const store = createAnalyticsStore({ dataDir });
  const app = express();

  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

  app.post('/api/v1/gate', (req, res) => {
    const password = String(req.body.password || '').trim();
    if (!password || (password !== gatePassword && password !== adminToken)) {
      res.status(401).json({ error: 'Gecersiz admin sifresi' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/v1/event', (req, res) => {
    try {
      store.ingestEvent(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Gecersiz istek' });
    }
  });

  app.post('/api/v1/download', (req, res) => {
    try {
      store.ingestDownload(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Gecersiz istek' });
    }
  });

  app.get('/api/v1/stats', requireAdmin(adminToken), (_req, res) => {
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
