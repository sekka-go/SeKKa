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
  await page.getByRole('button',{name:'توسيع القائمة'}).click();
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
  await expect(active.locator('.sekka-menu-row__icon')).toHaveCSS('color','rgb(215, 248, 255)');
  await expect(active.locator('.sekka-menu-row__label')).toHaveCSS('color','rgb(247, 252, 255)');
  await expect(drawer.locator('.sekka-side-drawer__close')).toHaveCSS('background-color','rgba(205, 238, 255, 0.15)');
  await page.waitForTimeout(650); // Capture after the drawer entrance finishes.
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
 await page.getByRole('button',{name:'توسيع القائمة'}).click();
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
 await page.getByRole('button',{name:'توسيع القائمة'}).click();
 const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
 await expect(drawer).toBeVisible();
 await page.waitForTimeout(650); // Avoid capturing a half-open drawer.
 await page.screenshot({path:'../docs/audit/menu-white-ice-390.png',fullPage:true,animations:'disabled'});
 const background=await drawer.evaluate(element=>getComputedStyle(element).backgroundImage);
 expect(background).toContain('linear-gradient');
 expect(background).toContain('rgba(255, 255, 255, 0.93) 0%');
 expect(background).toContain('rgba(234, 243, 255, 0.9) 100%');
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


test('glass drawer unfolds from an icon rail and supports reversible collapse without losing navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','dark');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=profile');
 await page.getByRole('button',{name:'فتح القائمة'}).click();
 const panel=page.getByRole('dialog',{name:'القائمة الرئيسية'});
 await expect(panel).toBeVisible();
 await expect(panel).toHaveClass(/sekka-glass-panel--collapsed/);
 await expect(panel).toHaveCSS('width','70px');
 await expect(panel.locator('.sekka-glass-search')).toBeHidden();
 await expect(panel.getByRole('button',{name:'توسيع القائمة'})).toHaveAttribute('aria-expanded','false');
 await page.waitForTimeout(450);
 const compactChevron=await panel.locator('.sekka-glass-rail-toggle svg').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
 expect(compactChevron).toBeGreaterThan(.95); // left arrow when compact
 await page.screenshot({path:'../docs/audit/menu-glass-compact-390.png',fullPage:true,animations:'disabled'});
 await panel.getByRole('button',{name:'توسيع القائمة'}).click();
 await expect(panel).not.toHaveClass(/sekka-glass-panel--collapsed/);
 await expect(panel).toHaveCSS('border-top-left-radius','31px');
 await page.waitForTimeout(550);
 const expandedChevron=await panel.locator('.sekka-glass-rail-toggle svg').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
 expect(expandedChevron).toBeLessThan(-.95); // right arrow to collapse back
 await page.screenshot({path:'../docs/audit/menu-glass-expanded-390.png',fullPage:true,animations:'disabled'});
 const glass=await panel.evaluate(el=>({
  blur:getComputedStyle(el).backdropFilter,
  webkitBlur:getComputedStyle(el).webkitBackdropFilter,
  supported:CSS.supports('backdrop-filter','blur(30px)'),
  background:getComputedStyle(el).backgroundImage,
 }));
 // Some CI builds expose a translucent CSS fallback rather than backdrop blur.
 // The actual overlay must still have layered, semi-transparent glass surfaces.
 expect(glass.background).toContain('rgba(');
 if(glass.blur!=='none')expect(glass.blur).toContain('blur(30px)');
 else if(glass.webkitBlur&&glass.webkitBlur!=='none')expect(glass.webkitBlur).toContain('blur(30px)');
 // A narrow collapsed rail retains icons, active destination and its controls.
 await panel.getByRole('button',{name:'تصغير القائمة'}).click();
 await expect(panel).toHaveClass(/sekka-glass-panel--collapsed/);
 await expect(panel).toHaveCSS('width','70px');
 await expect(panel.locator('.sekka-glass-search')).toBeHidden();
 await expect(panel.getByRole('button',{name:'توسيع القائمة'})).toHaveAttribute('aria-expanded','false');
 await expect(panel.locator('button.sekka-menu-row').first().locator('svg')).toBeVisible();
 await panel.getByRole('button',{name:'توسيع القائمة'}).click();
 await expect(panel).not.toHaveClass(/sekka-glass-panel--collapsed/);
 await expect(panel.locator('.sekka-glass-search')).toBeVisible();
 await expect(panel.locator('.sekka-glass-search input')).toHaveAttribute('type','search');
 await panel.locator('.sekka-glass-search input').fill('الإشعارات');
 await expect(panel.locator('nav > button.sekka-menu-row')).toHaveCount(1);
 await panel.getByRole('button',{name:'الإشعارات',exact:true}).click();
 await expect(page).toHaveURL(/tab=notifications/);
 await expect(panel).toHaveCount(0);
});

test('glassy menu keeps the drawer at the right in Arabic and left in English',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','ar');
  localStorage.setItem('theme_preference','light');
  sessionStorage.setItem('sekka.launch.seen.v1','1');
 });
 await page.goto('/?tab=profile');
 await page.getByRole('button',{name:'فتح القائمة'}).click();
 await page.getByRole('button',{name:'توسيع القائمة'}).click();
 const panel=page.locator('.sekka-glass-panel');
 await expect(panel).toBeVisible();
 await page.waitForTimeout(700);
 const arabicRect=await panel.boundingBox();
 expect(arabicRect).not.toBeNull();
 expect(arabicRect!.x).toBeGreaterThan(30);
 await panel.locator('#sekka-language-pref').selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 const englishPanel=page.getByRole('dialog',{name:'Main menu'});
 await expect(englishPanel).toBeVisible();
 const englishRect=await englishPanel.boundingBox();
 expect(englishRect).not.toBeNull();
 expect(englishRect!.x).toBeLessThan(20);
 await expect(englishPanel.locator('.sekka-glass-search input')).toHaveAttribute('placeholder','Search pages');
 await expect(englishPanel.locator('#sekka-appearance-pref')).toHaveCount(0);
});
