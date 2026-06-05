const GUIDE_STEP_COUNT = 8;

const SPEECH_LANG = {
  tr: 'tr-TR',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  it: 'it-IT',
  ru: 'ru-RU',
};

function guidePlainText(t) {
  const intro = t('guide.plainIntro');
  const steps = [];
  for (let n = 1; n <= GUIDE_STEP_COUNT; n += 1) {
    steps.push(`${t(`guide.s${n}Title`)}. ${t(`guide.s${n}Body`)}`);
  }
  return `${intro} ${steps.join(' ')}`;
}

function pickVoiceForLocale(locale) {
  const lang = SPEECH_LANG[locale] || SPEECH_LANG.tr;
  const prefix = lang.split('-')[0].toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(prefix));
  if (matching.length > 0) {
    return matching.find((v) => v.localService) || matching[0];
  }
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) || null;
}

export function wireHowToPlayGuide({ button, modalRoot, i18n }) {
  let utterance = null;
  let speaking = false;

  function stopSpeech() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speaking = false;
    updateListenButton();
  }

  function updateListenButton() {
    const listenBtn = modalRoot.querySelector('[data-role="listen"]');
    if (!listenBtn) return;
    if (!window.speechSynthesis) {
      listenBtn.disabled = true;
      listenBtn.title = i18n.t('guide.speechUnsupported');
      return;
    }
    listenBtn.disabled = false;
    listenBtn.title = '';
    listenBtn.textContent = speaking ? i18n.t('guide.stopListen') : i18n.t('guide.listen');
    listenBtn.setAttribute('aria-pressed', speaking ? 'true' : 'false');
  }

  function startSpeech() {
    if (!window.speechSynthesis) return;
    stopSpeech();
    const locale = i18n.getLocale();
    const text = guidePlainText(i18n.t);
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG[locale] || 'tr-TR';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = pickVoiceForLocale(locale);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      speaking = true;
      updateListenButton();
    };
    utterance.onend = () => {
      speaking = false;
      updateListenButton();
    };
    utterance.onerror = () => {
      speaking = false;
      updateListenButton();
    };

    window.speechSynthesis.speak(utterance);
  }

  function renderSectionsHtml() {
    const sections = [];
    for (let n = 1; n <= GUIDE_STEP_COUNT; n += 1) {
      sections.push(`
        <section class="guide-section">
          <h3>${i18n.t(`guide.s${n}Title`)}</h3>
          <p>${i18n.t(`guide.s${n}Body`)}</p>
        </section>
      `);
    }
    return sections.join('');
  }

  let escapeHandler = null;

  function closeModal() {
    stopSpeech();
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
    modalRoot.innerHTML = '';
    modalRoot.setAttribute('aria-hidden', 'true');
  }

  function applyModalI18n() {
    const title = modalRoot.querySelector('#howToPlayTitle');
    const intro = modalRoot.querySelector('.guide-intro');
    const body = modalRoot.querySelector('[data-role="body"]');
    const closeBtn = modalRoot.querySelector('[data-role="close"]');
    if (!title) return;
    title.textContent = i18n.t('guide.title');
    intro.textContent = i18n.t('guide.intro');
    body.innerHTML = renderSectionsHtml();
    closeBtn.textContent = i18n.t('common.close');
    updateListenButton();
  }

  function openModal() {
    modalRoot.setAttribute('aria-hidden', 'false');
    modalRoot.innerHTML = `
      <div class="modal-overlay" data-role="overlay">
        <div class="modal modal-guide" role="dialog" aria-modal="true" aria-labelledby="howToPlayTitle">
          <h2 id="howToPlayTitle">${i18n.t('guide.title')}</h2>
          <p class="guide-intro">
            ${i18n.t('guide.intro')}
          </p>
          <div class="guide-body" data-role="body">
            ${renderSectionsHtml()}
          </div>
          <div class="modal-actions guide-actions">
            <button type="button" class="btn ghost" data-role="listen">${i18n.t('guide.listen')}</button>
            <button type="button" class="btn primary" data-role="close">${i18n.t('common.close')}</button>
          </div>
        </div>
      </div>
    `;

    const overlay = modalRoot.querySelector('[data-role="overlay"]');
    const listenBtn = modalRoot.querySelector('[data-role="listen"]');
    const closeBtn = modalRoot.querySelector('[data-role="close"]');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);
    listenBtn.addEventListener('click', () => {
      if (speaking) stopSpeech();
      else startSpeech();
    });

    escapeHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escapeHandler);

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => updateListenButton();
    }
    updateListenButton();
    closeBtn.focus();
  }

  button.addEventListener('click', openModal);
  i18n.onChange(() => {
    if (modalRoot.querySelector('[data-role="overlay"]')) {
      applyModalI18n();
    }
  });

  return { close: closeModal };
}
