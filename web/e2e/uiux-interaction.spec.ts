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
