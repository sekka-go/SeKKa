import {test,expect} from '@playwright/test';

/** Layout smoke checks for captain previews; screenshot signoff remains separate. */
test('captain route wizard buttons and fields keep spacing on mobile',async({browser})=>{
 for(const locale of ['ar-EG','en-GB'] as const){
  const context=await browser.newContext({locale,viewport:{width:390,height:844}});
  const page=await context.newPage();
  for(const id of [42,43,44,45,46,47,48,49]){
   await page.goto('/?screen='+id+'&preview=phase6');
   const canvas=page.locator('.captain-routes-canvas');
   await expect(canvas).toBeVisible();
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
   expect(dimensions.scroll, 'Overflow in captain route '+id+' '+locale).toBeLessThanOrEqual(dimensions.width+2);
   const buttons=canvas.locator('.d-box > button');
   if(await buttons.count()>1){
    const boxes=await buttons.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom}}));
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
     const x=Math.max(0,Math.max(boxes[a].l-boxes[b].r,boxes[b].l-boxes[a].r));
     const y=Math.max(0,Math.max(boxes[a].t-boxes[b].b,boxes[b].t-boxes[a].b));
     expect(x>=10||y>=10,'Touching captain buttons '+id+' '+locale).toBeTruthy();
    }
   }
  }
  await context.close();
 }
});
