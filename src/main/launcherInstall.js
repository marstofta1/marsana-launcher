'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { app } = require('electron');
const { compareVersionStrings } = require('../shared/appVersion');

const POINTER_FILE = 'launcher-install.json';
const EXE_NAME = 'Marsana Launcher.exe';

function installDirCandidates() {
  const local = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.PROGRAMFILES || '';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || '';
  return [
    path.join(local, 'Programs', 'marsana-launcher'),
    path.join(local, 'Programs', 'Marsana Launcher'),
    path.join(programFiles, 'Marsana Launcher'),
    path.join(programFilesX86, 'Marsana Launcher'),
  ];
}

function pointerPath(userDataDir) {
  return path.join(userDataDir, POINTER_FILE);
}

function readInstallPointer(userDataDir) {
  try {
    const raw = fs.readFileSync(pointerPath(userDataDir), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data.exePath !== 'string') return null;
    return {
      exePath: path.normalize(data.exePath),
      version: data.version ? String(data.version) : null,
      updatedAt: data.updatedAt || 0,
    };
  } catch {
    return null;
  }
}

function writeInstallPointer(userDataDir, exePath, version) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(
      pointerPath(userDataDir),
      JSON.stringify(
        {
          exePath: path.normalize(exePath),
          version: version ? String(version) : null,
          updatedAt: Date.now(),
        },
        null,
        2
      ),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

function readAppVersionFromInstallDir(installDir) {
  const unpackedPkg = path.join(installDir, 'resources', 'app', 'package.json');
  try {
    if (fs.existsSync(unpackedPkg)) {
      const pkg = JSON.parse(fs.readFileSync(unpackedPkg, 'utf8'));
      if (pkg && pkg.version) return String(pkg.version);
    }
  } catch {
    /* ignore */
  }
  try {
    const { extractFile } = require('@electron/asar');
    const asarPath = path.join(installDir, 'resources', 'app.asar');
    if (fs.existsSync(asarPath)) {
      const buf = extractFile(asarPath, 'package.json');
      const pkg = JSON.parse(buf.toString('utf8'));
      if (pkg && pkg.version) return String(pkg.version);
    }
  } catch {
    /* @electron/asar yoksa veya okuma başarısız — mtime ile devam */
  }
  return null;
}

function exeMtimeMs(exePath) {
  try {
    return fs.statSync(exePath).mtimeMs;
  } catch {
    return 0;
  }
}

function discoverInstalledLaunchers() {
  const found = [];
  const seen = new Set();
  for (const dir of installDirCandidates()) {
    const exe = path.join(dir, EXE_NAME);
    const norm = path.normalize(exe);
    if (!fs.existsSync(exe) || seen.has(norm)) continue;
    seen.add(norm);
    found.push({
      exe: norm,
      dir,
      version: readAppVersionFromInstallDir(dir),
      mtimeMs: exeMtimeMs(exe),
    });
  }
  return found;
}

function pickNewestLauncher(candidates, fallbackVersion) {
  let best = null;
  for (const entry of candidates) {
    if (!best) {
      best = entry;
      continue;
    }
    const entryVer = entry.version || fallbackVersion || '0.0.0';
    const bestVer = best.version || fallbackVersion || '0.0.0';
    const cmp = compareVersionStrings(entryVer, bestVer);
    if (cmp > 0) {
      best = entry;
      continue;
    }
    if (cmp < 0) continue;
    if ((entry.mtimeMs || 0) > (best.mtimeMs || 0)) best = entry;
  }
  return best;
}

/**
 * Güncelleme NSIS kurulumunu %LOCALAPPDATA%\\Programs altına yapar; kullanıcı
 * indirilen eski .exe kopyasından açarsa sürüm geri düşer. En yeni kurulumu bulup oradan başlat.
 * @returns {boolean} true ise süreç sonlandırıldı (yeni exe açılıyor).
 */
function redirectToNewestLauncherInstall() {
  if (!app.isPackaged) return false;

  const currentExe = path.normalize(process.execPath);
  const userDataDir = app.getPath('userData');
  const currentVersion = app.getVersion();
  const discovered = discoverInstalledLaunchers();
  const pointer = readInstallPointer(userDataDir);

  if (pointer && pointer.exePath && fs.existsSync(pointer.exePath)) {
    const inList = discovered.some((d) => d.exe === pointer.exePath);
    if (!inList) {
      discovered.push({
        exe: pointer.exePath,
        dir: path.dirname(pointer.exePath),
        version: pointer.version || readAppVersionFromInstallDir(path.dirname(pointer.exePath)),
        mtimeMs: exeMtimeMs(pointer.exePath),
      });
    }
  }

  discovered.push({
    exe: currentExe,
    dir: path.dirname(currentExe),
    version: currentVersion,
    mtimeMs: exeMtimeMs(currentExe),
  });

  const newest = pickNewestLauncher(discovered, currentVersion);
  if (!newest) return false;

  if (newest.exe !== currentExe) {
    writeInstallPointer(userDataDir, newest.exe, newest.version || currentVersion);
    try {
      spawn(newest.exe, process.argv.slice(1), {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    } catch {
      return false;
    }
    app.exit(0);
    return true;
  }

  writeInstallPointer(userDataDir, currentExe, currentVersion);
  return false;
}

function expectedInstallExe() {
  const local = process.env.LOCALAPPDATA || '';
  return path.normalize(path.join(local, 'Programs', 'marsana-launcher', EXE_NAME));
}

function recordPendingUpdateInstall(userDataDir, version) {
  const target = expectedInstallExe();
  writeInstallPointer(userDataDir, target, version);
}

module.exports = {
  redirectToNewestLauncherInstall,
  writeInstallPointer,
  readInstallPointer,
  recordPendingUpdateInstall,
  expectedInstallExe,
  readAppVersionFromInstallDir,
};
