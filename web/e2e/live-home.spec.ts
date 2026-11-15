import {test,expect} from '@playwright/test';
test('real default home offers Google sign-in rather than mock profile',async({page})=>{
 await page.goto('/?screen=8');
 await expect(page.getByRole('heading',{name:/سِكّة|seKKa/}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:/تسجيل الدخول|Sign in/}).first()).toBeVisible();
 await expect(page.getByText(/حقيقية|real account/).first()).toBeVisible();
});
test('real home theme preference is saved',async({page})=>{
 await page.goto('/?screen=8&oauth_theme=light&oauth_language=en');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Switch to dark'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
