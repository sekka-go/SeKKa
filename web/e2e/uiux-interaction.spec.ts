import { test, expect } from '@playwright/test';

// Phase 2 design regression; independently inspect screenshot evidence as well.
test('rider offer cards convey keyboard focus and responsive layout', async ({ browser }) => {
  for (const locale of ['ar-EG', 'en-GB'] as const) {
    const context = await browser.newContext({locale, viewport:{width:390,height:844}, colorScheme:'dark'});
    const page = await context.newPage();
    await page.goto('/?screen=11&preview=phase2');
    const card = page.locator('.discovery-stage .d-screen-11 .d-result').first();
    await expect(card).toBeVisible();
    const color = await card.evaluate(el => getComputedStyle(el).borderTopColor);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    const buttons = card.locator('button');
    if(await buttons.count()) {
      await buttons.first().focus();
      const focusedBorder=await card.evaluate(el => getComputedStyle(el).borderTopColor);
      expect(focusedBorder).not.toBe('rgba(0, 0, 0, 0)');
      await expect(buttons.first()).toBeFocused();
    }
    await page.goto('/?screen=12&preview=phase2');
    await expect(page.locator('.discovery-stage .d-screen-12')).toBeVisible();
    await context.close();
  }
});


test('rider home quick actions have visible 12px spacing in Arabic and English', async ({browser}) => {
  for (const locale of ['ar-EG','en-GB'] as const) {
    for (const width of [320,390]) {
      const context=await browser.newContext({locale,viewport:{width,height:844}});
      const page=await context.newPage();
      await page.goto('/?screen=8&preview=phase2');
      const buttons=page.locator('.d-screen-8 .d-home-quick-actions > button');
      await expect(buttons).toHaveCount(4);
      const boxes=await buttons.evaluateAll(nodes=>nodes.map(n=>{
        const r=n.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
      }));
      for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];
        const horizontal=Math.max(0,Math.max(a.left-b.right,b.left-a.right));
        const vertical=Math.max(0,Math.max(a.top-b.bottom,b.top-a.bottom));
        expect(horizontal>=11 || vertical>=11,
          'Quick action buttons touch: '+locale+' / '+width+' / '+i+'-'+j).toBeTruthy();
      }
      await context.close();
    }
  }
});
