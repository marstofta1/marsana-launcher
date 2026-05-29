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

function bedrockJoinUrl(name, host, port) {
  const label = encodeURIComponent(name);
  return `minecraft://?addExternalServer=${label}|${host}:${port}`;
}

async function openNativeUrl(primaryUrl, fallbackUrl) {
  const plugin = window.Capacitor?.Plugins?.MarsanaLauncher;
  if (!plugin?.openUrl) return false;
  try {
    await plugin.openUrl({ url: primaryUrl });
    return true;
  } catch {
    if (!fallbackUrl) return false;
    try {
      await plugin.openUrl({ url: fallbackUrl });
      return true;
    } catch {
      return false;
    }
  }
}

async function openBedrockWithFallback(primaryUrl, fallbackUrl) {
  const isNative = window.Capacitor?.isNativePlatform?.() === true;

  if (isNative) {
    const opened = await openNativeUrl(primaryUrl, fallbackUrl);
    if (opened) return;
  }

  if (isNative) {
    window.location.href = primaryUrl;
    return;
  }

  let hidden = false;
  const onHide = () => {
    hidden = true;
  };
  document.addEventListener('visibilitychange', onHide, { once: true });

  // iOS bazen location.href ile şema açmaz; gizli iframe dene.
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = primaryUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  }, 2000);

  window.location.href = primaryUrl;

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!hidden && !document.hidden) {
      window.location.href = fallbackUrl;
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
  openBedrockWithFallback(bedrockJoinUrl(server.name, server.host, port), fallback);
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
  if (server.bedrockPort) return `${server.host}:${server.bedrockPort} (Bedrock)`;
  return `${server.host}:${server.javaPort || 25565} (Java)`;
}

function renderServer(server) {
  const card = document.createElement('article');
  card.className = 'server-card';

  const joinDisabled = !server.bedrockPort;
  const joinHint = joinDisabled
    ? 'Bedrock portu bilinmiyor; adresi kopyalayıp oyunda elle ekle.'
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
    <p class="hint">${escapeHtml(joinHint)}</p>
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

  if (!joinDisabled) {
    card.querySelector('[data-action="join"]').addEventListener('click', () => {
      launchBedrockServer(server);
      setStatus(`${server.name} için Minecraft açılıyor…`);
    });
  }

  const actions = card.querySelector('.server-actions');
  if (server.dashboardUrl) {
    const wake = document.createElement('button');
    wake.type = 'button';
    wake.className = 'btn';
    wake.textContent = 'Sunucuyu Uyandır';
    wake.addEventListener('click', () => {
      window.location.href = server.dashboardUrl;
    });
    actions.appendChild(wake);
  } else if (server.websiteUrl) {
    const web = document.createElement('button');
    web.type = 'button';
    web.className = 'btn';
    web.textContent = 'Web Sitesi';
    web.addEventListener('click', () => {
      window.location.href = server.websiteUrl;
    });
    actions.appendChild(web);
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
    list.innerHTML = '<p class="hint warn">Sunucu listesi yüklenemedi.</p>';
  }
}

function wirePlayButton() {
  const btn = document.getElementById('play-btn');
  const hint = document.getElementById('play-hint');
  if (!btn) return;

  const platform = detectPlatform();
  if (platform === 'other') {
    if (hint) {
      hint.textContent =
        'Bu sayfa telefon ve tablet içindir. Bilgisayarda ana Marsana Launcher sitesini kullan.';
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
  if (window.Capacitor?.isNativePlatform?.()) return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

wirePlayButton();
loadServers();
registerServiceWorker();
