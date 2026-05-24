const LINKS = [
  { label: 'Modrinth', url: 'https://modrinth.com', icon: 'M' },
  { label: 'Forge', url: 'https://files.minecraftforge.net/net/minecraftforge/forge/', icon: 'F' },
];

export function createBottomLinks({ root, openExternal }) {
  root.innerHTML = `
    <span class="bottom-links-label">Mod indir:</span>
    ${LINKS.map(
      (l) => `
        <button type="button" class="bottom-link" data-url="${l.url}" title="${l.url}">
          <span class="bottom-link-icon">${l.icon}</span>
          <span>${l.label}</span>
        </button>
      `
    ).join('')}
  `;

  root.querySelectorAll('[data-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) openExternal(url);
    });
  });

  function mount() {}
  return { mount };
}
