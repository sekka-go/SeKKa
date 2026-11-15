import {test,expect} from '@playwright/test';
test.use({viewport:{width:360,height:780}});
// Test real anonymous guards, not the retired /?screen=8 live-home mock.
for(const theme of ['light','dark'] as const){
 test(`profile sign-in gate keeps its action inside the card in ${theme}`,async({page})=>{
  await page.addInitScript(theme=>localStorage.setItem('theme_preference',theme),theme);
  await page.goto('/?tab=profile');
  const card=page.locator('.sekka-mobile-card').first();
  const action=card.getByRole('button',{name:/تسجيل الدخول بجوجل|Sign in with Google/});
  await expect(card).toBeVisible();await expect(action).toBeVisible();
  const panel=await card.boundingBox(),button=await action.boundingBox();
  expect(panel&&button).toBeTruthy();
  expect(button!.x).toBeGreaterThanOrEqual(panel!.x-1);
  expect(button!.x+button!.width).toBeLessThanOrEqual(panel!.x+panel!.width+1);
  expect(button!.y).toBeGreaterThanOrEqual(panel!.y);
  expect(button!.y+button!.height).toBeLessThanOrEqual(panel!.y+panel!.height+1);
  expect(button!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
