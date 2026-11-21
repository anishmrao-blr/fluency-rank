// Generates the app icons as PNGs using only Node built-ins (zlib).
// Design: the rank hexagon, a steel outline with an amber core on ink. Maskable art stays in the safe zone.
// Usage: node tools/make-icons.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
// Pointy-top hexagon test: inside if within the vertical band and under the slanted edges.
const inHex = (x, y, c, r) => { const dx = Math.abs(x - c) / r, dy = Math.abs(y - c) / r; return dx <= 0.866 && dy <= 1 - dx * 0.577; };
const SS = 4; // supersampling per axis, for smooth edges
function png(size, scale) {
  const ink = [11, 16, 27], steel = [125, 180, 240], amber = [233, 180, 76];
  const raw = Buffer.alloc((size * 4 + 1) * size), c = size / 2, r = size * 0.40 * scale;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        let col = ink;
        if (inHex(px, py, c, r)) col = steel;
        if (inHex(px, py, c, r * 0.86)) col = ink;
        if (inHex(px, py, c, r * 0.5)) col = amber;
        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4, n = SS * SS;
      raw[o] = Math.round(acc[0] / n); raw[o + 1] = Math.round(acc[1] / n); raw[o + 2] = Math.round(acc[2] / n); raw[o + 3] = 255;
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, {recursive: true});
[['icon-180.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['maskable-512.png', 512, 0.78]]
  .forEach(([f, s, k]) => fs.writeFileSync(path.join(out, f), png(s, k)));
console.log('icons written');
