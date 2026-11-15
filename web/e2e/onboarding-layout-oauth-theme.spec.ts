import { test, expect } from '@playwright/test';
test.use({ locale:'ar-EG', viewport:{width:390,height:844} });

for (const theme of ['light','dark'] as const) {
  test(`first seven onboarding screens keep action buttons within their cards in ${theme}`,async ({page})=>{
    await page.addInitScript((selected)=>localStorage.setItem('theme_preference',selected),theme);
    for(let screen=1;screen<=7;screen++){
      await page.goto(`/?screen=${screen}&inspect=1`);
      const canvas=page.locator('main.phase-canvas');
      await expect(canvas).toBeVisible();
      await expect(page.locator('.phase-one-stage')).toHaveClass(new RegExp(theme));
      const bounds=await canvas.boundingBox();
      expect(bounds).not.toBeNull();
      for(const btn of await canvas.locator('button:visible').all()){
        const rect=await btn.boundingBox();
        if(!rect)continue;
        expect(rect.x,`screen ${screen} left bound`).toBeGreaterThanOrEqual(bounds!.x-2);
        expect(rect.x+rect.width,`screen ${screen} right bound`).toBeLessThanOrEqual(bounds!.x+bounds!.width+2);
        expect(rect.y,`screen ${screen} top bound`).toBeGreaterThanOrEqual(bounds!.y-2);
        expect(rect.y+rect.height,`screen ${screen} bottom bound`).toBeLessThanOrEqual(bounds!.y+bounds!.height+2);
      }
    }
  });
}
test('live Google sign-in button is below its heading inside the card in both themes',async({page})=>{
 for(const theme of ['light','dark'] as const){
  await page.goto(`/?screen=4&oauth_theme=${theme}&oauth_language=ar`);
  const heading=page.getByRole('heading',{name:'الدخول بجوجل'});
  const button=page.getByRole('button',{name:'المتابعة باستخدام جوجل'});
  await expect(heading).toBeVisible();
  await expect(button).toBeVisible();
  const titleBox=await heading.boundingBox(),buttonBox=await button.boundingBox(),cardBox=await page.locator('main.phase-canvas').boundingBox();
  expect(titleBox&&buttonBox&&cardBox).toBeTruthy();
  expect(buttonBox!.y).toBeGreaterThan(titleBox!.y+titleBox!.height);
  expect(buttonBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(buttonBox!.x+buttonBox!.width).toBeLessThanOrEqual(cardBox!.x+cardBox!.width);
  await expect(page.locator('.phase-one-stage')).toHaveClass(new RegExp(theme));
 }
});
test('light preference carried in OAuth callback remains light after reload',async({page})=>{
 await page.goto('/?screen=8&oauth_theme=light&oauth_language=ar');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto('/?screen=8');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('html')).toHaveAttribute('lang','ar');
});

test('prerequisite return button stays outside onboarding image and never overlays logo',async({page})=>{
 await page.addInitScript(()=>{
   sessionStorage.setItem('sekka.prerequisiteReturn','?screen=11');
   localStorage.setItem('theme_preference','dark');
 });
 await page.goto('/?screen=5&preview=phase1');
 const button=page.locator('.phase-return-prerequisite');
 if(await button.count()){
  await expect(button).toBeVisible();
  const b=await button.boundingBox(),card=await page.locator('main.phase-canvas').boundingBox();
  expect(b&&card).toBeTruthy();
  expect(b!.y+b!.height).toBeLessThanOrEqual(card!.y);
 }
});
