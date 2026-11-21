import {test,expect} from '@playwright/test';
// Owner deliberately replaced production S009 and S010. Do NOT compare against
// the old gallery's exact geometry. Check real RTL/LTR layout and preserve
// the developer gallery as a separate isolated reference.
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test('redesigned production search + filters '+width+' '+language+' '+theme,async({page})=>{
    await page.setViewportSize({width,height:width===360?800:844});
    await page.addInitScript(({language,theme})=>{
     localStorage.setItem('language_preference',language);
     localStorage.setItem('theme_preference',theme);
    },{language,theme});
    for(const view of [9,10] as const){
     await page.goto('/?tab=search&view='+view);
     const container=page.locator('.d-screen-'+view);
     await expect(container).toBeVisible();
     await expect(container.locator(view===9?'.rs3':'.rf3')).toBeVisible();
     await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
     const cta=container.locator(view===9?'.rs3__submit':'.rf3__apply');
     await expect(cta).toBeVisible();
     const rect=await cta.boundingBox();
     expect(rect).not.toBeNull();
     expect(rect!.height).toBeGreaterThanOrEqual(44);
     expect(await page.evaluate(()=>document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width+1);
     await page.screenshot({path:'../docs/audit/redesign-S'+String(view).padStart(3,'0')+
      '-'+width+'-'+language+'-'+theme+'.png',fullPage:true,animations:'disabled'});
    }
   });
  }
 }
}
test('separate developer gallery retains its original screen 9 and 10',async({page})=>{
 await page.goto('/dev/screens?screen=9&preview=phase2');
 await expect(page.locator('.d-screen-9 .d-planner')).toBeVisible();
 await page.goto('/dev/screens?screen=10&preview=phase2');
 await expect(page.locator('.d-screen-10 .d-filter-section')).toBeVisible();
 await expect(page.locator('.rs3,.rf3')).toHaveCount(0);
});
