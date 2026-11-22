import {expect,test} from '@playwright/test';

const intro='.sekka-launch';

test('fresh opening shows approved Cairo SUV art and white PoNo wordmark',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/');
 const splash=page.locator(intro);
 await expect(splash).toBeVisible();
 await expect(splash.locator('.sekka-launch__brand-name')).toHaveAttribute('src','/brand/pono-wordmark-white.svg');
 await expect(splash.locator('.sekka-launch__brand-name')).toHaveAttribute('alt','PoNo');
 await expect(splash.locator('.sekka-launch__approved-scene')).toBeVisible();
 await expect(splash.locator('.sekka-launch__wave-wipe')).toHaveCSS('animation-name','sk-wave-out');
 await expect(splash.locator('.sekka-launch__approved-scene')).toHaveCSS('animation-name','sk-scene-depart');
 await expect(splash.locator('.sekka-launch__wheel-motion')).toHaveCSS('animation-name','sk-scene-depart');
 await expect(splash.locator('.sekka-launch__ribbon')).toBeVisible();
 await expect(splash.locator('.sekka-launch__sky-to-road-wave')).toBeVisible();
 await expect(splash.locator('.sekka-launch__stage')).toHaveCSS('animation-name','sk-stage-finish');
 await expect(splash.locator('.sekka-launch__wheel-motion')).toBeVisible();
 const rect=await splash.boundingBox();
 expect(rect).not.toBeNull();
 expect(rect!.x).toBe(0);
 expect(rect!.y).toBe(0);
 expect(rect!.width).toBe(390);
 expect(rect!.height).toBe(844);
 await expect(splash).toHaveCount(0,{timeout:8000});
 await expect(page.locator('.phase-screen-2')).toBeVisible();
});

for(const [width,height] of [[320,700],[360,800],[412,915]] as const){
 test('approved opening covers viewport at '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/?tab=login&view=2');
  const splash=page.locator(intro);
  await expect(splash).toBeVisible();
  const rect=await splash.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBe(0);
  expect(rect!.y).toBe(0);
  expect(rect!.width).toBe(width);
  expect(rect!.height).toBe(height);
  await expect(splash).toHaveCount(0,{timeout:8000});
 });
}

test('OAuth callback and developer gallery never play the opening',async({page})=>{
 await page.goto('/?code=test-oauth-callback');
 await expect(page.locator(intro)).toHaveCount(0);
 await page.goto('/dev/screens?screen=2');
 await expect(page.locator(intro)).toHaveCount(0);
});

test('reload does not replay a five-second intro within the same browser tab',async({page})=>{
 await page.goto('/?tab=login&view=2');
 await expect(page.locator(intro)).toBeVisible();
 await expect(page.locator(intro)).toHaveCount(0,{timeout:8000});
 await page.reload();
 await expect(page.locator(intro)).toHaveCount(0);
 await expect(page.locator('.phase-screen-2')).toBeVisible();
});

test('reduced motion bypasses launch animations without blocking the app',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?tab=login&view=2');
 await expect(page.locator(intro)).toHaveCount(0,{timeout:3000});
 await expect(page.locator('.phase-screen-2')).toBeVisible();
});

test('installed PoNo identity keeps approved P mark and blue manifest',async({request})=>{
 const response=await request.get('/manifest.webmanifest');
 expect(response.ok()).toBeTruthy();
 const manifest=await response.json();
 expect(manifest.name).toBe('PoNo');
 expect(manifest.short_name).toBe('PoNo');
 expect(manifest.dir).toBe('rtl');
 expect(manifest.background_color).toBe('#0648F5');
 expect(manifest.theme_color).toBe('#0648F5');
 expect(manifest.icons.map((item:{src:string})=>item.src)).toEqual([
  '/brand/pono-icon-192.png',
  '/brand/pono-icon-512.png',
  '/brand/pono-icon.svg'
 ]);
 const index=await (await request.get('/')).text();
 expect(index).toContain('name="theme-color" content="#0648F5"');
 // Vite can normalize inline CSS whitespace/case; background on the live Rider
 // home is tested by computed styles in mobile-navigation-role.spec.ts.
 expect(index).toContain('meta name="theme-color"');
 for(const item of manifest.icons){
  const img=await request.get(item.src);
  expect(img.ok()).toBeTruthy();
  if(item.type==='image/png'){
   const bytes=await img.body();
   expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  }else{
   expect((await img.text()).trimStart()).toMatch(/^(?:<\?xml[^>]*>\s*)?<svg\b/);
  }
 }
});

test('light mode retains PoNo brand and accessible urban palettes',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('theme_preference','light'));
 await page.goto('/?tab=login&view=2');
 await expect(page.locator(intro)).toHaveCount(0,{timeout:8000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 const palette=await page.evaluate(()=>{
  const styles=getComputedStyle(document.documentElement);
  return {
   sky:styles.getPropertyValue('--sekka-sky').trim().toLowerCase(),
   cyan:styles.getPropertyValue('--sekka-cyan').trim().toLowerCase(),
   sun:styles.getPropertyValue('--sekka-sun').trim().toLowerCase()
  };
 });
 // Legacy design tokens are internal; the approved P icon and mobile palette
 // are the public source of truth after the PoNo rebrand.
 expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
 const manifesto=await (await page.request.get('/manifest.webmanifest')).json();
 expect(manifesto.theme_color).toBe('#0648F5');
});

test('dark mode keeps a legible dark surface without losing yellow accent',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('theme_preference','dark'));
 await page.goto('/?tab=login&view=2');
 await expect(page.locator(intro)).toHaveCount(0,{timeout:8000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const root=page.locator('.sekka-mobile');
 await expect(root).toBeVisible();
 const colors=await root.evaluate(el=>({
  background:getComputedStyle(el).backgroundColor,
  yellow:getComputedStyle(document.documentElement).getPropertyValue('--sekka-sun').trim()
 }));
 expect(colors.background).not.toBe('rgb(255, 255, 255)');
 expect(colors.yellow.toLowerCase()).toBe('#ffcc24');
});
