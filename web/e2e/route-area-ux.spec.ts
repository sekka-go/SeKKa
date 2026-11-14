import {test,expect} from '@playwright/test';

test('rider district filtering keeps current value and reports missing matches',async({page})=>{
 await page.goto('/?screen=9&preview=phase2');
 const filters=page.locator('.d-area-picker input[type=search]');
 await expect(filters).toHaveCount(2);
 await filters.first().fill('xyz-no-match');
 await expect(page.getByText('مفيش مناطق مطابقة')).toBeVisible();
 await expect(page.locator('.d-area-picker select').first()).toHaveValue('المعادي');
 await filters.first().fill('المعادي');
 await expect(page.locator('.d-area-picker select').first().locator('option[value="المعادي"]')).toHaveCount(1);
});

test('captain preview prevents duplicate stops and supports reordering',async({page})=>{
 await page.goto('/?screen=44&preview=phase6');
 const input=page.getByLabel('اسم النقطة');
 await input.fill('موقف المعادي');
 await page.getByRole('button',{name:'أضف نقطة'}).click();
 await input.fill('موقف المعادي');
 await expect(page.getByText('النقطة دي مضافة بالفعل في نفس المنطقة.')).toBeVisible();
 await expect(page.getByRole('button',{name:'أضف نقطة'})).toBeDisabled();
 await input.fill('محطة مترو المعادي');
 await page.getByRole('button',{name:'أضف نقطة'}).click();
 await expect(page.getByRole('button',{name:'لأسفل'}).first()).toBeEnabled();
 await page.getByRole('button',{name:'لأسفل'}).first().click();
});
