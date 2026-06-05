export function wireUpdateFlow({ button, overlay, updates, i18n }) {
  const titleEl = overlay.querySelector('[data-role="title"]');
  const messageEl = overlay.querySelector('[data-role="message"]');
  const barWrap = overlay.querySelector('[data-role="progress-wrap"]');
  const bar = overlay.querySelector('[data-role="bar"]');
  const dismiss = overlay.querySelector('[data-role="dismiss"]');

  function setButtonMode({ available, version }) {
    if (available) {
      button.textContent = i18n.t('update.labelUpdate');
      button.title = version
        ? i18n.t('update.updateAvailable', { version })
        : i18n.t('update.downloadUpdate');
      button.classList.add('has-update');
      return;
    }
    button.textContent = i18n.t('update.labelRestart');
    button.title = i18n.t('update.restartLauncher');
    button.classList.remove('has-update');
  }

  async function refreshUpdateButtonLabel() {
    try {
      const res = await updates.check();
      if (res && res.ok) {
        setButtonMode({ available: !!res.available, version: res.version });
        return;
      }
    } catch {
      /* ignore */
    }
    setButtonMode({ available: false });
  }

  function applyPhase(payload) {
    if (!payload) return;
    const { phase, message, percent } = payload;

    if (phase === 'error') {
      overlay.classList.add('is-error');
      titleEl.textContent = i18n.t('update.titleError');
      messageEl.textContent = message || i18n.t('update.unknownError');
      barWrap.style.display = 'none';
      dismiss.classList.remove('hidden');
      overlay.setAttribute('aria-busy', 'false');
      return;
    }

    overlay.classList.remove('is-error');
    dismiss.classList.add('hidden');
    titleEl.textContent = i18n.t('update.title');
    messageEl.textContent = message || '';

    if (phase === 'downloading') {
      barWrap.style.display = 'block';
      const p = typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : 0;
      bar.style.width = `${p}%`;
    } else {
      barWrap.style.display = 'none';
      bar.style.width = '0%';
    }
  }

  function closeOverlay() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-error');
    dismiss.classList.add('hidden');
    button.disabled = false;
  }

  dismiss.addEventListener('click', () => {
    closeOverlay();
  });

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    overlay.classList.remove('hidden', 'is-error');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-busy', 'true');
    dismiss.classList.add('hidden');
    titleEl.textContent = i18n.t('update.title');
    messageEl.textContent = i18n.t('update.starting');
    barWrap.style.display = 'none';
    bar.style.width = '0%';

    const offPhase = updates.onPhase((p) => applyPhase(p));

    try {
      const res = await updates.run();
      if (!res || !res.ok) {
        applyPhase({ phase: 'error', message: (res && res.message) || i18n.t('update.failed') });
        offPhase();
        return;
      }
      if (res.willRelaunch || res.willInstall) {
        offPhase();
        return;
      }
    } catch (err) {
      applyPhase({
        phase: 'error',
        message: err && err.message ? err.message : String(err),
      });
      offPhase();
      return;
    }

    offPhase();
    closeOverlay();
    refreshUpdateButtonLabel();
  });

  setButtonMode({ available: false });
  void refreshUpdateButtonLabel();
  i18n.onChange(refreshUpdateButtonLabel);
}
