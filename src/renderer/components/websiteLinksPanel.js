const LINKS = [
  {
    label: 'Marsana Web Sitesi',
    description: 'İndirme, kurulum rehberi ve SSS',
    url: 'https://marstofta1.github.io/marsana-launcher/',
    iconImage: 'assets/logo-sm.png',
    accent: true,
  },
  {
    label: 'Minecraft.net',
    description: 'Resmi Minecraft sitesi',
    url: 'https://www.minecraft.net/',
    iconImage: 'assets/sites/minecraft-net-icon.png',
    iconPixelated: true,
  },
  {
    label: 'Minecraft Wiki',
    description: 'Oyun rehberi, bloklar ve mekanikler',
    url: 'https://minecraft.wiki/',
    iconImage: 'assets/sites/minecraft-wiki.svg',
  },
  {
    label: 'GitHub',
    description: 'Kaynak kod ve sürüm notları',
    url: 'https://github.com/marstofta1/marsana-launcher',
    iconImage: 'assets/sites/github-mark.png',
  },
  {
    label: 'Modrinth',
    description: 'Mod ve shader indir',
    url: 'https://modrinth.com',
    iconImage: 'assets/sites/modrinth.svg',
  },
  {
    label: 'Forge',
    description: 'Forge mod yükleyici',
    url: 'https://files.minecraftforge.net/net/minecraftforge/forge/',
    iconImage: 'assets/sites/forge.png',
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createWebsiteLinksPanel({ root, openExternal }) {
  root.innerHTML = `
    <h3>Web siteleri</h3>
    <p class="website-links-intro">Resmi site ve mod kaynaklarına hızlı erişim.</p>
    <div class="website-links-grid">
      ${LINKS.map(
        (link) => `
          <button
            type="button"
            class="website-link-tile${link.accent ? ' accent' : ''}"
            data-url="${escapeHtml(link.url)}"
            title="${escapeHtml(link.url)}"
          >
            <span class="website-link-icon has-img" aria-hidden="true">
              <img class="website-link-icon-img${link.iconPixelated ? ' pixelated' : ''}" src="${escapeHtml(link.iconImage)}" alt="" width="28" height="28" />
            </span>
            <span class="website-link-text">
              <span class="website-link-label">${escapeHtml(link.label)}</span>
              <span class="website-link-desc">${escapeHtml(link.description)}</span>
            </span>
            <span class="website-link-arrow" aria-hidden="true">↗</span>
          </button>
        `
      ).join('')}
    </div>
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
