import {test,expect} from '@playwright/test';

// Real rendered controls; no synthetic backend or placeholder results.
const themes=['light','dark'] as const;
const widths=[320,390] as const;
function rgbChannels(color:string):number[]{
 const values=color.match(/\d+(?:\.\d+)?/g);
 if(!values||values.length<3)throw new Error('No RGB color: '+color);
 return values.slice(0,3).map(Number);
}
function luminance(rgb:number[]):number{
 const channels=rgb.map(v=>{
  const c=v/255;
  return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
 });
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function ratio(a:string,b:string):number{
 const [x,y]=[luminance(rgbChannels(a)),luminance(rgbChannels(b))].sort((n,m)=>m-n);
 return (x+0.05)/(y+0.05);
}
for(const width of widths){
 for(const theme of themes){
  test('PoNo real filters: readable active states and touch targets '+width+'px '+theme,async({page})=>{
   await page.setViewportSize({width,height:844});
   await page.addInitScript(value=>{
    localStorage.setItem('language_preference','ar');
    localStorage.setItem('theme_preference',value);
    sessionStorage.setItem('sekka.launch.seen.v1','1');
   },theme);
   await page.goto('/?tab=search&view=10');
   const filters=page.locator('.rf3');
   const action=filters.locator('.rf3__apply');
   await expect(action).toBeVisible();
   const category=filters.locator('.rf3__categories button').first();
   await expect(category).toBeEnabled();
   await category.click();
   await expect(category).toHaveAttribute('aria-pressed','true');
   for(const target of [category,action,filters.locator('.rf3__choices button[aria-pressed="true"]').first()]){
    const info=await target.evaluate(el=>{
     const style=getComputedStyle(el);
     const r=el.getBoundingClientRect();
     return {foreground:style.color,background:style.backgroundColor,width:r.width,height:r.height};
    });
    expect(ratio(info.foreground,info.background),'Foreground must meet WCAG AA text contrast').toBeGreaterThanOrEqual(4.5);
    expect(info.height,'Tap target must remain at least 44 CSS pixels high').toBeGreaterThanOrEqual(44);
    expect(info.width).toBeGreaterThanOrEqual(44);
   }
   const seatCount=category.locator('span');
   const seatColors=await seatCount.evaluate(el=>{
    const style=getComputedStyle(el),parent=getComputedStyle(el.parentElement!);
    return {foreground:style.color,background:parent.backgroundColor};
   });
   expect(ratio(seatColors.foreground,seatColors.background),'Seat count contrast').toBeGreaterThanOrEqual(4.5);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
   await page.screenshot({path:`../docs/audit/pono-filters-a11y-${width}-${theme}.png`,animations:'disabled'});
  });
 }
}
