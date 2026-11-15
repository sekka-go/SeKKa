import {test,expect,type Page} from '@playwright/test';

const scenes=[
 {id:'passenger-welcome',url:'/',selector:'.phase-screen-2'},
 {id:'passenger-account-type',url:'/',selector:'.phase-screen-3',start:true},
 {id:'passenger-search',url:'/?tab=search&view=9',selector:'.d-screen-9'},
 {id:'captain-sign-in-gate',url:'/?tab=captain-onboarding&view=35',selector:'.phase-screen-4'},
 {id:'admin-access-gate',url:'/?tab=admin&view=62',selector:'.sekka-mobile-card'}
] as const;

const widths=[320,360,390,412] as const;
const heights:Record<(typeof widths)[number],number>={320:700,360:800,390:844,412:915};
const variants=[
 {language:'ar',theme:'light'},
 {language:'ar',theme:'dark'},
 {language:'en',theme:'light'},
 {language:'en',theme:'dark'}
] as const;

async function geometry(page:Page){
 return page.evaluate(()=>{
  const selectors=['html','body','#root','.sekka-mobile','.sekka-mobile-header',
   '.sekka-mobile-content','.phase-one-stage','.phase-canvas','.sekka-bottom-nav'];
  return Object.fromEntries(selectors.map(selector=>{
   const element=document.querySelector<HTMLElement>(selector);
   if(!element)return[selector,null];
   const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
   return[selector,{
    x:Math.round(rect.x*10)/10,y:Math.round(rect.y*10)/10,
    width:Math.round(rect.width*10)/10,height:Math.round(rect.height*10)/10,
    minHeight:style.minHeight,maxWidth:style.maxWidth,marginInline:style.marginInline,
    paddingBlock:style.paddingBlock,aspectRatio:style.aspectRatio,transform:style.transform,
    overflowX:style.overflowX
   }];
  }));
 });
}

for(const width of widths){
 for(const {language,theme} of variants){
  for(const scene of scenes){
   test(`mobile viewport ${scene.id} ${width}px ${language} ${theme}`,async({page})=>{
    const height=heights[width];
    await page.setViewportSize({width,height});
    await page.addInitScript(({language,theme})=>{
     localStorage.setItem('language_preference',language);
     localStorage.setItem('theme_preference',theme);
    },{language,theme});
    await page.goto(scene.url);
    if(scene.start){
     const start=page.getByRole('button',{name:language==='ar'?/ابدأ الآن/:/Get started/});
     await expect(start).toBeVisible();
     await start.click();
    }
    const screen=page.locator(scene.selector);
    await expect(screen).toBeVisible();
    const primary=scene.id==='passenger-welcome'?page.locator('.phase-start'):
     scene.id==='passenger-account-type'?page.locator('.phase-role-next'):
     scene.id==='passenger-search'?page.locator('.d-screen-9 .d-planner > .d-primary'):
     scene.id==='captain-sign-in-gate'?page.locator('.phase-google-auth .phase-primary'):null;
    if(primary){
     await expect(primary).toBeVisible();
     const bounds=await primary.boundingBox();
     expect(bounds).not.toBeNull();
     expect(bounds!.y+bounds!.height,'Primary action must remain inside the mobile viewport')
      .toBeLessThanOrEqual(height+1);
    }
    if(scene.id==='admin-access-gate')
     await expect(screen.getByRole('heading',{name:language==='ar'?/غير مسموح/:/Access restricted/})).toBeVisible();
    const layout=await geometry(page);
    if(width===390&&language==='en'&&theme==='dark')
     console.log(`MOBILE_LAYOUT ${scene.id} ${JSON.stringify(layout)}`);
    if(scene.id==='passenger-welcome'||scene.id==='passenger-account-type'||scene.id==='captain-sign-in-gate'){
     const canvas=layout['.phase-canvas'];
     expect(canvas?.x,'Original production screen must start at the viewport edge').toBe(0);
     expect(canvas?.width,'Original production screen must use the viewport width').toBe(width);
     expect(canvas!.height,'Original production screen must fill the mobile viewport')
      .toBeGreaterThanOrEqual(height-2);
    }
    if(scene.id==='passenger-search'){
     const canvas=layout['.phase-canvas'];
     expect(canvas?.width,'Search canvas must use the viewport width').toBe(width);
     expect(canvas!.height,'Search canvas must fill the space above bottom navigation')
      .toBeGreaterThanOrEqual(height-140);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth))
     .toBeLessThanOrEqual(width+1);
    await page.screenshot({
     path:`../docs/audit/layout-after-${scene.id}-${width}-${language}-${theme}.png`,
     animations:'disabled'
    });
   });
  }
 }
}
