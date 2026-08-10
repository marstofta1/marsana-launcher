import { isOrnitheVersionBlocked } from '../../shared/versionCompatibility.js';

const MAX_LOG_LINES = 500;

function launchFailureHint(logLines) {
  const text = (logLines || []).slice(-100).join('\n');
  if (/duplicate ASM classes/i.test(text)) {
    return 'Fabric sınıf yolu çakışması (çift ASM). Launcher güncellenince profil otomatik düzelir — tekrar Oyna.';
  }
  if (/Mixin apply for mod continuity failed|continuity\.mixins\.json/i.test(text)) {
    return 'Continuity sürümü Minecraft ile uyumsuz — launcher eski jar\'ı kaldırıp doğru sürümü indirecek.';
  }
  if (/Mixin apply for mod krypton failed|EntityTrackerEntryMixin from mod krypton/i.test(text)) {
    return 'Krypton sürümü eski (OptiFine paketi) — launcher krypton-0.2.9\'u kaldırıp güncel sürümü indirecek.';
  }
  if (/MixinTransformerError|Mixin apply for mod/i.test(text)) {
    const mod = text.match(/Mixin apply for mod (\S+)/);
    if (mod) return `Mod mixin hatası (${mod[1]}) — sürüm uyumsuzluğu olabilir.`;
  }
  if (/Incompatible mods found/i.test(text)) {
    return 'Mod uyumsuzluğu — eksik bağımlılık veya sürüm çakışması. Logdaki mod adlarına bakın.';
  }
  if (/SchematicHologramRenderer|SchematicFarmScreen|at com\.marsana\.schematicfarm/i.test(text)) {
    return 'Sematik Farm (F8) modu çöktü — güncel launcher sürümünü kurun. F8 menüsünden hologramı kapalı tutup tekrar deneyin.';
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

  let lastStatusText = '';
  let lastProgress = -1;
  let lastLogCount = 0;

  function updateStatus(state) {
    const st = state.statusText || 'Hazır.';
    if (st !== lastStatusText) {
      lastStatusText = st;
      text.textContent = st;
    }
    const pct = state.progressPercent || 0;
    if (pct !== lastProgress) {
      lastProgress = pct;
      bar.style.width = `${pct.toFixed(1)}%`;
    }
  }

  function syncLogLines(lines) {
    const arr = Array.isArray(lines) ? lines : [];
    if (arr.length === lastLogCount) return;
    if (arr.length < lastLogCount || lastLogCount === 0) {
      log.textContent = arr.join('\n');
    } else {
      log.textContent += `\n${arr.slice(lastLogCount).join('\n')}`;
    }
    lastLogCount = arr.length;
    log.scrollTop = log.scrollHeight;
  }

  function render(state) {
    updateStatus(state);
    syncLogLines(state.logLines);
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
      // Windows native crash'leri NTSTATUS hata araliginda (>= 0xC0000000) cikis
      // kodu dondurur — or. 0xCFFFFFFF (3489660927), 0xC0000005 (erisim ihlali).
      // Yalnizca 0xFFFFFFFF/-1'i degil bu araligi da crash say ki hint gosterilsin.
      const crashed =
        code === 4294967295 || code === -1 || (typeof code === 'number' && code >= 0xc0000000);
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
