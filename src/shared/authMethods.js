/** Renderer — authMethods.cjs ile senkron tutulmalı. */
export const AUTH_METHODS = Object.freeze({
  MICROSOFT: 'microsoft',
  XBOX: 'xbox',
  PLAYSTATION: 'playstation',
});

export const AUTH_METHOD_OPTIONS = Object.freeze([
  {
    id: AUTH_METHODS.MICROSOFT,
    label: 'Microsoft',
    shortLabel: 'Microsoft',
    description: 'Outlook, Hotmail veya kurumsal Microsoft hesabı.',
    statusOpening: 'Microsoft giriş penceresi açılıyor...',
    helpUrl: null,
    helpHint: null,
  },
  {
    id: AUTH_METHODS.XBOX,
    label: 'Xbox',
    shortLabel: 'Xbox',
    description: 'Xbox Live / Game Pass hesabın (Microsoft hesabına bağlı).',
    statusOpening: 'Xbox giriş penceresi açılıyor...',
    helpUrl: null,
    helpHint: null,
  },
  {
    id: AUTH_METHODS.PLAYSTATION,
    label: 'PlayStation',
    shortLabel: 'PlayStation',
    description: 'PSN hesabını Microsoft ile eşleştirdiysen aynı Microsoft oturumu.',
    statusOpening: 'PlayStation için Microsoft giriş penceresi açılıyor...',
    helpUrl: 'https://www.minecraft.net/tr-tr/realms/minecraft-and-microsoft-accounts',
    helpHint:
      'PlayStation\'da Minecraft oynadıysan PSN hesabını microsoft.com adresinde Microsoft hesabına bağlamış olmalısın.',
  },
]);

export function normalizeAuthMethod(method) {
  const id = String(method || AUTH_METHODS.MICROSOFT).toLowerCase();
  if (id === AUTH_METHODS.XBOX || id === AUTH_METHODS.PLAYSTATION) return id;
  return AUTH_METHODS.MICROSOFT;
}
