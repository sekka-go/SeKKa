import {test,expect,type Page} from '@playwright/test';

// Video-inspired public entry; no synthetic Supabase session.
async function noOverflow(page:Page,width:number){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
}
for(const width of [320,360,390,412]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test('intro, role and Google handoff '+width+' '+language+' '+theme,async({page})=>{
    await page.setViewportSize({width,height:width===320?700:844});
    await page.addInitScript(({language,theme})=>{
     localStorage.setItem('language_preference',language);
     localStorage.setItem('theme_preference',theme);
    },{language,theme});
    await page.goto('/');
    await expect(page.locator('.sekka-launch')).toBeHidden();
    const intro=page.locator('.phase-screen-2.sekka-entry');
    await expect(intro.locator('.sekka-entry__title')).toBeVisible();
    await expect(page.locator('.sekka-mobile-header')).toBeHidden();
    await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
    for(let i=0;i<3;i++){
     const next=intro.locator('.phase-start');
     await expect(next).toBeVisible();
     const box=await next.boundingBox();
     expect(box).not.toBeNull();
     expect(box!.height).toBeGreaterThanOrEqual(44);
     await noOverflow(page,width);
     await next.click();
    }
    await expect(page).toHaveURL(/tab=login&view=3/);
    const role=page.locator('.phase-screen-3.sekka-entry');
    await expect(role.locator('.sekka-entry__title')).toBeVisible();
    const captain=page.getByRole('radio',{name:language==='ar'?'كابتن':'Captain'});
    await captain.click();
    await expect(captain).toHaveAttribute('aria-checked','true');
    await noOverflow(page,width);
    await role.locator('.phase-role-next').click();
    await expect(page).toHaveURL(/tab=login&view=4/);
    await expect(page.locator('.phase-screen-4 .phase-google-auth .phase-primary')).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('sekka.pendingRole'))).toBe('captain');
    expect(await page.evaluate(()=>sessionStorage.getItem('sekka.postAuthPath')))
     .toBe('/?tab=captain-onboarding&view=35');
    await noOverflow(page,width);
    await page.screenshot({path:'test-results/vnext-entry-'+width+'-'+language+'-'+theme+'.png',
      animations:'disabled',fullPage:true});
    await page.goBack();
    await expect(page.getByRole('radio',{name:language==='ar'?'كابتن':'Captain'}))
     .toHaveAttribute('aria-checked','true');
   });
  }
 }
}
test('skip stays optional, Google login does not forge signed-in identity',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem('language_preference','ar'));
 await page.goto('/');
 await page.locator('.sekka-entry__skip').click();
 await expect(page).toHaveURL(/tab=login&view=3/);
 await page.getByRole('radio',{name:'راكب'}).click();
 await page.locator('.phase-role-next').click();
 await expect(page).toHaveURL(/tab=login&view=4/);
 await expect(page.locator('.phase-google-auth .phase-primary')).toBeVisible();
 await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
 await expect(page.getByRole('button',{name:/انضم للرحلة|Join ride/})).toHaveCount(0);
});
