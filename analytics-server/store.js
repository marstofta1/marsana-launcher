'use strict';

const fs = require('fs');
const path = require('path');

const MAX_EVENTS = 20000;

function createAnalyticsStore({ dataDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'analytics-store.json');

  let data = {
    version: 1,
    installs: {},
    downloads: [],
    events: [],
  };

  function load() {
    if (!fs.existsSync(filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        data = {
          version: 1,
          installs: parsed.installs || {},
          downloads: parsed.downloads || [],
          events: parsed.events || [],
        };
      }
    } catch {
      /* keep empty */
    }
  }

  function save() {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  load();

  function recordEvent(event) {
    data.events.push(event);
    if (data.events.length > MAX_EVENTS) {
      data.events = data.events.slice(-MAX_EVENTS);
    }
  }

  function upsertInstall(installId, patch) {
    const existing = data.installs[installId] || {
      installId,
      playerName: null,
      playerUuid: null,
      launcherVersion: null,
      platform: null,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 0,
      totalActiveSeconds: 0,
      launchCount: 0,
      totalPlaySeconds: 0,
    };
    data.installs[installId] = {
      ...existing,
      ...patch,
      installId,
      lastSeen: Date.now(),
    };
  }

  function ingestEvent(body) {
    const now = Date.now();
    const installId = String(body.installId || '').trim();
    if (!installId) {
      throw new Error('installId gerekli');
    }

    const type = String(body.type || 'unknown');
    const playerName = body.playerName ? String(body.playerName) : null;
    const playerUuid = body.playerUuid ? String(body.playerUuid) : null;

    upsertInstall(installId, {
      playerName: playerName || data.installs[installId]?.playerName || null,
      playerUuid: playerUuid || data.installs[installId]?.playerUuid || null,
      launcherVersion: body.launcherVersion || data.installs[installId]?.launcherVersion || null,
      platform: body.platform || data.installs[installId]?.platform || null,
      lastSeen: now,
    });

    const install = data.installs[installId];

    if (type === 'install' || type === 'first_open') {
      install.firstSeen = install.firstSeen || now;
      install.sessionCount += 1;
    }
    if (type === 'session_start') {
      install.sessionCount += 1;
    }
    if (type === 'session_end' && Number.isFinite(body.activeSeconds)) {
      install.totalActiveSeconds += Math.max(0, Math.floor(body.activeSeconds));
    }
    if (type === 'game_launch') {
      install.launchCount += 1;
    }
    if (type === 'game_close' && Number.isFinite(body.playSeconds)) {
      install.totalPlaySeconds += Math.max(0, Math.floor(body.playSeconds));
    }

    recordEvent({
      installId,
      type,
      playerName: install.playerName,
      launcherVersion: body.launcherVersion || install.launcherVersion,
      platform: body.platform || install.platform,
      payload: body.payload || null,
      createdAt: now,
    });

    save();
    return { ok: true };
  }

  function ingestDownload(body) {
    const entry = {
      platformId: String(body.platformId || 'unknown'),
      userAgent: String(body.userAgent || '').slice(0, 512),
      createdAt: Date.now(),
    };
    data.downloads.push(entry);
    if (data.downloads.length > MAX_EVENTS) {
      data.downloads = data.downloads.slice(-MAX_EVENTS);
    }
    save();
    return { ok: true };
  }

  function getStats() {
    const installs = Object.values(data.installs);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * day;

    const activeWeek = installs.filter((i) => i.lastSeen >= weekAgo).length;
    const onlineWindowMs = 15 * 60 * 1000;
    const activeNow = installs.filter((i) => i.lastSeen >= now - onlineWindowMs).length;
    const totalActiveSeconds = installs.reduce((s, i) => s + (i.totalActiveSeconds || 0), 0);
    const totalPlaySeconds = installs.reduce((s, i) => s + (i.totalPlaySeconds || 0), 0);
    const totalLaunches = installs.reduce((s, i) => s + (i.launchCount || 0), 0);

    const downloadByPlatform = {};
    for (const d of data.downloads) {
      downloadByPlatform[d.platformId] = (downloadByPlatform[d.platformId] || 0) + 1;
    }

    const recentEvents = [...data.events].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
    const recentDownloads = [...data.downloads].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);

    const users = installs
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .map((i) => ({
        installId: i.installId,
        playerName: i.playerName || 'Anonim',
        playerUuid: i.playerUuid,
        launcherVersion: i.launcherVersion,
        platform: i.platform,
        firstSeen: i.firstSeen,
        lastSeen: i.lastSeen,
        sessionCount: i.sessionCount || 0,
        totalActiveSeconds: i.totalActiveSeconds || 0,
        launchCount: i.launchCount || 0,
        totalPlaySeconds: i.totalPlaySeconds || 0,
      }));

    return {
      summary: {
        totalInstalls: installs.length,
        activeNow,
        activeLast7Days: activeWeek,
        totalDownloadClicks: data.downloads.length,
        totalActiveSeconds,
        totalPlaySeconds,
        totalLaunches,
      },
      downloadByPlatform,
      users,
      recentEvents,
      recentDownloads,
    };
  }

  return {
    ingestEvent,
    ingestDownload,
    getStats,
  };
}

module.exports = { createAnalyticsStore };
