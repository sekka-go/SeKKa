import {test,expect} from '@playwright/test';
test.use({viewport:{width:360,height:780}});
for(const theme of ['light','dark'] as const){
 test(`home alert and retry are contained inside the action card in ${theme}`,async({page})=>{
  await page.goto(`/?screen=8&oauth_theme=${theme}&oauth_language=en`);
  const card=page.locator('.live-home__panel').last();
  await expect(card).toBeVisible();
  // Inject a representative connection error to test its real CSS at narrow mobile width.
  await card.evaluate(el=>{
    const alert=document.createElement('div');
    alert.className='live-home__inline-alert';
    alert.setAttribute('role','alert');
    const message=document.createElement('span');
    message.textContent='Unable to connect to your account. Retry or sign in.';
    const retry=document.createElement('button');
    retry.textContent='Retry';retry.type='button';
    alert.append(message,retry);el.prepend(alert);
  });
  const panelBox=await card.boundingBox();
  const alert=card.getByRole('alert'),retry=alert.getByRole('button',{name:'Retry'});
  const alertBox=await alert.boundingBox(),retryBox=await retry.boundingBox();
  expect(panelBox&&alertBox&&retryBox).toBeTruthy();
  expect(alertBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
  expect(alertBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
  expect(alertBox!.x+alertBox!.width).toBeLessThanOrEqual(panelBox!.x+panelBox!.width+1);
  expect(retryBox!.y).toBeGreaterThanOrEqual(alertBox!.y);
  expect(retryBox!.y+retryBox!.height).toBeLessThanOrEqual(alertBox!.y+alertBox!.height+1);
  expect(retryBox!.x+retryBox!.width).toBeLessThanOrEqual(alertBox!.x+alertBox!.width+1);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 });
}
