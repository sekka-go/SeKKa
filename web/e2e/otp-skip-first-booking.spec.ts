import {test,expect} from '@playwright/test';
test.use({locale:'ar-EG',viewport:{width:390,height:844}});

for(const theme of ['dark','light'] as const){
 test('verification preview allows skip below Verify in '+theme,async({page})=>{
  await page.addInitScript(t=>localStorage.setItem('theme_preference',t),theme);
  await page.goto('/?screen=5&inspect=1');
  const verify=page.locator('button.phase-verify');
  const skip=page.getByRole('button',{name:/تخطي الآن/});
  await expect(skip).toBeVisible();
  const v=await verify.boundingBox(),s=await skip.boundingBox(),c=await page.locator('main.phase-canvas').boundingBox();
  expect(v&&s&&c).toBeTruthy();
  expect(s!.y).toBeGreaterThan(v!.y+v!.height);
  expect(s!.x).toBeGreaterThanOrEqual(c!.x);
  expect(s!.y+s!.height).toBeLessThanOrEqual(c!.y+c!.height+1);
  await skip.click();
  await expect(page).toHaveURL(/screen=6/);
  const deferred=await page.evaluate(()=>sessionStorage.getItem('sekka.phoneVerificationDeferred'));
  expect(deferred).toBe('true');
 });
}
