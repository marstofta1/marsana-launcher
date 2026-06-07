'use strict';

const express = require('express');
const path = require('path');
const { createAnalyticsStore } = require('./store');

const PORT = Number(process.env.MARSANA_ANALYTICS_PORT || 3847);
const DEFAULT_SECRET = process.env.MARSANA_ANALYTICS_ADMIN_TOKEN
  || process.env.MARSANALIZ_GATE_PASSWORD
  || 'marsana-admin';
const ADMIN_TOKEN = DEFAULT_SECRET;
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

  app.use('/', express.static(dashboardDir));

  return { app, store, adminToken, gatePassword, dataDir, port: options.port || PORT };
}

function startAnalyticsServer(options = {}) {
  const ctx = createAnalyticsApp(options);
  const port = ctx.port;
  return new Promise((resolve) => {
    const server = ctx.app.listen(port, () => {
      console.log(`Marsana Analytics: http://127.0.0.1:${port}`);
      console.log(`Veri klasoru: ${ctx.dataDir}`);
      resolve({ ...ctx, server, url: `http://127.0.0.1:${port}` });
    });
  });
}

if (require.main === module) {
  startAnalyticsServer();
}

module.exports = { createAnalyticsApp, startAnalyticsServer, ADMIN_TOKEN, GATE_PASSWORD, PORT, DATA_DIR };
