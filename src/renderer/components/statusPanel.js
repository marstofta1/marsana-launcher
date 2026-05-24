const MAX_LOG_LINES = 500;

export function createStatusPanel({ root, store, events }) {
  root.innerHTML = `
    <div class="status-text" data-role="text">Hazır.</div>
    <div class="progress-wrap"><div class="progress-bar" data-role="bar"></div></div>
    <pre class="log-box" data-role="log"></pre>
  `;

  const text = root.querySelector('[data-role="text"]');
  const bar = root.querySelector('[data-role="bar"]');
  const log = root.querySelector('[data-role="log"]');

  function render(state) {
    text.textContent = state.statusText || 'Hazır.';
    bar.style.width = `${(state.progressPercent || 0).toFixed(1)}%`;
    if (Array.isArray(state.logLines)) {
      log.textContent = state.logLines.join('\n');
      log.scrollTop = log.scrollHeight;
    }
  }

  function appendLog(line) {
    const current = store.getState().logLines || [];
    const next = [...current, line];
    const trimmed = next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
    store.setState({ logLines: trimmed });
  }

  function mount() {
    render(store.getState());
    const unsub = store.subscribe(render);

    events.onProgress((p) => {
      if (p && typeof p.task === 'number' && typeof p.total === 'number' && p.total > 0) {
        const pct = (p.task / p.total) * 100;
        store.setState({
          progressPercent: pct,
          statusText: `${p.type || 'indiriliyor'}: ${p.task}/${p.total}`,
        });
      }
    });
    events.onStatus((s) => {
      if (s && s.text) store.setState({ statusText: s.text });
    });
    events.onStdout((line) => appendLog(String(line)));
    events.onClose(({ code }) => {
      store.setState({
        statusText: `Oyun kapandı (kod: ${code}).`,
        progressPercent: 0,
      });
    });

    return unsub;
  }

  return { mount };
}
