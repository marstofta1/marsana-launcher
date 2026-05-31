'use strict';

/** Windows sürümüne göre indirme kartını vurgular. */
(function initWindowsDownloads() {
  const grid = document.getElementById('windows-download-grid');
  if (!grid) return;

  fetch('downloads/windows-manifest.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('manifest');
      return res.json();
    })
    .then((manifest) => renderCards(grid, manifest))
    .catch(() => {
      grid.innerHTML = '<p class="download-note">Windows indirme listesi yüklenemedi. Sayfayı yenileyin.</p>';
    });

  function renderCards(container, manifest) {
    container.innerHTML = '';
    for (const platform of manifest.platforms || []) {
      const href = 'downloads/' + encodeURIComponent(platform.file);
      const card = document.createElement('a');
      card.className = 'download-card available windows-card';
      card.href = href;
      card.download = platform.downloadName;
      card.dataset.platform = platform.id;
      card.innerHTML =
        '<div class="download-icon">🪟</div>' +
        '<h3>' + escapeHtml(platform.title) + '</h3>' +
        '<p><code>.exe</code> kurucu · ' + escapeHtml(platform.note) + '</p>' +
        '<span class="dl-badge ' + escapeHtml(platform.badgeClass || 'ready') + '">' +
        escapeHtml(platform.badge) + '</span>';
      container.appendChild(card);
    }

    if (manifest.note) {
      const note = document.createElement('p');
      note.className = 'windows-manifest-note';
      note.textContent = manifest.note;
      container.after(note);
    }

    highlightDetectedPlatform(container);
    if (window.MarsanaAnalytics) MarsanaAnalytics.bindDownloadCards(container, manifest);
  }

  function highlightDetectedPlatform(container) {
    const detected = detectWindowsPlatform();
    if (!detected) return;
    markDetected(container, detected);
    if (detected === 'win10' && navigator.userAgentData?.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['platformVersion']).then((v) => {
        const major = parseInt(String(v.platformVersion || '0').split('.')[0], 10);
        if (major >= 13) markDetected(container, 'win11');
      }).catch(() => {});
    }
  }

  function markDetected(container, platformId) {
    container.querySelectorAll('.windows-card.detected').forEach((el) => el.classList.remove('detected'));
    const match = container.querySelector('[data-platform="' + platformId + '"]');
    if (match) match.classList.add('detected');
  }

  function detectWindowsPlatform() {
    const ua = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const hay = (ua + ' ' + platform).toLowerCase();
    if (!hay.includes('win')) return null;
    if (/windows nt 10\.0/.test(hay)) return 'win10';
    if (/windows nt 6\.3/.test(hay)) return 'win81';
    if (/windows nt 6\.[12]/.test(hay)) return 'win81';
    if (/windows nt 6\.1/.test(hay)) return 'win7';
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
