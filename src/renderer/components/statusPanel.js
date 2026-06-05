import { isOrnitheVersionBlocked } from '../../shared/versionCompatibility.js';

const MAX_LOG_LINES = 500;

function launchFailureHint(logLines) {
  const text = (logLines || []).slice(-100).join('\n');
  if (/duplicate ASM classes/i.test(text)) {
    return 'Fabric sınıf yolu çakışması (çift ASM). Launcher güncellenince profil otomatik düzelir — tekrar Oyna.';
  }
  if (/Incompatible mods found/i.test(text)) {
    return 'Mod uyumsuzluğu — eksik bağımlılık veya sürüm çakışması. Logdaki mod adlarına bakın.';
  }
  const caused = text.match(/Caused by: ([^\n]+)/);
  if (caused) return caused[1].trim().slice(0, 220);
  const ex = text.match(/Exception in thread[^\n]*\n([^\n]+)/);
  if (ex) return ex[1].trim().slice(0, 220);
  return '';
}

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
      const { selectedLoader, selectedVersion, lastLaunchLoader, lastLaunchVersion, logLines } =
        store.getState();
      const loader = lastLaunchLoader || selectedLoader;
      const version = lastLaunchVersion || selectedVersion;
      const crashed = code === 4294967295 || code === -1;
      let statusText = loader === 'bedrock'
        ? 'Minecraft Bedrock başlatıldı.'
        : `Oyun kapandı (kod: ${code}).`;
      const hint = code === 1 || crashed ? launchFailureHint(logLines) : '';
      if (hint) statusText = `${statusText} ${hint}`;
      if (crashed && loader === 'ornithe') {
        if (isOrnitheVersionBlocked(version)) {
          statusText =
            'Ornithe bu Minecraft sürümüyle çalışmıyor (1.13.x). Lütfen 1.12.2 seçin veya Legacy Fabric kullanın.';
        } else {
          statusText =
            `Ornithe (${version}) dünya/sunucuya girerken çöktü — Ornithe 0.1.2 Calamus hatası (launcher kaynaklı değil). ` +
            'Eski sürüm modları için Modlar bölümünden Legacy Fabric deneyin.';
        }
      }
      store.setState({
        statusText,
        progressPercent: 0,
      });
    });

    return unsub;
  }

  return { mount };
}
