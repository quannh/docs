#!/usr/bin/env node
// One-shot: inject PWA tags (manifest, theme-color, apple-touch-icon, SW register)
// vào tất cả file .html content (trừ root index.html — đã được build-index.mjs lo).
// An toàn để chạy nhiều lần — skip nếu đã có dấu hiệu inject.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'scripts', '.github', '.vscode', 'assets', 'icons']);
const EXCLUDE = new Set(['index.html', 'docs/index.html', 'docs/CNAME']);

const HEAD_TAGS = `<meta name="theme-color" content="#042f23">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`;

const SW_SCRIPT = `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));}</script>`;

const MARKER = 'manifest.webmanifest';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.toLowerCase().endsWith('.html')) {
      const rel = full.slice(ROOT.length + 1).split(sep).join('/');
      if (!EXCLUDE.has(rel) && rel !== 'index.html') out.push(full);
    }
  }
  return out;
}

let touched = 0;
for (const file of walk(ROOT)) {
  let html = readFileSync(file, 'utf8');
  if (html.includes(MARKER)) {
    console.log(`· skip (already has PWA) — ${file.slice(ROOT.length + 1)}`);
    continue;
  }
  // Inject head tags before </head>
  html = html.replace(/<\/head>/i, `${HEAD_TAGS}\n</head>`);
  // Inject SW register before </body>
  html = html.replace(/<\/body>/i, `${SW_SCRIPT}\n</body>`);
  writeFileSync(file, html);
  touched++;
  console.log(`✓ injected — ${file.slice(ROOT.length + 1)}`);
}
console.log(`Done. ${touched} file(s) modified.`);
