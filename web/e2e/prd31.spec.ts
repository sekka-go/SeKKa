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

test('English device translates onboarding; unsupported device language falls back to Arabic',async({browser})=>{
 const en=await browser.newContext({locale:'en-GB',colorScheme:'light'}),page=await en.newPage();
 const headings=['With you on your commute','With you on your commute','Choose your account type','Enter your mobile number','Enter the verification code','Complete profile','Permissions'];
 for(let n=1;n<=7;n++){
  await page.goto(`/?screen=${n}&inspect=1`);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('main h1')).toHaveText(headings[n-1]);
 }
 await page.goto('/?screen=3');await expect(page.getByRole('radio',{name:/Register as a captain/})).toBeVisible();
 await en.close();
 const fallback=await browser.newContext({locale:'fr-FR'}),other=await fallback.newPage();await other.goto('/?screen=2');
 await expect(other.locator('html')).toHaveAttribute('lang','ar');await expect(other.locator('html')).toHaveAttribute('dir','rtl');await fallback.close();
});

test('manual language changes keep rider draft details and translate account controls',async({page})=>{
 await page.goto('/?screen=32&preview=phase4');await page.getByRole('button',{name:'تعديل بياناتي',exact:true}).click();
 await page.getByLabel('الاسم الكامل',{exact:true}).fill('عبد الرحمن');
 await page.getByRole('button',{name:'الرجوع لحسابي',exact:true}).click();
 await page.getByLabel('language_preference',{exact:true}).selectOption('en');
 await expect(page.getByRole('heading',{name:'My account',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit my details',exact:true}).click();
 await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('عبد الرحمن');
 await page.getByRole('button',{name:'Back to my account',exact:true}).click();
 await page.getByLabel('language_preference',{exact:true}).selectOption('ar');
 await expect(page.getByRole('heading',{name:'حسابي',exact:true})).toBeVisible();
});

test('captain settings persist independent manual choices',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',colorScheme:'dark'}),page=await context.newPage();
 await page.goto('/?screen=60&preview=phase7');
 await page.getByLabel('language_preference',{exact:true}).selectOption('ar');
 await page.getByLabel('theme_preference',{exact:true}).selectOption('light');await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','ar');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByLabel('theme_preference',{exact:true}).selectOption('system');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await context.close();
});

test('interactive preview locks booking terms and persists dual-confirmation security release',async({page})=>{
 await page.goto('/?screen=9&preview=phase2');await page.getByRole('button',{name:'ابحث عن الرحلات',exact:true}).click();
 await page.getByRole('button',{name:/عرض تفاصيل PRIME/}).click();
 await page.getByLabel('نقطة الركوب',{exact:true}).selectOption('maadi');await page.getByLabel('نقطة النزول',{exact:true}).selectOption('tagamoa');
 await page.getByRole('button',{name:'حجز الاشتراك',exact:true}).click();
 await page.getByRole('button',{name:'متابعة لتأمين الحجز',exact:true}).click();
 await page.getByRole('button',{name:'تأكيد الحجز التجريبي وحجز 100 جنيه افتراضية',exact:true}).click();
 await expect(page).toHaveURL(/screen=17/);
 const snapshot=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sekka.preview.bookingLedger.v31')!));
 expect(snapshot.available).toBe(50);expect(snapshot.reserved).toBe(100);expect(snapshot.bookings).toHaveLength(1);
 // Simulate a later edit of the source offer. The confirmed snapshot must stay fixed.
 await page.evaluate(()=>{const offer=JSON.parse(sessionStorage.getItem('sekka.preview.selectedOffer')!);offer.amount=99999;offer.selectedStops.pickup.name='نقطة معدلة';sessionStorage.setItem('sekka.preview.selectedOffer',JSON.stringify(offer));});
 await page.reload();await expect(page.locator('.b-stops')).toContainText('ميدان الجزائر');await expect(page.locator('.b-stops')).not.toContainText('نقطة معدلة');
 await page.getByRole('button',{name:'شوف تفاصيل اشتراكي',exact:true}).click();
 await page.getByRole('button',{name:'تأكيد الدفع',exact:true}).click();
 await page.getByLabel('دفعت للكابتن قيمة الاشتراك كاملة.',{exact:true}).check();await page.getByRole('button',{name:'معاينة متابعة الاستلام',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sekka.preview.bookingLedger.v31')!).reserved)).toBe(100);
 const receiptUrl=page.url();
 await page.goto('/?screen=51&preview=phase7');
 await expect(page.getByText('راكب المعاينة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'تفاصيل الاشتراك',exact:true}).click();
 await expect(page.getByText('نقاط الراكب',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'متابعة تأكيد الاستلام',exact:true}).click();
 await page.getByLabel('أقر باستلام المبلغ الموضح').check();
 await page.getByRole('button',{name:'محاكاة تم الاستلام',exact:true}).click();
 await expect(page.getByRole('button',{name:'محاكاة تم الاستلام',exact:true})).toBeDisabled();
 await page.goto(receiptUrl);await expect(page.locator('.b-status-tag')).toContainText('الكابتن أكد الاستلام');
 const released=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sekka.preview.bookingLedger.v31')!));expect(released.available).toBe(150);expect(released.reserved).toBe(0);expect(released.bookings[0].quote).toEqual(snapshot.bookings[0].quote);
 await expect(page.getByRole('button',{name:'محاكاة تأكيد الكابتن — لا دفع حقيقي',exact:true})).toHaveCount(0);
});

test('favorite sign-in prerequisite returns to its original screen',async({page})=>{
 await page.goto('/?screen=13');
 await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
 await expect(page).toHaveURL(/screen=4/);
 await page.getByRole('button',{name:'ارجع للخطوة السابقة',exact:true}).click();
 await expect(page).toHaveURL(/screen=13/);
 await expect(page.getByRole('heading',{name:'المفضلة',exact:true})).toBeVisible();
});

test('captain draft survives reload and incomplete publication links to its missing step',async({page})=>{
 await page.goto('/?screen=43&preview=phase6');
 await page.getByLabel('وصف الخط',{exact:true}).fill('خط المعادي اليومي');
 await page.getByRole('button',{name:'حفظ المسودة ومتابعة',exact:true}).click();
 await page.getByLabel('اسم النقطة',{exact:true}).fill('ميدان الجزائر');
 await page.reload();await expect(page.getByLabel('اسم النقطة',{exact:true})).toHaveValue('ميدان الجزائر');
 await page.getByLabel('شاشة خطوط الكابتن').selectOption('48');
 await page.getByRole('button',{name:'راجع البيانات الناقصة',exact:true}).click();
 await expect(page).toHaveURL(/screen=44/);
 await page.getByRole('button',{name:'رجوع',exact:true}).click();
 await expect(page.getByLabel('وصف الخط',{exact:true})).toHaveValue('خط المعادي اليومي');
});

test('English wallet preserves amount through failed result and retry',async({browser})=>{
 const context=await browser.newContext({locale:'en-GB'}),page=await context.newPage();
 await page.goto('/?screen=23&preview=phase4');
 await page.getByLabel('Top-up amount in EGP').fill('99');
 await expect(page.getByRole('button',{name:'Preview top-up result'})).toBeDisabled();
 await page.getByLabel('Top-up amount in EGP').fill('240');
 await page.getByRole('button',{name:'Preview top-up result'}).click();
 await page.getByLabel('Preview top-up status').selectOption('failed');
 await page.getByRole('button',{name:'Review top-up amount'}).click();
 await expect(page.getByLabel('Top-up amount in EGP')).toHaveValue('240');
 await context.close();
});
