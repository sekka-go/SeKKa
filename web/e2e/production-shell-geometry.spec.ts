import {test,expect,type Page} from '@playwright/test';

// Read-only original gallery vs genuine production-facing GUEST components.
// These are geometry checks, not approval of authenticated or data-driven states.
// Screens 02, 03, 09 and 10 use the approved original components in both paths.
const screens=[
 {id:2,original:'/dev/screens?screen=2&inspect=1',integrated:'/',heading:'.phase-screen-2 .phase-title',canvas:'.phase-screen-2',mode:'welcome'},
 {id:3,original:'/dev/screens?screen=3&inspect=1',integrated:'/',heading:'.phase-screen-3 .phase-title',canvas:'.phase-screen-3',mode:'choose'},
 {id:9,original:'/dev/screens?screen=9&preview=phase2',integrated:'/?tab=search&view=9',heading:'.d-screen-9 .d-title',canvas:'.d-screen-9',mode:'search'},
 {id:10,original:'/dev/screens?screen=10&preview=phase2',integrated:'/?tab=search&view=10',heading:'.d-screen-10 .d-title',canvas:'.d-screen-10',mode:'filters'}
] as const;
type Rect={x:number;y:number;width:number;height:number};
async function rect(page:Page,selector:string){
 const r=await page.locator(selector).first().boundingBox();
 expect(r,`Missing expected original component ${selector}`).not.toBeNull();
 return r as Rect;
}
async function snapshot(page:Page,scene:(typeof screens)[number],kind:'reference'|'after',label:string){
 const realSearch=kind==='after'&&scene.id>=9;
 if(realSearch){
  await expect(page.locator(scene.heading)).toHaveCount(0);
  await expect(page.locator(scene.canvas+' > h1.sr-only')).toHaveCount(1);
  await expect(page.locator(scene.canvas+' .sekka-discovery-logo-en')).toBeVisible();
 }else await expect(page.locator(scene.heading)).toBeVisible();
 await expect(page.locator('.sekka-launch')).toBeHidden();
 const title=realSearch?null:await rect(page,scene.heading),canvas=await rect(page,scene.canvas);
 const action=scene.id===10?await rect(page,'.d-screen-10 > .d-primary'):null;
 const checks=await page.evaluate(()=>({
   scrollWidth:document.documentElement.scrollWidth,
   viewportWidth:innerWidth,
   bodyHeight:document.documentElement.scrollHeight,
   dir:document.documentElement.dir,
   theme:document.documentElement.getAttribute('data-theme')
 }));
 await page.screenshot({path:`../docs/audit/layout-${kind}-S${String(scene.id).padStart(3,'0')}-${label}.png`,
  fullPage:true,animations:'disabled'});
 return{title,canvas,action,checks};
}
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   for(const scene of screens){
    const variant=`${width}x${width===360?800:844}-${language}-${theme}`;
    test(`original geometry ${String(scene.id).padStart(2,'0')} ${variant}`,async({page})=>{
     await page.setViewportSize({width,height:width===360?800:844});
     await page.addInitScript(({language,theme})=>{
      localStorage.setItem('language_preference',language);
      localStorage.setItem('theme_preference',theme);
     },{language,theme});
     await page.goto(scene.original);
     const reference=await snapshot(page,scene,'reference',variant);
     await page.goto(scene.integrated);
     if(scene.mode==='choose'){
      const start=page.getByRole('button',{name:language==='ar'?/ابدأ الآن/:/Get started/});
      await expect(start).toBeVisible();await start.click();
     }
     const actual=await snapshot(page,scene,'after',variant);
     expect(actual.checks.scrollWidth,'Production screen horizontal overflow').toBeLessThanOrEqual(width+1);
     // Screens 02/03 stay untouched full-screen onboarding. The real
     // Search/Filters have a compact menu-only shell, never a fixed tab strip.
     if(scene.id===2||scene.id===3){
      await expect(page.locator('.sekka-mobile-header')).toBeHidden();
     }else{
      // Search owns a logo/back navigation row; no duplicated named shell.
      await expect(page.locator('.sekka-mobile-header')).toBeHidden();
      await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
      await expect(page.locator('.sekka-discovery-logo-en')).toBeVisible();
      await expect(page.locator('.d-header .phase-back')).toBeVisible();
      expect(actual.canvas.y,'Search must start near the top of the screen').toBeLessThanOrEqual(96);
     }
     if(scene.id===10){
      if(!actual.action||!reference.action)throw new Error('Missing filter action measurement');
      expect(Math.abs(actual.action.width-reference.action.width),
       'Filter action width must preserve the approved design').toBeLessThanOrEqual(4);
      expect(Math.abs(actual.action.height-reference.action.height),
       'Filter action height must preserve the approved design').toBeLessThanOrEqual(4);
      // Search filters may scroll naturally; the action must be reachable
      // without a fixed bottom nav covering it.
      await page.locator('.d-screen-10 > .d-primary').scrollIntoViewIfNeeded();
      const visibleAction=await rect(page,'.d-screen-10 > .d-primary');
      expect(visibleAction.y+visibleAction.height,'Filter action must be visible after scrolling')
       .toBeLessThanOrEqual((width===360?800:844)+1);
     }
     expect(Math.abs(actual.canvas.width-reference.canvas.width),
      'Root canvas must not shrink because of a duplicated outer padding').toBeLessThanOrEqual(3);
     if(actual.title&&reference.title){
      expect(Math.abs(actual.title.width-reference.title.width),
       'Onboarding heading width must be preserved').toBeLessThanOrEqual(4);
      expect(Math.abs((actual.title.y-actual.canvas.y)-(reference.title.y-reference.canvas.y)),
       'Onboarding heading geometry must remain stable').toBeLessThanOrEqual(9);
     }
     // No fixed footer remains; preserve scrollability and ensure no
     // old viewport-height reservation takes usable space below actions.
     if(scene.id>=9&&scene.id!==10){
      const layout=await page.evaluate(()=>({
       contentHeight:document.querySelector('.sekka-mobile-content')?.getBoundingClientRect().height||0,
       scrollWidth:document.documentElement.scrollWidth
      }));
      expect(layout.contentHeight).toBeGreaterThan(0);
      expect(layout.scrollWidth).toBeLessThanOrEqual(width+1);
     }
    });
   }
  }
 }
}
