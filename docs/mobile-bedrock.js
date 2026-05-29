// Telefon & tablet — Bedrock başlatma (ana site #mobil bölümü).
(function () {
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
    return `minecraft://?addExternalServer=${encodeURIComponent(name)}|${host}:${port}`;
  }

  function openWithFallback(primaryUrl, fallbackUrl) {
    let hidden = false;
    const onHide = () => {
      hidden = true;
    };
    document.addEventListener('visibilitychange', onHide, { once: true });
    window.location.href = primaryUrl;
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!hidden && !document.hidden) window.location.href = fallbackUrl;
    }, 1600);
  }

  function launchBedrock() {
    const platform = detectPlatform();
    openWithFallback('minecraft://', STORE_URLS[platform] || STORE_URLS.other);
    return platform;
  }

  function launchServer(server) {
    if (!server.bedrockPort) return false;
    const platform = detectPlatform();
    openWithFallback(
      bedrockJoinUrl(server.name, server.host, server.bedrockPort),
      STORE_URLS[platform] || STORE_URLS.other
    );
    return true;
  }

  function setStatus(text) {
    const el = document.getElementById('bedrock-status');
    if (el) el.textContent = text || '';
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
    card.className = 'mobile-server-card';
    const canJoin = !!server.bedrockPort;

    card.innerHTML = `
      <h4>${escapeHtml(server.name)}</h4>
      <p>${escapeHtml(server.description || '')}</p>
      <code>${escapeHtml(addressLabel(server))}</code>
      <div class="mobile-server-actions">
        <button type="button" class="btn btn-mobile" data-action="copy">Adresi Kopyala</button>
        <button type="button" class="btn btn-mobile btn-mobile-accent" data-action="join" ${canJoin ? '' : 'disabled'}>
          Sunucuya Katıl
        </button>
      </div>
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

    if (canJoin) {
      card.querySelector('[data-action="join"]').addEventListener('click', () => {
        launchServer(server);
        setStatus(`${server.name} için Minecraft açılıyor…`);
      });
    }

    const actions = card.querySelector('.mobile-server-actions');
    if (server.dashboardUrl) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-mobile';
      b.textContent = 'Sunucuyu Uyandır';
      b.addEventListener('click', () => {
        window.location.href = server.dashboardUrl;
      });
      actions.appendChild(b);
    } else if (server.websiteUrl) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-mobile';
      b.textContent = 'Web Sitesi';
      b.addEventListener('click', () => {
        window.location.href = server.websiteUrl;
      });
      actions.appendChild(b);
    }

    return card;
  }

  async function loadServers() {
    const list = document.getElementById('mobile-server-list');
    if (!list) return;
    try {
      const res = await fetch('data/bedrock-servers.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('fetch');
      const servers = await res.json();
      list.replaceChildren();
      for (const server of servers) list.appendChild(renderServer(server));
    } catch {
      list.innerHTML = '<p class="mobile-hint">Sunucu listesi yüklenemedi.</p>';
    }
  }

  function wirePlayButton() {
    const btn = document.getElementById('bedrock-play-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const p = launchBedrock();
      setStatus(
        p === 'android' || p === 'ios'
          ? 'Minecraft Bedrock açılıyor…'
          : 'Minecraft yüklü değilse mağaza sayfasına yönlendiriliyorsun.'
      );
      window.setTimeout(() => {
        btn.disabled = false;
      }, 2000);
    });
  }

  function wireNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function markMobileBody() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('is-mobile-layout');
    }
    window.matchMedia('(max-width: 900px)').addEventListener('change', (e) => {
      document.body.classList.toggle('is-mobile-layout', e.matches);
    });
  }

  wirePlayButton();
  loadServers();
  wireNavToggle();
  markMobileBody();
})();
