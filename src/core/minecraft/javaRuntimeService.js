'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { LauncherError, Codes } = require('../infra/errors');

const execFileAsync = promisify(execFile);

const MOJANG_JAVA_INDEX =
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

const DOWNLOAD_CONCURRENCY = 8;

function parseJavaMajorFromVersionOutput(text) {
  const m = (text || '').match(/version "(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  if (m[1] === '1' && m[2]) return parseInt(m[2], 10);
  return parseInt(m[1], 10);
}

async function probeJavaMajor(executable) {
  try {
    const { stderr, stdout } = await execFileAsync(executable, ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseJavaMajorFromVersionOutput(stderr || stdout);
  } catch {
    return null;
  }
}

function javaMeetsGameRequirement(systemMajor, requiredMajor) {
  if (systemMajor == null || requiredMajor == null) return false;
  if (requiredMajor <= 8) return systemMajor === 8;
  return systemMajor >= requiredMajor;
}

function mojangRuntimeOsKey() {
  const { platform, arch } = process;
  if (platform === 'win32') {
    if (arch === 'x64') return 'windows-x64';
    if (arch === 'ia32') return 'windows-x86';
    if (arch === 'arm64') return 'windows-arm64';
    return 'windows-x64';
  }
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  }
  if (platform === 'linux') {
    return arch === 'ia32' ? 'linux-i386' : 'linux';
  }
  return 'linux';
}

function pickRuntimeManifest(allJson, component, preferredOsKey) {
  let osKey = preferredOsKey;
  let list = allJson[osKey] && allJson[osKey][component];
  if (!list || list.length === 0) {
    if (preferredOsKey === 'mac-os-arm64') {
      osKey = 'mac-os';
      list = allJson[osKey] && allJson[osKey][component];
    }
  }
  if (!list || list.length === 0) return null;
  return { osKey, entry: list[0] };
}

function javaBinaryPathForLayout(osKey, runtimeRoot) {
  if (osKey.startsWith('windows')) {
    return path.join(runtimeRoot, 'bin', 'java.exe');
  }
  if (osKey.startsWith('mac-os')) {
    return path.join(runtimeRoot, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  }
  return path.join(runtimeRoot, 'bin', 'java');
}

async function downloadRuntimeFiles({ files, runtimeRoot, httpClient, emit }) {
  const tasks = Object.entries(files).filter(
    ([, spec]) => spec.type === 'file' && spec.downloads && spec.downloads.raw && spec.downloads.raw.url
  );
  const total = tasks.length;
  let done = 0;

  for (let i = 0; i < tasks.length; i += DOWNLOAD_CONCURRENCY) {
    const chunk = tasks.slice(i, i + DOWNLOAD_CONCURRENCY);
    await Promise.all(
      chunk.map(async ([relPath, spec]) => {
        const dest = path.join(runtimeRoot, relPath);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await httpClient.download(spec.downloads.raw.url, dest);
        if (spec.executable && process.platform !== 'win32') {
          await fs.promises.chmod(dest, 0o755);
        }
        done += 1;
        if (emit && (done === total || done % 25 === 0)) {
          emit.status({ text: `Mojang Java çalıştırıcısı indiriliyor… (${done}/${total})` });
        }
      })
    );
  }
}

function createJavaRuntimeService({ httpClient, paths, logger }) {
  let indexCache = null;
  let indexCacheAt = 0;
  const INDEX_TTL_MS = 60 * 60 * 1000;

  async function loadIndex() {
    const now = Date.now();
    if (indexCache && now - indexCacheAt < INDEX_TTL_MS) return indexCache;
    indexCache = await httpClient.fetchJson(MOJANG_JAVA_INDEX);
    indexCacheAt = now;
    return indexCache;
  }

  async function ensureRuntimeInstalled({ component, emit }) {
    const allJson = await loadIndex();
    const preferredOs = mojangRuntimeOsKey();
    const picked = pickRuntimeManifest(allJson, component, preferredOs);
    if (!picked) {
      throw new LauncherError(
        Codes.JAVA_RUNTIME_UNAVAILABLE,
        `Bu bilgisayar için Mojang "${component}" Java paketi bulunamadı. ` +
          'Uyumlu bir JDK kurun veya JAVA_HOME ile doğru sürümü gösterin.'
      );
    }

    const { osKey, entry } = picked;
    const sha1 = entry.manifest.sha1;
    const runtimeRoot = path.join(paths.javaRuntimesDir, `${component}-${sha1}-${osKey}`);
    const marker = path.join(runtimeRoot, '.marsana-runtime-ready');
    const javaBin = javaBinaryPathForLayout(osKey, runtimeRoot);

    if (fs.existsSync(marker) && fs.existsSync(javaBin)) {
      return javaBin;
    }

    await fs.promises.mkdir(runtimeRoot, { recursive: true });
    if (emit) {
      emit.status({ text: `Mojang Java (${component}) hazırlanıyor — bu Minecraft sürümü için gerekli…` });
    }
    const manifest = await httpClient.fetchJson(entry.manifest.url);
    if (!manifest || !manifest.files) {
      throw new LauncherError(Codes.JAVA_RUNTIME_UNAVAILABLE, 'Mojang Java manifesti okunamadı.');
    }

    logger.info('Downloading Mojang Java runtime', { component, osKey, sha1 });
    await downloadRuntimeFiles({ files: manifest.files, runtimeRoot, httpClient, emit });
    await fs.promises.writeFile(marker, `${Date.now()}\n`, 'utf8');

    if (!fs.existsSync(javaBin)) {
      throw new LauncherError(
        Codes.JAVA_RUNTIME_UNAVAILABLE,
        'Java çalıştırıcısı indirildi ancak beklenen yolda bulunamadı.'
      );
    }
    return javaBin;
  }

  function resolveJavaHomePathOnly() {
    const home = (process.env.JAVA_HOME || '').trim();
    if (!home) return undefined;
    const binName = process.platform === 'win32' ? 'java.exe' : 'java';
    const candidate = path.join(home, 'bin', binName);
    if (fs.existsSync(candidate)) return candidate;
    return undefined;
  }

  // `strict` true ise sistem Java'sı (JAVA_HOME/PATH) atlanır ve Mojang'ın
  // tam doğru sürümü kullanılır. Forge için şart: Forge bağımlılığı ASM,
  // Minecraft sürümünün gerektirdiğinden yeni Java bytecode'unu okuyamıyor.
  async function resolveForLaunch({ versionId, versionService, emit, strict = false }) {
    const forced = (process.env.MARSANA_JAVA || '').trim();
    if (forced && !strict) return forced;

    let versionJson;
    try {
      versionJson = await versionService.getVersionJson(versionId);
    } catch (e) {
      logger.warn('Could not load version json for Java resolution', { versionId, err: e.message });
      if (strict) throw e;
      return resolveJavaHomePathOnly();
    }

    const jv = versionJson.javaVersion;
    if (!jv || typeof jv.majorVersion !== 'number') {
      if (strict) {
        throw new Error(`Version JSON Java sürüm bilgisini içermiyor: ${versionId}`);
      }
      return resolveJavaHomePathOnly();
    }

    const requiredMajor = jv.majorVersion;
    const component = jv.component || (requiredMajor <= 8 ? 'jre-legacy' : 'java-runtime-gamma');

    if (!strict) {
      const homeJava = resolveJavaHomePathOnly();
      if (homeJava) {
        const major = await probeJavaMajor(homeJava);
        if (javaMeetsGameRequirement(major, requiredMajor)) return homeJava;
      }

      const pathJava = process.platform === 'win32' ? 'java.exe' : 'java';
      const pathMajor = await probeJavaMajor(pathJava);
      if (javaMeetsGameRequirement(pathMajor, requiredMajor)) {
        return undefined;
      }
    }

    if (emit) {
      emit.status({
        text: strict
          ? `Forge bu Minecraft sürümü için Java ${requiredMajor} gerektiriyor; Mojang çalıştırıcısı kuruluyor…`
          : `Bu Minecraft sürümü Java ${requiredMajor} gerektiriyor; sistem Java'sı uyumsuz. Mojang çalıştırıcısı indiriliyor…`,
      });
    }
    return ensureRuntimeInstalled({ component, emit });
  }

  return { resolveForLaunch };
}

module.exports = { createJavaRuntimeService };

