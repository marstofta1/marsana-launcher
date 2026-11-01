#!/usr/bin/env node
// SessionStart hook: Claude'un otomatik hafızasını denetler. Sağlıklıysa hiçbir şey yazmaz;
// sorun varsa oturum bağlamına kısa bir uyarı ekler. Asla hata koduyla çıkmaz.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const LIMITS = {
  fileBytes: 2048,
  totalBytes: 16 * 1024,
  indexLineChars: 150,
  staleDays: 60
};

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Claude Code proje klasörü adı: yoldaki harf/rakam dışı her karakter '-' olur.
// Sürücü harfinin büyük/küçük hâli makineye göre değiştiği için eşleşme büyük/küçük harf duyarsız.
function findMemoryDir(cwd) {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  const slug = cwd.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  let entries;
  try {
    entries = fs.readdirSync(projectsDir);
  } catch {
    return null;
  }
  const match = entries.find((name) => name.toLowerCase() === slug);
  if (!match) return null;
  const dir = path.join(projectsDir, match, 'memory');
  return fs.existsSync(dir) ? dir : null;
}

function check(dir) {
  const issues = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const indexPath = path.join(dir, 'MEMORY.md');
  const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const linked = new Set([...index.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));
  const now = Date.now();
  let total = 0;

  index.split(/\r?\n/).forEach((line, i) => {
    if (line.length > LIMITS.indexLineChars) {
      issues.push(`MEMORY.md satır ${i + 1} ${line.length} karakter (sınır ${LIMITS.indexLineChars})`);
    }
  });

  for (const target of linked) {
    if (!files.includes(target)) issues.push(`MEMORY.md olmayan dosyayı gösteriyor: ${target}`);
  }

  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    total += stat.size;
    if (file === 'MEMORY.md') continue;

    if (!linked.has(file)) issues.push(`${file} MEMORY.md'de listelenmemiş`);
    if (stat.size > LIMITS.fileBytes) {
      issues.push(`${file} ${stat.size} B (sınır ${LIMITS.fileBytes}); güncel duruma indir`);
    }

    const text = fs.readFileSync(full, 'utf8');
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const missing = ['name:', 'description:', 'type:'].filter((k) => !front || !front[1].includes(k));
    if (missing.length) issues.push(`${file} frontmatter eksik: ${missing.join(', ')}`);

    const ageDays = Math.floor((now - stat.mtimeMs) / 86400000);
    if (/type:\s*project/.test(text) && ageDays > LIMITS.staleDays) {
      issues.push(`${file} ${ageDays} gündür değişmedi; hâlâ doğru mu kontrol et`);
    }
  }

  if (total > LIMITS.totalBytes) {
    issues.push(`toplam hafıza ${total} B (sınır ${LIMITS.totalBytes})`);
  }
  return issues;
}

try {
  const input = readStdin();
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const dir = findMemoryDir(cwd);
  if (dir) {
    const issues = check(dir);
    if (issues.length) {
      const context =
        'Hafıza sağlık kontrolü bakım gerektiriyor (CLAUDE.md → "Hafıza bakımı"):\n- ' +
        issues.join('\n- ') +
        '\nDoğal bir durakta consolidate-memory skill\'ini çalıştır ve kullanıcıya tek satırla söyle.';
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } })
      );
    }
  }
} catch {
  // Kontrol hiçbir zaman oturumu bozmamalı.
}
process.exit(0);
