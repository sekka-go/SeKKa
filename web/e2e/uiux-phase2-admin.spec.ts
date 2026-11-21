import {test,expect} from '@playwright/test';

// Source-level visual smoke only; screenshot-based human signoff remains required.
test('admin responsive navigation and tables across languages and themes',async({browser})=>{
 // Four independent locale/theme browser contexts × twelve lazy gallery pages:
 // do not time out the entire coverage after the default 20-second limit.
 test.setTimeout(180000);
 for(const locale of ['ar-EG','en-GB'] as const) for(const theme of ['dark','light'] as const){
  const context=await browser.newContext({locale,colorScheme:theme,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.addInitScript(({lang,mode})=>{
   localStorage.setItem('language_preference',lang);
   localStorage.setItem('theme_preference',mode);
  },{lang:locale==='ar-EG'?'ar':'en',mode:theme});
  for(const id of [62,63,64,65,66,67,68,69,70,71,72,73]){
   await page.goto('/dev/screens?screen='+id+'&preview=phase8');
   await expect(page.locator('main.ad-content'),'Admin screen '+id+' must finish loading').toBeVisible({timeout:15000});
   await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar-EG'?'rtl':'ltr');
   const buttons=page.locator('.ad-sidebar nav button');
   if(await buttons.count())await expect(buttons.first()).toBeVisible();
   const documentOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
   expect(documentOverflow,'Admin screen '+id+' overflows at 390px / '+locale+' / '+theme).toBe(false);
  }
  await context.close();
 }
});
