'use strict';

/** macOS sürümüne göre indirme kartını vurgular. */
(function initMacOsDownloads() {
  const grid = document.getElementById('macos-download-grid');
  if (!grid) return;

  fetch('downloads/macos-manifest.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('manifest');
      return res.json();
    })
    .then((manifest) => renderCards(grid, manifest))
    .catch(() => {
      grid.innerHTML = '<p class="download-note">macOS indirme listesi yüklenemedi. Sayfayı yenileyin.</p>';
    });

  function renderCards(container, manifest) {
    container.innerHTML = '';
    for (const platform of manifest.platforms || []) {
      const href = platform.url || manifest.sourceUrl;
      const card = document.createElement('a');
      card.className = 'download-card available macos-card';
      card.href = href;
      card.download = platform.downloadName;
      if (manifest.sourceType === 'remote' || /^https?:\/\//.test(href)) {
        card.target = '_blank';
        card.rel = 'noopener';
      }
      card.dataset.platform = platform.id;
      card.innerHTML =
        '<div class="download-icon">🍎</div>' +
        '<h3>' + escapeHtml(platform.title) + '</h3>' +
        '<p><code>.dmg</code> · ' + escapeHtml(platform.note) + '</p>' +
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
      rel.textContent = 'macOS paketi su an v' + manifest.releaseVersion + ' olarak GitHub Releases uzerinden sunuluyor.';
      container.after(rel);
    }

    highlightDetectedPlatform(container);
  }

  function highlightDetectedPlatform(container) {
    const detected = detectMacPlatformSync();
    if (detected) {
      markDetected(container, detected);
    }
    if (navigator.userAgentData?.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['platformVersion']).then((v) => {
        const id = mapMacMajor(parseInt(String(v.platformVersion || '0').split('.')[0], 10));
        if (id) markDetected(container, id);
      }).catch(() => {});
    }
  }

  function markDetected(container, platformId) {
    container.querySelectorAll('.macos-card.detected').forEach((el) => el.classList.remove('detected'));
    const match = container.querySelector('[data-platform="' + platformId + '"]');
    if (match) match.classList.add('detected');
  }

  function detectMacPlatformSync() {
    const ua = navigator.userAgent || '';
    if (!/Macintosh|Mac OS X|MacIntel/.test(ua)) return null;
    if (/iPhone|iPad|iPod/.test(ua)) return null;

    const macMatch = ua.match(/Mac OS X (\d+)[_.](\d+)/);
    if (!macMatch) return null;
    const major = parseInt(macMatch[1], 10);
    const minor = parseInt(macMatch[2], 10);
    if (major === 10 && minor >= 16) return 'mac11';
    return null;
  }

  function mapMacMajor(major) {
    if (major >= 15) return 'mac15';
    if (major === 14) return 'mac14';
    if (major === 13) return 'mac13';
    if (major === 12) return 'mac12';
    if (major === 11) return 'mac11';
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
