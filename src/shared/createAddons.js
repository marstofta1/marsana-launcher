// OTOMATİK ÜRETİLDİ — elle düzenleme: node scripts/import-create-pack.js <paket.mrpack>
// Tek oyunculu "Create (+ eklentiler)" paketinde açılıp kapatılabilen eklentiler (arayüz).
// id'ler createPack.js + shaderStackService CREATE_BUNDLED_ADDONS ile aynıdır (testte doğrulanır).
// Klima SMP paketi bunu yok sayar: sunucuyla birebir aynı modlar zorunludur.
export const CREATE_ADDONS = Object.freeze([
  {
    "id": "create-additional-logistics",
    "name": "Create: Additional Logistics"
  },
  {
    "id": "create-aeronautics",
    "name": "Create Aeronautics"
  },
  {
    "id": "appleskin",
    "name": "AppleSkin"
  },
  {
    "id": "create-aquatic-ambitions",
    "name": "Create: Aquatic Ambitions"
  },
  {
    "id": "bellsandwhistles",
    "name": "Create: Bells & Whistles"
  },
  {
    "id": "create-big-cannons",
    "name": "Create Big Cannons"
  },
  {
    "id": "big-contraptions",
    "name": "Create: Big Contraptions"
  },
  {
    "id": "create-bits-n-bobs",
    "name": "Create: Bits 'n' Bobs"
  },
  {
    "id": "blocks-bogies",
    "name": "Create: Blocks & Bogies"
  },
  {
    "id": "create-cafe",
    "name": "Create Cafe"
  },
  {
    "id": "create-central-kitchen",
    "name": "Create: Central Kitchen"
  },
  {
    "id": "create-confectionery",
    "name": "Create Confectionery"
  },
  {
    "id": "create-connected",
    "name": "Create: Connected"
  },
  {
    "id": "create-contraption-terminals",
    "name": "Create Contraption Terminals"
  },
  {
    "id": "copycats",
    "name": "Create: Copycats+"
  },
  {
    "id": "createaddition",
    "name": "Create Crafts & Additions"
  },
  {
    "id": "create-curios-backtank",
    "name": "Create: Curios Backtank"
  },
  {
    "id": "create-deco",
    "name": "Create Deco"
  },
  {
    "id": "create-design-n-decor",
    "name": "Create: Design n' Decor"
  },
  {
    "id": "create-diesel-generators",
    "name": "Create: Diesel Generators"
  },
  {
    "id": "create-dragons-plus",
    "name": "Create: Dragons Plus"
  },
  {
    "id": "create-dreams-and-desires",
    "name": "Create: Dreams & Desires"
  },
  {
    "id": "create-encased",
    "name": "Create Encased"
  },
  {
    "id": "create-enchantable-machinery",
    "name": "Create: Enchantable Machinery"
  },
  {
    "id": "create-enchantment-industry",
    "name": "Create: Enchantment Industry"
  },
  {
    "id": "create-engines",
    "name": "Create: Engines"
  },
  {
    "id": "escalated",
    "name": "Create: Escalated"
  },
  {
    "id": "create-factory",
    "name": "Create: Factory"
  },
  {
    "id": "create_factory_logistics",
    "name": "Create Factory Logistics"
  },
  {
    "id": "farmers-delight",
    "name": "Farmer's Delight"
  },
  {
    "id": "create-fast-schematic-cannon",
    "name": "Create: FastSchematicCannon"
  },
  {
    "id": "create-flight-control",
    "name": "Create: Flight Control"
  },
  {
    "id": "create-garnished",
    "name": "Create: Garnished"
  },
  {
    "id": "create-horse-power",
    "name": "Create Horse Power"
  },
  {
    "id": "hypertube",
    "name": "Create: Hypertubes"
  },
  {
    "id": "create-integrated-farming",
    "name": "Create: Integrated Farming"
  },
  {
    "id": "interiors",
    "name": "Create: Interiors"
  },
  {
    "id": "create-ironworks",
    "name": "Create: Ironworks"
  },
  {
    "id": "jade",
    "name": "Jade"
  },
  {
    "id": "create-jetpack",
    "name": "Create Jetpack"
  },
  {
    "id": "create-liquid-fuel",
    "name": "Create: Liquid Fuel"
  },
  {
    "id": "create-mechanical-extruder",
    "name": "Create Mechanical Extruder"
  },
  {
    "id": "create-mechanical-spawner",
    "name": "Create Mechanical Spawner"
  },
  {
    "id": "create-metallurgy",
    "name": "Create: Metallurgy"
  },
  {
    "id": "create-metalwork",
    "name": "Create: Metalwork"
  },
  {
    "id": "create-misc-and-things",
    "name": "Create: Misc and Things"
  },
  {
    "id": "create-mobile-packages",
    "name": "Create: Mobile Packages"
  },
  {
    "id": "create-molten-vents",
    "name": "Create: Molten Vents"
  },
  {
    "id": "create-more-girder",
    "name": "Create: More Girder"
  },
  {
    "id": "create-more-package-couriers",
    "name": "Create More: Package Couriers"
  },
  {
    "id": "create-new-age",
    "name": "Create: New Age"
  },
  {
    "id": "createnuclear",
    "name": "Create Nuclear"
  },
  {
    "id": "numismatics",
    "name": "Create: Numismatics"
  },
  {
    "id": "create-ore-excavation",
    "name": "Create Ore Excavation"
  },
  {
    "id": "create-pattern-schematics",
    "name": "Create: Pattern Schematics"
  },
  {
    "id": "power-grid",
    "name": "Create: Power Grid"
  },
  {
    "id": "create-power-loader",
    "name": "Create: Power Loader"
  },
  {
    "id": "create-propulsion-simulated",
    "name": "Create Propulsion: Simulated"
  },
  {
    "id": "create-radars",
    "name": "Create: Radars"
  },
  {
    "id": "create-ratatouille",
    "name": "Create Ratatouille"
  },
  {
    "id": "slice-and-dice",
    "name": "Create Slice & Dice"
  },
  {
    "id": "some-assembly-required",
    "name": "Create: Some Assembly Required"
  },
  {
    "id": "create-steam-n-rails-1.21.1",
    "name": "Steam 'n' Rails Neoforge"
  },
  {
    "id": "create-storage-neo-forge",
    "name": "Create: Storage [Neo/Forge]"
  },
  {
    "id": "create-structures-arise",
    "name": "Create: Structures Arise"
  },
  {
    "id": "create-stuff-additions",
    "name": "Create Stuff 'N Additions"
  },
  {
    "id": "tfmg-community-edition",
    "name": "Create: TFMG Community Edition"
  },
  {
    "id": "toms-storage",
    "name": "Tom's Simple Storage Mod"
  },
  {
    "id": "create-tracks-plus",
    "name": "Create: Tracks+"
  },
  {
    "id": "create-trading-floor",
    "name": "Create: Trading floor"
  },
  {
    "id": "create-train-perspective",
    "name": "Create: Train Perspective"
  },
  {
    "id": "create-transmission",
    "name": "Create: Transmission!"
  },
  {
    "id": "create-tweaked-controllers",
    "name": "Create: Tweaked Controllers"
  },
  {
    "id": "create-vibrant-vaults",
    "name": "Create: Vibrant Vaults"
  },
  {
    "id": "create-vintage-unofficial-port",
    "name": "Create: Vintage"
  },
  {
    "id": "create-winery",
    "name": "Create: Winery"
  }
]);

export const CREATE_ADDON_IDS = Object.freeze(CREATE_ADDONS.map((a) => a.id));
