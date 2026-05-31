'use strict';

const express = require('express');
const path = require('path');
const { createAnalyticsStore } = require('./store');

const PORT = Number(process.env.MARSANA_ANALYTICS_PORT || 3847);
const ADMIN_TOKEN = process.env.MARSANA_ANALYTICS_ADMIN_TOKEN || 'marsana-analytics-degistir';
const DATA_DIR = process.env.MARSANA_ANALYTICS_DATA_DIR
  || path.join(__dirname, 'data');

const store = createAnalyticsStore({ dataDir: DATA_DIR });
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

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'Yetkisiz' });
    return;
  }
  next();
}

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, service: 'marsana-analytics' });
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

app.get('/api/v1/stats', requireAdmin, (_req, res) => {
  res.json(store.getStats());
});

const dashboardDir = path.join(__dirname, '..', 'analytics');
app.use('/', express.static(dashboardDir));

app.listen(PORT, () => {
  console.log(`Marsana Analytics: http://127.0.0.1:${PORT}`);
  console.log(`Veri klasoru: ${DATA_DIR}`);
  console.log('Panel bu adreste acilir (indirme sitesinden ayri klasor: /analytics)');
});
