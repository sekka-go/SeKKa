import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(webRoot, "public/brand");
const sourceMark = await readFile(resolve(webRoot, "src/brand/sekka-mark.svg"), "utf8");
const mark = {
  viewBox: sourceMark.match(/viewBox="([^"]+)"/)?.[1],
  transform: sourceMark.match(/<g transform="([^"]+)"/)?.[1],
  route: sourceMark.match(/<path id="sekka-mark-route"[^>]*d="([^"]+)"/)?.[1],
  dots: [...sourceMark.matchAll(/<circle id="sekka-mark-dot" cx="([^"]+)" cy="([^"]+)"/g)]
    .map(([, cx, cy]) => ({ cx, cy })),
};
if (!mark.viewBox || !mark.transform || !mark.route || mark.dots.length < 2) {
  throw new Error("src/brand/sekka-mark.svg is missing required mark geometry.");
}
const colors = { green: "#2d6a4f", dark: "#0b1c30", light: "#f8f9ff", tile: "#2d6a4f" };

function markSvg({ green = colors.green, dark = colors.dark, light = colors.light, tile = null } = {}) {
  const background = tile ? `<rect width="512" height="512" fill="${tile}"/>` : "";
  const route = `<path d="${mark.route}" fill="none" stroke="${dark}" stroke-width="27" stroke-linecap="round"/><path d="${mark.route}" fill="none" stroke="${light}" stroke-width="21" stroke-linecap="round"/><path d="${mark.route}" fill="none" stroke="${green}" stroke-width="14" stroke-linecap="round"/>`;
  const dots = mark.dots.map(({ cx, cy }) => `<circle cx="${cx}" cy="${cy}" r="17" fill="${dark}"/><circle cx="${cx}" cy="${cy}" r="14" fill="${light}"/><circle cx="${cx}" cy="${cy}" r="10" fill="${green}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${mark.viewBox}">${background}<g transform="${mark.transform}">${route}${dots}</g></svg>`;
}

async function writePng(name, svg, width, height = width) {
  await sharp(Buffer.from(svg)).resize(width, height, { fit: "contain" }).png().toFile(resolve(outputDir, name));
}

await mkdir(outputDir, { recursive: true });
const transparentSvg = markSvg();
const maskableSvg = markSvg({ green: colors.light, dark: colors.dark, light: colors.tile, tile: colors.tile });
await writeFile(resolve(outputDir, "sekka-mark.svg"), transparentSvg);
await writeFile(resolve(outputDir, "favicon.svg"), transparentSvg);
await Promise.all([
  writePng("favicon-32.png", transparentSvg, 32),
  writePng("favicon-48.png", transparentSvg, 48),
  writePng("pwa-icon-192.png", transparentSvg, 192),
  writePng("pwa-icon-512.png", transparentSvg, 512),
  writePng("pwa-icon-192-maskable.png", maskableSvg, 192),
  writePng("pwa-icon-512-maskable.png", maskableSvg, 512),
  writePng("apple-touch-icon-180.png", maskableSvg, 180),
  writePng("sekka-badge.png", markSvg({ green: colors.green, dark: colors.green, light: colors.green }), 96),
  writePng("sekka-share.png", `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${colors.light}"/><svg x="344" y="59" width="512" height="512" viewBox="0 0 512 512">${transparentSvg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg></svg>`, 1200, 630),
]);

console.log("Generated SeKKa icons from src/brand/sekka-mark.svg.");
