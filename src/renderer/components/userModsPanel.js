import { isClientMode } from '../../shared/marsanaClient.js';

export function createUserModsPanel({ root, store, modsApi, i18n }) {
  root.innerHTML = `
    <h3 class="section-title" data-role="title"></h3>
    <div class="mod-drop" data-role="drop" role="button" tabindex="0">
      <strong data-role="drop-title"></strong>
      <span data-role="drop-sub"></span>
    </div>
    <ul class="mod-drop-results" data-role="results" aria-live="polite"></ul>
    <div class="user-mods-bulk" data-role="bulk" hidden>
      <button type="button" class="btn ghost" data-bulk="enableAll"></button>
      <button type="button" class="btn ghost" data-bulk="disableAll"></button>
      <button type="button" class="btn ghost user-mods-bulk-danger" data-bulk="removeAll"></button>
    </div>
    <ul class="user-mods-list" data-role="list"></ul>
  `;

  const title = root.querySelector('[data-role="title"]');
  const drop = root.querySelector('[data-role="drop"]');
  const dropTitle = root.querySelector('[data-role="drop-title"]');
  const dropSub = root.querySelector('[data-role="drop-sub"]');
  const results = root.querySelector('[data-role="results"]');
  const list = root.querySelector('[data-role="list"]');
  const bulkBar = root.querySelector('[data-role="bulk"]');
  const bulkButtons = [...root.querySelectorAll('[data-bulk]')];

  let busy = false;
  let mods = [];

  function selection(state = store.getState()) {
    return {
      loader: state.selectedLoader || 'vanilla',
      gameVersion: state.selectedVersion || '',
      playMode: state.playMode,
    };
  }

  function applyLabels() {
    title.textContent = i18n.t('userMods.title');
    dropTitle.textContent = busy ? i18n.t('userMods.adding') : i18n.t('userMods.dropTitle');
    dropSub.textContent = i18n.t('userMods.dropSub');
    drop.classList.toggle('busy', busy);
    for (const btn of bulkButtons) btn.textContent = i18n.t(`userMods.bulk.${btn.dataset.bulk}.label`);
  }

  // Mod adı / sürümü dosyanın içinden gelir (güvenilmez): yalnızca textContent ile yazılır.
  function renderList() {
    list.textContent = '';
    bulkBar.hidden = mods.length === 0;
    for (const mod of mods) {
      const li = document.createElement('li');
      li.className = `user-mod-item${mod.active ? '' : ' inactive'}`;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `btn ghost user-mod-toggle${mod.enabled ? '' : ' is-off'}`;
      toggle.textContent = i18n.t(mod.enabled ? 'userMods.disable' : 'userMods.enable');
      toggle.title = i18n.t(mod.enabled ? 'userMods.turnOff' : 'userMods.turnOn');
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        await modsApi.setEnabled(mod.file, !mod.enabled);
        refresh();
      });

      const info = document.createElement('div');
      info.className = 'user-mod-info';
      const name = document.createElement('strong');
      name.textContent = `${mod.name}${mod.version ? ` ${mod.version}` : ''}`;
      const meta = document.createElement('span');
      meta.className = 'user-mod-meta';
      meta.textContent = mod.active
        ? `${mod.loaderLabel} — ${i18n.t('userMods.active')}`
        : `${mod.loaderLabel} — ${mod.reason}`;
      info.append(name, meta);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn ghost user-mod-remove';
      removeBtn.textContent = i18n.t('userMods.remove');
      removeBtn.title = i18n.t('userMods.removeTitle');
      removeBtn.addEventListener('click', async () => {
        await modsApi.remove(mod.file);
        // Önceki "eklendi" mesajları kaldırılan modu hâlâ varmış gibi gösterirdi.
        results.textContent = '';
        refresh();
      });

      li.append(info, toggle, removeBtn);
      list.appendChild(li);
    }
  }

  function showResults(items) {
    results.textContent = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = item.ok ? 'ok' : 'error';
      li.textContent = `${item.name ? `${item.name}: ` : ''}${item.message}`;
      results.appendChild(li);
      const notes = item.ok
        ? [item.notLoading && i18n.t('userMods.notLoading', { reason: item.notLoading }), item.warning]
        : [];
      for (const note of notes.filter(Boolean)) {
        const warn = document.createElement('li');
        warn.className = 'warn';
        warn.textContent = note;
        results.appendChild(warn);
      }
    }
  }

  let refreshSeq = 0;
  async function refresh() {
    const seq = ++refreshSeq;
    try {
      const next = await modsApi.list(selection());
      if (seq !== refreshSeq) return;
      mods = Array.isArray(next) ? next : [];
    } catch {
      mods = [];
    }
    renderList();
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    applyLabels();
    try {
      const items = await task();
      if (Array.isArray(items) && items.length > 0) showResults(items);
    } catch (err) {
      showResults([{ ok: false, message: i18n.t('userMods.failed', { error: err?.message || String(err) }) }]);
    } finally {
      busy = false;
      applyLabels();
      refresh();
    }
  }

  function addDropped(files) {
    if (!files.length) {
      showResults([{ ok: false, message: i18n.t('userMods.noFile') }]);
      return;
    }
    const filePaths = [];
    const unreadable = [];
    for (const file of files) {
      const filePath = modsApi.pathForFile(file);
      if (filePath) filePaths.push(filePath);
      else unreadable.push({ ok: false, name: file.name, message: i18n.t('userMods.noPath') });
    }
    run(async () => [...unreadable, ...(filePaths.length ? await modsApi.add(filePaths, selection()) : [])]);
  }

  for (const btn of bulkButtons) {
    btn.addEventListener('click', () => {
      const action = btn.dataset.bulk;
      const key = `userMods.bulk.${action}`;
      run(async () => {
        const outcome = await modsApi.bulk({
          action,
          title: i18n.t(`${key}.label`),
          confirm: i18n.t(`${key}.confirm`, { count: mods.length }),
          confirmAgain: i18n.t('userMods.bulk.confirmAgain'),
          yes: i18n.t('userMods.bulk.yes'),
          no: i18n.t('userMods.bulk.no'),
        });
        if (!outcome || !outcome.confirmed) return [];
        return [{ ok: true, message: i18n.t(`${key}.done`, { count: outcome.count }) }];
      });
    });
  }

  drop.addEventListener('click', () => run(() => modsApi.pick(selection())));
  drop.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    run(() => modsApi.pick(selection()));
  });
  drop.addEventListener('dragenter', () => drop.classList.add('dragover'));
  drop.addEventListener('dragover', () => drop.classList.add('dragover'));
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    drop.classList.remove('dragover');
    addDropped([...(e.dataTransfer?.files || [])]);
  });

  // Alanın dışına bırakılan dosya pencereyi o dosyaya yönlendirmesin (launcher arayüzü kaybolurdu).
  function blockWindowDrop(e) {
    e.preventDefault();
  }

  function selectionKey(state) {
    return [state.selectedLoader, state.selectedVersion, state.playMode].join('\0');
  }

  function mount() {
    applyLabels();
    root.style.display = isClientMode(store.getState().playMode) ? 'none' : '';
    refresh();
    window.addEventListener('dragover', blockWindowDrop);
    window.addEventListener('drop', blockWindowDrop);
    let lastKey = selectionKey(store.getState());
    const unsubs = [
      store.subscribe((state) => {
        const key = selectionKey(state);
        if (key === lastKey) return;
        lastKey = key;
        root.style.display = isClientMode(state.playMode) ? 'none' : '';
        refresh();
      }),
      i18n.onChange(() => {
        applyLabels();
        renderList();
      }),
      () => {
        window.removeEventListener('dragover', blockWindowDrop);
        window.removeEventListener('drop', blockWindowDrop);
      },
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
