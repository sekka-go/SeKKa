import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "public/manifest.webmanifest"), "utf8"));
assert.ok(manifest.name && manifest.short_name, "manifest needs app names");
assert.ok(manifest.start_url && manifest.scope, "manifest needs start_url and scope");
assert.ok(["standalone", "minimal-ui", "fullscreen"].includes(manifest.display), "manifest display must support app-like launch");
assert.equal(manifest.prefer_related_applications, false, "PWA should not prefer a related native app");

for (const expected of [192, 512]) {
  const icon = manifest.icons?.find((entry) => entry.sizes === expected + "x" + expected && entry.type === "image/png");
  assert.ok(icon, "manifest must include a " + expected + "px PNG icon");
  assert.ok(String(icon.purpose).split(/\s+/).includes("maskable"), "install icons must be maskable");
  const file = path.join(root, "public", icon.src.replace(/^\//, ""));
  const bytes = await readFile(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], icon.src + " must be a real PNG");
  assert.equal(bytes.readUInt32BE(16), expected, icon.src + " width must match manifest");
  assert.equal(bytes.readUInt32BE(20), expected, icon.src + " height must match manifest");
}

await readFile(path.join(root, "public/offline.html"));
const worker = await readFile(path.join(root, "public/sw.js"), "utf8");
assert.ok(worker.includes("key.startsWith(CACHE_PREFIX)"), "service worker must only clear its own cache namespace");
assert.ok(worker.includes('url.origin !== self.location.origin'), "service worker must not cache third-party data");
assert.ok(worker.includes('url.pathname === "/api"'), "service worker must bypass API requests");
console.log("PWA manifest, icon dimensions, offline fallback, and cache boundaries are valid.");
