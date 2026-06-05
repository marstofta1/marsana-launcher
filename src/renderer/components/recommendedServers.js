const SERVER_SEARCH_URL = 'https://topminecraftservers.org/#google_vignette';

function primaryActionFor(server, t) {
  if (server.provider === 'aternos' && server.providerDashboardUrl) {
    return { label: t('servers.wake'), url: server.providerDashboardUrl };
  }
  if (server.websiteUrl) {
    return { label: t('servers.website'), url: server.websiteUrl };
  }
  return null;
}

function renderServerCard(server, { onCopyAddress, onOpenExternal, t }) {
  const card = document.createElement('div');
  card.className = 'server-card';

  const action = primaryActionFor(server, t);
  const actionButton = action
    ? `<button class="btn primary" data-role="external">${escapeHtml(action.label)}</button>`
    : '';

  card.innerHTML = `
    <div class="server-card-header">
      <h3 class="server-name">${escapeHtml(server.name)}</h3>
      <span class="server-badge">${server.capacity ? t('servers.players', { count: server.capacity }) : ''}</span>
    </div>
    <p class="server-description">${escapeHtml(server.description || '')}</p>
    <div class="server-address" data-role="address">
      <span class="server-address-label">${t('servers.address')}</span>
      <code>${escapeHtml(server.address)}</code>
    </div>
    <div class="server-actions">
      <button class="btn ghost" data-role="copy">${t('servers.copy')}</button>
      ${actionButton}
    </div>
  `;

  const copyBtn = card.querySelector('[data-role="copy"]');
  copyBtn.addEventListener('click', () => onCopyAddress(server, copyBtn));

  if (action) {
    const externalBtn = card.querySelector('[data-role="external"]');
    externalBtn.addEventListener('click', () => onOpenExternal(action.url));
  }

  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function createRecommendedServers({ root, store, serversApi, openExternal, i18n }) {
  let cachedServers = null;
  let loadFailed = false;

  async function onCopyAddress(server, button) {
    try {
      await copyToClipboard(server.address);
      const original = button.textContent;
      button.textContent = i18n.t('servers.copied');
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    } catch {
      store.setState({ statusText: i18n.t('servers.copyFailed') });
    }
  }

  function onOpenExternal(url) {
    if (!url) return;
    openExternal(url);
  }

  function renderHeader() {
    const header = document.createElement('div');
    header.className = 'servers-header';
    header.innerHTML = `
      <h3 class="section-title servers-header-title">${i18n.t('servers.title')}</h3>
      <button type="button" class="btn ghost servers-search-link" data-role="search-servers" title="${SERVER_SEARCH_URL}">
        ${i18n.t('servers.searchMore')}
      </button>
    `;
    header.querySelector('[data-role="search-servers"]').addEventListener('click', () => {
      onOpenExternal(SERVER_SEARCH_URL);
    });
    return header;
  }

  function renderEmpty(message) {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = message || i18n.t('servers.empty');
    root.appendChild(hint);
  }

  function renderList(servers) {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    const container = document.createElement('div');
    container.className = 'server-list';
    const t = i18n.t;
    for (const server of servers) {
      container.appendChild(renderServerCard(server, { onCopyAddress, onOpenExternal, t }));
    }
    root.appendChild(container);
  }

  function refreshView() {
    if (loadFailed) {
      renderEmpty();
      return;
    }
    if (!cachedServers || cachedServers.length === 0) {
      renderEmpty(i18n.t('servers.emptyHint'));
      return;
    }
    renderList(cachedServers);
  }

  async function mount() {
    try {
      const list = await serversApi.list();
      cachedServers = Array.isArray(list) ? list : [];
      if (cachedServers.length === 0) {
        renderEmpty(i18n.t('servers.emptyHint'));
      } else {
        renderList(cachedServers);
      }
    } catch (err) {
      loadFailed = true;
      store.setState({
        statusText: `${i18n.t('servers.loadError')} ${err.message || err}`,
      });
      renderEmpty();
    }

    return i18n.onChange(refreshView);
  }

  return { mount };
}
