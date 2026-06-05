const LINKS = [
  { id: 'modrinth', url: 'https://modrinth.com', icon: 'M' },
  { id: 'forge', url: 'https://files.minecraftforge.net/net/minecraftforge/forge/', icon: 'F' },
];

export function createBottomLinks({ root, openExternal, i18n }) {
  function render() {
    root.innerHTML = `
      <span class="bottom-links-label" data-role="bottom-label">Mod indir:</span>
      ${LINKS.map(
        (l) => `
          <button type="button" class="bottom-link" data-url="${l.url}" title="${l.url}">
            <span class="bottom-link-icon">${l.icon}</span>
            <span>${i18n.t(`websites.${l.id}`)}</span>
          </button>
        `
      ).join('')}
    `;

    root.querySelector('[data-role="bottom-label"]').textContent = i18n.t('bottom.downloadModsLabel');

    root.querySelectorAll('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        if (url) openExternal(url);
      });
    });
  }

  function mount() {
    render();
    return i18n.onChange(render);
  }

  return { mount };
}
