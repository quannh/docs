#!/usr/bin/env node
// Render assets/icon-source.svg và assets/icon-maskable.svg ra các PNG cần thiết cho PWA.
// Ưu tiên file PNG nếu user save assets/icon-source.png — sẽ dùng PNG đó thay cho SVG.
// Chạy: node scripts/build-icons.mjs

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'icons');
if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true });

async function load(svgPath, pngPath) {
  if (pngPath && existsSync(pngPath)) {
    console.log(`· using PNG source: ${pngPath.slice(ROOT.length + 1)}`);
    return sharp(pngPath);
  }
  if (!existsSync(svgPath)) {
    throw new Error(`Source not found: ${svgPath}`);
  }
  console.log(`· using SVG source: ${svgPath.slice(ROOT.length + 1)}`);
  const svgBuf = readFileSync(svgPath);
  return sharp(svgBuf, { density: 384 });
}

async function render(input, size, out) {
  await input
    .clone()
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(ICONS_DIR, out));
  console.log(`✓ ${out} (${size}x${size})`);
}

import { statSync } from 'node:fs';

const sourceSvg = join(ROOT, 'assets', 'icon-source.svg');
const sourcePng = join(ROOT, 'assets', 'icon-source.png');
const maskableSvg = join(ROOT, 'assets', 'icon-maskable.svg');
const squarePng = join(ROOT, 'assets', 'icon-square.png');

// Nếu icon-square.png trùng size với icon-source.png → coi như user chưa cung cấp
// maskable riêng, fallback về SVG (full-bleed, không bo góc).
let maskablePngArg = squarePng;
if (existsSync(squarePng) && existsSync(sourcePng)) {
  const a = statSync(squarePng).size;
  const b = statSync(sourcePng).size;
  if (a === b) {
    console.log('· icon-square.png trùng icon-source.png → dùng SVG cho maskable');
    maskablePngArg = null;
  }
}

const sourceInput = await load(sourceSvg, sourcePng);
const maskableInput = await load(maskableSvg, maskablePngArg);

await render(sourceInput, 192, 'icon-192.png');
await render(sourceInput, 512, 'icon-512.png');
await render(maskableInput, 512, 'icon-maskable-512.png');
await render(maskableInput, 180, 'apple-touch-icon.png');
await render(sourceInput, 32, 'favicon-32.png');

console.log('Done.');
