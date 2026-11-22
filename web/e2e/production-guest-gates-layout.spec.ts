import {test,expect} from '@playwright/test';
// Actual unauthenticated production entry points. No fake Admin/Captain sessions.
for(const width of [360,390])for(const language of ['ar','en'] as const)for(const theme of ['light','dark'] as const){
 test(`guest-only layout and access gates ${width}px ${language} ${theme}`,async({page})=>{
  const h=width===360?800:844;
  await page.setViewportSize({width,height:h});
  await page.addInitScript(({language,theme})=>{
   localStorage.setItem('language_preference',language);
   localStorage.setItem('theme_preference',theme);
      // These tests audit destination layout, not the 5-second launch animation.
      sessionStorage.setItem('sekka.launch.seen.v1','1');
  },{language,theme});
  const routes=[
   {tab:'search',view:12,expected:'.d-screen-12',label:'route-details-empty'},
   {tab:'booking',view:16,expected:'.booking-stage',label:'booking-guest'},
   {tab:'captain-onboarding',view:35,expected:'.phase-screen-4',label:'captain-login-gate'},
   {tab:'admin',view:64,expected:'.sekka-mobile-card',label:'admin-access-gate'}
  ] as const;
  for(const scene of routes){
   await page.goto(`/?tab=${scene.tab}&view=${scene.view}`);
   await expect(page.locator(scene.expected).first()).toBeVisible();
   await expect(page.locator('.sekka-launch')).toBeHidden();
   if(scene.tab==='captain-onboarding')
    await expect(page.locator('.sekka-mobile-header')).toBeHidden();
   else if(scene.tab==='search'||scene.tab==='booking'){
    // The shell's nav is a zero-height placement layer; visible, focusable
    // menu buttons are the actual interaction targets.
    await expect(page.locator('.sekka-floating-actions')).toHaveCount(1);
    await expect(page.locator('.sekka-mobile-header')).toHaveCount(0);
    const menu=page.getByRole('button',{name:language==='ar'?'فتح القائمة':'Open menu'});
    await expect(menu).toBeVisible();
    const bounds=await menu.boundingBox();
    expect(bounds).not.toBeNull();
    if(language==='ar')expect(bounds!.x+bounds!.width/2,'RTL menu should be on the physical right').toBeGreaterThan(width/2);
    else expect(bounds!.x+bounds!.width/2,'LTR menu should be on the physical left').toBeLessThan(width/2);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
   }
   await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
   if(scene.tab==='admin'){
    await expect(page.locator('.admin-stage')).toHaveCount(0);
    await expect(page.getByRole('button',{name:/Approve captain|اعتماد الكابتن/})).toHaveCount(0);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
     `Horizontal overflow at ${scene.label}`).toBe(true);
   await page.screenshot({
    path:`../docs/audit/layout-gated-${scene.label}-${width}-${language}-${theme}.png`,
    fullPage:true,animations:'disabled'
   });
  }
 });
}
