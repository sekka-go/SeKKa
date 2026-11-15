import {test,expect} from '@playwright/test';

for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`captain approval routes require Google session ${width} ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.addInitScript(({language,theme})=>{
      localStorage.setItem('language_preference',language);
      localStorage.setItem('theme_preference',theme);
    },{language,theme});
    await page.goto('/?tab=captain-onboarding&view=38');
    await expect(page.locator('.c-approval-live')).toHaveCount(0);
    await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
    await page.screenshot({path:`test-results/approval-guest-${width}-${language}-${theme}.png`,fullPage:true});
    await page.goto('/?tab=admin&view=65');
    await expect(page.locator('.ad-content,.ad-layout')).toHaveCount(0);
    await expect(page.getByRole('button',{name:/Approve captain|اعتماد الكابتن/})).toHaveCount(0);
    await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   });
  }
 }
}
