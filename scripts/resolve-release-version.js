'use strict';

/**
 * Marsana Launcher sürümleme kuralı:
 * 0.1.40 yerine 0.2.0 yayınlanır (minor serisi 0.1.x burada biter).
 */
const MINOR_SERIES_CAP = { major: 0, minor: 1, patch: 40 };
const NEXT_MAJOR_RELEASE = '0.2.0';

function parseVersion(version) {
  const parts = String(version).trim().split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Gecersiz surum: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2], raw: `${parts[0]}.${parts[1]}.${parts[2]}` };
}

function versionGte(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

/** Planlanan sürümü yayın sürümüne çevirir (0.1.40+ → 0.2.0). */
function resolveReleaseVersion(plannedVersion) {
  const planned = parseVersion(plannedVersion);
  const cap = parseVersion(`${MINOR_SERIES_CAP.major}.${MINOR_SERIES_CAP.minor}.${MINOR_SERIES_CAP.patch}`);
  if (versionGte(planned, cap)) {
    return NEXT_MAJOR_RELEASE;
  }
  return planned.raw;
}

/** package.json sürümünün yayınlanabilir olup olmadığını doğrular. */
function assertPublishableVersion(version) {
  const resolved = resolveReleaseVersion(version);
  if (resolved !== String(version).trim()) {
    throw new Error(
      `Surum ${version} yayinlanamaz. 0.1.40 ve uzeri yerine ${NEXT_MAJOR_RELEASE} kullanin.`
    );
  }
  return resolved;
}

module.exports = {
  MINOR_SERIES_CAP,
  NEXT_MAJOR_RELEASE,
  resolveReleaseVersion,
  assertPublishableVersion,
};

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.log(`Kullanim: node scripts/resolve-release-version.js <surum>`);
    console.log(`Ornek: 0.1.39 -> ${resolveReleaseVersion('0.1.39')}`);
    console.log(`Ornek: 0.1.40 -> ${resolveReleaseVersion('0.1.40')}`);
    process.exit(0);
  }
  console.log(resolveReleaseVersion(input));
}
