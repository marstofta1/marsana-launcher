'use strict';

(function () {
  const SESSION_KEY = 'marsanaliz-gate-ok';

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function showError(msg) {
    const el = document.getElementById('gate-error');
    el.hidden = false;
    el.textContent = msg;
  }

  function hideError() {
    document.getElementById('gate-error').hidden = true;
  }

  async function verifyPassword(password, config) {
    if (config.apiBase) {
      const res = await fetch(`${config.apiBase.replace(/\/$/, '')}/gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return true;
      return false;
    }
    if (!config.passwordSha256) return false;
    const hash = await sha256(password);
    return hash === config.passwordSha256;
  }

  function unlockDownload(manifest) {
    document.getElementById('gate-panel').hidden = true;
    const downloadPanel = document.getElementById('download-panel');
    downloadPanel.hidden = false;

    const link = document.getElementById('download-link');
    const file = manifest.file || manifest.source;
    link.href = `downloads/${file}`;
    link.download = manifest.downloadName || file;
    document.getElementById('download-version').textContent = manifest.version || '-';
    document.getElementById('download-filename').textContent = file;
  }

  async function init() {
    const [configRes, manifestRes] = await Promise.all([
      fetch('gate-config.json'),
      fetch('downloads/manifest.json'),
    ]);
    const config = await configRes.json();
    const manifest = await manifestRes.json();

    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      unlockDownload(manifest);
      return;
    }

    document.getElementById('gate-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      const password = document.getElementById('gate-password').value;
      const ok = await verifyPassword(password, config);
      if (!ok) {
        showError('Admin sifresi hatali.');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, '1');
      unlockDownload(manifest);
    });
  }

  init().catch((err) => {
    showError('Yapilandirma yuklenemedi: ' + (err.message || err));
  });
})();
