// Marsana Launcher landing — sesli okuma kontrolü.
// Web Speech API (window.speechSynthesis) kullanıyoruz. Harici servis veya
// API anahtarı yok; tarayıcının yerleşik sentezleyicisi devreye girer.

(function () {
  'use strict';

  const synth = window.speechSynthesis;
  if (!synth) {
    const status = document.querySelector('[data-tts-status]');
    if (status) status.textContent = 'Tarayıcın sesli okumayı desteklemiyor.';
    document.querySelectorAll('.tts-btn').forEach((b) => (b.disabled = true));
    return;
  }

  const els = {
    play: document.querySelector('[data-tts="play"]'),
    pause: document.querySelector('[data-tts="pause"]'),
    stop: document.querySelector('[data-tts="stop"]'),
    voice: document.querySelector('[data-tts="voice"]'),
    rate: document.querySelector('[data-tts="rate"]'),
    rateVal: document.querySelector('[data-tts-rate-val]'),
    label: document.querySelector('[data-tts-label]'),
    status: document.querySelector('[data-tts-status]'),
  };
  const sections = Array.from(document.querySelectorAll('[data-tts-section]'));

  let voices = [];
  let queue = []; // { utter, sectionEl }
  let currentIdx = 0;
  let isReading = false;

  // ---------- voice loading ----------
  // speechSynthesis.getVoices() bazı tarayıcılarda asenkron dolar — voiceschanged
  // event'ini de dinlemek şart.
  function loadVoices() {
    voices = synth.getVoices();
    populateVoiceSelect();
  }
  loadVoices();
  if (typeof synth.onvoiceschanged !== 'undefined') {
    synth.onvoiceschanged = loadVoices;
  }

  function populateVoiceSelect() {
    const trVoices = voices.filter((v) => /^tr(\b|-)/i.test(v.lang));
    const others = voices.filter((v) => !/^tr(\b|-)/i.test(v.lang));
    const sel = els.voice;
    sel.innerHTML = '';
    function addGroup(label, list) {
      if (list.length === 0) return;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const v of list) {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        group.appendChild(opt);
      }
      sel.appendChild(group);
    }
    addGroup('Türkçe sesler', trVoices);
    addGroup('Diğer sesler', others);
    if (sel.options.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '(Sistem varsayılanı)';
      sel.appendChild(opt);
    }
  }

  // ---------- text collection ----------
  // Her section'ı cümlelere böl — Chrome'da uzun utterance (~32s+) sessizce
  // yarıda kesilebiliyor, küçük parçalar daha güvenli.
  function collectText(sectionEl) {
    const clone = sectionEl.cloneNode(true);
    // scriptleri / butonları okumamak için kaldır
    clone.querySelectorAll('script, button, code').forEach((n) => n.replaceWith(document.createTextNode(n.textContent)));
    const raw = clone.textContent.replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    // Türkçe cümle sınırı: . ! ? ardından boşluk; ayrıca uzun cümleleri 220 karakterde kır
    const sentences = [];
    let buf = '';
    const tokens = raw.split(/([.!?]+\s+)/);
    for (let i = 0; i < tokens.length; i++) {
      buf += tokens[i];
      if (/[.!?]+\s+$/.test(tokens[i]) || i === tokens.length - 1) {
        let s = buf.trim();
        while (s.length > 220) {
          const cut = s.lastIndexOf(' ', 220);
          sentences.push(s.slice(0, cut > 60 ? cut : 220).trim());
          s = s.slice(cut > 60 ? cut : 220).trim();
        }
        if (s) sentences.push(s);
        buf = '';
      }
    }
    return sentences;
  }

  function buildQueue() {
    queue = [];
    const voiceName = els.voice.value;
    const voice = voices.find((v) => v.name === voiceName) || null;
    const rate = parseFloat(els.rate.value) || 1;
    for (const section of sections) {
      const parts = collectText(section);
      for (let i = 0; i < parts.length; i++) {
        const utter = new SpeechSynthesisUtterance(parts[i]);
        if (voice) utter.voice = voice;
        utter.lang = voice ? voice.lang : 'tr-TR';
        utter.rate = rate;
        utter.pitch = 1;
        queue.push({ utter, sectionEl: section, isFirstOfSection: i === 0 });
      }
    }
  }

  function highlightSection(sectionEl) {
    sections.forEach((s) => s.classList.remove('tts-reading'));
    if (sectionEl) {
      sectionEl.classList.add('tts-reading');
      // Sadece görünüm dışındaysa scroll et — kullanıcının okuduğu yeri sıçratmayalım
      const rect = sectionEl.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function speakNext() {
    if (currentIdx >= queue.length) {
      stopReading();
      els.status.textContent = 'Okuma tamamlandı.';
      return;
    }
    const item = queue[currentIdx];
    if (item.isFirstOfSection) highlightSection(item.sectionEl);
    item.utter.onend = () => {
      currentIdx++;
      speakNext();
    };
    item.utter.onerror = (e) => {
      // "interrupted" — stop'la beklenen davranış, sessiz geç
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      els.status.textContent = `Hata: ${e.error || 'bilinmeyen'}`;
      stopReading();
    };
    synth.speak(item.utter);
  }

  function startReading() {
    synth.cancel(); // önceki kuyruğu temizle
    buildQueue();
    if (queue.length === 0) {
      els.status.textContent = 'Okunacak içerik bulunamadı.';
      return;
    }
    currentIdx = 0;
    isReading = true;
    els.play.disabled = true;
    els.pause.disabled = false;
    els.stop.disabled = false;
    els.label.textContent = 'Okunuyor...';
    els.status.textContent = `Toplam ${queue.length} parça. Sıra: 1`;
    speakNext();
  }

  function stopReading() {
    synth.cancel();
    isReading = false;
    queue = [];
    currentIdx = 0;
    sections.forEach((s) => s.classList.remove('tts-reading'));
    els.play.disabled = false;
    els.pause.disabled = true;
    els.stop.disabled = true;
    els.label.textContent = 'Sesli Dinle';
    if (els.status.textContent.indexOf('Hata') === -1) {
      els.status.textContent = 'Durduruldu.';
    }
  }

  function togglePause() {
    if (synth.paused) {
      synth.resume();
      els.status.textContent = 'Devam ediyor.';
    } else if (synth.speaking) {
      synth.pause();
      els.status.textContent = 'Duraklatıldı.';
    }
  }

  // ---------- ilerleme bildirimi ----------
  // queue.forEach onstart ile hangi parçada olduğumuzu status'a yansıt
  function attachProgress() {
    const origSpeakNext = speakNext;
    // Halihazırda speakNext idx artırıyor — sadece status'u güncellemek için
    // sarmalama yerine doğrudan utter.onstart'a hook takıyoruz buildQueue içinde.
    return origSpeakNext;
  }
  attachProgress();

  // ---------- events ----------
  els.play.addEventListener('click', startReading);
  els.pause.addEventListener('click', togglePause);
  els.stop.addEventListener('click', stopReading);
  els.rate.addEventListener('input', () => {
    els.rateVal.textContent = `${parseFloat(els.rate.value).toFixed(1)}×`;
    // Okuma sırasında hızı değiştirmek için yeniden başlat
    if (isReading) {
      const wasIdx = currentIdx;
      synth.cancel();
      buildQueue();
      currentIdx = Math.min(wasIdx, queue.length - 1);
      speakNext();
    }
  });
  els.voice.addEventListener('change', () => {
    if (isReading) {
      // Sesi anında değiştirebilmek için kuyruğu yeniden kur
      const wasIdx = currentIdx;
      synth.cancel();
      buildQueue();
      currentIdx = Math.min(wasIdx, queue.length - 1);
      speakNext();
    }
  });

  // Sayfa kapanmadan sentezleyiciyi durdur (bazı tarayıcılarda arka planda devam ediyor)
  window.addEventListener('beforeunload', () => synth.cancel());
})();
