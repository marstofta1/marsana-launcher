'use strict';

/** Linux dağıtımına göre indirme kartını vurgular. */
(function initLinuxDownloads() {
  const grid = document.getElementById('linux-download-grid');
  if (!grid) return;

  fetch('downloads/linux-manifest.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('manifest');
      return res.json();
    })
    .then((manifest) => renderCards(grid, manifest))
    .catch(() => {
      grid.innerHTML = '<p class="download-note">Linux indirme listesi yüklenemedi. Sayfayı yenileyin.</p>';
    });

  function renderCards(container, manifest) {
    container.innerHTML = '';
    for (const platform of manifest.platforms || []) {
      const href = platform.url || manifest.sourceUrl;
      const card = document.createElement('a');
      card.className = 'download-card available linux-card';
      card.href = href;
      card.download = platform.downloadName;
      if (manifest.sourceType === 'remote' || /^https?:\/\//.test(href)) {
        card.target = '_blank';
        card.rel = 'noopener';
      }
      card.dataset.platform = platform.id;
      card.innerHTML =
        '<div class="download-icon">🐧</div>' +
        '<h3>' + escapeHtml(platform.title) + '</h3>' +
        '<p><code>.AppImage</code> · ' + escapeHtml(platform.note) + '</p>' +
        '<span class="dl-badge ' + escapeHtml(platform.badgeClass || 'ready') + '">' +
        escapeHtml(platform.badge) + '</span>';
      container.appendChild(card);
    }

    if (manifest.note) {
      const note = document.createElement('p');
      note.className = 'platform-manifest-note';
      note.textContent = manifest.note;
      container.after(note);
    }

    if (manifest.releaseVersion && manifest.releaseVersion !== manifest.version) {
      const rel = document.createElement('p');
      rel.className = 'platform-manifest-note';
      rel.textContent = 'Linux paketi su an v' + manifest.releaseVersion + ' olarak GitHub Releases uzerinden sunuluyor.';
      container.after(rel);
    }

    highlightDetectedDistro(container);
  }

  function highlightDetectedDistro(container) {
    const detected = detectLinuxDistro();
    if (detected) markDetected(container, detected);
  }

  function markDetected(container, platformId) {
    container.querySelectorAll('.linux-card.detected').forEach((el) => el.classList.remove('detected'));
    const match = container.querySelector('[data-platform="' + platformId + '"]');
    if (match) match.classList.add('detected');
  }

  function detectLinuxDistro() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (!/linux/.test(ua) && !/x11/.test(ua)) return null;

    if (ua.includes('ubuntu')) return 'ubuntu';
    if (ua.includes('mint')) return 'mint';
    if (ua.includes('debian')) return 'debian';
    if (ua.includes('fedora')) return 'fedora';
    if (ua.includes('manjaro')) return 'manjaro';
    if (ua.includes('mx linux') || ua.includes('mxlinux')) return 'mxlinux';
    if (ua.includes('solus')) return 'solus';
    if (ua.includes('elementary')) return 'elementary';

    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
