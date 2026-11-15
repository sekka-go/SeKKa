import { expect, test } from "@playwright/test";

test("splash fills mobile viewport, reveals logo and hands off to the real app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?tab=login&view=2");
  const splash = page.locator(".sekka-launch");
  await expect(splash).toBeVisible();
  const bounds = await splash.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBe(0);
  expect(bounds!.y).toBe(0);
  expect(bounds!.width).toBe(390);
  expect(bounds!.height).toBe(844);
  await expect(page.locator(".sekka-launch__wordmark")).toHaveAttribute("src", "/brand/sekka-splash-wordmark.svg");
  await expect(splash).toHaveCount(0, { timeout: 5500 });
  await expect(page.locator("#root")).toBeVisible();
});

test("splash doesn't interrupt Google OAuth callback", async ({ page }) => {
  await page.goto("/?code=test-oauth-callback");
  await expect(page.locator(".sekka-launch")).toHaveCount(0);
});

test("manifest contains the new icon at both install sizes", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
    "/brand/sekka-icon-192.png",
    "/brand/sekka-icon-512.png"
  ]);
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.ok()).toBeTruthy();
    expect((await asset.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  }
});
