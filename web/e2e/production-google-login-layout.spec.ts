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
    },{language,theme});
    await page.goto('/?tab=profile');
    await page.getByRole('button',{name:language==='ar'?'تسجيل الدخول بجوجل':'Sign in with Google'}).click();
    const root=page.locator('.phase-screen-4');
    const primary=root.locator('.phase-google-auth .phase-primary');
    const back=root.locator('.phase-back'),logo=root.locator('.phase-logo');
    await expect(primary).toBeVisible();
    await expect(root.locator('.phase-google-auth .phase-title')).toBeVisible();
    const boxes=await Promise.all([primary,back,logo,page.locator('.sekka-bottom-nav')].map(el=>el.boundingBox()));
    for(const box of boxes)expect(box).not.toBeNull();
    const [action,previous,brand,nav]=boxes as NonNullable<(typeof boxes)[number]>[];
    const overlaps=(a:typeof action,b:typeof action)=>
      Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
    expect(overlaps(action,previous),'Google CTA must not cover the Back button').toBe(0);
    expect(overlaps(action,brand),'Google CTA must not cover the logo').toBe(0);
    expect(overlaps(action,nav),'Google CTA must not be obscured by fixed navigation').toBe(0);
    expect(action.x).toBeGreaterThanOrEqual(0);
    expect(action.x+action.width).toBeLessThanOrEqual(width+1);
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({
      path:`test-results/google-login-layout-${width}-${language}-${theme}.png`,
      animations:'disabled',fullPage:true
    });
   });
  }
 }
}
