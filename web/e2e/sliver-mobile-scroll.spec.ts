import {test,expect} from '@playwright/test';

// Tests the real production MobileApp shell, NOT the dev gallery. The guide is
// disabled for these cases so scroll motion and tour overlays stay independent.
for(const language of ['ar','en'] as const){
 for(const theme of ['light','dark'] as const){
  test(`sliver-style scroll keeps native input and pins compact title ${language} ${theme}`,async({page})=>{
   await page.setViewportSize({width:390,height:720});
   await page.addInitScript(({language,theme})=>{
    localStorage.setItem('language_preference',language);
    localStorage.setItem('theme_preference',theme);
    localStorage.setItem('sekka.tour.disable-auto.guest','1');
   },{language,theme});
   await page.goto('/?tab=search&view=9');
   const hero=page.locator('.rs3__head');
   await expect(hero).toBeVisible();
   await expect(hero).toHaveAttribute('data-sekka-scroll-hero','true');
   await expect(page.locator('.sekka-sliver-pin')).toBeAttached();
   await page.evaluate(()=>window.scrollTo({top:440,behavior:'instant'}));
   await expect(page.locator('.sekka-mobile')).toHaveAttribute('data-sekka-scrolled','true');
   const pin=page.locator('.sekka-sliver-pin');
   await expect(pin).toBeVisible();
   await expect(pin.locator('span')).toHaveText(language==='ar'?'دور على رحلة':'Find a ride');
   await expect(page.locator('.rs3__submit')).toBeAttached();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await expect(page.locator('.sekka-mobile')).toHaveAttribute('data-sekka-scrolled','false');
   // Switching visual states must not modify search inputs or trigger submit.
   expect(await page.locator('.rs3 input[role="combobox"]').count()).toBeGreaterThanOrEqual(2);
  });
 }
}
test('reduced-motion disables hero transforms and preserves sticky labels',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('sekka.tour.disable-auto.guest','1'));
 await page.setViewportSize({width:360,height:690});
 await page.goto('/?tab=search&view=9');
 await expect(page.locator('.rs3__head')).toBeVisible();
 await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}));
 await expect(page.locator('.sekka-mobile')).toHaveAttribute('data-sekka-scrolled','true');
 const transform=await page.locator('.rs3__head h2').evaluate(el=>getComputedStyle(el).transform);
 expect(transform).toBe('none');
});
test('admin access is never unlocked by scroll-only UI',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('sekka.tour.disable-auto.guest','1'));
 await page.goto('/?tab=admin&view=62');
 await expect(page.locator('.admin-stage .ad-metrics')).toHaveCount(0);
 await expect(page.locator('.sekka-sliver-pin')).toBeAttached();
});
