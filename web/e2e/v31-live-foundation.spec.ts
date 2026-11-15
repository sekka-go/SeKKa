import {test,expect} from '@playwright/test';
test.use({locale:'ar-EG'});

test('live captain route page never offers unauthenticated publishing',async({page})=>{
 await page.goto('/?screen=42');
 await expect(page.getByText('إنشاء مسودة خط حقيقية')).toHaveCount(0);
 await expect(page.locator('button').filter({hasText:'نشر'})).toHaveCount(0);
 await expect(page.getByRole('alert')).toContainText('سجّل دخولك أو اعمل حساب');
 await expect(page.getByRole('button',{name:'تسجيل الدخول أو إنشاء حساب كابتن'})).toBeVisible();
});

test('Google auth is available on existing phone entry without backend env',async({page})=>{
 await page.goto('/?screen=4');
 await expect(page.getByRole('heading')).toBeVisible();
 await expect(page.getByRole('button',{name:'المتابعة باستخدام جوجل'})).toBeDisabled();
 await expect(page.getByText('هنبعت لك كود تأكيد على موبايلك.')).toHaveCount(0);
});
