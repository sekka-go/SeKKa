import {test,expect} from '@playwright/test';
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  test(`public / is a mobile app, not gallery ${width}px ${language}`,async({page})=>{
   await page.setViewportSize({width,height:844});
   await page.addInitScript(l=>{localStorage.setItem('language_preference',l);localStorage.setItem('theme_preference','light');},language);
   await page.goto('/');
   await expect(page.locator('.sekka-mobile')).toBeVisible();
   await expect(page.locator('.sekka-bottom-nav')).toBeVisible();
   await expect(page.locator('.phase-screen-2')).toBeVisible();
   await expect(page.getByRole('button',{name:language==='ar'?'ابدأ الآن':'Get started'})).toBeVisible();
   await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
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
   await expect(page.locator('.d-screen-9')).toBeVisible();
   await expect(page).toHaveURL(/tab=search/);
   await page.reload();
   await expect(page.locator('.d-screen-9')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await nav.nth(2).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'حجوزاتي':'My bookings'})).toBeVisible();
   await nav.nth(4).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'حسابي':'My profile'})).toBeVisible();
   await expect(page).toHaveURL(/tab=profile/);
   await page.getByRole('button',{name:language==='ar'?'تسجيل الدخول بجوجل':'Sign in with Google'}).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'سجّل دخولك لسِكّة':'Sign in to seKKa'})).toBeVisible();
   await expect(page.getByRole('button',{name:language==='ar'?'المتابعة باستخدام جوجل':'Continue with Google'})).toBeVisible();
   const primary=page.locator('.phase-screen-4 .phase-primary');
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

test('approved original onboarding transitions to Google OAuth without OTP',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.phase-screen-2')).toBeVisible();
 await page.locator('.phase-screen-2 .phase-start').click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await expect(page.locator('.phase-role-card')).toHaveCount(2);
 await page.locator('.phase-screen-3 .phase-role-next').click();
 await expect(page.locator('.phase-screen-4')).toBeVisible();
 await expect(page.locator('.phase-screen-5')).toHaveCount(0);
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
});

test('approved production Discovery renders real-data results without gallery fixtures',async({page})=>{
 await page.goto('/?tab=search');
 await expect(page.locator('.d-screen-9')).toBeVisible();
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
 await expect(page.getByText('preview-prime')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.d-screen-9')).toBeVisible();
});
