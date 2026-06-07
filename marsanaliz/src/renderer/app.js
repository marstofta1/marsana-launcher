'use strict';

const STORAGE_KEY = 'marsanaliz-session';

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

const apiBase = window.marsanaliz?.getApiBase?.() || 'http://127.0.0.1:3847/api/v1';

const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('admin-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const lastUpdated = document.getElementById('last-updated');
const updateBtn = document.getElementById('update-btn');
const updateOverlay = document.getElementById('update-overlay');
const updateTitle = document.getElementById('update-title');
const updateMessage = document.getElementById('update-message');
const updateProgressWrap = document.getElementById('update-progress-wrap');
const updateProgress = document.getElementById('update-progress');
const updateDismiss = document.getElementById('update-dismiss');

function showLoginError(msg) {
  loginError.hidden = false;
  loginError.textContent = msg;
}

function hideLoginError() {
  loginError.hidden = true;
}

async function verifyPassword(password) {
  const res = await fetch(`${apiBase}/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Gecersiz admin sifresi');
  }
}

async function fetchStats(session) {
  const res = await fetch(`${session.apiBase}/stats`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Sifre gecersiz' : `HTTP ${res.status}`);
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
    `<div class="bar-row"><span>${escapeHtml(id)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / max) * 100)}%"></div></div><strong>${count}</strong></div>`
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
    showLoginError(err.message || 'Veri alinamadi');
    exitDashboard();
  });
}

function exitDashboard() {
  dashboard.hidden = true;
  loginSection.hidden = false;
}

loginBtn.addEventListener('click', async () => {
  hideLoginError();
  const password = passwordInput.value.trim();
  if (!password) {
    showLoginError('Admin sifresi gerekli');
    return;
  }
  try {
    await verifyPassword(password);
    const session = { apiBase, token: password };
    saveSession(session);
    enterDashboard(session);
  } catch (err) {
    showLoginError(err.message || 'Giris basarisiz');
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

refreshBtn.addEventListener('click', () => {
  const session = loadSession();
  if (session) refreshDashboard(session).catch((err) => alert(err.message));
});

logoutBtn.addEventListener('click', () => {
  clearSession();
  passwordInput.value = '';
  exitDashboard();
});

function showUpdateOverlay(payload) {
  updateOverlay.classList.remove('hidden');
  updateOverlay.setAttribute('aria-hidden', 'false');
  const { phase, message, percent } = payload || {};
  if (phase === 'error') {
    updateTitle.textContent = 'Guncelleme basarisiz';
    updateProgressWrap.classList.add('hidden');
  } else if (phase === 'uptodate') {
    updateTitle.textContent = 'Guncel surum';
    updateProgressWrap.classList.add('hidden');
  } else if (phase === 'downloading') {
    updateTitle.textContent = 'Guncelleme indiriliyor';
    updateProgressWrap.classList.remove('hidden');
    updateProgress.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
  } else {
    updateTitle.textContent = 'Guncelleme';
    updateProgressWrap.classList.add('hidden');
  }
  updateMessage.textContent = message || '';
}

function hideUpdateOverlay() {
  updateOverlay.classList.add('hidden');
  updateOverlay.setAttribute('aria-hidden', 'true');
  updateBtn.disabled = false;
}

updateDismiss.addEventListener('click', hideUpdateOverlay);

async function refreshUpdateButton() {
  if (!window.marsanaliz?.updates) return;
  try {
    const res = await window.marsanaliz.updates.check();
    if (res?.available) {
      updateBtn.textContent = 'Guncelle';
      updateBtn.classList.add('has-update');
      updateBtn.title = `Surum ${res.version} mevcut`;
    } else {
      updateBtn.textContent = 'Guncellemeleri kontrol et';
      updateBtn.classList.remove('has-update');
      updateBtn.title = res?.currentVersion ? `Guncel (v${res.currentVersion})` : '';
    }
  } catch {
    updateBtn.classList.remove('has-update');
  }
}

updateBtn.addEventListener('click', async () => {
  if (!window.marsanaliz?.updates || updateBtn.disabled) return;
  updateBtn.disabled = true;
  showUpdateOverlay({ phase: 'checking', message: 'Baslatiliyor…' });
  const off = window.marsanaliz.updates.onPhase((p) => showUpdateOverlay(p));
  try {
    const res = await window.marsanaliz.updates.run();
    if (res?.willInstall) {
      off();
      return;
    }
    off();
    if (!res?.ok && res?.message) {
      showUpdateOverlay({ phase: 'error', message: res.message });
    } else if (res?.upToDate) {
      showUpdateOverlay({ phase: 'uptodate', message: res.message || 'Yeni surum yok.' });
    } else {
      hideUpdateOverlay();
    }
    refreshUpdateButton();
  } catch (err) {
    off();
    showUpdateOverlay({ phase: 'error', message: err.message || String(err) });
    updateBtn.disabled = false;
  }
});

const existing = loadSession();
if (existing?.token) {
  passwordInput.value = existing.token;
  enterDashboard(existing);
}

window.setTimeout(() => refreshUpdateButton(), 2500);
