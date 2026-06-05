const STORAGE_KEY = 'marsana.firstRunNoticeAcknowledged';
const VERSION = '0.1.0';

export function createFirstRunNotice({ root, i18n }) {
  function alreadyAcknowledged() {
    try {
      return localStorage.getItem(STORAGE_KEY) === VERSION;
    } catch {
      return false;
    }
  }

  function persistAcknowledgement() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      /* ignore — best effort */
    }
  }

  function render() {
    root.innerHTML = `
      <div class="modal-overlay" data-role="overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="firstRunTitle">
          <h2 id="firstRunTitle" data-role="title">${i18n.t('firstRun.title')}</h2>
          <p data-role="body1">${i18n.t('firstRun.body1')}</p>
          <p data-role="body2">${i18n.t('firstRun.body2')}</p>
          <div class="modal-actions">
            <button class="btn primary" data-role="acknowledge">${i18n.t('firstRun.acknowledge')}</button>
          </div>
        </div>
      </div>
    `;

    const overlay = root.querySelector('[data-role="overlay"]');
    const ackBtn = root.querySelector('[data-role="acknowledge"]');

    ackBtn.addEventListener('click', () => {
      persistAcknowledgement();
      overlay.remove();
    });
    ackBtn.focus();
  }

  function applyI18n() {
    const title = root.querySelector('[data-role="title"]');
    const body1 = root.querySelector('[data-role="body1"]');
    const body2 = root.querySelector('[data-role="body2"]');
    const ackBtn = root.querySelector('[data-role="acknowledge"]');
    if (!title) return;
    title.textContent = i18n.t('firstRun.title');
    body1.textContent = i18n.t('firstRun.body1');
    body2.textContent = i18n.t('firstRun.body2');
    ackBtn.textContent = i18n.t('firstRun.acknowledge');
  }

  function mount() {
    if (alreadyAcknowledged()) return;
    render();
    return i18n.onChange(applyI18n);
  }

  return { mount };
}
