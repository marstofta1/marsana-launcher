'use strict';

const STORAGE_KEY = 'marsana-analytics-session';

function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk`;
  return `${s}sn`;
}

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('tr-TR');
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const apiBaseInput = document.getElementById('api-base');
const tokenInput = document.getElementById('admin-token');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const lastUpdated = document.getElementById('last-updated');

function showError(msg) {
  loginError.hidden = false;
  loginError.textContent = msg;
}

function hideError() {
  loginError.hidden = true;
}

async function fetchStats(session) {
  const res = await fetch(`${session.apiBase}/stats`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Token gecersiz' : `HTTP ${res.status}`);
  }
  return res.json();
}

function renderSummary(summary) {
  const cards = [
    ['Toplam kurulum', summary.totalInstalls],
    ['Son 7 gun aktif', summary.activeLast7Days],
    ['Indirme tiklamasi', summary.totalDownloadClicks],
    ['Toplam launcher suresi', formatDuration(summary.totalActiveSeconds)],
    ['Toplam oyun suresi', formatDuration(summary.totalPlaySeconds)],
    ['Oyun baslatma', summary.totalLaunches],
  ];
  document.getElementById('summary-cards').innerHTML = cards.map(([label, value]) =>
    `<article class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></article>`
  ).join('');
}

function renderDownloads(downloadByPlatform) {
  const entries = Object.entries(downloadByPlatform || {}).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('download-chart');
  if (!entries.length) {
    el.innerHTML = '<p class="muted">Henuz indirme kaydi yok.</p>';
    return;
  }
  const max = entries[0][1] || 1;
  el.innerHTML = entries.map(([id, count]) =>
    `<div class="bar-row"><span>${id}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / max) * 100)}%"></div></div><strong>${count}</strong></div>`
  ).join('');
}

function renderUsers(users) {
  const body = document.getElementById('users-body');
  if (!users.length) {
    body.innerHTML = '<tr><td colspan="7" class="muted">Henuz launcher kullanimi yok.</td></tr>';
    return;
  }
  body.innerHTML = users.map((u) =>
    `<tr>
      <td>${escapeHtml(u.playerName)}<br><small class="muted">${escapeHtml(u.installId.slice(0, 8))}…</small></td>
      <td>${escapeHtml(u.platform || '-')}</td>
      <td>${escapeHtml(u.launcherVersion || '-')}</td>
      <td>${formatDuration(u.totalActiveSeconds)}<br><small class="muted">${u.sessionCount} oturum</small></td>
      <td>${formatDuration(u.totalPlaySeconds)}</td>
      <td>${u.launchCount}</td>
      <td>${formatDate(u.lastSeen)}</td>
    </tr>`
  ).join('');
}

function renderEvents(events) {
  const el = document.getElementById('recent-events');
  if (!events.length) {
    el.innerHTML = '<li class="muted">Olay yok</li>';
    return;
  }
  el.innerHTML = events.map((e) =>
    `<li><strong>${escapeHtml(e.type)}</strong> · ${escapeHtml(e.playerName || 'Anonim')} · ${formatDate(e.createdAt)}</li>`
  ).join('');
}

function renderRecentDownloads(downloads) {
  const el = document.getElementById('recent-downloads');
  if (!downloads.length) {
    el.innerHTML = '<li class="muted">Indirme yok</li>';
    return;
  }
  el.innerHTML = downloads.map((d) =>
    `<li><strong>${escapeHtml(d.platformId)}</strong> · ${formatDate(d.createdAt)}</li>`
  ).join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function refreshDashboard(session) {
  const data = await fetchStats(session);
  renderSummary(data.summary);
  renderDownloads(data.downloadByPlatform);
  renderUsers(data.users);
  renderEvents(data.recentEvents);
  renderRecentDownloads(data.recentDownloads);
  lastUpdated.textContent = 'Guncellendi: ' + new Date().toLocaleTimeString('tr-TR');
}

function enterDashboard(session) {
  loginSection.hidden = true;
  dashboard.hidden = false;
  refreshDashboard(session).catch((err) => {
    showError(err.message || 'Veri alinamadi');
    exitDashboard();
  });
}

function exitDashboard() {
  dashboard.hidden = true;
  loginSection.hidden = false;
}

loginBtn.addEventListener('click', () => {
  hideError();
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, '');
  const token = tokenInput.value.trim();
  if (!apiBase || !token) {
    showError('API adresi ve token gerekli');
    return;
  }
  const session = { apiBase, token };
  fetchStats(session)
    .then(() => {
      saveSession(session);
      enterDashboard(session);
    })
    .catch((err) => showError(err.message || 'Giris basarisiz'));
});

refreshBtn.addEventListener('click', () => {
  const session = loadSession();
  if (session) refreshDashboard(session).catch((err) => alert(err.message));
});

logoutBtn.addEventListener('click', () => {
  clearSession();
  exitDashboard();
});

const existing = loadSession();
apiBaseInput.value = existing?.apiBase || `${window.location.origin}/api/v1`;
if (existing?.token) {
  tokenInput.value = existing.token;
  enterDashboard(existing);
}
