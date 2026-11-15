import {test,expect} from '@playwright/test';

for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`approved route details empty state never uses mock inventory ${width} ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.addInitScript(({language,theme})=>{
      localStorage.setItem('language_preference',language);
      localStorage.setItem('theme_preference',theme);
    },{language,theme});
    await page.goto('/?tab=search&view=12');
    await expect(page.locator('.d-screen-12')).toBeVisible();
    await expect(page.locator('.d-detail-journey')).toHaveCount(0);
    await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
    await expect(page.locator('.d-result')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/v31-approved-details-empty-${width}-${language}-${theme}.png`,fullPage:true});
   });
  }
 }
}

test('booking deep-link without verified route cannot claim pending or confirmed booking',async({page})=>{
 await page.goto('/?tab=booking');
 await expect(page.locator('.b-screen-16')).toBeVisible();
 await expect(page.getByRole('button',{name:/Submit booking request|تأكيد طلب الحجز/})).toHaveCount(0);
 await expect(page.getByText(/Booking details|تفاصيل الحجز/)).toHaveCount(0);
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
});

test('approved search and details preserve history navigation',async({page})=>{
 await page.goto('/?tab=search&view=9');
 await expect(page.locator('.d-screen-9')).toBeVisible();
 await page.goto('/?tab=search&view=12');
 await expect(page.locator('.d-screen-12')).toBeVisible();
 await page.goBack();
 await expect(page.locator('.d-screen-9')).toBeVisible();
});
