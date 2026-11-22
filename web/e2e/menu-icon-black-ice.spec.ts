import {expect,test} from '@playwright/test';

// The reference is a settings/menu video, not a new authentication flow.
// Check the actual public shell with its existing language/theme controls.
for(const width of [320,390]){
 test('video-style icon tiles and truly black menu in Arabic '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.addInitScript(()=>{
   localStorage.setItem('language_preference','ar');
   localStorage.setItem('theme_preference','dark');
   sessionStorage.setItem('sekka.launch.seen.v1','1');
  });
  await page.goto('/?tab=profile');
  await expect(page.locator('.sekka-mobile')).toHaveCSS('background-color','rgb(5, 7, 11)');
  await expect(page.locator('.sekka-mobile-content')).toHaveCSS('background-color','rgb(5, 7, 11)');
  await page.getByRole('button',{name:'فتح القائمة'}).click();
  const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('.sekka-side-drawer__wordmark')).toHaveText('سِكَّة');
  const rows=drawer.locator('button.sekka-menu-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(5);
  await expect(rows.first().locator('.sekka-menu-row__icon svg')).toBeVisible();
  for(const label of ['الرئيسية','حسابي','الإشعارات']){
   await expect(drawer.getByRole('button',{name:label,exact:true}).locator('.sekka-menu-row__icon svg')).toBeVisible();
  }
  const active=drawer.getByRole('button',{name:'حسابي'});
  await expect(active).toHaveAttribute('aria-current','page');
  await expect(active.locator('.sekka-menu-row__icon')).toHaveCSS('border-top-color','rgb(146, 227, 250)');
  await expect(active.locator('.sekka-menu-row__label')).toHaveCSS('color','rgb(247, 252, 255)');
  await expect(drawer.locator('.sekka-side-drawer__close')).toHaveCSS('background-color','rgb(23, 31, 43)');
  await page.screenshot({path:'../docs/audit/menu-black-ice-'+width+'.png',fullPage:true,animations:'disabled'});
  await expect(drawer.locator('.sekka-preference-row')).toHaveCount(1);
  await expect(drawer.locator('#sekka-appearance-pref')).toHaveCount(0);
  await expect(drawer.locator('.sekka-preference-row__details select')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 });
}

test('dark black theme can be changed to light without losing language or navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','dark');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=profile');
 await page.getByRole('button',{name:'فتح القائمة'}).click();
 const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
 await expect(drawer.locator('#sekka-appearance-pref')).toHaveCount(0);
 const toggle=drawer.getByRole('switch',{name:'تشغيل أو إيقاف الوضع الليلي'});
 await expect(toggle).toHaveAttribute('aria-checked','true');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-checked','false');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.sekka-mobile')).toHaveCSS('background-color','rgb(5, 7, 11)');
 await expect(drawer.getByRole('button',{name:'حسابي'}).locator('.sekka-menu-row__label')).toHaveCSS('color','rgb(247, 252, 255)');
 await toggle.click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('.sekka-mobile')).not.toHaveCSS('background-color','rgb(5, 7, 11)');
 await drawer.locator('#sekka-language-pref').selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 // Changing language renames the dialog's accessible label from Arabic to
 // English; query the re-localized dialog rather than the stale Arabic locator.
 const englishDrawer=page.getByRole('dialog',{name:'Main menu'});
 await expect(englishDrawer).toBeVisible();
 await expect(englishDrawer.getByRole('button',{name:'My profile'})).toBeVisible();
 await expect(page.locator('.sekka-mobile .sekka-side-drawer .sekka-menu-row__icon').first()).toBeVisible();
});

test('dark search has a black canvas with an icy-blue hero',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','dark');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=search&view=9');
 const search=page.locator('.rs3');
 await expect(search).toBeVisible();
 await expect(search).toHaveCSS('background-color','rgb(5, 7, 11)');
 const hero=await search.locator('.rs3__head').evaluate(element=>getComputedStyle(element).backgroundImage);
 expect(hero).toContain('linear-gradient');
 expect(hero).toContain('rgb(8, 11, 18)');
 await expect(page.locator('.sekka-mobile')).toHaveCSS('background-color','rgb(5, 7, 11)');
});

test('light drawer fades from white to ice blue with icon-free secondary controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','light');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=profile');
 await page.getByRole('button',{name:'فتح القائمة'}).click();
 const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
 await expect(drawer).toBeVisible();
 await page.screenshot({path:'../docs/audit/menu-white-ice-390.png',fullPage:true,animations:'disabled'});
 const background=await drawer.evaluate(element=>getComputedStyle(element).backgroundImage);
 expect(background).toContain('linear-gradient');
 expect(background).toContain('rgb(255, 255, 255) 0%');
 expect(background).toContain('rgb(234, 243, 255) 100%');
 await expect(drawer.locator('.sekka-preference-row--appearance')).toHaveCount(0);
 await expect(drawer.locator('#sekka-appearance-pref')).toHaveCount(0);
 await expect(drawer.getByText('مظهر التطبيق')).toHaveCount(0);
 await expect(drawer.locator('.sekka-preference-row')).toHaveCount(1);
 const guide=drawer.getByRole('button',{name:'اشرحلي الشاشة دي'});
 await expect(guide.locator('.sekka-menu-row__icon')).toHaveCount(0);
 await expect(guide).toBeEnabled();
 // The separate quick dark-mode switch keeps its useful moon symbol.
 await expect(drawer.locator('.sekka-theme-quick-row .sekka-menu-row__icon')).toBeVisible();
 await guide.click();
 await expect(drawer).toHaveCount(0);
});

test('authenticated dark home waves fade from icy-blue to near-black with no hard seam',async({page})=>{
 const endpoint='https://sekka-auth-e2e.supabase.co';
 const user={
  id:'00000000-0000-4000-8000-0000000000b1',aud:'authenticated',role:'authenticated',
  email:'dark-wave@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',
  app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Wave Fixture'}
 };
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({endpoint,user})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'local-fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','dark');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 },{endpoint,user});
 await page.route(endpoint+'/**',async request=>{
  const path=new URL(request.request().url()).pathname;
  const data=path==='/auth/v1/user'?user:path==='/rest/v1/rpc/v31_is_admin'?false:[];
  await request.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');
 await expect(page.locator('.sekka-rider-home')).toBeVisible();
 await expect(page.locator('.rh-home')).toHaveCSS('background-color','rgb(5, 7, 11)');
 const hero=await page.locator('.rh-showcase-hero').evaluate(el=>getComputedStyle(el).backgroundImage);
 expect(hero).toContain('rgb(55, 122, 154)');
 expect(hero).toContain('rgb(5, 7, 11) 100%');
 const paths=page.locator('.rh-showcase-hero__bottom-wave > path');
 await expect(paths).toHaveCount(3);
 for(const [index,id] of ['sekka-dark-wave-upper','sekka-dark-wave-middle','sekka-dark-wave-base'].entries()){
  const fill=await paths.nth(index).evaluate(el=>getComputedStyle(el).fill);
  expect(fill).toContain(id);
  await expect(page.locator('#'+id+' stop').last()).toHaveAttribute('stop-color','#05070B');
 }
 await expect(page.locator('.rh-showcase-hero__bottom-wave')).toHaveCSS('height','172px');
 await page.screenshot({path:'../docs/audit/dark-home-smooth-wave-390.png',fullPage:true,animations:'disabled'});
});
