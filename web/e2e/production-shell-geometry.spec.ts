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
 await expect(page.locator(scene.heading)).toBeVisible();
 const title=await rect(page,scene.heading),canvas=await rect(page,scene.canvas);
 const checks=await page.evaluate(()=>({
   scrollWidth:document.documentElement.scrollWidth,
   viewportWidth:innerWidth,
   bodyHeight:document.documentElement.scrollHeight,
   dir:document.documentElement.dir,
   theme:document.documentElement.getAttribute('data-theme')
 }));
 await page.screenshot({path:`../docs/audit/layout-${kind}-S${String(scene.id).padStart(3,'0')}-${label}.png`,
  fullPage:true,animations:'disabled'});
 return{title,canvas,checks};
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
     // Stage 1 requires its approved isolated canvas; search retains mobile tabs.
     if(scene.id===2||scene.id===3){
      await expect(page.locator('.sekka-mobile-header')).toBeHidden();
      await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
     }else{
      await expect(page.locator('.sekka-bottom-nav')).toBeVisible();
      const nav=await rect(page,'.sekka-bottom-nav');
      expect(nav.x).toBeGreaterThanOrEqual(-1);
      expect(nav.x+nav.width).toBeLessThanOrEqual(width+1);
      expect(nav.y).toBeGreaterThanOrEqual((width===360?800:844)-nav.height-2);
     }
     expect(Math.abs(actual.canvas.width-reference.canvas.width),
      'Root canvas must not shrink because of a duplicated outer padding').toBeLessThanOrEqual(3);
     expect(Math.abs(actual.title.width-reference.title.width),
      'Approved heading width must be preserved').toBeLessThanOrEqual(4);
     expect(Math.abs(actual.title.y-reference.title.y),
      'Original heading vertical placement should survive integrated shell').toBeLessThanOrEqual(28);
     // A fixed tab bar may temporarily cover scrolling content mid-scroll.
     // It is a defect only if the layout cannot scroll the last action above
     // the bar; reserve explicit scrollable bottom clearance.
     if(scene.id>=9){
       const clearance=await page.evaluate(()=>{
         const canvas=document.querySelector('.d-canvas')?.getBoundingClientRect();
         const nav=document.querySelector('.sekka-bottom-nav')?.getBoundingClientRect();
         if(!canvas||!nav)return null;
         const pageBottom=window.scrollY+canvas.bottom;
         return {distance:document.documentElement.scrollHeight-pageBottom,navHeight:nav.height};
       });
       expect(clearance).not.toBeNull();
       expect(clearance!.distance,'Scrollable bottom clearance must protect actions from fixed tabs')
        .toBeGreaterThanOrEqual(clearance!.navHeight-12);
     }
    });
   }
  }
 }
}
