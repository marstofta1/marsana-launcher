import { CREATE_ADDONS, CREATE_ADDON_IDS } from '../../shared/createAddons.js';
import { isMarsanaServerPackSelected } from '../../shared/modPacks.js';

// Create seçiliyken eklentileri tek tek açıp kapatma listesi. Seçim launcher'da kalıcıdır
// (yalnız bu bilgisayar); kapatılan eklenti bir sonraki OYNA'da mods/ klasöründen kaldırılır.
const STORAGE_KEY = 'marsana.createAddonsDisabled';

function loadDisabled() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => CREATE_ADDON_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

function saveDisabled(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* depolama kapalıysa yalnız bu oturumda geçerli */
  }
}

export function mountCreateAddons({ container, store, i18n }) {
  container.className = 'create-addons';
  container.innerHTML = `
    <div class="create-addons-head">
      <span class="create-addons-title" data-role="title"></span>
      <span class="create-addons-count" data-role="count"></span>
      <span class="create-addons-bulk">
        <button type="button" class="link-button" data-bulk="on"></button>
        <button type="button" class="link-button" data-bulk="off"></button>
      </span>
    </div>
    <div class="create-addons-list" data-role="list"></div>
    <p class="hint create-addons-warning" data-role="warning"></p>
  `;
  const list = container.querySelector('[data-role="list"]');

  function setDisabled(next) {
    saveDisabled(next);
    store.setState({ createAddonsDisabled: next });
  }
  container.querySelector('[data-bulk="on"]').addEventListener('click', () => setDisabled([]));
  container.querySelector('[data-bulk="off"]').addEventListener('click', () => setDisabled([...CREATE_ADDON_IDS]));

  function disabledOf(state) {
    return Array.isArray(state.createAddonsDisabled) ? state.createAddonsDisabled : [];
  }

  function render(state) {
    const visible = !!state.modCreate && !isMarsanaServerPackSelected(state);
    container.hidden = !visible;
    if (!visible) return;
    const disabled = disabledOf(state);
    container.querySelector('[data-role="title"]').textContent = i18n.t('mods.createAddons.title');
    container.querySelector('[data-role="count"]').textContent = i18n.t('mods.createAddons.count', {
      on: CREATE_ADDONS.length - disabled.length,
      total: CREATE_ADDONS.length,
    });
    container.querySelector('[data-role="warning"]').textContent = i18n.t('mods.createAddons.warning');
    container.querySelector('[data-bulk="on"]').textContent = i18n.t('mods.createAddons.allOn');
    container.querySelector('[data-bulk="off"]').textContent = i18n.t('mods.createAddons.allOff');
    list.innerHTML = CREATE_ADDONS.map(
      (a) => `
      <label class="field checkbox create-addon">
        <input type="checkbox" data-addon="${a.id}" ${disabled.includes(a.id) ? '' : 'checked'} />
        <span>${a.name}</span>
      </label>`
    ).join('');
    for (const cb of list.querySelectorAll('input[data-addon]')) {
      cb.addEventListener('change', () => {
        const id = cb.dataset.addon;
        const current = new Set(disabledOf(store.getState()));
        if (cb.checked) current.delete(id);
        else current.add(id);
        setDisabled(CREATE_ADDON_IDS.filter((x) => current.has(x)));
      });
    }
  }

  let lastKey = null;
  function update(state) {
    const key = JSON.stringify([
      !!state.modCreate,
      isMarsanaServerPackSelected(state),
      disabledOf(state),
      i18n.t('mods.createAddons.title'),
    ]);
    if (key === lastKey) return;
    lastKey = key;
    render(state);
  }

  store.setState({ createAddonsDisabled: loadDisabled() });
  update(store.getState());
  const unsubs = [
    store.subscribe(update),
    i18n.onChange(() => {
      lastKey = null;
      update(store.getState());
    }),
  ];
  return () => unsubs.forEach((u) => u());
}
