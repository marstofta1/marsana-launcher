const MIN_VISIBLE_MS = 900;
const FADE_MS = 420;

let shownAt = 0;

export function initBootSplash() {
  shownAt = Date.now();
  const status = document.getElementById('boot-splash-status');
  if (status) status.textContent = 'Marsana Launcher';
}

export function setBootSplashStatus(text) {
  const status = document.getElementById('boot-splash-status');
  if (status && text) status.textContent = text;
}

export function dismissBootSplash() {
  const el = document.getElementById('boot-splash');
  if (!el || el.classList.contains('boot-splash-hide')) return;

  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  window.setTimeout(() => {
    el.classList.add('boot-splash-hide');
    window.setTimeout(() => {
      el.remove();
    }, FADE_MS);
  }, wait);
}
