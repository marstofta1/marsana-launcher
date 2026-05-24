'use strict';

function createAccountStore({ fileStore }) {
  function load() {
    const raw = fileStore.readSync();
    if (!raw) return null;
    if (typeof raw.uuid === 'string') return raw;
    return null;
  }

  function save(account) {
    fileStore.writeSync(account);
  }

  function clear() {
    fileStore.removeSync();
  }

  return { load, save, clear };
}

module.exports = { createAccountStore };
