import {test,expect} from '@playwright/test';
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  test(`public / is a mobile app, not gallery ${width}px ${language}`,async({page})=>{
   await page.setViewportSize({width,height:844});
   await page.addInitScript(l=>{localStorage.setItem('language_preference',l);localStorage.setItem('theme_preference','light');},language);
   await page.goto('/');
   await expect(page.locator('.sekka-mobile')).toBeVisible();
   await expect(page.locator('.sekka-bottom-nav')).toBeVisible();
   await expect(page.getByRole('heading',{name:language==='ar'?/مشوارك اليومي/:/Your daily commute/})).toBeVisible();
   await expect(page.getByRole('button',{name:language==='ar'?'التسجيل باستخدام جوجل':'Continue with Google'})).toBeVisible();
   await page.screenshot({path:`test-results/public-mobile-${width}-${language}-light.png`,fullPage:true});
   await page.getByRole('button',{name:language==='ar'?'تغيير المظهر':'Switch appearance'}).click();
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   await page.screenshot({path:`test-results/public-mobile-${width}-${language}-dark.png`,fullPage:true});
   await expect(page.locator('.phase-preview-note,.phase-navigation,.phase-screen-selector')).toHaveCount(0);
   await expect(page.getByText(/معاينة المرحلة الأولى|Stage one preview|7 screens/)).toHaveCount(0);
   await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const nav=page.locator('.sekka-bottom-nav button');
   await expect(nav).toHaveCount(5);
   await nav.nth(1).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'دور على خط':'Find a route'})).toBeVisible();
   await expect(page).toHaveURL(/tab=search/);
   await page.reload();
   await expect(page.getByRole('heading',{name:language==='ar'?'دور على خط':'Find a route'})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await nav.nth(2).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'حجوزاتي':'My bookings'})).toBeVisible();
   await nav.nth(4).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'سجّل دخولك لسِكّة':'Sign in to seKKa'})).toBeVisible();
   await expect(page.getByRole('button',{name:language==='ar'?'المتابعة باستخدام جوجل':'Continue with Google'})).toBeVisible();
   const primary=page.locator('.sekka-mobile-card .sekka-action');
   const p=await primary.boundingBox();
   expect(p?.x).toBeGreaterThanOrEqual(0);
   expect(p!.x+p!.width).toBeLessThanOrEqual(width+1);
  });
 }
}
test('approved 73 screen designs isolated under /dev/screens',async({page})=>{
 await page.goto('/dev/screens?screen=2');
 await expect(page.locator('.phase-preview-note')).toBeVisible();
 await expect(page.locator('.sekka-mobile')).toHaveCount(0);
});
