const STORAGE_KEY = 'marsana.settings.v1';

// Otomatik tema penceresi: bu saat aralığında gündüz, dışında gece.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 19;

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'night',           // 'night' | 'day' | 'auto'
  masterVolume: 100,        // 0-100
  musicVolume: 50,          // 0-100
  animations: true,
});

export function resolveAutoTheme(date = new Date()) {
  const h = date.getHours();
  return h >= DAY_START_HOUR && h < DAY_END_HOUR ? 'day' : 'night';
}

export function effectiveTheme(settings) {
  if (!settings) return 'night';
  if (settings.theme === 'auto') return resolveAutoTheme();
  return settings.theme || 'night';
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* best effort */
  }
}

// Tema, animasyon vb. çevresel ayarları DOM'a uygula. Otomatik temada gerçek
// saatin getirdiği renge göre body class set edilir.
export function applyAmbientSettings(settings) {
  const body = document.body;
  if (effectiveTheme(settings) === 'day') body.classList.add('theme-day');
  else body.classList.remove('theme-day');

  if (settings.animations) body.classList.remove('no-animations');
  else body.classList.add('no-animations');
}

// Auto modda saat geçişlerini takip eder — dakikada bir tema'yı yeniden
// hesaplar. Önceki watcher varsa temizlenir; null verilirse durdurulur.
let autoThemeIntervalId = null;
export function startAutoThemeWatcher(store) {
  if (autoThemeIntervalId) clearInterval(autoThemeIntervalId);
  if (!store) {
    autoThemeIntervalId = null;
    return;
  }
  autoThemeIntervalId = setInterval(() => {
    const s = store.getState().settings;
    if (s && s.theme === 'auto') applyAmbientSettings(s);
  }, 60 * 1000);
}

export function wireSettingsModal({ button, modalRoot, store }) {
  function render() {
    const s = store.getState().settings || { ...DEFAULT_SETTINGS };
    modalRoot.innerHTML = `
      <div class="modal-overlay" data-role="overlay">
        <div class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
          <h2 id="settingsTitle">Ayarlar</h2>

          <div class="settings-group">
            <span class="settings-group-label">Tema</span>
            <div class="settings-row settings-theme-row">
              <label class="settings-toggle ${s.theme === 'night' ? 'active' : ''}" data-role="theme-night">
                <span class="settings-toggle-icon">🌙</span>
                <span>Gece</span>
              </label>
              <label class="settings-toggle ${s.theme === 'day' ? 'active' : ''}" data-role="theme-day">
                <span class="settings-toggle-icon">☀️</span>
                <span>Gündüz</span>
              </label>
              <label class="settings-toggle ${s.theme === 'auto' ? 'active' : ''}" data-role="theme-auto">
                <span class="settings-toggle-icon">🕒</span>
                <span>Otomatik</span>
              </label>
            </div>
            <p class="settings-hint">
              Otomatik: ${DAY_START_HOUR.toString().padStart(2, '0')}:00 — ${DAY_END_HOUR.toString().padStart(2, '0')}:00 arası gündüz, dışı gece (cihaz saatine göre).
            </p>
          </div>

          <div class="settings-group">
            <span class="settings-group-label">Ana Ses</span>
            <div class="settings-slider-row">
              <input type="range" min="0" max="100" step="1" value="${s.masterVolume}" data-role="masterVolume" />
              <span class="settings-slider-value" data-role="masterVolume-val">${s.masterVolume}%</span>
            </div>
            <p class="settings-hint">Minecraft içindeki tüm sesleri etkiler.</p>
          </div>

          <div class="settings-group">
            <span class="settings-group-label">Müzik Sesi</span>
            <div class="settings-slider-row">
              <input type="range" min="0" max="100" step="1" value="${s.musicVolume}" data-role="musicVolume" />
              <span class="settings-slider-value" data-role="musicVolume-val">${s.musicVolume}%</span>
            </div>
            <p class="settings-hint">Arka plan müziği; ana sesin altında uygulanır.</p>
          </div>

          <div class="settings-group">
            <label class="settings-checkbox">
              <input type="checkbox" data-role="animations" ${s.animations ? 'checked' : ''} />
              <span>Animasyonlar açık</span>
            </label>
            <p class="settings-hint">Yumuşak geçişler ve hover efektleri.</p>
          </div>

          <div class="modal-actions">
            <button class="btn ghost" data-role="cancel">Kapat</button>
            <button class="btn primary" data-role="save">Kaydet</button>
          </div>
        </div>
      </div>
    `;

    const overlay = modalRoot.querySelector('[data-role="overlay"]');
    const masterSlider = modalRoot.querySelector('[data-role="masterVolume"]');
    const masterVal = modalRoot.querySelector('[data-role="masterVolume-val"]');
    const musicSlider = modalRoot.querySelector('[data-role="musicVolume"]');
    const musicVal = modalRoot.querySelector('[data-role="musicVolume-val"]');
    const animationsCb = modalRoot.querySelector('[data-role="animations"]');
    const themeNight = modalRoot.querySelector('[data-role="theme-night"]');
    const themeDay = modalRoot.querySelector('[data-role="theme-day"]');
    const themeAuto = modalRoot.querySelector('[data-role="theme-auto"]');
    const cancelBtn = modalRoot.querySelector('[data-role="cancel"]');
    const saveBtn = modalRoot.querySelector('[data-role="save"]');

    // Çalışma kopyası — kullanıcı kaydetmeden değişiklikleri görsün
    let draft = { ...s };

    function setDraft(patch) {
      draft = { ...draft, ...patch };
      // Tema değişikliğini canlı önizle (kaydetmese bile geri alabilir)
      applyAmbientSettings(draft);
    }

    masterSlider.addEventListener('input', () => {
      const v = parseInt(masterSlider.value, 10);
      masterVal.textContent = `${v}%`;
      setDraft({ masterVolume: v });
    });
    musicSlider.addEventListener('input', () => {
      const v = parseInt(musicSlider.value, 10);
      musicVal.textContent = `${v}%`;
      setDraft({ musicVolume: v });
    });
    animationsCb.addEventListener('change', () => {
      setDraft({ animations: animationsCb.checked });
    });
    function selectTheme(value, el) {
      themeNight.classList.toggle('active', el === themeNight);
      themeDay.classList.toggle('active', el === themeDay);
      themeAuto.classList.toggle('active', el === themeAuto);
      setDraft({ theme: value });
    }
    themeNight.addEventListener('click', (e) => {
      e.preventDefault();
      selectTheme('night', themeNight);
    });
    themeDay.addEventListener('click', (e) => {
      e.preventDefault();
      selectTheme('day', themeDay);
    });
    themeAuto.addEventListener('click', (e) => {
      e.preventDefault();
      selectTheme('auto', themeAuto);
    });

    function close(restorePrevious) {
      if (restorePrevious) {
        applyAmbientSettings(s);
      }
      overlay.remove();
    }

    cancelBtn.addEventListener('click', () => close(true));
    saveBtn.addEventListener('click', () => {
      saveSettings(draft);
      store.setState({ settings: draft });
      applyAmbientSettings(draft);
      close(false);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(true);
    });
  }

  button.addEventListener('click', render);
}
