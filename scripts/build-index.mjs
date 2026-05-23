#!/usr/bin/env node
// Quét tất cả file .html trong repo, đọc <title>, sinh index.html ở root.
// Chạy: node scripts/build-index.mjs

import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'index.html');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'scripts', '.github', '.vscode']);
const EXCLUDE_PATHS = new Set([
  'docs/index.html',
  'docs/CNAME',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (name.toLowerCase().endsWith('.html')) {
      const rel = relative(ROOT, full).split(sep).join('/');
      if (rel === 'index.html' || EXCLUDE_PATHS.has(rel)) continue;
      out.push({ rel, mtime: st.mtimeMs });
    }
  }
  return out;
}

function extractTitle(absPath) {
  try {
    const html = readFileSync(absPath, 'utf8');
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  } catch {}
  return null;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const files = walk(ROOT).sort((a, b) => b.mtime - a.mtime);
const items = files.map(f => ({
  rel: f.rel,
  title: extractTitle(join(ROOT, f.rel)) || f.rel,
  folder: f.rel.includes('/') ? f.rel.split('/')[0] : '(gốc)',
  mtime: f.mtime,
}));

const groups = new Map();
for (const it of items) {
  if (!groups.has(it.folder)) groups.set(it.folder, []);
  groups.get(it.folder).push(it);
}

const sections = [...groups.entries()].map(([folder, list]) => `
  <section class="group">
    <h2>${esc(folder)} <span class="count">${list.length}</span></h2>
    <ul class="list">
${list.map(it => `      <li class="item"><a href="${esc(it.rel)}">
        <div class="title">${esc(it.title)}</div>
        <div class="path">${esc(it.rel)}</div>
      </a></li>`).join('\n')}
    </ul>
  </section>`).join('\n');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#042f23">
<title>Sổ tay QN — docs.vienthietke.com</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>
:root{--bg:#0b1020;--text:#f7f9ff;--muted:#b9c2d9;--blue:#7cc7ff;--cyan:#74f0d2;--violet:#c5a3ff;--shadow:0 18px 60px rgba(0,0,0,.35)}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 10% 0%,rgba(124,199,255,.18),transparent 34%),radial-gradient(circle at 90% 10%,rgba(197,163,255,.16),transparent 32%),radial-gradient(circle at 50% 110%,rgba(116,240,210,.12),transparent 42%),var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:32px 24px 80px}
.hero{padding:28px;border-radius:24px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,rgba(124,199,255,.16),rgba(197,163,255,.10) 50%,rgba(116,240,210,.10)),rgba(18,26,51,.82);box-shadow:var(--shadow);margin-bottom:28px}
.hero h1{margin:0 0 8px;font-size:clamp(28px,4vw,42px)}
.hero p{margin:0;color:var(--muted)}
h2{margin:28px 0 12px;font-size:14px;color:var(--cyan);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:10px}
h2 .count{padding:2px 8px;border-radius:999px;background:rgba(124,199,255,.14);color:#cfeeff;font-size:12px;font-weight:600;letter-spacing:0;text-transform:none}
.list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.item a{display:block;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);text-decoration:none;color:var(--text);transition:border-color .15s,transform .15s,background .15s}
.item a:hover{border-color:var(--blue);background:rgba(124,199,255,.06);transform:translateX(2px)}
.title{font-weight:650}
.path{margin-top:4px;font-size:13px;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace}
.footer{margin-top:48px;text-align:center;color:var(--muted);font-size:13px}
.footer code{padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.08);font-size:12px}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>docs.vienthietke.com</h1>
    <p>Thư viện tài liệu — ${items.length} trang</p>
  </header>
${sections}
  <p class="footer">Tự sinh bởi <code>scripts/build-index.mjs</code> · ${new Date().toISOString().slice(0, 10)}</p>
</div>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
  }
</script>
</body>
</html>
`;

writeFileSync(OUTPUT, html);
console.log(`✓ Wrote ${relative(ROOT, OUTPUT)} (${items.length} entries)`);
for (const it of items) console.log(`  - ${it.rel}  — ${it.title}`);

// === Cập nhật precache list trong sw.js ===
const swPath = join(ROOT, 'sw.js');
try {
  const sw = readFileSync(swPath, 'utf8');
  const precacheList = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
    ...items.map(it => '/' + it.rel),
  ];
  const block = `const PRECACHE_URLS = [\n${precacheList.map(u => `  '${u}',`).join('\n')}\n];`;
  const newSw = sw.replace(/const PRECACHE_URLS = \[[\s\S]*?\];/, block);
  if (newSw !== sw) {
    writeFileSync(swPath, newSw);
    console.log(`✓ Updated PRECACHE_URLS in sw.js (${precacheList.length} URLs)`);
  }
} catch (e) {
  console.warn(`⚠ Skipped sw.js update: ${e.message}`);
}
