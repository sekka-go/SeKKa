import {test,expect} from '@playwright/test';

// The same shared corner controls appear on all real Passenger, Captain,
// and Admin screens. Their palette follows the resolved device/user theme.
for(const theme of ['light','dark'] as const){
 for(const language of ['ar','en'] as const){
  test(`shared notification and menu tiles ${theme} / ${language}`,async({page})=>{
   await page.setViewportSize({width:390,height:844});
   await page.addInitScript(({theme,language})=>{
    localStorage.setItem('theme_preference',theme);
    localStorage.setItem('language_preference',language);
    localStorage.setItem('sekka.tour.disable-auto.guest','1');
   },{theme,language});
   await page.goto('/?tab=search&view=9');
   const menu=page.locator('.sekka-floating-actions .sekka-fab-menu');
   const bell=page.locator('.sekka-floating-actions .sekka-fab-bell');
   await expect(menu).toBeVisible();
   await expect(bell).toBeVisible();
   for(const button of [menu,bell]){
    const style=await button.evaluate(el=>{
     const button=window.getComputedStyle(el);
     const svg=window.getComputedStyle(el.querySelector('svg')!);
     const b=el.getBoundingClientRect(),s=el.querySelector('svg')!.getBoundingClientRect();
     return {background:button.backgroundColor,stroke:svg.stroke,
      offsetX:Math.abs((s.left+s.right)/2-(b.left+b.right)/2),
      offsetY:Math.abs((s.top+s.bottom)/2-(b.top+b.bottom)/2)};
    });
    expect(style.background).toBe(theme==='light'?'rgb(255, 255, 255)':'rgb(23, 58, 80)');
    expect(style.stroke).toBe(theme==='light'?'rgb(17, 17, 17)':'rgb(255, 204, 36)');
    expect(style.offsetX).toBeLessThan(2);
    expect(style.offsetY).toBeLessThan(2);
   }
   const m=await menu.boundingBox(),b=await bell.boundingBox();
   expect(m).not.toBeNull();expect(b).not.toBeNull();
   expect(language==='ar'?m!.x>b!.x:m!.x<b!.x).toBe(true);
  });
 }
}
