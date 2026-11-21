import {test,expect,type Page} from '@playwright/test';

// Legacy gallery is not the baseline for the owner-redesigned onboarding.
// Those new production pages are verified in guest-entry-vnext.spec.ts.
// Keep the independently approved search/filters geometry regression gate.
const screens=[
 {id:9,original:'/dev/screens?screen=9&preview=phase2',integrated:'/?tab=search&view=9',heading:'.d-screen-9 .d-title',canvas:'.d-screen-9'},
 {id:10,original:'/dev/screens?screen=10&preview=phase2',integrated:'/?tab=search&view=10',heading:'.d-screen-10 .d-title',canvas:'.d-screen-10'}
] as const;
type Rect={x:number;y:number;width:number;height:number};
async function rect(page:Page,selector:string){
 const r=await page.locator(selector).first().boundingBox();
 expect(r,'Missing component '+selector).not.toBeNull();
 return r as Rect;
}
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   for(const scene of screens){
    test('search shell geometry '+scene.id+' '+width+' '+language+' '+theme,async({page})=>{
     await page.setViewportSize({width,height:width===360?800:844});
     await page.addInitScript(({language,theme})=>{
      localStorage.setItem('language_preference',language);
      localStorage.setItem('theme_preference',theme);
     },{language,theme});
     await page.goto(scene.original);
     await expect(page.locator(scene.heading)).toBeVisible();
     const reference=await rect(page,scene.canvas);
     const oldAction=scene.id===10?await rect(page,'.d-screen-10 > .d-primary'):null;
     await page.screenshot({path:'../docs/audit/layout-reference-S'+String(scene.id).padStart(3,'0')+'-'+width+'-'+language+'-'+theme+'.png',
      animations:'disabled',fullPage:true});
     await page.goto(scene.integrated);
     await expect(page.locator('.sekka-launch')).toBeHidden();
     await expect(page.locator(scene.heading)).toHaveCount(0);
     await expect(page.locator(scene.canvas+' > h1.sr-only')).toHaveCount(1);
     await expect(page.locator('.sekka-discovery-logo-en')).toHaveCount(0);
     const actual=await rect(page,scene.canvas);
     const header=page.locator('.sekka-mobile-header');
     await expect(header).toBeVisible();
     const menu=page.locator('.sekka-shell-menu');
     await expect(menu).toBeVisible();
     const menuBox=await menu.boundingBox(),headerBox=await header.boundingBox();
     expect(menuBox).not.toBeNull();
     expect(headerBox).not.toBeNull();
     expect(menuBox!.width).toBeGreaterThanOrEqual(44);
     expect(menuBox!.x+menuBox!.width/2).toBeLessThan(width/2);
     expect(actual.y).toBeLessThanOrEqual(headerBox!.y+headerBox!.height+70);
     expect(Math.abs(actual.width-reference.width)).toBeLessThanOrEqual(3);
     await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
     if(scene.id===9)await expect(page.locator('.d-header .phase-back')).toBeHidden();
     else{
      await expect(page.locator('.d-header .phase-back')).toBeVisible();
      const action=await rect(page,'.d-screen-10 > .d-primary');
      if(!oldAction)throw Error('Missing reference filter button');
      expect(Math.abs(action.width-oldAction.width)).toBeLessThanOrEqual(4);
      expect(Math.abs(action.height-oldAction.height)).toBeLessThanOrEqual(4);
      await page.locator('.d-screen-10 > .d-primary').scrollIntoViewIfNeeded();
     }
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);
     expect(overflow).toBeLessThanOrEqual(width+1);
     await page.screenshot({path:'../docs/audit/layout-after-S'+String(scene.id).padStart(3,'0')+'-'+width+'-'+language+'-'+theme+'.png',
      animations:'disabled',fullPage:true});
    });
   }
  }
 }
}
