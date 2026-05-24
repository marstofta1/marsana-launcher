'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function createLogger({ level = 'info', namespace = 'marsana' } = {}) {
  const threshold = LEVELS[level] || LEVELS.info;

  function log(lvl, args) {
    if (LEVELS[lvl] < threshold) return;
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${lvl.toUpperCase()}] [${namespace}]`;
    if (lvl === 'error') console.error(prefix, ...args);
    else if (lvl === 'warn') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }

  return {
    debug: (...a) => log('debug', a),
    info: (...a) => log('info', a),
    warn: (...a) => log('warn', a),
    error: (...a) => log('error', a),
    child: (ns) => createLogger({ level, namespace: `${namespace}:${ns}` }),
  };
}

module.exports = { createLogger };
