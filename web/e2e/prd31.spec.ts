import {test,expect} from '@playwright/test';
test.use({locale:'ar-EG'});
import {viewIds,canonicalTitles,internalScreen,publicScreen} from '../src/v2/screenMap';
test('v3.1 registry has exactly 73 unique reversible screen identifiers',()=>{
 expect(viewIds).toHaveLength(73);expect(canonicalTitles).toHaveLength(73);expect(new Set(viewIds).size).toBe(73);
 for(let n=1;n<=73;n++)expect(publicScreen(internalScreen(n))).toBe(n);
 expect(publicScreen(13)).toBe(18);
});
test('73 guest entries render without client exceptions',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(let n=1;n<=73;n++){await page.goto(`/?screen=${n}`);await expect(page.locator('main')).toBeVisible();await expect(page.locator('main h1,main h2').first()).not.toBeEmpty();}expect(errors).toEqual([]);
});
test('no-results request reuses search, prevents duplicate confirmation and direct entry',async({page})=>{
 await page.goto('/?screen=9&preview=phase2');
 await expect(page.getByRole('button',{name:'اطلب رحلة',exact:true})).toHaveCount(0);
 await page.getByLabel('من أين؟',{exact:true}).selectOption('الدقي');await page.getByLabel('إلى أين؟',{exact:true}).selectOption('المهندسين');
 await page.getByRole('button',{name:'ابحث عن الرحلات',exact:true}).click();
 await page.getByRole('button',{name:'اطلب رحلة',exact:true}).click();await expect(page).toHaveURL(/screen=14/);
 await expect(page.locator('.d-request')).toContainText('الدقي');await expect(page.locator('.d-request')).toContainText('المهندسين');
 await expect(page.locator('.d-request select,.d-request input')).toHaveCount(0);
 await page.getByRole('button',{name:'تأكيد الطلب',exact:true}).click();await expect(page.getByRole('button',{name:'تم تأكيد الطلب في المعاينة',exact:true})).toBeDisabled();
 await page.goto('/?screen=14&preview=phase2');await expect(page.getByRole('button',{name:'تأكيد الطلب',exact:true})).toHaveCount(0);
});
test('matching offers hide request and ordered stops carry to summary',async({page})=>{
 await page.goto('/?screen=9&preview=phase2');await page.getByRole('button',{name:'ابحث عن الرحلات',exact:true}).click();
 await expect(page.locator('.d-result')).toHaveCount(1);await expect(page.getByRole('button',{name:'اطلب رحلة',exact:true})).toHaveCount(0);
 await expect(page.locator('.d-result')).not.toContainText('كابتن أحمد');await page.getByRole('button',{name:/عرض تفاصيل PRIME/}).click();
 await expect(page.getByRole('button',{name:'حجز الاشتراك',exact:true})).toBeDisabled();
 await page.getByLabel('نقطة الركوب',{exact:true}).selectOption('maadi');await page.getByLabel('نقطة النزول',{exact:true}).selectOption('tagamoa');
 await expect(page.getByRole('combobox')).toHaveCount(3);
 await page.getByRole('button',{name:'حجز الاشتراك',exact:true}).click();await expect(page).toHaveURL(/screen=15/);
 await expect(page.locator('.b-stops')).toContainText('ميدان الجزائر');await expect(page.locator('.b-stops')).toContainText('شارع التسعين');
});
test('device preferences, manual override, persistence, independence and return to system',async({browser})=>{
 const context=await browser.newContext({locale:'ar-EG',colorScheme:'dark'}),page=await context.newPage();
 await page.goto('/?screen=32&preview=phase4');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByLabel('theme_preference',{exact:true}).selectOption('light');await page.getByLabel('language_preference',{exact:true}).selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('dir','ltr');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page).toHaveURL(/screen=32/);
 await page.reload();await expect(page.getByLabel('theme_preference',{exact:true})).toHaveValue('light');await expect(page.getByLabel('language_preference',{exact:true})).toHaveValue('en');
 await page.getByLabel('theme_preference',{exact:true}).selectOption('system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.getByLabel('language_preference',{exact:true}).selectOption('system');await expect(page.locator('html')).toHaveAttribute('lang','ar');await context.close();
});
test('captain route preview enforces approval and capacity before local publication',async({page})=>{
 await page.goto('/?screen=43&preview=phase6');await page.getByLabel('وصف الخط',{exact:true}).fill('خط صباحي تجريبي');
 await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 for(const [name,area] of [['ميدان الجزائر','المعادي'],['شارع التسعين','التجمع']]){
  await page.getByLabel('اسم النقطة',{exact:true}).fill(name);await page.getByLabel('المنطقة',{exact:true}).selectOption(area);await page.getByRole('button',{name:'أضف نقطة',exact:true}).click();
 }
 await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 await page.getByLabel('مسار العودة يدعم نفس النقاط بالترتيب العكسي.').check();await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 await page.getByLabel('المقاعد المعروضة',{exact:true}).fill('4');await page.getByLabel('سعر العرض الذي تحدده — جنيه',{exact:true}).fill('2800');await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 await page.getByLabel('محاكاة حساب كابتن معتمد',{exact:true}).check();await expect(page.getByRole('button',{name:'نشر في المعاينة',exact:true})).toBeDisabled();
 await page.getByLabel('شاشة خطوط الكابتن').selectOption('47');await page.getByLabel('المقاعد المعروضة',{exact:true}).fill('3');await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 await page.getByRole('button',{name:'نشر في المعاينة',exact:true}).click();await expect(page).toHaveURL(/screen=49/);await expect(page.getByRole('button',{name:'إيقاف الحجوزات الجديدة في المعاينة'})).toBeEnabled();
});
