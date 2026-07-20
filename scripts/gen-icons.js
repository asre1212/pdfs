// Generates PNG app icons procedurally (no external deps — uses Node zlib).
// Draws a document with a folded corner + scan line on a blue gradient.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    // simple alpha blend over existing
    const ia = a / 255, na = 1 - ia;
    buf[o]   = Math.round(r * ia + buf[o] * na);
    buf[o+1] = Math.round(g * ia + buf[o+1] * na);
    buf[o+2] = Math.round(b * ia + buf[o+2] * na);
    buf[o+3] = 255;
  };
  // background gradient (navy -> blue)
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(0x0b + (0x2f - 0x0b) * t);
    const g = Math.round(0x12 + (0x6f - 0x12) * t);
    const b = Math.round(0x20 + (0xe0 - 0x20) * t);
    for (let x = 0; x < size; x++) set(x, y, r, g, b);
  }
  // document card geometry (normalized)
  const S = size;
  const dx = 0.24 * S, dy = 0.20 * S, dw = 0.52 * S, dh = 0.60 * S;
  const fold = 0.16 * S;        // folded corner size
  const rad = 0.05 * S;         // corner radius
  const insideCard = (x, y) => {
    if (x < dx || x > dx + dw || y < dy || y > dy + dh) return false;
    // rounded corners (skip the top-right where the fold is)
    const corners = [[dx, dy], [dx + dw, dy + dh], [dx, dy + dh]];
    for (const [cx, cy] of corners) {
      const nx = (x < dx + rad && cx === dx) || (x > dx + dw - rad && cx === dx + dw);
      const ny = (y < dy + rad && cy === dy) || (y > dy + dh - rad && cy === dy + dh);
      if (nx && ny) {
        const rx = cx === dx ? dx + rad : dx + dw - rad;
        const ry = cy === dy ? dy + rad : dy + dh - rad;
        if ((x - rx) ** 2 + (y - ry) ** 2 > rad * rad) return false;
      }
    }
    // cut the folded corner (top-right diagonal)
    if (x > dx + dw - fold && y < dy + fold) {
      if ((x - (dx + dw - fold)) + (dy + fold - y) > fold) return false;
    }
    return true;
  };
  // soft shadow
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const ox = x - Math.round(0.012 * S), oy = y - Math.round(0.012 * S);
      if (insideCard(ox, oy)) set(x, y, 0, 0, 0, 55);
    }
  // white page
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (insideCard(x, y)) set(x, y, 246, 249, 255);
  // folded-corner triangle (light shade)
  for (let y = Math.floor(dy); y < dy + fold; y++)
    for (let x = Math.floor(dx + dw - fold); x < dx + dw; x++) {
      const ax = x - (dx + dw - fold), ay = (dy + fold) - y;
      if (ax >= 0 && ay >= 0 && ax + ay <= fold && ax >= ay) set(x, y, 0xcf, 0xdd, 0xf5);
    }
  // text lines
  const lineColor = [0x9a, 0xa8, 0xc2];
  const accent = [0x34, 0xd3, 0x99];
  const lines = 5;
  for (let li = 0; li < lines; li++) {
    const ly = dy + dh * (0.34 + li * 0.12);
    const lw = li === lines - 1 ? dw * 0.42 : dw * 0.62;
    const th = Math.max(2, Math.round(0.028 * S));
    const col = li === 0 ? accent : lineColor; // top line = green accent (the "scan")
    for (let y = Math.round(ly); y < ly + th; y++)
      for (let x = Math.round(dx + dw * 0.16); x < dx + dw * 0.16 + lw; x++)
        if (insideCard(x, y)) set(x, y, col[0], col[1], col[2]);
  }
  return encodePng(size, size, buf);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${s}.png`), draw(s));
  console.log('wrote icon-' + s + '.png');
}
// maskable variant is the same full-bleed design
fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.join(outDir, 'icon-512-maskable.png'));
console.log('done');
