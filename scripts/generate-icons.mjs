#!/usr/bin/env node
/**
 * Generates placeholder PWA icons with Brigada pink branding.
 * Uses only Node.js built-ins (no external dependencies).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const combined = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, combined, crc]);
}

function createPng(size) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  const bg = { r: 255, g: 27, b: 141 };
  const white = { r: 255, g: 255, b: 255 };
  const radius = size * 0.18;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inCircle = dist < radius;

      // Draw letter B shape (simplified block)
      const relX = (x - cx) / (size * 0.35);
      const relY = (y - cy) / (size * 0.35);
      const inB =
        relX >= -0.5 && relX <= 0.5 &&
        relY >= -0.8 && relY <= 0.8 &&
        (
          (relX >= -0.5 && relX <= -0.2) ||
          (relY >= -0.8 && relY <= -0.55 && relX >= -0.5 && relX <= 0.4) ||
          (relY >= -0.1 && relY <= 0.1 && relX >= -0.5 && relX <= 0.35) ||
          (relY >= 0.55 && relY <= 0.8 && relX >= -0.5 && relX <= 0.4) ||
          (relX >= 0.15 && relX <= 0.4 && relY >= -0.8 && relY <= -0.35) ||
          (relX >= 0.1 && relX <= 0.35 && relY >= 0.35 && relY <= 0.8)
        );

      const color = inB ? white : inCircle ? bg : bg;
      const px = rowStart + 1 + x * 4;
      raw[px] = color.r;
      raw[px + 1] = color.g;
      raw[px + 2] = color.b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const png = createPng(size);
  const filename = join(OUT_DIR, `icon-${size}x${size}.png`);
  writeFileSync(filename, png);
  console.log(`Created ${filename}`);
}

console.log('Done generating PWA icons.');
