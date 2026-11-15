import {test,expect} from '@playwright/test';

test('live captain route page never offers unauthenticated publishing',async({page})=>{
 await page.goto('/?screen=42');
 await expect(page.getByText('إنشاء مسودة خط حقيقية')).toHaveCount(0);
 await expect(page.locator('button').filter({hasText:'نشر'})).toHaveCount(0);
 await expect(page.locator('.captain-routes-canvas')).toBeVisible();
});

test('Google auth replaces OTP entry when no backend env configured',async({page})=>{
 await page.goto('/?screen=4');
 await expect(page.getByText('الدخول بجوجل',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'المتابعة باستخدام جوجل'})).toBeDisabled();
 await expect(page.getByText('هنبعت لك كود تأكيد على موبايلك.')).toHaveCount(0);
});
