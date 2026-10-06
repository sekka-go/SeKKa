import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const SIZE = 512;
const SCALE = 2;
const HI_SIZE = SIZE * SCALE;
const background = [16, 24, 39, 255];
const white = [247, 249, 252, 255];
const cyan = [103, 214, 212, 185];
const gold = [245, 189, 8, 255];
const pixels = new Uint8Array(HI_SIZE * HI_SIZE * 4);
for (let i = 0; i < pixels.length; i += 4) pixels.set(background, i);

function blend(x, y, color, coverage = 1) {
  if (x < 0 || y < 0 || x >= HI_SIZE || y >= HI_SIZE || coverage <= 0) return;
  const offset = (Math.round(y) * HI_SIZE + Math.round(x)) * 4;
  const alpha = Math.min(1, coverage * color[3] / 255);
  for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(pixels[offset + channel] * (1 - alpha) + color[channel] * alpha);
  pixels[offset + 3] = 255;
}

function disk(x, y, radius, color) {
  x *= SCALE; y *= SCALE; radius *= SCALE;
  for (let py = Math.floor(y - radius - 1); py <= y + radius + 1; py++) {
    for (let px = Math.floor(x - radius - 1); px <= x + radius + 1; px++) {
      const distance = Math.hypot(px + .5 - x, py + .5 - y);
      blend(px, py, color, Math.max(0, Math.min(1, radius + .5 - distance)));
    }
  }
}

function cubic([x0, y0], [x1, y1], [x2, y2], [x3, y3], t) {
  const u = 1 - t;
  return [u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
    u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3];
}

function drawRoute(curves, color, width) {
  for (const curve of curves) {
    const steps = 180;
    let previous = cubic(...curve, 0);
    for (let step = 1; step <= steps; step++) {
      const point = cubic(...curve, step / steps);
      const distance = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
      const stamps = Math.max(1, Math.ceil(distance * SCALE / 1.5));
      for (let stamp = 0; stamp <= stamps; stamp++) {
        const ratio = stamp / stamps;
        disk(previous[0] + (point[0] - previous[0]) * ratio, previous[1] + (point[1] - previous[1]) * ratio, width / 2, color);
      }
      previous = point;
    }
  }
}

function pinPolygon(x, y, width, height) {
  const curves = [
    [[x + width / 2, y + height], [x + width * .34, y + height * .68], [x, y + height * .48], [x, y + height * .3]],
    [[x, y + height * .3], [x, y + height * .12], [x + width * .2, y], [x + width / 2, y]],
    [[x + width / 2, y], [x + width * .8, y], [x + width, y + height * .12], [x + width, y + height * .3]],
    [[x + width, y + height * .3], [x + width, y + height * .48], [x + width * .66, y + height * .68], [x + width / 2, y + height]],
  ];
  const points = [];
  for (const curve of curves) for (let i = 0; i < 32; i++) points.push(cubic(...curve, i / 32));
  return points;
}

function fillPolygon(points, color) {
  const xs = points.map(([x]) => x * SCALE), ys = points.map(([, y]) => y * SCALE);
  const minX = Math.max(0, Math.floor(Math.min(...xs))), maxX = Math.min(HI_SIZE - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(HI_SIZE - 1, Math.ceil(Math.max(...ys)));
  for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
    const cx = px + .5, cy = py + .5; let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ix, iy] = points[i].map((value) => value * SCALE); const [jx, jy] = points[j].map((value) => value * SCALE);
      if ((iy > cy) !== (jy > cy) && cx < (jx - ix) * (cy - iy) / (jy - iy) + ix) inside = !inside;
    }
    if (inside) blend(px, py, color);
  }
}

function drawPin(x, y, width, height) {
  fillPolygon(pinPolygon(x, y, width, height), gold);
  disk(x + width / 2, y + height * .29, width * .155, background);
}

drawRoute([
  [[142, 389], [221, 368], [319, 347], [357, 313]],
  [[357, 313], [399, 273], [279, 254], [210, 225]],
  [[210, 225], [141, 196], [231, 166], [356, 145]],
], white, 15);
drawRoute([
  [[138, 408], [235, 384], [340, 360], [382, 320]],
  [[382, 320], [429, 274], [293, 239], [227, 210]],
  [[227, 210], [177, 188], [274, 158], [364, 137]],
], cyan, 5);
drawPin(325, 70, 72, 88);
drawPin(111, 323, 65, 79);

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function png(width, height) {
  const factor = HI_SIZE / width;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4); rows[row] = 0;
    for (let x = 0; x < width; x++) for (let channel = 0; channel < 4; channel++) {
      let sum = 0; const x0 = x * factor, x1 = (x + 1) * factor, y0 = y * factor, y1 = (y + 1) * factor;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const weight = Math.max(0, Math.min(x1, sx + 1) - Math.max(x0, sx)) * Math.max(0, Math.min(y1, sy + 1) - Math.max(y0, sy));
        sum += pixels[(sy * HI_SIZE + sx) * 4 + channel] * weight;
      }
      rows[row + 1 + x * 4 + channel] = Math.round(sum / (factor * factor));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

for (const [size, file] of [[192, "pwa-icon-192.png"], [512, "pwa-icon-512.png"], [1024, "sekka-icon-dark.png"]]) {
  const output = resolve("public/brand", file);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, png(size, size));
}
