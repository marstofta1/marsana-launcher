'use strict';

const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.mojang.minecraftpe',
  ios: 'https://apps.apple.com/app/minecraft/id479516143',
  other: 'https://www.minecraft.net/get-minecraft',
};

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

function isMobileDevice() {
  return detectPlatform() !== 'other' || window.matchMedia('(max-width: 768px)').matches;
}

function bedrockJoinUrl(name, host, port) {
  const label = encodeURIComponent(name);
  const address = `${host}:${port}`;
  return `minecraft://?addExternalServer=${label}|${address}`;
}

function openUrl(url) {
  window.location.href = url;
}

function openBedrockWithFallback(primaryUrl, fallbackUrl) {
  let hidden = false;
  const onHide = () => {
    hidden = true;
  };
  document.addEventListener('visibilitychange', onHide, { once: true });

  openUrl(primaryUrl);

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!hidden && !document.hidden) {
      openUrl(fallbackUrl);
    }
  }, 1600);
}

function launchBedrock() {
  const platform = detectPlatform();
  const fallback = STORE_URLS[platform] || STORE_URLS.other;
  openBedrockWithFallback('minecraft://', fallback);
  return platform;
}

function launchBedrockServer(server) {
  const port = server.bedrockPort;
  if (!port) return false;
  const platform = detectPlatform();
  const fallback = STORE_URLS[platform] || STORE_URLS.other;
  const joinUrl = bedrockJoinUrl(server.name, server.host, port);
  openBedrockWithFallback(joinUrl, fallback);
  return true;
}

async function copyText(text) {
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addressLabel(server) {
  if (server.bedrockPort) {
    return `${server.host}:${server.bedrockPort} (Bedrock)`;
  }
  return `${server.host}:${server.javaPort || 25565} (Java)`;
}

function renderServer(server) {
  const card = document.createElement('article');
  card.className = 'server-card';

  const joinDisabled = !server.bedrockPort;
  const joinHint = joinDisabled
    ? 'Bu sunucu için bilinen Bedrock portu yok; adresi kopyalayıp oyunda elle ekle.'
    : 'Minecraft açılır ve sunucu listene eklenir.';

  card.innerHTML = `
    <h3>${escapeHtml(server.name)}</h3>
    <p>${escapeHtml(server.description || '')}</p>
    <code>${escapeHtml(addressLabel(server))}</code>
    <div class="server-actions">
      <button type="button" class="btn" data-action="copy">Adresi Kopyala</button>
      <button type="button" class="btn primary" data-action="join" ${joinDisabled ? 'disabled' : ''}>
        Sunucuya Katıl
      </button>
    </div>
    <p class="note">${escapeHtml(joinHint)}</p>
  `;

  card.querySelector('[data-action="copy"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await copyText(addressLabel(server));
      const prev = btn.textContent;
      btn.textContent = 'Kopyalandı ✓';
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1600);
    } catch {
      btn.textContent = 'Kopyalanamadı';
    }
  });

  const joinBtn = card.querySelector('[data-action="join"]');
  if (!joinDisabled) {
    joinBtn.addEventListener('click', () => {
      launchBedrockServer(server);
      setStatus(`${server.name} için Minecraft açılıyor…`);
    });
  }

  if (server.dashboardUrl) {
    const wake = document.createElement('button');
    wake.type = 'button';
    wake.className = 'btn';
    wake.textContent = 'Sunucuyu Uyandır';
    wake.addEventListener('click', () => openUrl(server.dashboardUrl));
    card.querySelector('.server-actions').appendChild(wake);
  } else if (server.websiteUrl) {
    const web = document.createElement('button');
    web.type = 'button';
    web.className = 'btn';
    web.textContent = 'Web Sitesi';
    web.addEventListener('click', () => openUrl(server.websiteUrl));
    card.querySelector('.server-actions').appendChild(web);
  }

  return card;
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text || '';
}

async function loadServers() {
  const list = document.getElementById('server-list');
  if (!list) return;
  try {
    const res = await fetch('servers.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('servers.json');
    const servers = await res.json();
    list.replaceChildren();
    for (const server of servers) {
      list.appendChild(renderServer(server));
    }
  } catch {
    list.innerHTML = '<p class="note warn">Sunucu listesi yüklenemedi.</p>';
  }
}

function wirePlayButton() {
  const btn = document.getElementById('play-btn');
  const hint = document.getElementById('play-hint');
  if (!btn) return;

  const platform = detectPlatform();
  if (platform === 'other' && !isMobileDevice()) {
    if (hint) {
      hint.textContent =
        'Bu sayfa telefon içindir. Bilgisayarda tam Marsana Launcher kullan; ' +
        'telefonda bu sayfayı aç veya ana siteye git.';
      hint.classList.add('warn');
    }
  }

  btn.addEventListener('click', () => {
    btn.disabled = true;
    const p = launchBedrock();
    if (p === 'android' || p === 'ios') {
      setStatus('Minecraft Bedrock açılıyor…');
    } else {
      setStatus('Minecraft yüklü değilse mağaza sayfasına yönlendiriliyorsun.');
    }
    window.setTimeout(() => {
      btn.disabled = false;
    }, 2000);
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

wirePlayButton();
loadServers();
registerServiceWorker();
