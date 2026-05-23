#!/usr/bin/env node
// Quét tất cả file .html trong repo, đọc <title> + word count, sinh index.html.
// Đồng thời cập nhật precache list trong sw.js.
// Chạy: node scripts/build-index.mjs

import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'index.html');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'scripts', '.github', '.vscode', 'assets', 'icons']);
const EXCLUDE_PATHS = new Set([
  'docs/index.html',
  'docs/CNAME',
]);

const FOLDER_LABELS = {
  'vivo': 'Vivo X200',
  'tiet-kiem-dau-tu': 'Tiết kiệm — Đầu tư',
  '(gốc)': 'Khác',
};

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

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  return null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function timeAgo(mtimeMs) {
  const diff = Date.now() - mtimeMs;
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < h) return 'vừa xong';
  if (diff < d) return `${Math.floor(diff / h)}h trước`;
  if (diff < 2 * d) return 'hôm qua';
  if (diff < 7 * d) return `${Math.floor(diff / d)} ngày trước`;
  if (diff < 30 * d) return `${Math.floor(diff / (7 * d))} tuần trước`;
  if (diff < 365 * d) return `${Math.floor(diff / (30 * d))} tháng trước`;
  return `${Math.floor(diff / (365 * d))} năm trước`;
}

function formatK(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const files = walk(ROOT).sort((a, b) => b.mtime - a.mtime);
const items = files.map(f => {
  const absPath = join(ROOT, f.rel);
  const html = readFileSync(absPath, 'utf8');
  const text = stripHtml(html);
  const words = wordCount(text);
  const readMin = Math.max(1, Math.round(words / 250));
  return {
    rel: f.rel,
    title: extractTitle(html) || f.rel,
    folder: f.rel.includes('/') ? f.rel.split('/')[0] : '(gốc)',
    mtime: f.mtime,
    words,
    readMin,
  };
});

const totalWords = items.reduce((s, it) => s + it.words, 0);
const totalRead = Math.max(1, Math.round(totalWords / 250));

const groups = new Map();
for (const it of items) {
  if (!groups.has(it.folder)) groups.set(it.folder, []);
  groups.get(it.folder).push(it);
}

const F_LOGO_MINI = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor"><path d="M30 20 L78 20 L65 35 L30 35 Z"/><path d="M30 42 L66 42 L53 57 L30 57 Z"/><path d="M30 64 L54 64 L41 79 L30 79 Z"/></g></svg>`;

const sections = [...groups.entries()].map(([folder, list]) => {
  const label = FOLDER_LABELS[folder] || folder;
  return `
  <section class="group">
    <header class="group-head">
      <span class="dot"></span>
      <h2>${esc(label)}</h2>
      <span class="count">${list.length}</span>
    </header>
    <div class="cards">
${list.map(it => `      <a class="card" href="${esc(it.rel)}">
        <div class="card-thumb">${F_LOGO_MINI}</div>
        <div class="card-body">
          <div class="card-meta">
            <span>${esc(FOLDER_LABELS[it.folder] || it.folder)}</span>
            <span class="sep"></span>
            <span>${esc(timeAgo(it.mtime))}</span>
          </div>
          <h3 class="card-title">${esc(it.title)}</h3>
          <div class="card-stats">
            <span class="stat-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>${formatK(it.words)} từ</span>
            <span class="stat-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>~${it.readMin} phút</span>
          </div>
          <div class="card-path">${esc(it.rel)}</div>
        </div>
        <div class="card-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
        </div>
      </a>`).join('\n')}
    </div>
  </section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#021712">
<meta name="description" content="Sổ tay QN — thư viện tài liệu cá nhân tại docs.vienthietke.com">
<title>Sổ tay QN — docs.vienthietke.com</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>
:root{
  --bg-base:#021712;
  --emerald-200:#a7f3d0;
  --emerald-300:#6ee7b7;
  --emerald-400:#34d399;
  --emerald-500:#10b981;
  --emerald-600:#059669;
  --ink:#f0fdf4;
  --ink-mute:#a7f3d0;
  --ink-soft:#6ee7b7;
  --line:rgba(255,255,255,.08);
  --line-strong:rgba(255,255,255,.14);
  --card:rgba(255,255,255,.035);
  --shadow-card:0 18px 50px -20px rgba(0,0,0,.7);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;
  min-height:100svh;
  background:
    radial-gradient(70% 50% at 50% -10%, rgba(16,185,129,.28), transparent 70%),
    radial-gradient(50% 50% at 100% 100%, rgba(52,211,153,.18), transparent 70%),
    radial-gradient(40% 40% at 0% 60%, rgba(5,150,105,.16), transparent 70%),
    var(--bg-base);
  color:var(--ink);
  font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"SF Pro Display","Segoe UI",Roboto,sans-serif;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit}
.bg-orbs{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.45;animation:drift 28s ease-in-out infinite}
.orb1{width:80vmax;height:80vmax;background:radial-gradient(circle,rgba(16,185,129,.4),transparent 70%);top:-30vmax;left:-15vmax}
.orb2{width:60vmax;height:60vmax;background:radial-gradient(circle,rgba(52,211,153,.28),transparent 70%);top:30%;right:-25vmax;animation-delay:-10s}
.orb3{width:50vmax;height:50vmax;background:radial-gradient(circle,rgba(110,231,183,.2),transparent 70%);bottom:-20vmax;left:25%;animation-delay:-18s}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(2vmax,-3vmax) scale(1.08)}}

.wrap{max-width:1080px;margin:0 auto;padding:24px 16px 60px;position:relative;z-index:1}
@media(min-width:640px){.wrap{padding:36px 32px 80px}}
@media(min-width:1024px){.wrap{padding:56px 48px 120px}}

/* === HERO === */
.hero{margin-bottom:36px}
.brand-row{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.brand-logo{
  width:clamp(48px,11vw,64px);height:clamp(48px,11vw,64px);
  border-radius:clamp(11px,2.5vw,15px);
  background:linear-gradient(135deg,#34d399 0%,#10b981 100%);
  display:inline-flex;align-items:center;justify-content:center;
  box-shadow:0 12px 32px -8px rgba(16,185,129,.55),0 0 0 1px rgba(255,255,255,.06) inset;
  position:relative;overflow:hidden;flex-shrink:0;
  animation:logoPulse 4s ease-in-out infinite;
}
@keyframes logoPulse{0%,100%{box-shadow:0 12px 32px -8px rgba(16,185,129,.55),0 0 0 1px rgba(255,255,255,.06) inset}50%{box-shadow:0 16px 44px -8px rgba(52,211,153,.7),0 0 0 1px rgba(255,255,255,.1) inset}}
.brand-logo svg{width:62%;height:62%;color:#fff}
.brand-logo::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 50%);pointer-events:none}
.wordmark{display:flex;align-items:center;gap:8px;min-width:0}
.wordmark h1{
  margin:0;
  font-size:clamp(34px,8vw,54px);
  font-weight:900;
  letter-spacing:-0.04em;
  line-height:.95;
  color:var(--ink);
  font-stretch:75%;
  font-feature-settings:"ss01";
  white-space:nowrap;
}
.verified{width:clamp(20px,5vw,26px);height:clamp(20px,5vw,26px);flex-shrink:0;color:var(--emerald-500)}
.tagline{margin:0 0 28px;color:var(--emerald-200);font-size:clamp(14px,3vw,16px);font-weight:500;letter-spacing:.01em}
.tagline b{color:var(--ink);font-weight:700}

/* === STATS STRIP === */
.stats{
  display:grid;grid-template-columns:repeat(3,1fr);gap:1px;
  background:var(--line);
  border-radius:16px;overflow:hidden;
  margin-bottom:40px;
  border:1px solid var(--line);
}
.stat-cell{background:rgba(2,23,18,.55);backdrop-filter:blur(20px);padding:18px 12px;text-align:center}
.stat-cell b{display:block;font-size:clamp(22px,5.5vw,30px);font-weight:800;letter-spacing:-0.025em;color:var(--emerald-300);line-height:1;font-feature-settings:"tnum"}
.stat-cell small{display:block;font-size:.5em;font-weight:600;color:var(--ink-soft);margin-top:3px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2}
@media(min-width:640px){.stat-cell{padding:22px 14px}}

/* === GROUPS === */
.group{margin:36px 0}
.group-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--emerald-400);box-shadow:0 0 10px var(--emerald-400);flex-shrink:0}
.group-head h2{margin:0;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--emerald-200)}
.group-head .count{
  padding:2px 9px;border-radius:999px;
  background:rgba(16,185,129,.15);
  border:1px solid rgba(16,185,129,.28);
  font-size:11px;font-weight:700;color:var(--emerald-300);
  font-feature-settings:"tnum";
}

/* === CARDS === */
.cards{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:720px){.cards{grid-template-columns:1fr 1fr;gap:14px}}
@media(min-width:1100px){.cards{grid-template-columns:1fr 1fr;gap:16px}}

.card{
  position:relative;display:flex;align-items:stretch;gap:14px;
  padding:16px;border-radius:18px;
  background:var(--card);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid var(--line);
  text-decoration:none;color:inherit;
  overflow:hidden;
  transition:border-color .2s,transform .2s,background .2s,box-shadow .2s;
}
.card::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 0% 0%,rgba(52,211,153,.1),transparent 50%);pointer-events:none;opacity:0;transition:opacity .25s}
.card:hover,.card:focus-visible{border-color:rgba(52,211,153,.45);background:rgba(16,185,129,.045);transform:translateY(-2px);box-shadow:var(--shadow-card)}
.card:hover::before,.card:focus-visible::before{opacity:1}
.card:focus-visible{outline:2px solid var(--emerald-400);outline-offset:2px}

.card-thumb{
  flex-shrink:0;width:48px;height:48px;
  border-radius:12px;
  background:linear-gradient(135deg,#34d399,#10b981);
  display:flex;align-items:center;justify-content:center;
  color:#fff;
  box-shadow:0 6px 16px -4px rgba(16,185,129,.5),0 0 0 1px rgba(255,255,255,.08) inset;
  position:relative;overflow:hidden;
}
.card-thumb::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.2),transparent 50%);pointer-events:none}
.card-thumb svg{width:58%;height:58%;position:relative;z-index:1}

.card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.card-meta{
  display:flex;align-items:center;gap:8px;
  font-size:10.5px;font-weight:700;
  color:var(--ink-soft);
  text-transform:uppercase;letter-spacing:.06em;
  opacity:.85;
}
.card-meta .sep{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.4;flex-shrink:0}
.card-title{
  margin:0;font-size:clamp(15px,3.5vw,17px);font-weight:700;
  color:var(--ink);letter-spacing:-0.01em;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.card-stats{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.stat-pill{
  display:inline-flex;align-items:center;gap:5px;
  padding:3px 9px 3px 7px;border-radius:999px;
  background:rgba(16,185,129,.1);
  border:1px solid rgba(16,185,129,.22);
  color:var(--emerald-300);
  font-size:11px;font-weight:600;
  font-family:ui-monospace,Menlo,Consolas,monospace;
  font-feature-settings:"tnum";
}
.stat-pill svg{width:11px;height:11px;flex-shrink:0;stroke-width:2.5}
.card-path{
  font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:11px;color:var(--ink-soft);opacity:.55;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  margin-top:auto;padding-top:4px;
}

.card-arrow{
  flex-shrink:0;align-self:center;
  width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,.05);
  border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;
  color:var(--emerald-300);
  transition:background .2s,transform .2s,color .2s,border-color .2s;
}
.card-arrow svg{width:14px;height:14px}
.card:hover .card-arrow,.card:focus-visible .card-arrow{background:var(--emerald-500);color:var(--bg-base);border-color:var(--emerald-500);transform:translateX(2px)}

/* === FOOTER === */
.footer{margin-top:60px;padding-top:28px;border-top:1px solid var(--line);text-align:center;color:var(--ink-soft);font-size:12px;opacity:.7}
.footer code{padding:2px 7px;border-radius:5px;background:rgba(255,255,255,.06);font-size:11px}

/* === INSTALL BUTTON === */
.install{
  position:fixed;right:16px;bottom:16px;z-index:50;
  display:none;align-items:center;gap:10px;
  padding:12px 14px 12px 16px;
  background:linear-gradient(135deg,#34d399,#10b981);
  color:#042f23;
  border:0;border-radius:999px;
  font:inherit;font-weight:800;font-size:14px;
  cursor:pointer;
  box-shadow:0 16px 36px -8px rgba(16,185,129,.55),0 0 0 1px rgba(255,255,255,.1) inset;
  transition:transform .15s,box-shadow .15s;
}
.install:hover{transform:translateY(-2px);box-shadow:0 20px 44px -8px rgba(52,211,153,.65),0 0 0 1px rgba(255,255,255,.15) inset}
.install.show{display:inline-flex;animation:slideUp .35s cubic-bezier(.2,.8,.2,1)}
.install svg{width:18px;height:18px;flex-shrink:0}
.install .x{width:22px;height:22px;border-radius:50%;background:rgba(4,47,35,.2);border:0;color:#042f23;font-size:14px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-weight:700;padding:0;margin-left:2px;flex-shrink:0}
.install .x:hover{background:rgba(4,47,35,.32)}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

/* === MODAL === */
.modal{position:fixed;inset:0;background:rgba(2,23,18,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.show{display:flex;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal-card{background:linear-gradient(180deg,#053a2c,#021712);border:1px solid var(--line-strong);border-radius:20px;padding:24px;max-width:380px;width:100%;color:var(--ink);box-shadow:0 40px 100px -20px rgba(0,0,0,.7)}
.modal-card h3{margin:0 0 8px;font-size:18px;font-weight:800;letter-spacing:-0.01em}
.modal-card p{margin:0 0 14px;color:var(--ink-mute);font-size:14px;line-height:1.55}
.modal-card ol{margin:0 0 16px;padding-left:22px;color:var(--ink)}
.modal-card li{margin:8px 0;font-size:14px;line-height:1.55}
.modal-card li b{color:var(--emerald-300)}
.modal-card .ok{margin-top:6px;padding:12px 20px;background:linear-gradient(135deg,#34d399,#10b981);color:#042f23;border:0;border-radius:999px;font-weight:800;cursor:pointer;width:100%;font-size:14px;font-family:inherit}
.share-icon{display:inline-block;vertical-align:-4px;margin:0 2px;width:18px;height:18px}

/* === REDUCED MOTION === */
@media(prefers-reduced-motion:reduce){
  .orb,.brand-logo,.install.show,.modal.show{animation:none!important}
  .card{transition:none}
}

@media(max-width:560px){.install{padding:11px 12px 11px 14px;font-size:13px}}
</style>
</head>
<body>

<div class="bg-orbs" aria-hidden="true">
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>
</div>

<div class="wrap">

  <header class="hero">
    <div class="brand-row">
      <div class="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M30 20 L78 20 L65 35 L30 35 Z"/><path d="M30 42 L66 42 L53 57 L30 57 Z"/><path d="M30 64 L54 64 L41 79 L30 79 Z"/></g></svg>
      </div>
      <div class="wordmark">
        <h1>SỔ TAY QN</h1>
        <svg class="verified" viewBox="0 0 24 24" fill="none" aria-label="verified"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12l3.5 3.5 7-7" stroke="#021712" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
    <p class="tagline">Thư viện tài liệu cá nhân · <b>docs.vienthietke.com</b></p>

    <div class="stats" role="list">
      <div class="stat-cell" role="listitem"><b>${items.length}<small>trang</small></b></div>
      <div class="stat-cell" role="listitem"><b>${formatK(totalWords)}<small>từ</small></b></div>
      <div class="stat-cell" role="listitem"><b>~${totalRead}<small>phút đọc</small></b></div>
    </div>
  </header>

${sections}

  <p class="footer">Tự sinh bởi <code>scripts/build-index.mjs</code> · cập nhật ${new Date().toISOString().slice(0, 10)}</p>
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

  if (isStandalone()) {
    localStorage.setItem('pwa-installed','1');
    return;
  }
  if (localStorage.getItem('pwa-installed') === '1') {
    setTimeout(function(){
      if (!isStandalone()) {
        localStorage.removeItem('pwa-installed');
        if (!sessionStorage.getItem('install-dismissed')) show();
      }
    }, 5000);
    return;
  }
  if (sessionStorage.getItem('install-dismissed') === '1') return;

  if (isIOS()) {
    document.getElementById('installLabel').textContent = 'Cài app (iOS)';
    show();
  }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferred = e;
    show();
  });

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
console.log(`✓ Wrote ${relative(ROOT, OUTPUT)} (${items.length} entries, ${formatK(totalWords)} từ, ~${totalRead} phút)`);
for (const it of items) console.log(`  - ${it.rel}  — ${it.title}  (${it.words} từ, ${it.readMin}m)`);

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
