import {test,expect} from '@playwright/test';
test('PWA manifest installs at mobile root and worker never caches user data',async({page,request})=>{
 const response=await request.get('/manifest.webmanifest');
 expect(response.ok()).toBe(true);
 const manifest=await response.json();
 expect(manifest.start_url).toBe('/');
 expect(manifest.scope).toBe('/');
 expect(manifest.display).toBe('standalone');
 expect(manifest.icons?.length).toBeGreaterThan(0);
 for(const icon of manifest.icons){
  const image=await request.get(icon.src);
  expect(image.ok(),`Missing PWA icon ${icon.src}`).toBe(true);
  expect(image.headers()['content-type']).toContain('image/');
 }
 const worker=await request.get('/sw.js');
 expect(worker.ok()).toBe(true);
 const code=await worker.text();
 expect(code).toContain("req.mode==='navigate'");
 expect(code).toContain("url.pathname.startsWith('/assets/')");
 await page.goto('/');
 await expect(page.locator('.sekka-mobile')).toBeVisible();
 await expect(page.locator('.phase-preview-note')).toHaveCount(0);
});
test('guest app supports browser Back/Forward between real tabs',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:/Main navigation|التنقل الرئيسي/}).getByRole('button',{name:/Search|بحث/}).click();
 await expect(page).toHaveURL(/tab=search/);
 await page.getByRole('navigation',{name:/Main navigation|التنقل الرئيسي/}).getByRole('button',{name:/Bookings|حجوزاتي/}).click();
 await expect(page).toHaveURL(/tab=bookings/);
 await page.goBack();
 await expect(page).toHaveURL(/tab=search/);
 await expect(page.getByRole('heading',{name:/Find a route|دور على خط/})).toBeVisible();
 await page.goForward();
 await expect(page).toHaveURL(/tab=bookings/);
});
