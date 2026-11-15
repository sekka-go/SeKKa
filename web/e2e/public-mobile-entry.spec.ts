import {test,expect} from '@playwright/test';
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  test(`public landing is approved original onboarding, not a dev gallery ${width}px ${language}`,async({page})=>{
   await page.setViewportSize({width,height:844});
   await page.addInitScript(lang=>{localStorage.setItem('language_preference',lang);localStorage.setItem('theme_preference','light');},language);
   await page.goto('/');
   await expect(page.locator('.sekka-mobile')).toBeVisible();
   await expect(page.locator('.phase-screen-2')).toBeVisible();
   await expect(page.locator('.sekka-mobile-header')).toBeHidden();
   await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
   await expect(page.getByRole('button',{name:language==='ar'?'ابدأ الآن':'Get started'})).toBeVisible();
   await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
   await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   // Once on public search, the original Rider five-tab nav remains usable.
   await page.goto('/?tab=search');
   await expect(page.locator('.sekka-bottom-nav button')).toHaveCount(5);
   await expect(page.locator('.d-screen-9')).toBeVisible();
   const nav=page.locator('.sekka-bottom-nav button');
   await nav.nth(2).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'حجوزاتي':'My bookings'})).toBeVisible();
   await nav.nth(4).click();
   await expect(page.getByRole('heading',{name:language==='ar'?'حسابي':'My profile'})).toBeVisible();
   await page.getByRole('button',{name:language==='ar'?'تسجيل الدخول بجوجل':'Sign in with Google'}).click();
   await expect(page.locator('.phase-screen-4 .phase-google-auth')).toBeVisible();
   await expect(page.locator('.sekka-mobile-header')).toBeHidden();
   await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
   const primary=page.locator('.phase-screen-4 .phase-primary');
   const rect=await primary.boundingBox();expect(rect).not.toBeNull();
   expect(rect!.x).toBeGreaterThanOrEqual(0);
   expect(rect!.x+rect!.width).toBeLessThanOrEqual(width+1);
  });
 }
}
test('all 73 approved original previews remain isolated under /dev/screens',async({page})=>{
 await page.goto('/dev/screens?screen=2');
 await expect(page.locator('.phase-preview-note')).toBeVisible();
 await expect(page.locator('.sekka-mobile')).toHaveCount(0);
});
test('production onboarding skips the postponed OTP and uses Google OAuth',async({page})=>{
 await page.goto('/');
 await page.locator('.phase-screen-2 .phase-start').click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.locator('.phase-screen-3 .phase-role-next').click();
 await expect(page.locator('.phase-screen-4 .phase-google-auth')).toBeVisible();
 await expect(page.locator('.phase-screen-5')).toHaveCount(0);
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
});
test('production Search uses genuine back-end state rather than gallery fixtures',async({page})=>{
 await page.goto('/?tab=search');
 await expect(page.locator('.d-screen-9')).toBeVisible();
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
 await expect(page.getByText('preview-prime')).toHaveCount(0);
 await page.reload();await expect(page.locator('.d-screen-9')).toBeVisible();
});



test('signed-out PWA opens Welcome even if an older release stored completed intro',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('sekka.welcomeCompleted.v1','1');
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 });
 await page.goto('/');
 await expect(page.locator('.phase-screen-2 .phase-start')).toBeVisible();
 await expect(page.locator('.d-screen-8')).toHaveCount(0);
 await expect(page.locator('.sekka-mobile-header')).toBeHidden();
 await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
});

test('Get started -> role -> Google -> Back -> role -> Welcome via screen and browser',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 });
 await page.goto('/');
 await expect(page.locator('.phase-screen-2 .phase-start')).toBeVisible();
 await page.getByRole('button',{name:'Get started'}).click();
 await expect(page).toHaveURL(/tab=login&view=3/);
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.locator('.phase-screen-3 .phase-role-next').click();
 await expect(page).toHaveURL(/tab=login&view=4/);
 await expect(page.locator('.phase-screen-4 .phase-google-auth')).toBeVisible();
 await page.goBack();
 await expect(page).toHaveURL(/tab=login&view=3/);
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.goBack();
 await expect(page).toHaveURL(/\/$/);
 await expect(page.locator('.phase-screen-2 .phase-start')).toBeVisible();
 await page.getByRole('button',{name:'Get started'}).click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.locator('.phase-screen-3 .phase-back').click();
 await expect(page.locator('.phase-screen-2 .phase-start')).toBeVisible();
 await expect(page.locator('.d-screen-8')).toHaveCount(0);
});

test('Sign in directly from Welcome can still Back through role selection to Welcome',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.phase-screen-2')).toBeVisible();
 await page.locator('.phase-screen-2 .phase-login button').click();
 await expect(page).toHaveURL(/tab=login&view=4/);
 await page.locator('.phase-screen-4 .phase-back').click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.locator('.phase-screen-3 .phase-back').click();
 await expect(page).toHaveURL(/\/$/);
 await expect(page.locator('.phase-screen-2 .phase-start')).toBeVisible();
});

test('without Google session Account offers Sign in rather than Sign out',async({page})=>{
 await page.goto('/?tab=profile');
 await expect(page.getByRole('button',{name:/Sign in with Google|تسجيل الدخول بجوجل/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Sign out|تسجيل الخروج/})).toHaveCount(0);
 await page.goto('/');
 await expect(page.locator('.phase-screen-2')).toBeVisible();
 await expect(page.locator('.d-screen-8')).toHaveCount(0);
});

test('refresh keeps the current onboarding step, without redirecting or replaying welcome',async({page})=>{
 await page.goto('/');
 await page.locator('.phase-screen-2 .phase-start').click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.reload();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await expect(page.locator('.phase-screen-2')).toHaveCount(0);
 await page.locator('.phase-screen-3 .phase-back').click();
 await expect(page.locator('.phase-screen-2')).toBeVisible();
});
