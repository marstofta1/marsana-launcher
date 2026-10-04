'use strict';

// Mojang version JSON'undaki `arguments.jvm` listesinden, launcher'in oyuna
// AYNEN aktarmasi gereken sabit JVM bayraklarini secen saf fonksiyon (yan etkisiz;
// kolay test edilir).
//
// Sorun: MCLC v3 `arguments.jvm` listesini hic okumuyor, kendi sabit JVM
// argumanlarini kullaniyor. Mojang yeni surumlerde oraya zorunlu bayraklar koyuyor:
//   26.2: --sun-misc-unsafe-memory-access=allow, --enable-native-access=ALL-UNNAMED
//   26.3: -XX:StackShadowPages=32, --enable-native-access=ALL-UNNAMED,
//         --add-exports java.base/jdk.internal.misc=ALL-UNNAMED
// 26.3'te bunlar eksik kalinca (ozellikle StackShadowPages; varsayilan 8) oyun
// jvm.dll icinde rastgele anlarda 0xC0000005 (3221225477) ile kapaniyor.
//
// Kural:
//   - Yalnizca string girdiler alinir. Kural nesneleri (OS/mimari kosullu) atlanir:
//     HeapDumpPath'i MCLC, -XstartOnFirstThread'i launchService zaten ekliyor.
//   - `${...}` yer tutucusu iceren girdiler atlanir (java.library.path, classpath,
//     natives_directory, launcher_name...) — bunlari MCLC kendi yontemiyle kuruyor.
//   - Degeri yer tutucu olan ciplak bayrak (`-cp` + `${classpath}`) da atlanir.

const PLACEHOLDER = /\$\{[^}]*\}/;

function isBareFlag(entry) {
  return entry.startsWith('-') && !entry.includes('=');
}

function extractPassthroughJvmArgs(versionJson) {
  const jvm = versionJson && versionJson.arguments && versionJson.arguments.jvm;
  if (!Array.isArray(jvm)) return [];
  const entries = jvm.filter((e) => typeof e === 'string');
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (PLACEHOLDER.test(entry)) continue;
    const next = entries[i + 1];
    if (isBareFlag(entry) && typeof next === 'string' && PLACEHOLDER.test(next)) continue;
    out.push(entry);
  }
  return out;
}

module.exports = { extractPassthroughJvmArgs };
