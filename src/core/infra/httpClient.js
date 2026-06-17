'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { LauncherError, Codes } = require('./errors');

const DEFAULT_USER_AGENT = 'MarsanaLauncher/0.1.0 (+https://github.com/marsana/launcher)';
const MAX_REDIRECTS = 5;

function httpModuleForUrl(urlString) {
  try {
    return new URL(urlString).protocol === 'http:' ? http : https;
  } catch {
    return https;
  }
}

function createHttpClient({ userAgent = DEFAULT_USER_AGENT } = {}) {
  function get(url, { headers = {}, timeoutMs = 45000 } = {}, redirects = 0) {
    return new Promise((resolve, reject) => {
      let absoluteUrl;
      try {
        absoluteUrl = new URL(url).href;
      } catch (e) {
        reject(new LauncherError(Codes.HTTP, `Geçersiz URL: ${url}`, e));
        return;
      }

      const mod = httpModuleForUrl(absoluteUrl);
      const req = mod.get(
        absoluteUrl,
        {
          headers: {
            'User-Agent': userAgent,
            ...headers,
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const loc = res.headers.location;
            res.resume();
            if (!loc) {
              reject(new LauncherError(Codes.HTTP, `Redirect without location: ${url}`));
              return;
            }
            if (redirects >= MAX_REDIRECTS) {
              reject(new LauncherError(Codes.HTTP, `Too many redirects: ${url}`));
              return;
            }
            let nextUrl;
            try {
              nextUrl = new URL(loc, absoluteUrl).href;
            } catch (err) {
              reject(new LauncherError(Codes.HTTP, `Redirect URL geçersiz: ${loc}`, err));
              return;
            }
            resolve(get(nextUrl, { headers }, redirects + 1));
            return;
          }
          resolve(res);
        }
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new LauncherError(Codes.NETWORK, `İstek zaman aşımına uğradı: ${absoluteUrl}`));
      });
      req.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  async function fetchText(url, opts = {}) {
    const res = await get(url, {
      headers: { Accept: 'text/html,*/*', ...(opts.headers || {}) },
    });
    return new Promise((resolve, reject) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const body = Buffer.concat(chunks).toString('utf8');
        if (status >= 400) {
          reject(new LauncherError(Codes.HTTP, `HTTP ${status}: ${url}`));
          return;
        }
        resolve(body);
      });
      res.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  async function fetchJson(url, opts = {}) {
    const res = await get(url, {
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
    });
    return new Promise((resolve, reject) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const body = Buffer.concat(chunks).toString('utf8');
        if (status >= 400) {
          reject(new LauncherError(Codes.HTTP, `HTTP ${status}: ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new LauncherError(Codes.HTTP, `Invalid JSON from ${url}: ${e.message}`, e));
        }
      });
      res.on('error', (err) => reject(new LauncherError(Codes.NETWORK, err.message, err)));
    });
  }

  async function download(url, destPath) {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const res = await get(url);
    const status = res.statusCode || 0;
    if (status >= 400) {
      res.resume();
      throw new LauncherError(Codes.HTTP, `Download ${status}: ${url}`);
    }
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new LauncherError(Codes.FILESYSTEM, err.message, err));
      });
      res.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new LauncherError(Codes.NETWORK, err.message, err));
      });
    });
  }

  return { fetchJson, fetchText, download };
}

module.exports = { createHttpClient };
