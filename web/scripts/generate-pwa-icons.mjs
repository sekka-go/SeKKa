import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(webRoot, "public/brand");
const sourcePath = resolve(webRoot, "src/brand/sekka-logo-source.png");
const source = await readFile(sourcePath);
const sourceMeta = await sharp(source).metadata();
if (sourceMeta.width !== 397 || sourceMeta.height !== 385) {
  throw new Error(`Unexpected supplied SeKKa logo size: ${sourceMeta.width}x${sourceMeta.height}.`);
}

const tileSize = 336;
const roundedMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}"><rect width="${tileSize}" height="${tileSize}" rx="78" fill="#fff"/></svg>`);
const logoTile = await sharp(source)
  .extract({ left: 31, top: 27, width: tileSize, height: tileSize })
  .composite([{ input: roundedMask, blend: "dest-in" }])
  .png()
  .toBuffer();

async function createIcon(size, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const tileWidth = Math.round(size * 0.88);
  const tile = await sharp(logoTile).resize(tileWidth, tileWidth, { fit: "contain" }).png().toBuffer();
  const offset = Math.floor((size - tileWidth) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  }).composite([{ input: tile, left: offset, top: offset }]).png().toBuffer();
}

async function writePng(name, data) {
  await sharp(data).png().toFile(resolve(outputDir, name));
}

function imageSvg(href = "./sekka-mark.png") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image href="${href}" width="512" height="512" preserveAspectRatio="none"/></svg>`;
}

await mkdir(outputDir, { recursive: true });
const any512 = await createIcon(512);
const maskable192 = await createIcon(192, { r: 248, g: 249, b: 255, alpha: 1 });
const maskable512 = await createIcon(512, { r: 248, g: 249, b: 255, alpha: 1 });
const iconPixels = await sharp(logoTile).resize(96, 96).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const badgePixels = Buffer.alloc(iconPixels.data.length);
for (let offset = 0; offset < iconPixels.data.length; offset += 4) {
  const [red, green, blue, sourceAlpha] = iconPixels.data.subarray(offset, offset + 4);
  const darkness = Math.max(0, 255 - Math.min(red, green, blue));
  const alpha = Math.round((darkness / 255) * sourceAlpha);
  badgePixels[offset] = 0;
  badgePixels[offset + 1] = 137;
  badgePixels[offset + 2] = 94;
  badgePixels[offset + 3] = alpha;
}
const badge = await sharp(badgePixels, { raw: { width: 96, height: 96, channels: 4 } }).png().toBuffer();
const shareBackground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f8f9ff"/></svg>`);
const shareIcon = await createIcon(440, { r: 248, g: 249, b: 255, alpha: 0 });
const share = await sharp(shareBackground).composite([{ input: shareIcon, left: 380, top: 95 }]).png().toBuffer();

await Promise.all([
  writeFile(resolve(outputDir, "sekka-mark.svg"), imageSvg()),
  writeFile(resolve(outputDir, "favicon.svg"), imageSvg()),
  writeFile(resolve(webRoot, "src/brand/sekka-mark.svg"), imageSvg("./sekka-logo-source.png")),
  writePng("sekka-mark.png", await createIcon(512)),
  writePng("favicon-32.png", await createIcon(32)),
  writePng("favicon-48.png", await createIcon(48)),
  writePng("pwa-icon-192.png", await createIcon(192)),
  writePng("pwa-icon-512.png", any512),
  writePng("pwa-icon-192-maskable.png", maskable192),
  writePng("pwa-icon-512-maskable.png", maskable512),
  writePng("apple-touch-icon-180.png", await createIcon(180, { r: 248, g: 249, b: 255, alpha: 1 })),
  writePng("sekka-badge.png", badge),
  writePng("sekka-share.png", share),
]);

console.log("Generated SeKKa PWA icons from the supplied logo image.");
