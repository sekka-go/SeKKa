import {test,expect} from '@playwright/test';

// Production-facing guest login only. No mock auth and no Google button click.
// The old phone preview is NOT the same functional screen as Google sign-in.
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`Google login controls do not overlap ${width}px ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:width===360?800:844});
    await page.addInitScript(({language,theme})=>{
      localStorage.setItem('language_preference',language);
      localStorage.setItem('theme_preference',theme);
      // These tests audit destination layout, not the 5-second launch animation.
      sessionStorage.setItem('sekka.launch.seen.v1','1');
    },{language,theme});
    await page.goto('/?tab=profile');
    await page.getByRole('button',{name:language==='ar'?'تسجيل الدخول بجوجل':'Sign in with Google'}).click();
    const root=page.locator('.phase-screen-4');
    const primary=root.locator('.phase-google-auth .phase-primary');
    const back=root.locator('.phase-back');
    // By owner decision the logo appears only on the animated launch splash.
    await expect(root.locator('.phase-logo')).toHaveCount(0);
    await expect(primary).toBeVisible();
    await expect(root.locator('.phase-google-auth .phase-title')).toBeVisible();
    // Dark mode used to render white text on a white notice and white text
    // on a bright yellow Google CTA. Assert both foreground/background pairs.
    const notice=root.locator('.sekka-entry-login__secure');
    await expect(notice).toHaveCSS('background-color',
      theme==='dark'?'rgb(32, 70, 92)':'rgb(234, 249, 252)');
    await expect(notice).toHaveCSS('color',
      theme==='dark'?'rgb(244, 251, 255)':'rgb(16, 42, 67)');
    await expect(primary).toHaveCSS('color',
      theme==='dark'?'rgb(17, 17, 17)':'rgb(8, 40, 58)');

    // Approved onboarding is a standalone canvas, not a screen inside the
    // five-tab shell. The old test incorrectly required the nav to be visible.
    await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
    await expect(page.locator('.sekka-mobile-header')).toBeHidden();
    const boxes=await Promise.all([primary,back].map(el=>el.boundingBox()));
    for(const box of boxes)expect(box).not.toBeNull();
    const [action,previous]=boxes as NonNullable<(typeof boxes)[number]>[];
    const overlaps=(a:typeof action,b:typeof action)=>
      Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
    expect(overlaps(action,previous),'Google CTA must not cover the Back button').toBe(0);
    expect(action.x).toBeGreaterThanOrEqual(0);
    expect(action.x+action.width).toBeLessThanOrEqual(width+1);
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({
      path:`../docs/audit/layout-after-google-login-${width}-${language}-${theme}.png`,
      animations:'disabled',fullPage:true
    });
   });
  }
 }
}

// An initial deep-link to profile must never display an unsolicited tour over login.
test('guest profile sign-in is not blocked by automatic guidance',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','light');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=profile');
 const google=page.getByRole('button',{name:'تسجيل الدخول بجوجل'});
 await expect(google).toBeVisible();
 await page.waitForTimeout(850);
 await expect(page.locator('.sekka-app-tour')).toHaveCount(0);
 await google.click();
 await expect(page.locator('.phase-screen-4')).toBeVisible();
});
