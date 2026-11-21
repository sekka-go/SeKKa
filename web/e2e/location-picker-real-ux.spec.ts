import {test,expect} from '@playwright/test';
// Exercise touch rather than mouse-only click on narrow Android-like viewport.
test.use({hasTouch:true});
const street='شارع عبد السلام أمين';
const streetRow={
 i:'osm:way:500600700',n:street,a:street,e:'Abdelsalam Amin Street',
 c:'المجاورة 5 · الحي 1 · مدينة 6 أكتوبر',k:'road',
 p:[29.9724456,30.9448074],x:false,os:'way',
 v:['شارع عبد السلام امين','عبد السلام امين','abdelsalam amin street']
};
test.beforeEach(async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem('language_preference','ar'));
 await page.route('**/geo-index/*.json',r=>r.fulfill({json:{version:'ux-regression',results:[streetRow]}}));
});

test('tapping a named street fills the origin without opening a map',async({page})=>{
 await page.goto('/?tab=search&view=9');
 const start=page.getByRole('combobox',{name:'نقطة الانطلاق'});
 await start.fill(street);
 const choice=page.getByRole('option',{name:new RegExp(street)}).first();
 await expect(choice).toBeVisible();
 await expect(choice).not.toContainText('حدد نقطة على الخريطة');
 // Suggestion list must never expose the map shortcut while typing.
 await expect(page.locator('.rs3 .sekka-place-lookup').first().locator('.sekka-place-lookup__map-search')).toHaveCount(0);
 await expect(page.locator('.rs3__optional-map-toggle')).toHaveAttribute('aria-expanded','false');
 await choice.click();
 await expect(start).toHaveValue(street);
 await expect(page.getByText('✓ هنبحث عن أقرب نقاط الكباتن')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toHaveCount(0);
 // Opening the map is always optional and a different action.
 await page.locator('.rs3__optional-map-toggle').click();
 await page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'}).click();
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toBeVisible();
});

test('searching inside map navigates to a real place before explicit pin confirmation',async({page})=>{
 await page.goto('/?tab=search&view=9');
 await page.locator('.rs3__optional-map-toggle').click();
 await page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'}).click();
 const dialog=page.getByRole('dialog',{name:'حدد نقطة على الخريطة'});
 const lookup=dialog.getByRole('combobox',{name:'ابحث داخل الخريطة'});
 await lookup.fill(street);
 const result=dialog.getByRole('option',{name:new RegExp(street)});
 await expect(result).toBeVisible();
 await result.click();
 await expect(dialog.getByText(/وصلنا للمكان/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'تأكيد النقطة'})).toBeDisabled();
 await dialog.locator('.sekka-map-picker__map').click({position:{x:180,y:170}});
 await dialog.getByRole('button',{name:'تأكيد النقطة'}).click();
 await expect(page.getByRole('combobox',{name:'نقطة الانطلاق'})).toHaveValue('نقطة قرب '+street);
});

test('current location control requests device GPS and selects actual location, not map center',async({page,context})=>{
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:29.9724456,longitude:30.9448074,accuracy:18});
 await page.goto('/?tab=search&view=9');
 await page.locator('.rs3__optional-map-toggle').click();
 await page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'}).click();
 const dialog=page.getByRole('dialog',{name:'حدد نقطة على الخريطة'});
 await dialog.getByRole('button',{name:'موقعي الحالي'}).click();
 await expect(dialog.getByText(/تم تحديد موقعك/)).toBeVisible();
 await expect(dialog.getByText(/29\.972446/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'تأكيد النقطة'})).toBeEnabled();
 await dialog.getByRole('button',{name:'تأكيد النقطة'}).click();
 await expect(page.getByRole('combobox',{name:'نقطة الانطلاق'})).toHaveValue('موقعي الحالي');
});

test('denied GPS shows a usable permission message rather than silently centering Cairo',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition:(_ok:unknown,fail:(x:{code:number})=>void)=>fail({code:1})
  }});
 });
 await page.goto('/?tab=search&view=9');
 await page.locator('.rs3__optional-map-toggle').click();
 await page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'}).click();
 const dialog=page.getByRole('dialog',{name:'حدد نقطة على الخريطة'});
 await dialog.getByRole('button',{name:'موقعي الحالي'}).click();
 await expect(dialog.getByText(/اسمح بالوصول للموقع/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'تأكيد النقطة'})).toBeDisabled();
});

test('real touch tap on an autocomplete row cannot retarget to the map button',async({page})=>{
 await page.goto('/?tab=search&view=9');
 const first=page.locator('.rs3 .sekka-place-lookup').first();
 const from=first.getByRole('combobox',{name:'نقطة الانطلاق'});
 await from.fill(street);
 await expect(first.getByRole('option',{name:new RegExp(street)}).first()).toBeVisible();
 await expect(first.locator('.sekka-place-lookup__map-search')).toHaveCount(0);
 await first.getByRole('option',{name:new RegExp(street)}).first().tap();
 await expect(from).toHaveValue(street);
 await expect(first.locator('.sekka-place-lookup__map-search')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toHaveCount(0);
});

test('map mode is a separate two-step opt-in, not a location suggestion action',async({page})=>{
 await page.goto('/?tab=search&view=9');
 const fields=page.locator('.rs3 .sekka-place-lookup');
 await expect(fields.locator('.sekka-place-lookup__map-search')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toHaveCount(0);
 const button=page.locator('.rs3__optional-map-toggle');
 await expect(button).toHaveAttribute('aria-expanded','false');
 await button.click();
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toHaveCount(0);
 await expect(page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'})).toBeVisible();
 await page.locator('.rs3__optional-map-actions').getByRole('button',{name:'حدد الانطلاق على الخريطة'}).click();
 await expect(page.getByRole('dialog',{name:'حدد نقطة على الخريطة'})).toBeVisible();
});
