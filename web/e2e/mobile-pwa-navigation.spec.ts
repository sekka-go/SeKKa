import {test,expect} from '@playwright/test';
test('PWA manifest installs at mobile root and worker never caches user data',async({page,request})=>{
 const response=await request.get('/manifest.webmanifest');
 expect(response.ok()).toBe(true);
 const manifest=await response.json();
 expect(manifest.start_url).toBe('/');
 expect(manifest.scope).toBe('/');
 expect(manifest.display).toBe('standalone');
 expect(manifest.icons?.length).toBeGreaterThan(0);
 for(const icon of manifest.icons){
  const image=await request.get(icon.src);
  expect(image.ok(),`Missing PWA icon ${icon.src}`).toBe(true);
  expect(image.headers()['content-type']).toContain('image/');
 }
 const worker=await request.get('/sw.js');
 expect(worker.ok()).toBe(true);
 const code=await worker.text();
 expect(code).toContain("req.mode==='navigate'");
 expect(code).toContain("url.pathname.startsWith('/assets/')");
 await page.goto('/');
 await expect(page.locator('.sekka-mobile')).toBeVisible();
 await expect(page.locator('.phase-preview-note')).toHaveCount(0);
});
test('guest app supports browser Back/Forward between real tabs',async({page})=>{
 // The approved guest welcome is a standalone screen and has no tabs.
 // Start in the real tabbed Search experience before exercising history.
 await page.goto('/?tab=search');
 await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
 await page.getByRole('button',{name:/Open menu|فتح القائمة/}).click();
 await page.getByRole('dialog',{name:/Main menu|القائمة الرئيسية/}).getByRole('button',{name:/My bookings|حجوزاتي/}).click();
 await expect(page).toHaveURL(/tab=bookings/);
 await page.goBack();
 await expect(page).toHaveURL(/tab=search/);
 await expect(page.locator('.sekka-discovery-logo-en')).toHaveCount(0);
 await expect(page.locator('.d-title')).toHaveCount(0);
 await page.goForward();
 await expect(page).toHaveURL(/tab=bookings/);
});

// Only the exact developer gallery path may enter preview mode.
test('gallery path does not capture similarly named public application paths',async({page})=>{
 await page.goto('/dev/screens-copy');
 await expect(page.locator('.sekka-mobile')).toBeVisible();
 await expect(page.locator('.phase-review-bar')).toHaveCount(0);
 await page.goto('/dev/screens');
 await expect(page.locator('.phase-review-bar')).toBeVisible();
 await expect(page.locator('.sekka-mobile')).toHaveCount(0);
});

for(const language of ['ar','en'] as const){
 test(`physical-left menu consolidates key navigation in ${language} (guest)`,async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(lang=>localStorage.setItem('language_preference',lang),language);
  await page.goto('/?tab=search');
  const trigger=page.getByRole('button',{name:language==='ar'?'فتح القائمة':'Open menu'});
  await expect(trigger).toBeVisible();
  const position=await trigger.boundingBox();
  expect(position).not.toBeNull();
  expect(position!.x+position!.width/2).toBeLessThan(180);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  const drawer=page.getByRole('dialog',{name:language==='ar'?'القائمة الرئيسية':'Main menu'});
  await expect(drawer).toBeVisible();
  const bounds=await drawer.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeLessThanOrEqual(1);
  // Captain onboarding only starts at signed-out account-type selection, not from the guest drawer.
   await expect(drawer.getByRole('button',{name:language==='ar'?'تسجيل / متابعة طلب الكابتن':'Captain registration / application'})).toHaveCount(0);
  await drawer.getByRole('button',{name:language==='ar'?'حسابي':'My profile'}).click();
  await expect(page).toHaveURL(/tab=profile/);
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
 });
}

test('production light mode uses the approved search marker and brand palette',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','light');
 });
 await page.goto('/?tab=search&view=9');
 const stage=page.locator('.sekka-mobile .discovery-stage.light');
 await expect(stage).toBeVisible();
 await expect(stage.locator('.rs3__marker--start')).toHaveCSS('background-color','rgb(255, 117, 78)');
 await expect(stage.locator('.rs3__marker--end')).toHaveCSS('background-color','rgb(100, 20, 174)');
 const brand=await page.locator('.sekka-mobile').evaluate(node=>getComputedStyle(node).getPropertyValue('--sekka-brand').trim());
 expect(brand.toUpperCase()).toBe('#FF663D');
 await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
 await expect(page.locator('.sekka-mobile-header .sekka-approved-logo')).toHaveCount(0);
});

test('explicit Rider selection clears stale Captain intent before Google sign-in',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  sessionStorage.setItem('sekka.pendingRole','captain');
  sessionStorage.setItem('sekka.postAuthPath','/?tab=captain-onboarding&view=35');
 });
 await page.goto('/?tab=login&view=3');
 await page.getByRole('radio',{name:/Passenger/}).click();
 await expect(page.getByRole('radio',{name:/Passenger/})).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:/Continue/}).click();
 await expect(page).toHaveURL(/tab=login&view=4/);
 const selection=await page.evaluate(()=>({
  role:sessionStorage.getItem('sekka.pendingRole'),
  returnPath:sessionStorage.getItem('sekka.postAuthPath')
 }));
 expect(selection).toEqual({role:'rider',returnPath:'/?tab=login&view=6'});
});

test('real application shows no internal logos and no page titles',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.goto('/?tab=bookings');
 await expect(page.locator('.sekka-current-section')).toHaveCount(0);
 await expect(page.locator('.sekka-mobile-header .sekka-brand-button')).toHaveCount(0);
 await expect(page.locator('.sekka-mobile img[src*="sekka-wordmark"]')).toHaveCount(0);
 await page.getByRole('button',{name:/Open menu|فتح القائمة/}).click();
 await expect(page.getByRole('dialog',{name:/Main menu|القائمة الرئيسية/})).toBeVisible();
});
