import {test,expect} from '@playwright/test';
test('Passenger can open the real map with empty search and confirm a Cairo pin on mobile',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem('language_preference','ar'));
 await page.goto('/?tab=search&view=9');
 const form=page.locator('.rs3');
 await expect(form).toBeVisible();
 const button=form.getByRole('button',{name:/اختيار من الخريطة/}).first();
 await expect(button).toBeEnabled();
 await button.click();
 const dialog=page.getByRole('dialog',{name:'حدد نقطة على الخريطة'});
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('.sekka-map-picker__map')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'تأكيد النقطة'})).toBeDisabled();
 await dialog.locator('.sekka-map-picker__map').click({position:{x:180,y:170}});
 await expect(dialog.getByRole('button',{name:'تأكيد النقطة'})).toBeEnabled();
 await dialog.getByRole('button',{name:'تأكيد النقطة'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(form.getByRole('combobox',{name:'نقطة الانطلاق'})).toHaveValue('نقطة محددة على الخريطة');
 await expect(form.getByText('✓ نقطة محددة على الخريطة')).toBeVisible();
});
test('A guest may close the map without replacing the current text',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('language_preference','ar'));
 await page.goto('/?tab=search&view=9');
 const form=page.locator('.rs3');
 await expect(form).toBeVisible();
 const from=form.getByRole('combobox',{name:'نقطة الانطلاق'});
 await from.fill('الحي الأول');
 // Dismiss typed suggestions before explicitly opting in to map mode.
 await form.getByRole('combobox',{name:'نقطة الانطلاق'}).press('Tab');
 await form.getByRole('button',{name:/اختيار من الخريطة/}).first().click();
 const dialog=page.getByRole('dialog',{name:'حدد نقطة على الخريطة'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'إغلاق الخريطة'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(from).toHaveValue('الحي الأول');
});
