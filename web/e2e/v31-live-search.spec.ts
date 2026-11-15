import {test,expect} from '@playwright/test';
test.use({locale:'ar-EG'});

test('live rider results fail safely without Supabase browser configuration',async({page})=>{
 await page.goto('/dev/screens?screen=11');
 await expect(page.getByText('البحث الحقيقي محتاج ربط إعدادات Supabase العامة.')).toBeVisible();
 await expect(page.locator('.d-live-search .d-box')).toHaveCount(0);
 await expect(page.getByText('لسه مفيش خطوط منشورة مطابقة لنقط الركوب والنزول ومواعيدك.')).toBeVisible();
});

test('phase two demo remains isolated from live Supabase results',async({page})=>{
 await page.goto('/dev/screens?screen=11&preview=phase2');
 await expect(page.locator('.d-live-search')).toHaveCount(0);
 await expect(page.locator('.d-results-summary')).toBeVisible();
});
