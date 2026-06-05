const LINKS = [
  {
    id: 'marsanaSite',
    url: 'https://marstofta1.github.io/marsana-launcher/',
    iconImage: 'assets/logo-sm.png',
    accent: true,
  },
  {
    id: 'youtube',
    url: 'https://www.youtube.com/@Bilmemle',
    iconImage: 'assets/sites/youtube.svg',
  },
  {
    id: 'minecraftNet',
    url: 'https://www.minecraft.net/',
    iconImage: 'assets/sites/minecraft-net-icon.png',
    iconPixelated: true,
  },
  {
    id: 'wiki',
    url: 'https://minecraft.wiki/',
    iconImage: 'assets/sites/minecraft-wiki.svg',
  },
  {
    id: 'github',
    url: 'https://github.com/marstofta1/marsana-launcher',
    iconImage: 'assets/sites/github-mark.png',
  },
  {
    id: 'modrinth',
    url: 'https://modrinth.com',
    iconImage: 'assets/sites/modrinth.svg',
  },
  {
    id: 'forge',
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

export function createWebsiteLinksPanel({ root, openExternal, i18n }) {
  function render() {
    root.innerHTML = `
      <h3 data-role="websites-title">Web siteleri</h3>
      <p class="website-links-intro" data-role="websites-intro">Resmi site ve mod kaynaklarına hızlı erişim.</p>
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
                <span class="website-link-label" data-role="label-${link.id}">${escapeHtml(i18n.t(`websites.${link.id}`))}</span>
                <span class="website-link-desc" data-role="desc-${link.id}">${escapeHtml(i18n.t(`websites.${link.id}Desc`))}</span>
              </span>
              <span class="website-link-arrow" aria-hidden="true">↗</span>
            </button>
          `
        ).join('')}
      </div>
    `;

    root.querySelector('[data-role="websites-title"]').textContent = i18n.t('websites.title');
    root.querySelector('[data-role="websites-intro"]').textContent = i18n.t('websites.intro');

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
