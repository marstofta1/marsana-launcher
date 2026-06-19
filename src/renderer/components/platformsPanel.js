import { otherPlatformDownloads, nativePlatformLabelKey, DOWNLOADS_BASE } from '../../shared/platformDownloads.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createPlatformsPanel({ root, openExternal, i18n, getNativePlatform }) {
  let nativePlatform = 'win32';

  async function resolveNative() {
    if (typeof getNativePlatform === 'function') {
      try {
        const p = await getNativePlatform();
        if (p) nativePlatform = p;
      } catch {
        /* ignore */
      }
    }
  }

  function render() {
    const others = otherPlatformDownloads(nativePlatform);
    const currentLabel = i18n.t(nativePlatformLabelKey(nativePlatform));

    root.innerHTML = `
      <div class="platforms-panel">
        <h3 data-role="platforms-title">${escapeHtml(i18n.t('platforms.title'))}</h3>
        <p class="platforms-intro" data-role="platforms-intro">${escapeHtml(i18n.t('platforms.intro', { current: currentLabel }))}</p>
        <div class="platforms-grid">
          ${others
            .map(
              (p) => `
            <button type="button" class="platform-tile" data-url="${escapeHtml(p.url)}" title="${escapeHtml(i18n.t(p.descKey))}">
              <span class="platform-tile-icon" aria-hidden="true">${p.icon}</span>
              <span class="platform-tile-text">
                <span class="platform-tile-label">${escapeHtml(i18n.t(p.labelKey))}</span>
                <span class="platform-tile-desc">${escapeHtml(i18n.t(p.descKey))}</span>
              </span>
              <span class="platform-tile-arrow" aria-hidden="true">↗</span>
            </button>
          `
            )
            .join('')}
        </div>
        <button type="button" class="btn ghost platforms-all-btn" data-role="all-downloads">${escapeHtml(i18n.t('platforms.allDownloads'))}</button>
      </div>
    `;

    root.querySelectorAll('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        if (url) openExternal(url);
      });
    });
    const allBtn = root.querySelector('[data-role="all-downloads"]');
    if (allBtn) {
      allBtn.addEventListener('click', () => openExternal(DOWNLOADS_BASE));
    }
  }

  async function mount() {
    await resolveNative();
    render();
    return i18n.onChange(render);
  }

  return { mount };
}
