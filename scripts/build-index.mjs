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
.install{position:fixed;right:16px;bottom:16px;z-index:50;display:none;align-items:center;gap:10px;padding:12px 14px 12px 16px;background:linear-gradient(135deg,#34d399,#10b981);color:#042f23;border:0;border-radius:999px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 12px 28px rgba(16,185,129,.35),0 2px 8px rgba(0,0,0,.2);transition:transform .15s}
.install:hover{transform:translateY(-2px)}
.install.show{display:inline-flex;animation:slideUp .35s ease-out}
.install svg{width:18px;height:18px;flex-shrink:0}
.install .x{width:22px;height:22px;border-radius:50%;background:rgba(4,47,35,.18);border:0;color:#042f23;font-size:14px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-weight:700;padding:0}
.install .x:hover{background:rgba(4,47,35,.28)}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.show{display:flex;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal-card{background:var(--bg);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;max-width:380px;width:100%;color:var(--text);box-shadow:0 30px 80px rgba(0,0,0,.5)}
.modal-card h3{margin:0 0 6px;font-size:18px}
.modal-card p{margin:0 0 14px;color:var(--muted);font-size:14px;line-height:1.5}
.modal-card ol{margin:0 0 16px;padding-left:22px;color:var(--text)}
.modal-card li{margin:8px 0;font-size:14px;line-height:1.55}
.modal-card li b{color:var(--cyan)}
.modal-card .ok{margin-top:6px;padding:11px 18px;background:linear-gradient(135deg,#34d399,#10b981);color:#042f23;border:0;border-radius:999px;font-weight:700;cursor:pointer;width:100%;font-size:14px}
.share-icon{display:inline-block;vertical-align:-3px;margin:0 2px;width:18px;height:18px}
@media(max-width:560px){.install{right:12px;bottom:12px;padding:11px 12px 11px 14px;font-size:13px}}
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

<button id="installBtn" class="install" aria-label="Cài app Sổ tay QN">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
  <span id="installLabel">Cài Sổ tay QN</span>
  <button class="x" id="installClose" aria-label="Đóng">×</button>
</button>

<div id="iosModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="iosTitle">
  <div class="modal-card">
    <h3 id="iosTitle">Cài "Sổ tay QN" trên iPhone/iPad</h3>
    <p>Safari iOS không cho cài tự động. Làm thủ công 3 bước:</p>
    <ol>
      <li>Bấm nút <b>Share</b> <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> ở thanh dưới</li>
      <li>Cuộn xuống chọn <b>"Thêm vào Màn hình chính"</b></li>
      <li>Bấm <b>Thêm</b> ở góc trên phải</li>
    </ol>
    <button class="ok" id="iosOk">Đã hiểu</button>
  </div>
</div>

<div id="genericModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="genTitle">
  <div class="modal-card">
    <h3 id="genTitle">Cài "Sổ tay QN"</h3>
    <p>Trình duyệt chưa sẵn sàng prompt cài. Bạn có thể cài thủ công:</p>
    <ol>
      <li>Mở <b>menu</b> trình duyệt (3 chấm góc trên)</li>
      <li>Chọn <b>"Install app"</b> / <b>"Cài ứng dụng"</b> / <b>"Add to Home screen"</b></li>
    </ol>
    <p>Hoặc dùng web 30 giây rồi reload — Chrome thường sẽ tự fire prompt.</p>
    <button class="ok" id="genOk">Đã hiểu</button>
  </div>
</div>

<script>
(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
  }

  var btn = document.getElementById('installBtn');
  var closeBtn = document.getElementById('installClose');
  var iosModal = document.getElementById('iosModal');
  var iosOk = document.getElementById('iosOk');
  var genericModal = document.getElementById('genericModal');
  var genOk = document.getElementById('genOk');
  var deferred = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent;
    var iOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var iPadOS = navigator.platform === 'MacIntel' && 'ontouchend' in document;
    return iOSDevice || iPadOS;
  }
  function show(){ btn.classList.add('show'); }
  function hide(){ btn.classList.remove('show'); }
  function openModal(m){ m.classList.add('show'); }
  function closeModal(m){ m.classList.remove('show'); }

  // 1. Đã ở chế độ standalone → đã cài, không show
  if (isStandalone()) {
    localStorage.setItem('pwa-installed','1');
    return;
  }
  // 2. Đã cài từ session trước
  if (localStorage.getItem('pwa-installed') === '1') {
    // Re-check sau 5s: nếu vẫn không vào standalone, có thể user đã uninstall
    setTimeout(function(){
      if (!isStandalone()) {
        localStorage.removeItem('pwa-installed');
        if (!sessionStorage.getItem('install-dismissed')) show();
      }
    }, 5000);
    return;
  }
  // 3. Dismissed trong session này
  if (sessionStorage.getItem('install-dismissed') === '1') return;

  // 4. iOS → luôn show, click ra modal
  if (isIOS()) {
    document.getElementById('installLabel').textContent = 'Cài app (iOS)';
    show();
  }

  // 5. Android/desktop Chrome — đợi prompt event
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferred = e;
    show();
  });

  // Nếu sau 4s vẫn chưa có deferred và không phải iOS → vẫn show button
  // (click sẽ ra modal generic hướng dẫn menu trình duyệt)
  setTimeout(function(){
    if (!deferred && !isIOS() && !isStandalone()) show();
  }, 4000);

  btn.addEventListener('click', function(e){
    if (e.target.closest('.x')) return;
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function(c){
        if (c.outcome === 'accepted') {
          localStorage.setItem('pwa-installed','1');
          hide();
        }
        deferred = null;
      });
    } else if (isIOS()) {
      openModal(iosModal);
    } else {
      openModal(genericModal);
    }
  });

  closeBtn.addEventListener('click', function(e){
    e.stopPropagation();
    sessionStorage.setItem('install-dismissed','1');
    hide();
  });

  iosOk.addEventListener('click', function(){ closeModal(iosModal); });
  genOk.addEventListener('click', function(){ closeModal(genericModal); });
  iosModal.addEventListener('click', function(e){ if(e.target===iosModal) closeModal(iosModal); });
  genericModal.addEventListener('click', function(e){ if(e.target===genericModal) closeModal(genericModal); });

  window.addEventListener('appinstalled', function(){
    localStorage.setItem('pwa-installed','1');
    hide();
  });
})();
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
