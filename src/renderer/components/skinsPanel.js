// Hazır skin galerisi + kendi PNG'ni yükleme. Seçim main process'te skinService'e gider:
// Microsoft hesabında Mojang'a yüklenir, çevrimdışı oyunda kaynak paketiyle uygulanır.

const PRESET_ORDER = ['ninja', 'astronaut', 'knight', 'robot', 'pirate', 'frost-mage', 'miner', 'hoodie'];
const PREVIEW_SCALE = 3;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 64x64 skin'in önden görünüşünü (16x32) tuvale çizer; şapka/ceket katmanları dahil. */
function drawFrontView(canvas, src) {
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = PREVIEW_SCALE;
    const blit = (sx, sy, w, h, dx, dy) => ctx.drawImage(img, sx, sy, w, h, dx * s, dy * s, w * s, h * s);
    blit(8, 8, 8, 8, 4, 0); // kafa
    blit(20, 20, 8, 12, 4, 8); // gövde
    blit(44, 20, 4, 12, 0, 8); // sağ kol
    blit(36, 52, 4, 12, 12, 8); // sol kol
    blit(4, 20, 4, 12, 4, 20); // sağ bacak
    blit(20, 52, 4, 12, 8, 20); // sol bacak
    // Dış katmanlar (şapka, ceket, kollar, paçalar).
    blit(40, 8, 8, 8, 4, 0);
    blit(20, 36, 8, 12, 4, 8);
    blit(44, 36, 4, 12, 0, 8);
    blit(52, 52, 4, 12, 12, 8);
    blit(4, 36, 4, 12, 4, 20);
    blit(4, 52, 4, 12, 8, 20);
  };
  img.src = src;
}

export function createSkinsPanel({ root, store, skinsApi, i18n }) {
  let state = null;
  let busy = false;
  let message = '';
  let messageKind = '';

  root.innerHTML = `
    <div class="skins-panel">
      <div class="skins-header">
        <h3 data-role="title"></h3>
        <button type="button" class="btn ghost skins-upload" data-role="upload"></button>
      </div>
      <p class="hint skins-lead" data-role="lead"></p>
      <div class="skins-grid" data-role="grid"></div>
      <p class="skins-message" data-role="message" aria-live="polite"></p>
    </div>
  `;
  const grid = root.querySelector('[data-role="grid"]');
  const msgEl = root.querySelector('[data-role="message"]');
  const uploadBtn = root.querySelector('[data-role="upload"]');

  function selectionKey(sel) {
    if (!sel) return 'default';
    if (sel.kind === 'preset') return `preset:${sel.presetId}`;
    return sel.kind;
  }

  function tiles() {
    const available = new Set((state && state.presets) || []);
    const list = [{ key: 'default', label: i18n.t('skins.default'), src: null }];
    if (state && state.customDataUrl) {
      list.push({ key: 'custom', label: i18n.t('skins.custom'), src: state.customDataUrl });
    }
    for (const id of PRESET_ORDER) {
      if (!available.has(id)) continue;
      list.push({ key: `preset:${id}`, label: i18n.t(`skins.presets.${id}`), src: `assets/skins/${id}.png` });
    }
    return list;
  }

  function render() {
    root.querySelector('[data-role="title"]').textContent = i18n.t('skins.title');
    root.querySelector('[data-role="lead"]').textContent = i18n.t(
      state && state.hasJavaAccount ? 'skins.leadMicrosoft' : 'skins.leadOffline'
    );
    uploadBtn.textContent = i18n.t('skins.upload');
    uploadBtn.disabled = busy;

    const selected = selectionKey(state && state.selection);
    grid.innerHTML = tiles()
      .map(
        (t) => `
        <button type="button" class="skin-tile${t.key === selected ? ' selected' : ''}" data-key="${escapeHtml(t.key)}" ${busy ? 'disabled' : ''} title="${escapeHtml(t.label)}">
          <span class="skin-preview">
            ${t.src ? `<canvas width="${16 * PREVIEW_SCALE}" height="${32 * PREVIEW_SCALE}" data-src="${escapeHtml(t.src)}"></canvas>` : '<span class="skin-preview-default">?</span>'}
          </span>
          <span class="skin-label">${escapeHtml(t.label)}</span>
        </button>`
      )
      .join('');
    for (const canvas of grid.querySelectorAll('canvas[data-src]')) drawFrontView(canvas, canvas.dataset.src);
    for (const btn of grid.querySelectorAll('.skin-tile')) {
      btn.addEventListener('click', () => choose(btn.dataset.key));
    }

    msgEl.textContent = message;
    msgEl.className = `skins-message${messageKind ? ` ${messageKind}` : ''}`;
  }

  function describeResult(result) {
    const isDefault = result.selection && result.selection.kind === 'default';
    if (result.uploaded) return [i18n.t(isDefault ? 'skins.resetUploaded' : 'skins.uploaded'), 'ok'];
    if (result.uploadError) return [i18n.t('skins.uploadFailed', { error: result.uploadError }), 'warn'];
    return [i18n.t(isDefault ? 'skins.resetLocal' : 'skins.appliedLocal'), 'ok'];
  }

  async function run(work) {
    if (busy) return;
    busy = true;
    message = i18n.t('skins.applying');
    messageKind = '';
    render();
    try {
      const result = await work();
      if (result) {
        state = result;
        [message, messageKind] = describeResult(result);
      } else {
        message = '';
      }
    } catch (err) {
      message = i18n.t('skins.error', { error: (err && err.message ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') });
      messageKind = 'warn';
    } finally {
      busy = false;
      render();
    }
  }

  function choose(key) {
    if (key === selectionKey(state && state.selection)) return;
    if (key === 'default') return run(() => skinsApi.selectDefault());
    if (key === 'custom') return run(() => skinsApi.selectCustom());
    if (key.startsWith('preset:')) return run(() => skinsApi.selectPreset(key.slice('preset:'.length)));
    return undefined;
  }

  uploadBtn.addEventListener('click', () => run(() => skinsApi.pickCustom()));

  async function refreshState() {
    try {
      state = await skinsApi.state();
    } catch (err) {
      console.error('[skins] durum okunamadı', err);
    }
    render();
  }

  async function mount() {
    render();
    await refreshState();
    let lastUser = store.getState().user;
    const unsubs = [
      store.subscribe((s) => {
        if (s.user === lastUser) return;
        lastUser = s.user;
        refreshState();
      }),
      i18n.onChange(render),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
