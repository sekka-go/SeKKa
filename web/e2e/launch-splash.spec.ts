import { expect, test } from "@playwright/test";

const artwork = "/brand/sekka-launch-static-20261118.svg";

test("fresh app open shows a smaller centered seKKa logo with a gentle pulse before Welcome", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("/");
  const splash = page.locator(".sekka-launch");
  await expect(splash).toBeVisible();
  const picture = splash.locator("img.sekka-launch__artwork");
  await expect(picture).toHaveAttribute("src", artwork);
  await expect(picture).toHaveAttribute("alt", "seKKa");
  await expect(picture).toBeVisible();
  await expect(splash.locator("svg,.sekka-launch__map,.sekka-launch__route,.sekka-launch__wordmark")).toHaveCount(0);
  await expect(splash).not.toContainText("سكة");
  const box = await splash.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(box!.y).toBe(0);
  expect(box!.width).toBe(390);
  expect(box!.height).toBe(844);
  // Only the logo pulses, not an animated road/map or a second launch screen.
  const logoState = await picture.evaluate(image => {
    const imageRect = image.getBoundingClientRect();
    const viewport = document.documentElement;
    return {
      width: imageRect.width,
      centerX: imageRect.left + imageRect.width / 2,
      centerY: imageRect.top + imageRect.height / 2,
      viewportWidth: viewport.clientWidth,
      viewportHeight: window.innerHeight,
      animationName: getComputedStyle(image).animationName,
      otherAnimations: [...image.parentElement!.querySelectorAll("*")]
        .filter(element => element !== image)
        .some(element => getComputedStyle(element).animationName !== "none"),
    };
  });
  expect(logoState.width).toBeLessThanOrEqual(300 * 1.07);
  expect(logoState.width).toBeGreaterThan(100);
  expect(logoState.centerX).toBeCloseTo(logoState.viewportWidth / 2, 0);
  expect(logoState.centerY).toBeCloseTo(logoState.viewportHeight / 2, 0);
  expect(logoState.animationName).toContain("sekka-launch-pulse");
  expect(logoState.otherAnimations).toBe(false);
  await expect(splash).toHaveCount(0, { timeout: 4500 });
  await expect(page.locator(".phase-screen-2")).toBeVisible();
});

test("static artwork is the exact optimized brand asset, not an external image", async ({ request }) => {
  const response = await request.get(artwork);
  expect(response.ok()).toBeTruthy();
  const svg = await response.text();
  expect(svg).toContain('viewBox="0 0 1536 1536"');
  expect(svg).toContain('aria-label="seKKa"');
  expect(svg).toContain('fill="#000"');
  expect(svg).toContain('fill="#ffcd04"');
  expect(svg).toContain('fill="#fdfdfd"');
  expect(svg).not.toContain("سكة");
});

test("OAuth callback and the developer gallery never show the opening splash", async ({ page }) => {
  await page.goto("/?code=test-oauth-callback");
  await expect(page.locator(".sekka-launch")).toHaveCount(0);
  await page.goto("/dev/screens?screen=2");
  await expect(page.locator(".sekka-launch")).toHaveCount(0);
});

for (const [width, height] of [[320, 700], [360, 800], [412, 915]] as const) {
  test(`static splash fills the PWA viewport at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?tab=login&view=2");
    const splash = page.locator(".sekka-launch");
    await expect(splash).toBeVisible();
    const box = await splash.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
    expect(box!.width).toBe(width);
    expect(box!.height).toBe(height);
    await expect(splash).toHaveCount(0, { timeout: 4500 });
  });
}

test("refresh restores current page without replaying splash", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?tab=login&view=2");
  await expect(page.locator(".sekka-launch")).toBeVisible();
  await expect(page.locator(".sekka-launch")).toHaveCount(0, { timeout: 4500 });
  await page.reload();
  await expect(page.locator(".sekka-launch")).toHaveCount(0);
  await expect(page.locator(".phase-screen-2")).toBeVisible();
});

test("Android-installed PWA uses English logo icon instead of the old yellow Arabic one", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("seKKa");
  expect(manifest.short_name).toBe("seKKa");
  expect(manifest.dir).toBe("ltr");
  expect(manifest.background_color).toBe("#000000");
  expect(manifest.theme_color).toBe("#000000");
  expect(manifest.icons.map((icon: {src:string}) => icon.src)).toEqual([
    "/brand/sekka-pwa-en-20261118-192.png",
    "/brand/sekka-pwa-en-20261118-512.png"
  ]);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBeTruthy();
    const bytes = await response.body();
    expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
    expect(icon.type).toBe("image/png");
  }
  const index = await (await request.get("/")).text();
  expect(index).toContain(artwork);
  expect(index).toContain("/brand/sekka-pwa-en-20261118-192.png");
  expect(index).not.toContain("/brand/sekka-pwa-20261115-192.png");
  expect(index).not.toContain('href="/brand/sekka-user-icon.svg"');
  expect(index).not.toContain('href="/brand/sekka-splash-wordmark.svg"');
});

test("a new app navigation may display the same static launch artwork again", async ({ page }) => {
  await page.goto("/?tab=login&view=2");
  await expect(page.locator(".sekka-launch")).toBeVisible();
  await expect(page.locator(".sekka-launch")).toHaveCount(0, { timeout: 4500 });
  await page.goto("/?tab=login&view=2");
  await expect(page.locator(".sekka-launch")).toBeVisible();
});

test("system reduced-motion preference disables logo pulsing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?tab=login&view=2");
  const picture = page.locator(".sekka-launch__artwork");
  await expect(picture).toBeVisible();
  await expect(picture).toHaveCSS("animation-name", "none");
  await expect(page.locator(".sekka-launch")).toHaveCount(0, { timeout: 4500 });
});
