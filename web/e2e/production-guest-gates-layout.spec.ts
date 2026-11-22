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
   if(scene.tab==='search'||scene.tab==='booking'){
    // Guest header should share the approved Rider chrome, not the old pill.
    const shell=page.locator('.sekka-floating-actions');
    await expect(shell).toHaveCSS('background-color',theme==='dark'?'rgb(25, 52, 73)':'rgb(255, 255, 255)');
    const title=page.locator('.sekka-sliver-pin');
    await expect(title).toBeVisible();
    await expect(title).toContainText(scene.tab==='booking'?(language==='ar'?'إكمال الحجز':'Booking'):(language==='ar'?'تفاصيل الرحلة':'Trip details'));
   }
   if(scene.tab==='booking'){
    // The booking review must not paint a second decorative brand over
    // the central app title or stack its Back control on the menu.
    await expect(page.locator('.sekka-rider-booking-v3 .d-header .sekka-live-wordmark')).toHaveCount(0);
    const back=page.locator('.sekka-rider-booking-v3 .d-header .phase-back');
    await expect(back).toBeVisible();
    const header=await page.locator('.sekka-floating-actions').boundingBox();
    const button=await back.boundingBox();
    expect(header).not.toBeNull();
    expect(button).not.toBeNull();
    expect(button!.y).toBeGreaterThanOrEqual(header!.y+header!.height-2);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    // No-offer state must never paint white lettering over bright yellow.
    const returnSearch=page.locator('.b-unavailable .b-primary');
    await expect(returnSearch).toBeVisible();
    await expect(returnSearch).toHaveCSS('background-color','rgb(255, 204, 36)');
    await expect(returnSearch).toHaveCSS('color','rgb(16, 42, 60)');
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
