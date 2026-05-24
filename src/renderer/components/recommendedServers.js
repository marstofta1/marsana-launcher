const SERVER_SEARCH_URL = 'https://topminecraftservers.org/#google_vignette';

function primaryActionFor(server) {
  if (server.provider === 'aternos' && server.providerDashboardUrl) {
    return { label: 'Sunucuyu Uyandır', url: server.providerDashboardUrl };
  }
  if (server.websiteUrl) {
    return { label: 'Web Sitesi', url: server.websiteUrl };
  }
  return null;
}

function renderServerCard(server, { onCopyAddress, onOpenExternal }) {
  const card = document.createElement('div');
  card.className = 'server-card';

  const action = primaryActionFor(server);
  const actionButton = action
    ? `<button class="btn primary" data-role="external">${escapeHtml(action.label)}</button>`
    : '';

  card.innerHTML = `
    <div class="server-card-header">
      <h3 class="server-name">${escapeHtml(server.name)}</h3>
      <span class="server-badge">${server.capacity ? `${server.capacity} kişi` : ''}</span>
    </div>
    <p class="server-description">${escapeHtml(server.description || '')}</p>
    <div class="server-address" data-role="address">
      <span class="server-address-label">Adres:</span>
      <code>${escapeHtml(server.address)}</code>
    </div>
    <div class="server-actions">
      <button class="btn ghost" data-role="copy">Adresi Kopyala</button>
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

export function createRecommendedServers({ root, store, serversApi, openExternal }) {
  async function onCopyAddress(server, button) {
    try {
      await copyToClipboard(server.address);
      const original = button.textContent;
      button.textContent = 'Kopyalandı ✓';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    } catch {
      store.setState({ statusText: 'Adres kopyalanamadı.' });
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
      <h3 class="section-title servers-header-title">Önerilen Sunucular</h3>
      <button type="button" class="btn ghost servers-search-link" data-role="search-servers" title="${SERVER_SEARCH_URL}">
        Daha fazla sunucu
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
    hint.textContent = message || 'Önerilen sunucu yok.';
    root.appendChild(hint);
  }

  function renderList(servers) {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    const container = document.createElement('div');
    container.className = 'server-list';
    for (const server of servers) {
      container.appendChild(renderServerCard(server, { onCopyAddress, onOpenExternal }));
    }
    root.appendChild(container);
  }

  async function mount() {
    try {
      const list = await serversApi.list();
      if (!Array.isArray(list) || list.length === 0) {
        renderEmpty('Önerilen sunucu yok. Aşağıdaki bağlantıdan binlerce sunucu arasından arayabilirsin.');
        return;
      }
      renderList(list);
    } catch (err) {
      store.setState({ statusText: 'Sunucu listesi alınamadı: ' + (err.message || err) });
      renderEmpty();
    }
  }

  return { mount };
}
