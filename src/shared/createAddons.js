// Tek oyunculu "Create (+ eklentiler)" paketinde açılıp kapatılabilen eklentiler.
// id'ler shaderStackService CREATE_TOGGLEABLE_ADDON_SLUGS ile aynı olmalı (testte doğrulanır).
// Klima SMP paketi bunu yok sayar: sunucuyla birebir aynı modlar zorunludur.
export const CREATE_ADDONS = Object.freeze([
  { id: 'create-aeronautics', name: 'Create Aeronautics' },
  { id: 'create-engines', name: 'Create: Engines' },
  { id: 'create-diesel-generators', name: 'Create: Diesel Generators' },
  { id: 'power-grid', name: 'Power Grid' },
  { id: 'create-steam-n-rails-1.21.1', name: "Steam 'n' Rails" },
  { id: 'create-railways-navigator', name: 'Railways Navigator' },
  { id: 'create-connected', name: 'Create: Connected' },
  { id: 'create-dreams-and-desires', name: 'Dreams & Desires' },
  { id: 'create-framed', name: 'Create: Framed' },
]);

export const CREATE_ADDON_IDS = Object.freeze(CREATE_ADDONS.map((a) => a.id));
