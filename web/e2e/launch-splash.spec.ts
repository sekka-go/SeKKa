import { expect, test } from "@playwright/test";

const icon = "/brand/sekka-go-road-512.png";
const intro = ".sekka-launch";

test("new opening shows animated Hiace on a cream screen followed by a black curved transition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("/");
  const splash=page.locator(intro);
  await expect(splash).toBeVisible();
  await expect(splash.locator("svg.sekka-launch__hiace")).toBeVisible();
  await expect(splash.locator(".sekka-launch__wordmark")).toHaveText("سِكّة");
  await expect(splash.locator(".sekka-launch__vehicle")).toHaveCSS("animation-name", "sekka-hiace-drive");
  await expect(splash.locator(".sekka-launch__black-wipe")).toHaveCSS("animation-name", "sekka-black-reveal");
  await expect(splash.locator(".sekka-launch__stage")).toHaveCSS("background-color", "rgb(247, 240, 229)");
  // The old motorbike and static road-icon image must not be in the animation.
  await expect(splash.locator(".sekka-launch__artwork,img")).toHaveCount(0);
  const box=await splash.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(box!.y).toBe(0);
  expect(box!.width).toBe(390);
  expect(box!.height).toBe(844);
  await expect(splash).toHaveCount(0,{timeout:6000});
  await expect(page.locator(".phase-screen-2")).toBeVisible();
});

for(const [width,height] of [[320,700],[360,800],[412,915]] as const) {
  test(`Hiace opening covers the PWA viewport at ${width}x${height}`,async ({page})=>{
    await page.setViewportSize({width,height});
    await page.goto("/?tab=login&view=2");
    const splash=page.locator(intro);
    await expect(splash).toBeVisible();
    const box=await splash.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
    expect(box!.width).toBe(width);
    expect(box!.height).toBe(height);
    await expect(splash).toHaveCount(0,{timeout:6000});
  });
}

test("back navigation, OAuth callback and developer gallery must never replay the opening",async ({page})=>{
 await page.goto("/?code=test-oauth-callback");
 await expect(page.locator(intro)).toHaveCount(0);
 await page.goto("/dev/screens?screen=2");
 await expect(page.locator(intro)).toHaveCount(0);
});

test("reload replays Hiace intro while retaining user's requested page",async ({page})=>{
 await page.goto("/?tab=login&view=2");
 await expect(page.locator(intro)).toBeVisible();
 await expect(page.locator(intro)).toHaveCount(0,{timeout:6000});
 await page.reload();
 await expect(page.locator(intro)).toBeVisible();
 await expect(page.locator(intro)).toHaveCount(0,{timeout:6000});
 await expect(page.locator(".phase-screen-2")).toBeVisible();
});

test("prefers-reduced-motion skips vehicle/wipe motion and does not block the app",async ({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.goto("/?tab=login&view=2");
 await expect(page.locator(intro)).toHaveCount(0,{timeout:3000});
 await expect(page.locator(".phase-screen-2")).toBeVisible();
});

test("installed identity remains Sekka Go, but launch background and status bar are black",async ({request})=>{
 const response=await request.get("/manifest.webmanifest");
 expect(response.ok()).toBeTruthy();
 const manifest=await response.json();
 expect(manifest.name).toBe("Sekka Go");
 expect(manifest.short_name).toBe("Sekka Go");
 expect(manifest.dir).toBe("rtl");
 expect(manifest.background_color).toBe("#171318");
 expect(manifest.theme_color).toBe("#171318");
 expect(manifest.icons.map((item:{src:string})=>item.src)).toEqual([
  "/brand/sekka-go-road-192.png",icon
 ]);
 const index=await (await request.get("/")).text();
 expect(index).toContain('name="theme-color" content="#171318"');
 expect(index).toContain('background:#F7F0E5');
 for(const item of manifest.icons) {
  const img=await request.get(item.src);
  expect(img.ok()).toBeTruthy();
  const bytes=await img.body();
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
 }
});

test("public app uses black, cream and mauve tokens without restyling dev gallery",async ({page})=>{
 await page.goto("/?tab=login&view=2");
 await expect(page.locator(intro)).toHaveCount(0,{timeout:6000});
 const root=page.locator(".sekka-mobile");
 await expect(root).toBeVisible();
 const palette=await root.evaluate(el=>{
  const styles=getComputedStyle(el);
  return {
   bg:styles.backgroundColor,
   ink:styles.getPropertyValue("--sekka-black").trim(),
   cream:styles.getPropertyValue("--sekka-cream").trim(),
   mauve:styles.getPropertyValue("--sekka-mauve").trim()
  };
 });
 expect(palette).toEqual({
  bg:"rgb(247, 240, 229)",
  ink:"#171318",
  cream:"#F7F0E5",
  mauve:"#8050AF"
 });
});
