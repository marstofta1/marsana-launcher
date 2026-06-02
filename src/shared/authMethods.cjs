'use strict';

/** Launcher giriş yöntemleri — hepsi resmi Microsoft OAuth (Java Edition). */
const AUTH_METHODS = Object.freeze({
  MICROSOFT: 'microsoft',
  XBOX: 'xbox',
  PLAYSTATION: 'playstation',
});

const AUTH_METHOD_OPTIONS = Object.freeze([
  {
    id: AUTH_METHODS.MICROSOFT,
    label: 'Microsoft',
    shortLabel: 'Microsoft',
    description: 'Outlook, Hotmail veya kurumsal Microsoft hesabı.',
    prompt: 'select_account',
    windowTitle: 'Marsana — Microsoft ile giriş',
    statusOpening: 'Microsoft giriş penceresi açılıyor...',
  },
  {
    id: AUTH_METHODS.XBOX,
    label: 'Xbox',
    shortLabel: 'Xbox',
    description: 'Xbox Live / Game Pass hesabın (Microsoft hesabına bağlı).',
    prompt: 'login',
    windowTitle: 'Marsana — Xbox hesabı ile giriş',
    statusOpening: 'Xbox giriş penceresi açılıyor...',
  },
  {
    id: AUTH_METHODS.PLAYSTATION,
    label: 'PlayStation',
    shortLabel: 'PlayStation',
    description: 'PSN hesabını Microsoft ile eşleştirdiysen aynı Microsoft oturumu.',
    prompt: 'select_account',
    windowTitle: 'Marsana — PlayStation (Microsoft) giriş',
    statusOpening: 'PlayStation için Microsoft giriş penceresi açılıyor...',
    helpUrl: 'https://www.minecraft.net/tr-tr/realms/minecraft-and-microsoft-accounts',
    helpHint:
      'PlayStation\'da Minecraft oynadıysan PSN hesabını microsoft.com adresinde Microsoft hesabına bağlamış olmalısın.',
  },
]);

function normalizeAuthMethod(method) {
  const id = String(method || AUTH_METHODS.MICROSOFT).toLowerCase();
  if (id === AUTH_METHODS.XBOX || id === AUTH_METHODS.PLAYSTATION) return id;
  return AUTH_METHODS.MICROSOFT;
}

function getAuthMethodOption(method) {
  const id = normalizeAuthMethod(method);
  return AUTH_METHOD_OPTIONS.find((o) => o.id === id) || AUTH_METHOD_OPTIONS[0];
}

function listAuthMethodOptions() {
  return AUTH_METHOD_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    shortLabel: o.shortLabel,
    description: o.description,
    helpUrl: o.helpUrl || null,
    helpHint: o.helpHint || null,
  }));
}

module.exports = {
  AUTH_METHODS,
  AUTH_METHOD_OPTIONS,
  normalizeAuthMethod,
  getAuthMethodOption,
  listAuthMethodOptions,
};
