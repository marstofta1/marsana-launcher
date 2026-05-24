const GUIDE_SECTIONS = [
  {
    title: '1. Microsoft ile giriş',
    body:
      'Sağ üstteki Microsoft ile giriş yap düğmesine tıkla. Minecraft Java Edition lisansın olan bir hesapla oturum aç. Giriş olmadan çoğu sunucuya katılamazsın.',
  },
  {
    title: '2. Sürüm seç',
    body:
      'Oyunu Başlat bölümünden bir Minecraft sürümü seç. Yeni başlıyorsan güncel bir release sürümü (örneğin 1.21 veya listedeki en yeni release) uygundur.',
  },
  {
    title: '3. RAM ayarı',
    body:
      'RAM kaydırıcısını bilgisayarına göre ayarla. 8 gigabayt sistem belleğinde genelde 2 ila 4 gigabayt yeterlidir; çok yükseltmek bazen sorun çıkarır.',
  },
  {
    title: '4. Modlar (isteğe bağlı)',
    body:
      'Shader ve FPS, OptiFine veya kabartmalı bloklar seçeneklerinden birini işaretleyebilirsin. Hiçbirini seçmezsen oyun vanilla, modsuz başlar. OptiFine ile Shader artık aynı anda seçilemez.',
  },
  {
    title: '5. OYNA',
    body:
      'OYNA düğmesine bas. İlk açılışta dosyalar indirilir; Durum panelinden ilerlemeyi izle. İndirme bitince Minecraft açılır.',
  },
  {
    title: '6. Tek oyunculu dünya',
    body:
      'Ana menüde Tek Oyunculu, sonra Yeni Dünya. Oyun modu Hayatta Kalma veya Yaratıcı olabilir. Dünya adını yazıp Dünya Oluştur.',
  },
  {
    title: '7. Temel kontroller',
    body:
      'W A S D ile yürü, fare ile etrafa bak, boşluk ile zıpla, sol tık kır, sağ tık yerleştir veya kullan. E envanter, Esc menü.',
  },
  {
    title: '8. Çok oyunculu sunucu',
    body:
      'Ana menüde Çok Oyunculu, Sunucu Ekle veya önerilen sunuculardan birinin adresini kopyala. Adresi yapıştırıp sunucuya katıl.',
  },
];

function guidePlainText() {
  const intro =
    'Marsana Launcher ile Minecraft Java Edition nasıl oynanır. Adım adım rehber.';
  const steps = GUIDE_SECTIONS.map((s) => `${s.title}. ${s.body}`).join(' ');
  return `${intro} ${steps}`;
}

function pickTurkishVoice() {
  const voices = window.speechSynthesis.getVoices();
  const tr = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('tr'));
  if (tr.length > 0) {
    return tr.find((v) => v.localService) || tr[0];
  }
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr')) || null;
}

export function wireHowToPlayGuide({ button, modalRoot }) {
  let utterance = null;
  let speaking = false;

  function stopSpeech() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speaking = false;
    updateListenButton();
  }

  function updateListenButton() {
    const listenBtn = modalRoot.querySelector('[data-role="listen"]');
    if (!listenBtn) return;
    if (!window.speechSynthesis) {
      listenBtn.disabled = true;
      listenBtn.title = 'Bu sistemde sesli okuma desteklenmiyor.';
      return;
    }
    listenBtn.textContent = speaking ? 'Sesi durdur' : 'Sesli dinle';
    listenBtn.setAttribute('aria-pressed', speaking ? 'true' : 'false');
  }

  function startSpeech() {
    if (!window.speechSynthesis) return;
    stopSpeech();
    const text = guidePlainText();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = pickTurkishVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      speaking = true;
      updateListenButton();
    };
    utterance.onend = () => {
      speaking = false;
      updateListenButton();
    };
    utterance.onerror = () => {
      speaking = false;
      updateListenButton();
    };

    window.speechSynthesis.speak(utterance);
  }

  function renderSectionsHtml() {
    return GUIDE_SECTIONS.map(
      (s) => `
        <section class="guide-section">
          <h3>${s.title}</h3>
          <p>${s.body}</p>
        </section>
      `
    ).join('');
  }

  let escapeHandler = null;

  function closeModal() {
    stopSpeech();
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
    modalRoot.innerHTML = '';
    modalRoot.setAttribute('aria-hidden', 'true');
  }

  function openModal() {
    modalRoot.setAttribute('aria-hidden', 'false');
    modalRoot.innerHTML = `
      <div class="modal-overlay" data-role="overlay">
        <div class="modal modal-guide" role="dialog" aria-modal="true" aria-labelledby="howToPlayTitle">
          <h2 id="howToPlayTitle">Minecraft nasıl oynanır?</h2>
          <p class="guide-intro">
            Marsana Launcher ile ilk kez başlıyorsan bu adımları izle. Metni okuyabilir veya sesli dinleyebilirsin.
          </p>
          <div class="guide-body" data-role="body">
            ${renderSectionsHtml()}
          </div>
          <div class="modal-actions guide-actions">
            <button type="button" class="btn ghost" data-role="listen">Sesli dinle</button>
            <button type="button" class="btn primary" data-role="close">Kapat</button>
          </div>
        </div>
      </div>
    `;

    const overlay = modalRoot.querySelector('[data-role="overlay"]');
    const listenBtn = modalRoot.querySelector('[data-role="listen"]');
    const closeBtn = modalRoot.querySelector('[data-role="close"]');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);
    listenBtn.addEventListener('click', () => {
      if (speaking) stopSpeech();
      else startSpeech();
    });

    escapeHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escapeHandler);

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => updateListenButton();
    }
    updateListenButton();
    closeBtn.focus();
  }

  button.addEventListener('click', openModal);

  return { close: closeModal };
}
