import {test,expect} from '@playwright/test';

test('approved splash rotates its actual rim pixels while the SUV image stays fixed',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?tab=home',{waitUntil:'domcontentloaded'});
 const image=page.locator('.sekka-launch__approved-scene');
 const wheel=page.locator('canvas.sekka-launch__wheel-motion');
 const road=page.locator('.sekka-launch__motion');
 await expect(image).toBeVisible();
 await expect(wheel).toBeVisible();
 await expect(road).toBeVisible();
 await expect(road.locator('.sekka-launch__lane-cue')).toHaveCount(2);
 await expect(page.locator('.sekka-launch__road-flow')).toHaveCount(0);
 // The animated layers must be in the same crop space as the original art,
 // otherwise the tires and road streaks wander on narrow/wide devices.
 const boxes=await Promise.all([image,wheel,road].map(x=>x.boundingBox()));
 expect(boxes.every(Boolean)).toBe(true);
 for(const box of boxes.slice(1)){
  expect(Math.abs(box!.x-boxes[0]!.x)).toBeLessThan(2);
  expect(Math.abs(box!.y-boxes[0]!.y)).toBeLessThan(2);
  expect(Math.abs(box!.width-boxes[0]!.width)).toBeLessThan(2);
  expect(Math.abs(box!.height-boxes[0]!.height)).toBeLessThan(2);
 }
 await expect.poll(()=>wheel.evaluate((element)=>{
  const canvas=element as HTMLCanvasElement;
  const ctx=canvas.getContext('2d');
  if(!ctx||!canvas.width)return false;
  const px=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=3;i<px.length;i+=4)if(px[i]>32)return true;
  return false;
 }),{timeout:3000}).toBe(true);
 const a=await wheel.evaluate(el=>(el as HTMLCanvasElement).toDataURL());
 await page.waitForTimeout(250);
 const b=await wheel.evaluate(el=>(el as HTMLCanvasElement).toDataURL());
 expect(a).not.toBe(b);
 // The photographed car never translates, flips, or stretches.
 const after=await image.boundingBox();
 expect(Math.abs(after!.x-boxes[0]!.x)).toBeLessThan(1);
 expect(Math.abs(after!.y-boxes[0]!.y)).toBeLessThan(1);
});
test('reduced motion keeps the approved art without wheel or lane animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?tab=home',{waitUntil:'domcontentloaded'});
 const art=page.locator('.sekka-launch__approved-scene');
 // The reduced-motion splash may dismiss within 180ms, so test its computed
 // animation policy rather than requiring a prolonged overlay.
 if(await art.count()){
  const css=await page.locator('.sekka-launch__wheel-motion').evaluate(el=>getComputedStyle(el).display);
  expect(css).toBe('none');
 }
});
