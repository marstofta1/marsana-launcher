'use strict';

/** Android sürümüne göre indirme kartını vurgular. */
(function initAndroidDownloads() {
  const grid = document.getElementById('android-download-grid');
  if (!grid) return;

  fetch('downloads/android-manifest.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('manifest');
      return res.json();
    })
    .then((manifest) => renderCards(grid, manifest))
    .catch(() => {
      grid.innerHTML = '<p class="download-note">Android indirme listesi yüklenemedi. Sayfayı yenileyin.</p>';
    });

  function renderCards(container, manifest) {
    container.innerHTML = '';
    for (const platform of manifest.platforms || []) {
      const href = platform.url || manifest.sourceUrl;
      const card = document.createElement('a');
      card.className = 'download-card available android-card';
      card.href = href;
      card.download = platform.downloadName;
      if (manifest.sourceType === 'remote' || /^https?:\/\//.test(href)) {
        card.target = '_blank';
        card.rel = 'noopener';
      }
      card.dataset.platform = platform.id;
      card.innerHTML =
        '<div class="download-icon">🤖</div>' +
        '<h3>' + escapeHtml(platform.title) + '</h3>' +
        '<p><code>.apk</code> · ' + escapeHtml(platform.note) + '</p>' +
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
      rel.textContent = 'Android paketi su an v' + manifest.releaseVersion + ' olarak GitHub Releases uzerinden sunuluyor.';
      container.after(rel);
    }

    highlightDetectedVersion(container);
    if (window.MarsanaAnalytics) MarsanaAnalytics.bindDownloadCards(container, manifest);
  }

  function highlightDetectedVersion(container) {
    const detected = detectAndroidVersion();
    if (detected) markDetected(container, detected);
  }

  function markDetected(container, platformId) {
    container.querySelectorAll('.android-card.detected').forEach((el) => el.classList.remove('detected'));
    const match = container.querySelector('[data-platform="' + platformId + '"]');
    if (match) match.classList.add('detected');
  }

  function detectAndroidVersion() {
    const ua = navigator.userAgent || '';
    const match = ua.match(/Android\s+(\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const major = parseInt(match[1], 10);
    if (major >= 16) return 'android16';
    if (major === 15) return 'android15';
    if (major === 14) return 'android14';
    if (major === 13) return 'android13';
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
