import {test,expect} from '@playwright/test';
test('current guest home opens approved welcome then Google OAuth without fake user data',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.phase-screen-2')).toBeVisible();
 await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
 const welcome=page.locator('.phase-screen-2');
 await expect(welcome.getByRole('navigation',{name:/خطوة 1|Step 1/})).toBeVisible();
 await welcome.locator('.phase-start').click();
 await expect(welcome.getByRole('navigation',{name:/خطوة 2|Step 2/})).toBeVisible();
 await welcome.locator('.phase-start').click();
 await expect(welcome.getByRole('navigation',{name:/خطوة 3|Step 3/})).toBeVisible();
 await welcome.locator('.phase-start').click();
 await expect(page.locator('.phase-screen-3')).toBeVisible();
 await page.locator('.phase-screen-3 .phase-role-next').click();
 await expect(page.locator('.phase-screen-4 .phase-google-auth')).toBeVisible();
 await expect(page.getByRole('button',{name:/المتابعة باستخدام جوجل|Continue with Google/})).toBeVisible();
 await expect(page.locator('.phase-screen-5')).toHaveCount(0);
 await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
});
test('real guest search shell saves appearance and survives refresh',async({page})=>{
 await page.goto('/?tab=search');
 await page.evaluate(()=>{localStorage.setItem('language_preference','en');localStorage.setItem('theme_preference','light');});
 await page.reload();
 await expect(page.locator('.d-screen-9')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 // Appearance is now a manual preference in the physical-left menu,
 // not an extra toggle on the original full-screen onboarding or profile.
 await page.getByRole('button',{name:'Open menu'}).click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 await drawer.getByRole('button',{name:'Expand menu'}).click();
 await drawer.getByRole('switch',{name:'Toggle dark mode'}).click();
 await expect(drawer).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
