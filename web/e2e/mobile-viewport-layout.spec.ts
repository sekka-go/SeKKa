import {test,expect,type Page} from '@playwright/test';

const scenes=[
 {id:'passenger-welcome',url:'/',selector:'.phase-screen-2'},
 {id:'passenger-account-type',url:'/',selector:'.phase-screen-3',start:true},
 {id:'passenger-search',url:'/?tab=search&view=9',selector:'.d-screen-9'},
 {id:'passenger-filters',url:'/?tab=search&view=10',selector:'.d-screen-10'},
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
     scene.id==='passenger-filters'?page.locator('.d-screen-10 > .d-primary'):
     scene.id==='captain-sign-in-gate'?page.locator('.phase-google-auth .phase-primary'):null;
    if(primary){
     await expect(primary).toBeVisible();
     await primary.scrollIntoViewIfNeeded();
     const bounds=await primary.boundingBox();
     expect(bounds).not.toBeNull();
     expect(bounds!.y+bounds!.height,'Primary action must remain inside the mobile viewport')
      .toBeLessThanOrEqual(height+1);
    }
    // Reject oversized brand marks without changing the approved artwork or crop.
    // Ratios are relative to the actual integrated full-width canvas, not the
    // obsolete centered preview frame.
    const logo=screen.locator('.phase-logo > .phase-wordmark, .d-header > .phase-wordmark').first();
    if(await logo.count()){
     const mark=await logo.boundingBox(),canvas=await screen.boundingBox();
     expect(mark).not.toBeNull();expect(canvas).not.toBeNull();
     expect(mark!.width,'Logo must not occupy a third of the mobile screen')
      .toBeLessThanOrEqual(canvas!.width*.32+1);
     expect(mark!.height/mark!.width,'Wordmark must preserve its source proportions')
      .toBeGreaterThan(.45);
     expect(mark!.height/mark!.width,'Wordmark must preserve its source proportions')
      .toBeLessThan(.56);
    }
    const shellLogo=page.locator('.sekka-mobile-header .sekka-approved-logo:visible');
    if(await shellLogo.count()){
     const mark=await shellLogo.boundingBox();
     expect(mark!.width).toBeLessThanOrEqual(54);
     expect(mark!.height).toBeLessThanOrEqual(54);
    }
    // Pairwise interactive checks on the real rendered screen, excluding
    // invisible and off-screen elements.  Never score gallery chrome here.
    const collisions=await page.evaluate(()=>{
     const buttons=[...document.querySelectorAll<HTMLButtonElement>(
      '.sekka-mobile-content button, .sekka-bottom-nav button')].filter(b=>{
       const s=getComputedStyle(b),r=b.getBoundingClientRect();
       return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0
        &&r.bottom>0&&r.top<innerHeight;
      });
     const overlaps: string[]=[];
     for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
      const a=buttons[i].getBoundingClientRect(),b=buttons[j].getBoundingClientRect();
      const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
      const y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      if(x*y>4)overlaps.push([buttons[i].textContent,buttons[j].textContent].map(t=>
       (t||'').trim().replace(/\s+/g,' ').slice(0,45)).join(' / '));
     }
     return overlaps;
    });
    expect(collisions,'Interactive buttons must never occupy the same touch area').toEqual([]);
    if(scene.id==='passenger-filters'){
     await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
     const last=await page.locator('.d-screen-10 > .d-primary').boundingBox();
     expect(last).not.toBeNull();
     expect(last!.y+last!.height).toBeLessThanOrEqual(height-1);
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
    if(scene.id==='passenger-search'||scene.id==='passenger-filters'){
     const canvas=layout['.phase-canvas'];
     expect(canvas?.width,'Search canvas must use the viewport width').toBe(width);
     expect(canvas!.height,'Search canvas must fill the space above bottom navigation')
      .toBeGreaterThanOrEqual(height-140);
    }
    if(scene.id==='passenger-filters'){
     // Long filters are document scroll, not a clipped fixed-height canvas.
     expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.d-screen-10')!).overflowY))
      .not.toBe('hidden');
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

/* Regression: some installed Android PWA windows report a CSS viewport wider
 * than the old 680px breakpoint, leaving a portrait 3:4 letterboxed canvas. */
for (const [width, height] of [[390, 844], [709, 1536], [720, 1280]] as const) {
  test(`installed-size guest welcome fills the portrait viewport at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const screen = page.locator(".phase-screen-2");
    await expect(screen).toBeVisible();
    const rect = await screen.boundingBox();
    const stage = await page.locator(".sekka-guest-welcome .phase-one-stage").boundingBox();
    expect(rect).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(stage!.x).toBe(0);
    expect(stage!.y).toBe(0);
    expect(rect!.x).toBe(0);
    expect(rect!.width).toBe(width);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeLessThanOrEqual(2);
    expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(height - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
  });
}

test("approved screen gallery retains the 3:4 reference frame", async ({ page }) => {
  await page.setViewportSize({ width: 709, height: 1536 });
  await page.goto("/dev/screens");
  const canvas = page.locator(".phase-canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height / box!.width).toBeGreaterThan(1.30);
  expect(box!.height / box!.width).toBeLessThan(1.37);
});
