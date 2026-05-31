'use strict';

/** Indirme sitesi kart tiklamalarini analiz sunucusuna bildirir. */
window.MarsanaAnalytics = {
  sendDownload(platformId, endpoint) {
    if (!endpoint || !platformId) return;
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformId,
        userAgent: navigator.userAgent || '',
      }),
      keepalive: true,
    }).catch(() => {});
  },

  bindDownloadCards(container, manifest) {
    const url = manifest && manifest.analyticsDownloadUrl;
    if (!url || !container) return;
    container.querySelectorAll('[data-platform]').forEach((el) => {
      el.addEventListener('click', () => {
        MarsanaAnalytics.sendDownload(el.dataset.platform, url);
      });
    });
  },
};
