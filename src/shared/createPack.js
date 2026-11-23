// OTOMATİK ÜRETİLDİ — elle düzenleme: node scripts/import-create-pack.js <paket.mrpack>
// Tek oyunculu "Create (+ eklentiler)" paketi (main süreci). Klima SMP paketi bunu kullanmaz.
const CREATE_PACK = Object.freeze({
  "name": "All of Create (1.21.1 NeoForge)",
  "version": "1.0.0",
  "minecraft": "1.21.1",
  "neoforge": "21.1.267",
  "mods": [
    {
      "id": "appleskin",
      "name": "AppleSkin",
      "file": "appleskin-neoforge-mc1.21-3.0.9.jar",
      "url": "https://cdn.modrinth.com/data/EsAfCjCV/versions/uAKA6Laj/appleskin-neoforge-mc1.21-3.0.9.jar",
      "sha512": "f4ea46273e407334b63e262e2555c9a8204f7b5e60f23f272fbaa83ad9e88800e0ee186aca840710df2dbe0a18b37758695fef2ae1a902c10b3706e3de772937",
      "size": 75804,
      "fixed": false,
      "requires": []
    },
    {
      "id": "architectury-api",
      "name": "Architectury API",
      "file": "architectury-13.0.12-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/lhGA9TYQ/versions/xGfBrBzj/architectury-13.0.12-neoforge.jar",
      "sha512": "286127f99708d1e2723e1dcc9104ebcab258f04db92040fc2394e5b7faf36d731ef3b84e592d94ec0d0f7f899eca84f806b1e012223da4894d4d8af5030ffe0f",
      "size": 584731,
      "fixed": true,
      "requires": []
    },
    {
      "id": "azimuth-api",
      "name": "Azimuth API",
      "file": "azimuth-1.4.10.jar",
      "url": "https://cdn.modrinth.com/data/RpH8tmT1/versions/dxtZVosY/azimuth-1.4.10.jar",
      "sha512": "29d2ee1b146d91047bc265a4902d43c20a825005921aeb9c7c4e96be0ae880b1bc842ca5e2b9c607dc46bede744ab023dc5ba8876ac8892f06d3550637819349",
      "size": 143818,
      "fixed": true,
      "requires": [
        "create"
      ]
    },
    {
      "id": "bellsandwhistles",
      "name": "Create: Bells & Whistles",
      "file": "bellsandwhistles-0.4.7-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/gJ5afkVv/versions/w0mifib8/bellsandwhistles-0.4.7-1.21.1.jar",
      "sha512": "482ee096477b89ed8ec5ce008a4a8ac0ae853079a4f5ce16ad0e0dd9b2eb12b3326f17acaaca1eae0bc51ad238f4e51c8d5b93ded71fe7240717ac8600041c59",
      "size": 193619,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "big-contraptions",
      "name": "Create: Big Contraptions",
      "file": "bigcontraptions-neoforge-1.0.jar",
      "url": "https://cdn.modrinth.com/data/jv0UKGOX/versions/F92BjGXG/bigcontraptions-neoforge-1.0.jar",
      "sha512": "70830507e68f9c12e6b908d5fc030c960fcd7137078d7abcab48362bd68fa08c01fa7ae4207e5510b87ec47ec69f36d8dd933791a0175765c0cdfefdc138f98e",
      "size": 5861,
      "fixed": false,
      "requires": []
    },
    {
      "id": "blocks-bogies",
      "name": "Create: Blocks & Bogies",
      "file": "create_bb-1.0.8-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/j4ARnQwY/versions/nC19ZMKK/create_bb-1.0.8-1.21.1.jar",
      "sha512": "9f40b8c13f3acad65c479ae763c9cb1d27edf8c391746719409b72f01b1d7396a0d39db907fb7e5c3d97b57b24a27b6b5e2f16cc454c3d73e874dd30ec548e1b",
      "size": 2618795,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "copycats",
      "name": "Create: Copycats+",
      "file": "copycats-3.0.11+mc.1.21.1-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/UT2M39wf/versions/zLlVJXf0/copycats-3.0.11%2Bmc.1.21.1-neoforge.jar",
      "sha512": "2487a341060483e670a9fe5f5b4994470c6a9b048c7be061451f859b1861eae4cd15dc75e693a4588942b7c07f56f67b689c8fc8a99de93cc8cf531536684c84",
      "size": 1805121,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create",
      "name": "Create",
      "file": "create-1.21.1-6.0.10.jar",
      "url": "https://cdn.modrinth.com/data/LNytGWDc/versions/UjX6dr61/create-1.21.1-6.0.10.jar",
      "sha512": "11cc8fc049d2f67f6548c7abfada6b82a3adb5c7ca410a742de04bbca76e03862c518721b88d806f6e6d768a4d68531fdb903a85859b25d1484d550cc7bafd4b",
      "size": 19123767,
      "fixed": true,
      "requires": []
    },
    {
      "id": "create_factory_logistics",
      "name": "Create Factory Logistics",
      "file": "create_factory_logistics-1.21.1-1.6.1-all.jar",
      "url": "https://cdn.modrinth.com/data/QMGO17gm/versions/6lav8Nc5/create_factory_logistics-1.21.1-1.6.1-all.jar",
      "sha512": "c3b08e7fae0c6f47a4f576f4126b298dddf3b184a14b15c679dc8c238c9f0667bccca67a90388d28d9157216c383664baa6d9cf8213b3137093f1afb23ba19e0",
      "size": 1303123,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-additional-logistics",
      "name": "Create: Additional Logistics",
      "file": "createadditionallogistics-1.21.1-1.4.5.jar",
      "url": "https://cdn.modrinth.com/data/CZaz7aje/versions/soesZiME/createadditionallogistics-1.21.1-1.4.5.jar",
      "sha512": "0223a647558844c2a8c02ce63c78abade83f63013dbd4e09a5edbdb6e05a16f2c504f7328a113e5dca088cc112dc59f102f08e839ed1ebc5d9ed40a83481cb8a",
      "size": 953230,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-aeronautics",
      "name": "Create Aeronautics",
      "file": "create-aeronautics-bundled-1.21.1-1.3.3.jar",
      "url": "https://cdn.modrinth.com/data/oWaK0Q19/versions/demX2roU/create-aeronautics-bundled-1.21.1-1.3.3.jar",
      "sha512": "e28026fd6447b997f2c9b81c1d939094cf26c5c8572c6194b65282106f17257729efaecec670d0f2c84c6d7b2160102b08abb4e5822cf0fc01a4f4c74e5640a8",
      "size": 33133981,
      "fixed": false,
      "requires": [
        "create",
        "sable"
      ]
    },
    {
      "id": "create-aquatic-ambitions",
      "name": "Create: Aquatic Ambitions",
      "file": "create_aquatic_ambitions-1.21.1-2.0.4.jar",
      "url": "https://cdn.modrinth.com/data/9SyaPzp7/versions/DoI3PpXj/create_aquatic_ambitions-1.21.1-2.0.4.jar",
      "sha512": "2150402262c8aefed2e4ce2dbf193fddcac61837983ebb7fe0a78d035c33229015033a63ff568fc1cfcf3914b4c5a3b511ebd8b1a8dc6e824a7a1d1639166c12",
      "size": 1074131,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-big-cannons",
      "name": "Create Big Cannons",
      "file": "createbigcannons-5.11.7+mc.1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/GWp4jCJj/versions/bOiDu0LS/createbigcannons-5.11.7%2Bmc.1.21.1.jar",
      "sha512": "24f414dfbb973a0f4d9c9b2aa059edc7bed4d23b4f39eb1f7d23a1d6b437e3b5d64cca6e4b85ff7eb2815743fa711d54ad652bffe96d1eb1234544716006440d",
      "size": 3771506,
      "fixed": false,
      "requires": [
        "create",
        "rpl"
      ]
    },
    {
      "id": "create-bits-n-bobs",
      "name": "Create: Bits 'n' Bobs",
      "file": "bits_n_bobs-2.3.5.jar",
      "url": "https://cdn.modrinth.com/data/T8bvmqVZ/versions/g9Lmjjc5/bits_n_bobs-2.3.5.jar",
      "sha512": "33aaa835f1b1774a2b2f14ed6015efdf47a5b3827e702814c651ccde08ef5fda7572f6734c3b0f136795b45972a153c8dfe330df708b6487e58e18a29c689cb8",
      "size": 2433531,
      "fixed": false,
      "requires": [
        "azimuth-api",
        "create",
        "strut-your-stuff"
      ]
    },
    {
      "id": "create-cafe",
      "name": "Create Cafe",
      "file": "createcafe-1.4.3.jar",
      "url": "https://cdn.modrinth.com/data/O3hKBfwC/versions/5CZzXBed/createcafe-1.4.3.jar",
      "sha512": "8f3d8d2cb9613f52e173b8df65c32bd86eb31f801bc47ad3e5ec6d4e08217b2035bb440d7031f3b1e50a00aa54318f5c73d8232e862b6bb7487147cf7e8b157d",
      "size": 390889,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-central-kitchen",
      "name": "Create: Central Kitchen",
      "file": "create-central-kitchen-2.6.2b.jar",
      "url": "https://cdn.modrinth.com/data/btq68HMO/versions/qZxkZR8W/create-central-kitchen-2.6.2b.jar",
      "sha512": "d4d0a383b5288a7272392ae475d67bc947cd019bc627612bd01992f5ecd702bda078fe75302b83c9619eb26a754195e9ef5f2212cb200eef802bb7d49c255358",
      "size": 511818,
      "fixed": false,
      "requires": [
        "create",
        "create-dragons-plus"
      ]
    },
    {
      "id": "create-confectionery",
      "name": "Create Confectionery",
      "file": "create-confectionery1.21.1_v1.1.3b.jar",
      "url": "https://cdn.modrinth.com/data/WPE5gRs9/versions/ndnETBEN/create-confectionery1.21.1_v1.1.3b.jar",
      "sha512": "ee299e0b3fc12edc506f7385a44eef207fcdc30ba6a0d30248614eed3486f78c661d9a176cb715eba044ac1a4255e38aa522bdd4b3fc1778049625108e114e82",
      "size": 2127265,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-connected",
      "name": "Create: Connected",
      "file": "create_connected-1.3.3-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/Vg5TIO6d/versions/Xe7EqzfQ/create_connected-1.3.3-mc1.21.1.jar",
      "sha512": "485675693980a266611669857fa9cd348e2a29140b87bf0a8ab3e13c3591422cceaa36b7a2eb90084d35ec1868c8eec9f924383bb4dada2dddcb72e9f09361b0",
      "size": 6786783,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-contraption-terminals",
      "name": "Create Contraption Terminals",
      "file": "createcontraptionterminals-1.21-1.4.0.jar",
      "url": "https://cdn.modrinth.com/data/gOPAFzp0/versions/gBvq8zOa/createcontraptionterminals-1.21-1.4.0.jar",
      "sha512": "7ee2c06c244223e6f8a49a80ce617f88983e57e68bb3d34f80a90989279e4982aad6914f44881e078db394bae4a2f2ce94e08f31b187e941fc1978f7951ad824",
      "size": 91226,
      "fixed": false,
      "requires": [
        "create",
        "toms-storage"
      ]
    },
    {
      "id": "create-curios-backtank",
      "name": "Create: Curios Backtank",
      "file": "create_curios_backtank-neoforge-1.21.1-1.0.2.jar",
      "url": "https://cdn.modrinth.com/data/WuKy9y7l/versions/dUEAeRGL/create_curios_backtank-neoforge-1.21.1-1.0.2.jar",
      "sha512": "310a66c96088282ae062dbd4e8c87cc398f23f77b74cced9119c90b3bc4091945d7b883f92ac21b8cd9037535e65eb376b6d268f28a993f99e9836cce76d687a",
      "size": 596682,
      "fixed": false,
      "requires": [
        "create",
        "curios"
      ]
    },
    {
      "id": "create-deco",
      "name": "Create Deco",
      "file": "createdeco-2.1.3.jar",
      "url": "https://cdn.modrinth.com/data/sMvUb4Rb/versions/qrcMVoBD/createdeco-2.1.3.jar",
      "sha512": "c536662f9d47ad57a37419165ded14835b23ad6c3e82a920298ecd7ee074244b0b6062ef9cc7ea4501ddd35919a840faccd7fc64e43eb8df31e12076681c3c0d",
      "size": 3328498,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-design-n-decor",
      "name": "Create: Design n' Decor",
      "file": "Design-n-Decor-1.21.1-2.2b.jar",
      "url": "https://cdn.modrinth.com/data/x49wilh8/versions/uQsIRky8/Design-n-Decor-1.21.1-2.2b.jar",
      "sha512": "d888553c8a254c3654f8da2ae2cae0bb642594546c71988739c93bf6b18668145e0ce5b1c20ae0544b9b6019f17e4da944bd5bc17e4c6b73e7f1374cfa2c9db9",
      "size": 6329899,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-diesel-generators",
      "name": "Create: Diesel Generators",
      "file": "createdieselgenerators-1.21.1-1.3.16.jar",
      "url": "https://cdn.modrinth.com/data/ZM3tt6p1/versions/yzsE99E2/createdieselgenerators-1.21.1-1.3.16.jar",
      "sha512": "af43bdbceb4b3443833ee8e97ff7b516516c3bd785efb7e4fd6befb436f65964e53ead3bec77a45ef86ebb2d8057f9cd6c85fda2eff87707c2c7becd0e3c85fb",
      "size": 3155795,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-dragons-plus",
      "name": "Create: Dragons Plus",
      "file": "CreateDragonsPlus-1.11.9.jar",
      "url": "https://cdn.modrinth.com/data/dzb1a5WV/versions/b0u9vk8C/CreateDragonsPlus-1.11.9.jar",
      "sha512": "43299e49afe7132515aa8ad545b8c9566d90f12cfb39456b3d6e1ebc8e03f05787fbc420e7cc9495df4d6b585d13e7a4c4c7385f82f20aeb829c9491b725af53",
      "size": 1085674,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-dreams-and-desires",
      "name": "Create: Dreams & Desires",
      "file": "DnDesires-1.21.1-2.3a-BETA.jar",
      "url": "https://cdn.modrinth.com/data/JmybsfWs/versions/bqMxf6Ua/DnDesires-1.21.1-2.3a-BETA.jar",
      "sha512": "c2d70c5ef259d20ba60a66fa146fc0d37b588c5c42c0028a650af1e10678c4e4604966aa46efd25f3824df4620ef719daa8e54fc82220d7a1b22a7fcaa4e2077",
      "size": 1249099,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-encased",
      "name": "Create Encased",
      "file": "Create_Encased-1.21.1-1.10.1-fix1.jar",
      "url": "https://cdn.modrinth.com/data/hSSqdyU1/versions/tFR79nyG/Create%20Encased-1.21.1-1.10.1-fix1.jar",
      "sha512": "3d0b98164205c6621bf4f3cbbf9b56c232ab760dbc9ddeaa90401c4fb5afdcef4e6bfe69c4f797d3895ee7b4c82bf1b890cfe5923bc1c927b3f5ef5308b81af4",
      "size": 3396620,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-enchantable-machinery",
      "name": "Create: Enchantable Machinery",
      "file": "createenchantablemachinery-3.6.0+mc1.21.1-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/eqrvp4NK/versions/Cw5k6c0a/createenchantablemachinery-3.6.0%2Bmc1.21.1-neoforge.jar",
      "sha512": "1dda17f32d92b92ac2e953f7cc28efd6be4d627ca85f4639654bbc3acdc9c879bf0c1fc2f66e0956874d6e21928c1556df1630ee2243d67683e1eefe26312fc7",
      "size": 575739,
      "fixed": false,
      "requires": [
        "create",
        "kotlin-for-forge"
      ]
    },
    {
      "id": "create-enchantment-industry",
      "name": "Create: Enchantment Industry",
      "file": "create-enchantment-industry-2.4.2.jar",
      "url": "https://cdn.modrinth.com/data/JWGBpFUP/versions/qUpvzZ83/create-enchantment-industry-2.4.2.jar",
      "sha512": "16bd3dcd82159d6793bd9cc24dcb911b90e838c67f781581afea8c6af21f53106ac54de7f2dffe1a8576cf8908e68658538a1c76d3c44691109a24bc60460436",
      "size": 1283517,
      "fixed": false,
      "requires": [
        "create",
        "create-dragons-plus"
      ]
    },
    {
      "id": "create-factory",
      "name": "Create: Factory",
      "file": "create_factory-0.7b-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/j6Zt3N7W/versions/OA9Dvj5m/create_factory-0.7b-1.21.1.jar",
      "sha512": "4acc37144a644ea0ddc1290e2419b2eb852e38faa48992f702afc2555162fcc8baa9b79c9dab2f77da57b5b530011ad737cf638ba4813053a63c43b3a554d485",
      "size": 212765,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-fast-schematic-cannon",
      "name": "Create: FastSchematicCannon",
      "file": "CreateFastSchematicCannon-1.4.1-neoforge-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/DebMSCVn/versions/e70DdjWe/CreateFastSchematicCannon-1.4.1-neoforge-1.21.1.jar",
      "sha512": "87f7522b54b8cfaf0c1c5b2265b796d05ddc4234e1143bbc1c7c1e853e6c0a5183e077a5d929b4b4b0db40468d6b0149a46be9ef9b0d02827e6025fd448a1fb6",
      "size": 74294,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-flight-control",
      "name": "Create: Flight Control",
      "file": "create_flight_control-neoforge-0.8.5.jar",
      "url": "https://cdn.modrinth.com/data/IGVrnkhH/versions/7EiOHIDJ/create_flight_control-neoforge-0.8.5.jar",
      "sha512": "a05198650a2299494ac32f9ddc6ecb97ceae41802b90c8647167aee9c0a796c1387eef5e1dbaedc4d7b4d3a254742ef45866514531c6c8805f7f872613b8073a",
      "size": 6099288,
      "fixed": false,
      "requires": [
        "create",
        "create-aeronautics",
        "geckolib"
      ]
    },
    {
      "id": "create-garnished",
      "name": "Create: Garnished",
      "file": "garnished-2.1.9.2+1.21.1-neoforged.jar",
      "url": "https://cdn.modrinth.com/data/6e2SlzR4/versions/EKUHxs6i/garnished-2.1.9.2%2B1.21.1-neoforged.jar",
      "sha512": "fe29eb676d6534e0063d1b7468130ad298bd40ac4c9e6703aee622d504da3cdca943dce22a815921d6291bf2f08a431ae671d6d165aaa5d9b4a5bc540928f6b6",
      "size": 3725336,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-horse-power",
      "name": "Create Horse Power",
      "file": "createhorsepower-1.21.1-1.1.0.jar",
      "url": "https://cdn.modrinth.com/data/9Qm19XSM/versions/yj7NF0iZ/createhorsepower-1.21.1-1.1.0.jar",
      "sha512": "cb39a04f01508344ffa87fb6bad88a8d9fcf6b4b9c24b2b3b97ade1e290a579f1a7933b2355bd8c2953944b8aa81f246066bb99f0821bae503f4947075d9b42e",
      "size": 258688,
      "fixed": false,
      "requires": [
        "create",
        "jei"
      ]
    },
    {
      "id": "create-integrated-farming",
      "name": "Create: Integrated Farming",
      "file": "create-integrated-farming-1.4.4.jar",
      "url": "https://cdn.modrinth.com/data/9k1pAsfR/versions/3WTN4xaW/create-integrated-farming-1.4.4.jar",
      "sha512": "0c3dc2f79cb6f8f10c0b2eaf8dda384db4b22d775d7bdc8d9a18397dfa462f342e01e97972d3ba87de12771926f1f78709116da95d7321c94f321cd989a10546",
      "size": 869542,
      "fixed": false,
      "requires": [
        "create",
        "create-dragons-plus"
      ]
    },
    {
      "id": "create-ironworks",
      "name": "Create: Ironworks",
      "file": "create_ironworks-4.0.3-neoforge-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/FZb6dmQf/versions/91r9PehB/create_ironworks-4.0.3-neoforge-1.21.1.jar",
      "sha512": "1d121e4f6ba2464976a83925053a0d28a43e692d337890c33a24ce4cf7fb8fd34abfd3ce37293bf18b14ff45a665e29a8d6ff71212a0a75404d9e1c24a22347f",
      "size": 824925,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-jetpack",
      "name": "Create Jetpack",
      "file": "create_jetpack-forge-5.2.1.jar",
      "url": "https://cdn.modrinth.com/data/UbFnAd4l/versions/sCwiqLqq/create_jetpack-forge-5.2.1.jar",
      "sha512": "dd9856cf9f84d58174bcdb097f405a107d86d0947ab3d67f090994ed3a4939cc9d52bab0f56f988cd290b1e8f68d534c3e9155e33a1d67983d80923f3b67f4f3",
      "size": 495109,
      "fixed": false,
      "requires": [
        "create",
        "kotlin-for-forge"
      ]
    },
    {
      "id": "create-liquid-fuel",
      "name": "Create: Liquid Fuel",
      "file": "createliquidfuel-3.0.0-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/sH9tXU9f/versions/rLn2bDVE/createliquidfuel-3.0.0-1.21.1.jar",
      "sha512": "3925e0f7e7b883d719c12c2cdd409fa954fbd53cbb63295764fdf06d57f63553b5dd99f94ae69b071a2aa17fb5bff53817e3394191d8933f7916220861e1bc76",
      "size": 21815,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-mechanical-extruder",
      "name": "Create Mechanical Extruder",
      "file": "create_mechanical_extruder-1.21.1-2.2.2-6.0.10.jar",
      "url": "https://cdn.modrinth.com/data/hGAlcCDJ/versions/fFDOEXAA/create_mechanical_extruder-1.21.1-2.2.2-6.0.10.jar",
      "sha512": "efeb01312cb00800cc11e7765759b31058719e6a7c62744b453d242c4da7b75091b68eef2f489054a1244244a63672a46f4822a580eb8d8c64045a189e671827",
      "size": 523501,
      "fixed": false,
      "requires": [
        "create",
        "mechanicals-lib"
      ]
    },
    {
      "id": "create-mechanical-spawner",
      "name": "Create Mechanical Spawner",
      "file": "create_mechanical_spawner-1.21.1-1.3.2-6.0.10.jar",
      "url": "https://cdn.modrinth.com/data/T1hmeGi9/versions/k7Fepzl4/create_mechanical_spawner-1.21.1-1.3.2-6.0.10.jar",
      "sha512": "d7ec9b66a9461258bdfcf739bf46c151c78d8dbee2c8b839b14294af5d22b5e7cc39649b435440bc200ca87c863aa188c76e17d45d062818a0e55270d3e6f30c",
      "size": 1215649,
      "fixed": false,
      "requires": [
        "create",
        "mechanicals-lib"
      ]
    },
    {
      "id": "create-metallurgy",
      "name": "Create: Metallurgy",
      "file": "createmetallurgy-1.0.3-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/Soft45xC/versions/4RhIMmaJ/createmetallurgy-1.0.3-1.21.1.jar",
      "sha512": "e052bddbeb39b68c1482cfe2ebf9919db17d40d71e9f46f96375d82ec876dc0abb4e15b2c14cd1a9e7636d7f80166b2ec336507df7fcc452fd871cc4873ef881",
      "size": 2035560,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-metalwork",
      "name": "Create: Metalwork",
      "file": "createmetalwork-neoforge-1.21.1-3.1.0.jar",
      "url": "https://cdn.modrinth.com/data/q5i9RTSJ/versions/pOXSlxMI/createmetalwork-neoforge-1.21.1-3.1.0.jar",
      "sha512": "df1d796cf49b6bc9e1438768c72c57f90428b956a560467a0fc3cf1907011f70caae4152164537424964e73093fe201d87cfc9208b3cfc95cf4ca926f7340b2c",
      "size": 3353402,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-misc-and-things",
      "name": "Create: Misc and Things",
      "file": "create_things_and_misc-4.1.1-neoforge-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/uWrs8XlB/versions/zfExofVB/create_things_and_misc-4.1.1-neoforge-1.21.1.jar",
      "sha512": "3e4530d97403cd8efabd3ac0dddfc2360b3c94b0cfc061ed36546a56d8857d1a4d95094c92087387c87904e117d3c05fd415d0f0062b9e3f83de7c663efb87b8",
      "size": 1055815,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-mobile-packages",
      "name": "Create: Mobile Packages",
      "file": "create_mobile_packages-1.21.1-0.7.8.jar",
      "url": "https://cdn.modrinth.com/data/1vXRfEHZ/versions/xSPt2JXH/create_mobile_packages-1.21.1-0.7.8.jar",
      "sha512": "f99ccd6762ac89e000c8d479d3bdb5b6fc85c371f03272c2886c1fba9c2b856b7f2caaf3e2a84281af88c264823af1d74dc0323f60f3670ab6c5e1c3bf5dc0f0",
      "size": 623172,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-molten-vents",
      "name": "Create: Molten Vents",
      "file": "molten_vents-1.21.1-2.1.1.jar",
      "url": "https://cdn.modrinth.com/data/uuVy6k1s/versions/By33YVeb/molten_vents-1.21.1-2.1.1.jar",
      "sha512": "2bfc64f786ca8f40abdae92a5d5183eb51174a98efe7794b7041840b83a495988614da654f983ef740a62d4571e4d5b0950854b336c4868fb77fabaec074337b",
      "size": 88500,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-more-girder",
      "name": "Create: More Girder",
      "file": "create-more-girder-2.3.0-neo.jar",
      "url": "https://cdn.modrinth.com/data/sPg2LVAd/versions/24zvpwoC/create-more-girder-2.3.0-neo.jar",
      "sha512": "b7ef4ffc87b15dfa344373378a433f80f11eb66491b448e2b7d7e5c070a5d6ccaf3f8bc330f272b5ab1491d727e7c1e427e82d6d074157a074e0fa38b181d672",
      "size": 1407593,
      "fixed": false,
      "requires": [
        "create",
        "strut-your-stuff"
      ]
    },
    {
      "id": "create-more-package-couriers",
      "name": "Create More: Package Couriers",
      "file": "cmpackagecouriers-neoforge-2.3.1.jar",
      "url": "https://cdn.modrinth.com/data/GRqrodjM/versions/aG9jHA8l/cmpackagecouriers-neoforge-2.3.1.jar",
      "sha512": "1b118ec4dd64a85499edee1342e148a2179bac0c63cdacc4aa4509aaed4e967e0640a45f443c3f6f2073bf08b414f0b483b362007872198bc95677d3c2ab790e",
      "size": 328843,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-new-age",
      "name": "Create: New Age",
      "file": "create-new-age-1.2.0+neoforge-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/FTeXqI9v/versions/IwtuwMZy/create-new-age-1.2.0%2Bneoforge-mc1.21.1.jar",
      "sha512": "5075c6482b800af7044b594ad694855e7d56f386cb0354967eafe99d77e84b4e26ee7f880d287672d24d84ea8086fd074b7695e46632f32f215b31ce859ada72",
      "size": 1644485,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-ore-excavation",
      "name": "Create Ore Excavation",
      "file": "createoreexcavation-1.21-1.6.8.jar",
      "url": "https://cdn.modrinth.com/data/ResbpANg/versions/tivxiPTo/createoreexcavation-1.21-1.6.8.jar",
      "sha512": "844ae32ff0d22f4d3c83db3bae2f6edc0f74cd1a530f900bf18829838d5a354b1e439e52688416130d9fd9a52c3310458bbdbc7458f4c1c1d8ffb088ae802d32",
      "size": 476990,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-pattern-schematics",
      "name": "Create: Pattern Schematics",
      "file": "create_pattern_schematics-2.0.10.jar",
      "url": "https://cdn.modrinth.com/data/cpqKG67r/versions/VSJhIkG2/create_pattern_schematics-2.0.10.jar",
      "sha512": "c55e7d708aab59990ea123b32b5ecca3cdd8a0409e441257e87ac2bc414c15a4976ed06fb4aea3f4c216c4951f519295bb111c896642fd80520bcfc9227e24ee",
      "size": 221764,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-power-loader",
      "name": "Create: Power Loader",
      "file": "create_power_loader-2.0.5-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/wPQ6GgFE/versions/3Y4r0ItR/create_power_loader-2.0.5-mc1.21.1.jar",
      "sha512": "e4f06cfe79eafa538a2edf45d0b173051475f2a20d6c2352668f6980f4433078f2cdd8ffdd047984c30dfd903142ea37eadde48ff71a3892f18154662f20eb57",
      "size": 442369,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-propulsion-simulated",
      "name": "Create Propulsion: Simulated",
      "file": "createpropulsion-1.1.5.jar",
      "url": "https://cdn.modrinth.com/data/ApkoHNO9/versions/H13U56dc/createpropulsion-1.1.5.jar",
      "sha512": "6096c9c5cb220219a0b58b56f9fefd63f8b79a0967d326727b4206d62df1813da73956aeae2fa5b839160a1bb5af8e099726d12d2d93f10e5f157beb85bb9c52",
      "size": 1707765,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-radars",
      "name": "Create: Radars",
      "file": "create_radar-5.1.1-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/BLu2Yqfq/versions/ES5qa3pY/create_radar-5.1.1-1.21.1.jar",
      "sha512": "4480f1c1e369e55cb0a8b26eb508ac92089946bbf099fc4d18a42886186e81eddd699b89bec3ed6ec954893e11d9a05584044e5cfe93add7fd964378ee25eba1",
      "size": 5729658,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-ratatouille",
      "name": "Create Ratatouille",
      "file": "create_ratatouille-1.21.1-1.4.0.jar",
      "url": "https://cdn.modrinth.com/data/XM0ifg8q/versions/c81IeQl2/create_ratatouille-1.21.1-1.4.0.jar",
      "sha512": "4d8b5a1430e5001e6d055f836a5de8cfb6454496d992403a06f092f90f9bdec485171c4577c1551b4d5d6356f35013bd76a6e14eb27c406cbb5a8c392c1c9cd1",
      "size": 918946,
      "fixed": false,
      "requires": [
        "create",
        "farmers-delight"
      ]
    },
    {
      "id": "create-steam-n-rails-1.21.1",
      "name": "Steam 'n' Rails Neoforge",
      "file": "railways-0.2.1+neoforge-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/L3Jv0QZI/versions/HOPX5oro/railways-0.2.1%2Bneoforge-mc1.21.1.jar",
      "sha512": "dac8efb7c8b4b525114c2548bd2a8254d3b1e9e44664ba84b0f4e8467e1584029f8a219dd1ddf4389ab0a94e525183ee7753d33babdf319926cd63d2fc9cdffd",
      "size": 12118736,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-storage-neo-forge",
      "name": "Create: Storage [Neo/Forge]",
      "file": "fxntstorage-1.3.9+mc-1.21.1-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/h6BAXuvn/versions/6LuJGX9g/fxntstorage-1.3.9%2Bmc-1.21.1-neoforge.jar",
      "sha512": "98230e2425cab13b00db96c05687969939de79e9203a0e33e7b8fe9b0577dd9e90e97dbc9e6b4d2269e46c33bda517e00feac9f60d1eda71f69a7b85a1cd89fc",
      "size": 1772245,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-structures-arise",
      "name": "Create: Structures Arise",
      "file": "Create-Structures-Arise-1.21.1-NeoForge-176.49.49.jar",
      "url": "https://cdn.modrinth.com/data/9enMEvoc/versions/bSLlGvYn/Create-Structures-Arise-1.21.1-NeoForge-176.49.49.jar",
      "sha512": "e5864441b5f7ab76841057b269afd52327682aa35119c1346adab02b890b43664b5ffe13519c7f36d2e831b7b3d4d9df4ac9e8032250d704f54faadf957f973b",
      "size": 1843340,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-stuff-additions",
      "name": "Create Stuff 'N Additions",
      "file": "create-stuff-additions1.21.1_v2.1.4b.jar",
      "url": "https://cdn.modrinth.com/data/aq9qUUQG/versions/gMWQ1LX9/create-stuff-additions1.21.1_v2.1.4b.jar",
      "sha512": "75cd8a0a2f898b3599cb267c26c02691e53f8ca8f6c6c4f16d1a82db8fea4494988f163559cc3a8b471683d5b52353ba065def8846a7ff2073bddf42e68b5e7d",
      "size": 1347181,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-threaded-trains",
      "name": "Create: Threaded Trains",
      "file": "createthreadedtrains-neoforge-1.21.1-1.0.0.jar",
      "url": "https://cdn.modrinth.com/data/RYJzdkDr/versions/ry1hvo4l/createthreadedtrains-neoforge-1.21.1-1.0.0.jar",
      "sha512": "93511d32e8c7484fdcfd90646d48f297ba3188788e0ea6412900be38ae6b82e69bc131bbb011519b52ac0728a7dfd531c0ac356a7935335c06f691ad20e38c69",
      "size": 77249,
      "fixed": true,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-tracks-plus",
      "name": "Create: Tracks+",
      "file": "tracks_plus-1.0.6b7.jar",
      "url": "https://cdn.modrinth.com/data/E8eHF2Yl/versions/qUDRhHla/tracks_plus-1.0.6b7.jar",
      "sha512": "b250a25a78de9fceeafd8d26c85d1b91948db903ea39e58df6afb6224e60268f59d42a40a3485cfaa705c2f501d0f73b6eaa25905457a0643a4873b12824db20",
      "size": 613537,
      "fixed": false,
      "requires": [
        "create",
        "create-aeronautics",
        "sable"
      ]
    },
    {
      "id": "create-trading-floor",
      "name": "Create: Trading floor",
      "file": "trading_floor-3.0.16.jar",
      "url": "https://cdn.modrinth.com/data/WROfLLvn/versions/K3nIvcWT/trading_floor-3.0.16.jar",
      "sha512": "6eaf42758446093c1923a9c325b955f7ec38933bc0b271559547b73b7dc9950e47a8256ca6f9baf13389ccc349da05a9e32d0f77e71a5f5b2c37080f3773148f",
      "size": 214343,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-train-perspective",
      "name": "Create: Train Perspective",
      "file": "create_train_perspective-1.1.1.jar",
      "url": "https://cdn.modrinth.com/data/MAuPqvf1/versions/dR2F5bfH/create_train_perspective-1.1.1.jar",
      "sha512": "e41edde5aefad71a88bda3ac53dc1f3b9c2c2d1cf879a3c23a96ee32edcc91408f94f3815a4cdd3b1015bc17b871e7c76ad6ab3bb9f1d5768d36338248c6da08",
      "size": 200650,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-transmission",
      "name": "Create: Transmission!",
      "file": "createtransmission-1.2.2+neoforge-create6-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/QFCkBuIh/versions/dOsq88jX/createtransmission-1.2.2%2Bneoforge-create6-1.21.1.jar",
      "sha512": "ed90c19f6e265a3862a2c96d95e9b204cb3b3be8b781d8364d0a2aea4d70877f5fe66056354da0fed2eb35fde22c6e4c2801b0cf31d8d7157e4933f1d8913233",
      "size": 250901,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-tweaked-controllers",
      "name": "Create: Tweaked Controllers",
      "file": "create_tweaked_controllers-1.21.1-1.2.7.jar",
      "url": "https://cdn.modrinth.com/data/H6bJ8Ju4/versions/csCe2v7f/create_tweaked_controllers-1.21.1-1.2.7.jar",
      "sha512": "9b2aa5fcf70afd97e2473bb3cd230119d95aeb4f7e7318cb44fd8959add97d0f22cbe660c6d43c9bdb25825b68f9a7a2c11e9c24d55a706bded72bc011ede270",
      "size": 303343,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-vibrant-vaults",
      "name": "Create: Vibrant Vaults",
      "file": "create_vibrant_vaults-0.3.2.jar",
      "url": "https://cdn.modrinth.com/data/hddN8ksR/versions/t17qYXjn/create_vibrant_vaults-0.3.2.jar",
      "sha512": "3bd53097482e614dc4e5e635778af25020fa27c1c453d4928d1d8baa6767c93cb300810a5ac0c49af86813749a180e3f092ab2e65b07e7741c2b12aaebd47006",
      "size": 2687938,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "create-vintage-unofficial-port",
      "name": "Create: Vintage",
      "file": "vintage-1.21.1-1.6.5.jar",
      "url": "https://cdn.modrinth.com/data/qVZh767G/versions/8Xn8084G/vintage-1.21.1-1.6.5.jar",
      "sha512": "b492110c7c189598c2cd4c542a19c9bc6fb89a9b0b91c88e7cf332876aa90b646afdce02fd2d829212667add860ef18dbddde7a0eda0f058a234c982304cfc14",
      "size": 1222628,
      "fixed": false,
      "requires": []
    },
    {
      "id": "create-winery",
      "name": "Create: Winery",
      "file": "create_winery-2.0.3-neoforge-1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/zBuk6egG/versions/mbnef0lU/create_winery-2.0.3-neoforge-1.21.1.jar",
      "sha512": "f27194287c41172e5f4f3c497c032537945f03e22b84993527b3efe3a6c60cf0371a7bc4121e0c7024ee0d3484d42e70996900d5d8b4b113135097120d4846ca",
      "size": 515392,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "createaddition",
      "name": "Create Crafts & Additions",
      "file": "createaddition-1.7.2.jar",
      "url": "https://cdn.modrinth.com/data/kU1G12Nn/versions/hsjVajlP/createaddition-1.7.2.jar",
      "sha512": "f3a3ddb5600189da818fc71ea659d17f0d1097c5ad664433eed400b3ecc67d0f9305b348e5b7c5fd872d7a6e51330c7158b3181e77192c576c205a74dd0298ff",
      "size": 1772844,
      "fixed": false,
      "requires": []
    },
    {
      "id": "createnuclear",
      "name": "Create Nuclear",
      "file": "createnuclear-2.0.1-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/z611fdf7/versions/zNIyk0mQ/createnuclear-2.0.1-neoforge.jar",
      "sha512": "f1bde1c921ae0091abaef338651778122923a9ac31218e6abb997d93cea60849f5a844e4d164aea485968d7125ed86dd09a3e635bd74a640b6bab2ccffc7ff42",
      "size": 8357375,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "curios",
      "name": "Curios API",
      "file": "curios-neoforge-9.6.0+1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/vvuO3ImH/versions/KJsZIQrT/curios-neoforge-9.6.0%2B1.21.1.jar",
      "sha512": "1453d7c970f37b357967dbdad080ed107e90eea2b151e88a5e51b271a38ac72686d47a328fb8b3125cb8c6069130b72ac4b1c023f18ba5244f7550e4599bf8a4",
      "size": 411707,
      "fixed": true,
      "requires": []
    },
    {
      "id": "entityculling",
      "name": "Entity Culling",
      "file": "entityculling-neoforge-1.12.1-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/NNAgCjsB/versions/DDaDZQ47/entityculling-neoforge-1.12.1-mc1.21.1.jar",
      "sha512": "c1818837b0e43f67fa4cd2cfffc2d57c17e579b405b215dd627e3ea68d0c000b56a79614cd41f20451ea7a687e9e9de66afe871f0b9bcec680699445ea0d9fa3",
      "size": 1523607,
      "fixed": true,
      "requires": []
    },
    {
      "id": "escalated",
      "name": "Create: Escalated",
      "file": "escalated-1.3.2+mc.1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/LyOBYG8Q/versions/vJ49zRJl/escalated-1.3.2%2Bmc.1.21.1.jar",
      "sha512": "6989262104ab83d79c14fef15a19c7bcdbfb46ef7659f3c41a8421df57c6754e3bd8ce20de37b9200bfb7cb84da0977001385cfa489803efc02273419f248429",
      "size": 512624,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "farmers-delight",
      "name": "Farmer's Delight",
      "file": "FarmersDelight-1.21.1-1.3.4.jar",
      "url": "https://cdn.modrinth.com/data/R2OftAxM/versions/XTVZDOol/FarmersDelight-1.21.1-1.3.4.jar",
      "sha512": "1f6f8796469f747cff36f477b4f589a3d69613882399f9ee7f86db36c7bca9aa4828731f43db15dc6c7f5a4c1bbe3d4092a232e8cef010b09cec0581848fda90",
      "size": 3160490,
      "fixed": false,
      "requires": []
    },
    {
      "id": "ferrite-core",
      "name": "FerriteCore",
      "file": "ferritecore-7.0.3-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/uXXizFIs/versions/x7kQWVju/ferritecore-7.0.3-neoforge.jar",
      "sha512": "19af89a2075bb10a63884fa853ebf84b02c79dc3242430ecdad056fd764fdcde367a7303276b329df01b0736e2ef264c5d80c7dc92c6aebd244f556a230bb417",
      "size": 121559,
      "fixed": true,
      "requires": []
    },
    {
      "id": "geckolib",
      "name": "Geckolib",
      "file": "geckolib-neoforge-1.21.1-4.9.4.jar",
      "url": "https://cdn.modrinth.com/data/8BmcQJ2H/versions/nxAPSFAR/geckolib-neoforge-1.21.1-4.9.4.jar",
      "sha512": "3309f8cd15b653b898b7ab4f4f7991d59855218003ee951a481ebf12512f34b29e4c11ba2352100f3e45f273fa1b8e65be8c1e1202599e5faa9f08da929e688f",
      "size": 639063,
      "fixed": true,
      "requires": []
    },
    {
      "id": "hypertube",
      "name": "Create: Hypertubes",
      "file": "create_hypertube-0.6.1-NEOFORGE.jar",
      "url": "https://cdn.modrinth.com/data/ATDdrG1y/versions/j9cqY9tG/create_hypertube-0.6.1-NEOFORGE.jar",
      "sha512": "9f7798a20a520707704eb09d1463041ebdbb418dd14fff540c062b7abe1611861e322455ee6f612e4e76b416774f22c610be6bfc66caa856f66ae26a9c864e88",
      "size": 551681,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "interiors",
      "name": "Create: Interiors",
      "file": "interiors-1.21.1-neoforge-0.6.1.jar",
      "url": "https://cdn.modrinth.com/data/r4Knci2k/versions/gBrfZy6S/interiors-1.21.1-neoforge-0.6.1.jar",
      "sha512": "68b0d915e41fb0ce9d12a8c580d688a604770ded2b21e963058aa6d80cbc5661c481416d051a541395b5c79f461edcb658046e53cfcfb405179a450662ed01b5",
      "size": 486912,
      "fixed": false,
      "requires": []
    },
    {
      "id": "jade",
      "name": "Jade",
      "file": "Jade-1.21.1-NeoForge-15.10.6.jar",
      "url": "https://cdn.modrinth.com/data/nvQzSEkH/versions/eYz2YBGT/Jade-1.21.1-NeoForge-15.10.6.jar",
      "sha512": "dad9755dce8d85d914fc4df2baa0211f13e5839a71c1925fdd01f69081a95e30a2934e6273f8b01f0169adebe7a9dae57a8d904de0c4cb36dc17369bb474f0f2",
      "size": 726853,
      "fixed": false,
      "requires": []
    },
    {
      "id": "jei",
      "name": "Just Enough Items (JEI)",
      "file": "jei-1.21.1-neoforge-19.64.0.455.jar",
      "url": "https://cdn.modrinth.com/data/u6dRKJwZ/versions/iv3KiVkE/jei-1.21.1-neoforge-19.64.0.455.jar",
      "sha512": "fdd02e57ce4dcf20b69860a5ace1b97d9a771486241179cf9edfe71e30c69bb4003b046d0cce8d8c4913b9689f1d8b04cf0542b0b04a6cf0b3b0465f3bb11702",
      "size": 2375741,
      "fixed": true,
      "requires": [
        "mezzconfig"
      ]
    },
    {
      "id": "kotlin-for-forge",
      "name": "Kotlin for Forge",
      "file": "kotlinforforge-5.13.0-all.jar",
      "url": "https://cdn.modrinth.com/data/ordsPcFz/versions/9ZlVvei8/kotlinforforge-5.13.0-all.jar",
      "sha512": "64a26f73e3299ad09b350d3421e3f97a5ccd158d1936fb50fc57f3c88bf6fd33814568bf43a0886f79ada4be65d65d232d9e20a901833150ec5b89a01c46d459",
      "size": 7364729,
      "fixed": true,
      "requires": []
    },
    {
      "id": "mechanicals-lib",
      "name": "Mechanicals Lib",
      "file": "mechanicals-1.21.1-1.1.6.jar",
      "url": "https://cdn.modrinth.com/data/ProvjTA7/versions/GBSlpwLT/mechanicals-1.21.1-1.1.6.jar",
      "sha512": "84bfcd2cbd061eb1516fc2adbca0e599a38372b80ef9f5713de70be48d072243b1c5cb84c13177c35f333b6bcf16aa1f70dbd0964ed18e14c2bff733c531c6bc",
      "size": 2022181,
      "fixed": true,
      "requires": []
    },
    {
      "id": "mezzconfig",
      "name": "MezzConfig",
      "file": "mezz_config-1.21.1-neoforge-0.7.1-standalone.jar",
      "url": "https://cdn.modrinth.com/data/7tEfOcA7/versions/V6oWFnxW/mezz_config-1.21.1-neoforge-0.7.1-standalone.jar",
      "sha512": "e3576344d96b4734d35c7ceb969020ef728a666b771fb6da0465d08d940daff3c48352f6f3ca989edbe7fff57737d2fea4621f6422e858f95efe9fa70b46dfb2",
      "size": 347249,
      "fixed": true,
      "requires": []
    },
    {
      "id": "modernfix",
      "name": "ModernFix",
      "file": "modernfix-neoforge-5.27.27+mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/nmDcB62a/versions/ZDZENbHH/modernfix-neoforge-5.27.27%2Bmc1.21.1.jar",
      "sha512": "af14a35e51f1c5d94139c6225ae641e8b0ded5a8c68eb4806cf28025d6c043455ac289902cd6b854a867320ab845ad619b186d02b8341822faf03f4476dec555",
      "size": 614138,
      "fixed": true,
      "requires": []
    },
    {
      "id": "numismatics",
      "name": "Create: Numismatics",
      "file": "CreateNumismatics-1.1.0+neoforge-mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/Jdbbtt0i/versions/kVi3TESX/CreateNumismatics-1.1.0%2Bneoforge-mc1.21.1.jar",
      "sha512": "f0a8e65828f4a36c500f4f2cad99dce89f4899711f3ebe4b8a691bf26a8be9ac8f83386507f87aaead712ab8c5f8a847cd06befb1927cb1f81de95f6cb6b7754",
      "size": 1894517,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "power-grid",
      "name": "Create: Power Grid",
      "file": "powergrid-mc1.21.1-0.6.2.jar",
      "url": "https://cdn.modrinth.com/data/eWiBLJ9R/versions/jCkPHjmP/powergrid-mc1.21.1-0.6.2.jar",
      "sha512": "60307e23a27526d22bf753d387edef5a2f2a063a04a47b69e98b7f71bbad32fdf17e05f9838008e47a5999a60e5e77a91f0695215d0ab57694f0034fde9873ca",
      "size": 5738480,
      "fixed": false,
      "requires": [
        "architectury-api",
        "create"
      ]
    },
    {
      "id": "rpl",
      "name": "Ritchie's Projectile Library",
      "file": "ritchiesprojectilelib-2.1.2+mc.1.21.1-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/B3pb093D/versions/hZ6B2Z0x/ritchiesprojectilelib-2.1.2%2Bmc.1.21.1-neoforge.jar",
      "sha512": "6d64c84505a5a8fbb96d106603065465c5a2314ec09636900c5c1a31014c12fa68f1a41e758313cbf0d6f95d9a1f53bd67339020f7d8db0e184c23f66aee0330",
      "size": 76369,
      "fixed": true,
      "requires": []
    },
    {
      "id": "sable",
      "name": "Sable",
      "file": "sable-neoforge-1.21.1-2.0.6.jar",
      "url": "https://cdn.modrinth.com/data/T9PomCSv/versions/fg9dTRz9/sable-neoforge-1.21.1-2.0.6.jar",
      "sha512": "76d293ce751a01cb9c095a3659b0a41e03e005480bc9d76dfdc73ec7c2eabf7923740c7b077921d42616673c496cd5143569f2085ddcebe174fd91d81e2a04b8",
      "size": 12986135,
      "fixed": true,
      "requires": []
    },
    {
      "id": "slice-and-dice",
      "name": "Create Slice & Dice",
      "file": "sliceanddice-4.3.4-neoforge.jar",
      "url": "https://cdn.modrinth.com/data/GmjmRQ0A/versions/D6mQaFRW/sliceanddice-4.3.4-neoforge.jar",
      "sha512": "18fc9c70d2958ad6a0e7106ca2a5659d664fe9d5001a02afbd0c7d6980749764fcd90203abb2b9c6d7b1c8e564e421be04dfca1aeb25974371d7deeabf4b96a3",
      "size": 1356389,
      "fixed": false,
      "requires": [
        "create",
        "kotlin-for-forge"
      ]
    },
    {
      "id": "sodium",
      "name": "Sodium",
      "file": "sodium-neoforge-0.8.13+mc1.21.1.jar",
      "url": "https://cdn.modrinth.com/data/AANobbMI/versions/uMOpc5uV/sodium-neoforge-0.8.13%2Bmc1.21.1.jar",
      "sha512": "4f537696af95411e9daf15795fb5fcbc49913d488a96fa912fa8f1d7db408710995e8a1461190f3cd0f8217bf9e35e9539176592428ed587ca2d7aa84450a390",
      "size": 1292934,
      "fixed": true,
      "requires": []
    },
    {
      "id": "some-assembly-required",
      "name": "Create: Some Assembly Required",
      "file": "someassemblyrequired-5.2.8.jar",
      "url": "https://cdn.modrinth.com/data/jZi8ogTA/versions/G8Lz8Txm/someassemblyrequired-5.2.8.jar",
      "sha512": "de9c76595188852b187718aaf6287a6057e4135b5f45dfe9201b302ccdd0a5cf967314e1025c305b4fdcbcc94d1dcab8a379e8488f6adedbf3e9eb2f959ff9cc",
      "size": 451898,
      "fixed": false,
      "requires": [
        "farmers-delight"
      ]
    },
    {
      "id": "strut-your-stuff",
      "name": "Strut Your Stuff (Struts)",
      "file": "struts-1.3.1.jar",
      "url": "https://cdn.modrinth.com/data/sHO3MhQx/versions/BOTN7zzN/struts-1.3.1.jar",
      "sha512": "f7c9c3b66c926c163a8c747d3b50c45589f1796711bc9de0e3bb3f024cb18a552e9b7df6e667b813d12aba50377a39a1cd80a493925f164deb89c8a9dc709f49",
      "size": 216678,
      "fixed": true,
      "requires": []
    },
    {
      "id": "tfmg-community-edition",
      "name": "Create: TFMG Community Edition",
      "file": "tfmg-1.21.1-1.3.3a-community.jar",
      "url": "https://cdn.modrinth.com/data/hC1xYvnS/versions/o8aSx7yp/tfmg-1.21.1-1.3.3a-community.jar",
      "sha512": "fe59e45a6da83bad2afbec3b0f434b8791f317edefe6b53213e8dc3f75f4c8c0f37823f40ce9af463165952b983b908ad1974d4b8704e08687571925c9584d66",
      "size": 5631220,
      "fixed": false,
      "requires": [
        "create"
      ]
    },
    {
      "id": "toms-storage",
      "name": "Tom's Simple Storage Mod",
      "file": "toms_storage-1.21-2.4.2.jar",
      "url": "https://cdn.modrinth.com/data/XZNI4Cpy/versions/WQAMoIMC/toms_storage-1.21-2.4.2.jar",
      "sha512": "53db61b4486616b3a78dfff83b58f9424dd9bf525ea3db4e444ff0403fb70aa9ab7fc097dff2f49665e480bce936b32be76b3051a5aff217898b2b94d846d30b",
      "size": 856803,
      "fixed": false,
      "requires": []
    }
  ]
});

module.exports = { CREATE_PACK };
