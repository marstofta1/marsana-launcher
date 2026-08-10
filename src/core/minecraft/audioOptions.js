'use strict';

// Launcher ses slider'lari (Ana Ses / Muzik) ile Minecraft options.txt arasindaki
// senkron KARARINI veren saf fonksiyon (yan etkisiz; kolay test edilir).
//
// Sorun: eski davranis her acilista launcher slider degerini options.txt'e
// yaziyordu; kullanici oyun icinde muzigi kapatinca bir sonraki acilista uzerine
// yazilip geri aciliyordu. Cozum kurali:
//   Bir ses anahtarini YALNIZCA
//     (a) options.txt'te hic yoksa (yeni kurulum — bir kez tohumla), VEYA
//     (b) launcher slider'i son uygulanandan farkliysa (kullanici launcher'da degistirdi)
//   yaz. Aksi halde dokunma -> oyun-ici secim ( or. muzik = 0) kalici olur.
//
// audio: { masterVolume, musicVolume } — 0.0..1.0 (veya null/gecersiz)
// currentOptionsText: mevcut options.txt icerigi (string)
// lastApplied: { <optionKey>: '<son uygulanan launcher degeri>' }

const AUDIO_KEYS = Object.freeze([
  { optionKey: 'soundCategory_master', audioKey: 'masterVolume' },
  { optionKey: 'soundCategory_music', audioKey: 'musicVolume' },
]);

// Anahtarlar sabit (soundCategory_*), regex-ozel karakter icermez.
function optionsTextHasKey(text, optionKey) {
  if (!text) return false;
  return new RegExp(`^${optionKey}:`, 'm').test(text);
}

function computeAudioOptionUpdates({ audio, currentOptionsText = '', lastApplied = {} } = {}) {
  const updates = {};
  const prevState = lastApplied && typeof lastApplied === 'object' ? lastApplied : {};
  const nextLastApplied = { ...prevState };
  if (!audio || typeof audio !== 'object') {
    return { updates, nextLastApplied };
  }
  for (const { optionKey, audioKey } of AUDIO_KEYS) {
    const raw = audio[audioKey];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const desired = raw.toFixed(3);
    const hasKey = optionsTextHasKey(currentOptionsText, optionKey);
    const prev = prevState[optionKey];
    const changedInLauncher = prev !== undefined && prev !== desired;
    if (!hasKey || changedInLauncher) {
      updates[optionKey] = desired;
    }
    // Slider konumunu her durumda kaydet ki yalnizca SONRAKI launcher degisikligi
    // yazim tetiklesin (bu acilista yazmasak bile).
    nextLastApplied[optionKey] = desired;
  }
  return { updates, nextLastApplied };
}

module.exports = { computeAudioOptionUpdates, AUDIO_KEYS };
