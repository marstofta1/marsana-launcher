const STORAGE_KEY = 'marsana.firstRunNoticeAcknowledged';
const VERSION = '0.1.0';

export function createFirstRunNotice({ root }) {
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
          <h2 id="firstRunTitle">⚠️ Erken Sürüm Uyarısı</h2>
          <p>
            Bu Marsana Launcher'ın <strong>ilk sürümüdür</strong>; bu yüzden
            çalışmayabilir, takılabilir (lag) veya hatalı (bug) davranabilir.
          </p>
          <p>
            Geri bildirimlerin geliştirme için değerli — sorunla karşılaşırsan
            durumu not edip iletmen yeterli.
          </p>
          <div class="modal-actions">
            <button class="btn primary" data-role="acknowledge">Anladım, devam et</button>
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

  function mount() {
    if (alreadyAcknowledged()) return;
    render();
  }

  return { mount };
}
