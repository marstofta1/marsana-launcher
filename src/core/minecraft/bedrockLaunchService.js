'use strict';

const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { LauncherError, Codes } = require('../infra/errors');

const execFileAsync = promisify(execFile);

const BEDROCK_PACKAGE_NAME = 'Microsoft.MinecraftUWP';
// Get-StartApps ile doğrulanmış AUMID (…!Game); eski !App soneki bu kurulumda çalışmıyor.
const BEDROCK_AUMID_FALLBACK = 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!Game';

function normalizeBedrockAumid(raw) {
  const s = String(raw || '').trim();
  if (!s) return BEDROCK_AUMID_FALLBACK;
  // Get-StartApps bazen MICROSOFT.MINECRAFTUWP_… döner; explorer PascalCase ister.
  if (/^MICROSOFT\.MINECRAFTUWP_/i.test(s)) {
    return `Microsoft.MinecraftUWP_${s.replace(/^MICROSOFT\.MINECRAFTUWP_/i, '')}`;
  }
  return s;
}

async function queryBedrockAumid() {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-StartApps | Where-Object { $_.Name -eq 'Minecraft for Windows' }).AppID",
      ],
      { timeout: 15000, windowsHide: true }
    );
    return normalizeBedrockAumid(stdout);
  } catch {
    return BEDROCK_AUMID_FALLBACK;
  }
}

function launchViaExplorer(aumid) {
  return new Promise((resolve, reject) => {
    const shellPath = `shell:AppsFolder\\${aumid}`;
    const child = spawn('explorer.exe', [shellPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', reject);
    child.unref();
    // explorer.exe UWP başlatınca hemen kod 1 ile çıkabilir; spawn başarılıysa yeterli.
    resolve();
  });
}

function createBedrockLaunchService({ logger }) {
  async function isInstalled() {
    if (process.platform !== 'win32') return false;
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-AppxPackage -Name ${BEDROCK_PACKAGE_NAME} -ErrorAction SilentlyContinue).Name`,
        ],
        { timeout: 15000, windowsHide: true }
      );
      return Boolean(String(stdout || '').trim());
    } catch (err) {
      if (logger) logger.warn('Bedrock kurulum kontrolü başarısız', { err: err.message });
      return false;
    }
  }

  async function launch(emit) {
    if (process.platform !== 'win32') {
      throw new LauncherError(
        Codes.BEDROCK_UNAVAILABLE,
        'Minecraft Bedrock yalnızca Windows’ta Marsana Launcher üzerinden başlatılabilir.'
      );
    }

    if (emit && emit.status) {
      emit.status({ text: 'Minecraft Bedrock aranıyor...' });
    }

    const installed = await isInstalled();
    if (!installed) {
      throw new LauncherError(
        Codes.BEDROCK_UNAVAILABLE,
        'Minecraft Bedrock (Minecraft for Windows) bu bilgisayarda yüklü değil. ' +
          'Microsoft Store veya Xbox uygulamasından yükleyin.'
      );
    }

    const aumid = await queryBedrockAumid();
    if (emit && emit.status) {
      emit.status({ text: 'Minecraft Bedrock başlatılıyor...' });
    }

    await launchViaExplorer(aumid);

    if (emit && emit.stdout) {
      emit.stdout(`[launcher] Minecraft Bedrock başlatıldı (${aumid}).`);
    }
    if (emit && emit.status) {
      emit.status({ text: 'Minecraft Bedrock başlatıldı.' });
    }
    if (emit && emit.close) {
      emit.close({ code: 0 });
    }

    return { started: true, bedrock: true };
  }

  return { isInstalled, launch };
}

module.exports = { createBedrockLaunchService };
