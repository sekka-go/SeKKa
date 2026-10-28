import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "public/manifest.webmanifest"), "utf8"));
assert.ok(manifest.name && manifest.short_name, "manifest needs app names");
assert.ok(manifest.start_url && manifest.scope, "manifest needs start_url and scope");
assert.ok(["standalone", "minimal-ui", "fullscreen"].includes(manifest.display), "manifest display must support app-like launch");
assert.equal(manifest.prefer_related_applications, false, "PWA should not prefer a related native app");

for (const expected of [192, 512]) {
  const icon = manifest.icons?.find((entry) => entry.sizes === expected + "x" + expected && entry.type === "image/png" && entry.purpose === "any");
  const maskable = manifest.icons?.find((entry) => entry.sizes === expected + "x" + expected && entry.type === "image/png" && entry.purpose === "maskable");
  assert.ok(icon, "manifest must include a transparent " + expected + "px any icon");
  assert.ok(maskable, "manifest must include a separate " + expected + "px maskable icon");
  const file = path.join(root, "public", icon.src.replace(/^\//, ""));
  const bytes = await readFile(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], icon.src + " must be a real PNG");
  assert.equal(bytes.readUInt32BE(16), expected, icon.src + " width must match manifest");
  assert.equal(bytes.readUInt32BE(20), expected, icon.src + " height must match manifest");
  const { data: pixels } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.ok(pixels.some((alpha, index) => index % 4 === 3 && alpha === 0), icon.src + " must retain transparent pixels");
  const maskableFile = path.join(root, "public", maskable.src.replace(/^\//, ""));
  const maskableMetadata = await sharp(maskableFile).metadata();
  assert.equal(maskableMetadata.width, expected, maskable.src + " width must match manifest");
  assert.equal(maskableMetadata.height, expected, maskable.src + " height must match manifest");
}

await readFile(path.join(root, "public/brand/favicon.svg"));
const markFile = path.join(root, "public/brand/sekka-mark.png");
const markMetadata = await sharp(markFile).metadata();
assert.equal(markMetadata.width, 512, "shared SeKKa logo mark must be a 512px PNG");
assert.equal(markMetadata.height, 512, "shared SeKKa logo mark must be a 512px PNG");
const { data: markPixels } = await sharp(markFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(markPixels[3], 0, "shared SeKKa logo mark must keep transparent corners around its rounded tile");
for (const file of ["favicon-32.png", "favicon-48.png", "apple-touch-icon-180.png", "sekka-badge.png", "sekka-share.png"]) {
  await readFile(path.join(root, "public/brand", file));
}
assert.equal(manifest.theme_color, "#f8f9ff");
assert.equal(manifest.background_color, "#f8f9ff");
assert.equal(manifest.color_scheme_dark?.background_color, "#090d16");

await readFile(path.join(root, "public/offline.html"));
const worker = await readFile(path.join(root, "public/sw.js"), "utf8");
assert.ok(worker.includes("key.startsWith(CACHE_PREFIX)"), "service worker must only clear its own cache namespace");
assert.ok(worker.includes('url.origin !== self.location.origin'), "service worker must not cache third-party data");
assert.ok(worker.includes('url.pathname === "/api"'), "service worker must bypass API requests");
assert.ok(worker.includes('  "/",'), "service worker app shell must cache the shared root document");
assert.ok(worker.includes('cache.match("/")'), "offline navigations must fall back to the shared app shell");
assert.ok(worker.includes('sekka-shell-v12'), "service worker icon cache must be revised after replacing assets");
assert.ok(worker.includes('"/brand/sekka-mark.png"'), "service worker app shell must cache the shared logo mark");
const headers = await readFile(path.join(root, "public/_headers"), "utf8");
assert.match(headers, /\/assets\/\*[\s\S]*?Cache-Control: public, max-age=31536000, immutable/, "hashed assets must have immutable caching");
assert.match(headers, /\/sw\.js[\s\S]*?Cache-Control: no-cache/, "service worker updates must be revalidated");
assert.match(headers, /\/theme-preference\.js[\s\S]*?Cache-Control: no-cache/, "theme bootstrap must be revalidated");
console.log("PWA manifest, icon dimensions, offline fallback, and cache boundaries are valid.");
