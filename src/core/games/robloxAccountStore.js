'use strict';

const fs = require('fs');
const path = require('path');

const STORE_FILE = 'roblox-account.json';

function createRobloxAccountStore({ userDataDir }) {
  const filePath = path.join(userDataDir, STORE_FILE);

  function load() {
    try {
      if (!fs.existsSync(filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed.username !== 'string' || !parsed.username.trim()) return null;
      return {
        username: parsed.username.trim(),
        locale: parsed.locale || 'en-us',
        savedAt: parsed.savedAt || null,
      };
    } catch {
      return null;
    }
  }

  function save({ username, locale = 'en-us' } = {}) {
    const trimmed = String(username || '').trim();
    if (!trimmed) {
      throw new Error('Roblox kullanıcı adı boş olamaz.');
    }
    const payload = {
      username: trimmed.slice(0, 64),
      locale: String(locale || 'en-us').toLowerCase(),
      savedAt: Date.now(),
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  function clear() {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }

  return { load, save, clear, filePath };
}

module.exports = { createRobloxAccountStore, STORE_FILE };
