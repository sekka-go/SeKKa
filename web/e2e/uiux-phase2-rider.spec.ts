import { test, expect } from '@playwright/test';

/**
 * Independent UI/UX audit, PRD v3.1 public rider IDs 8–21.
 * Screenshots are evidence, not approval. Review each image manually.
 * No network services, reservations or real payments are exercised.
 */
const riderScreens = Array.from({ length: 14 }, (_, i) => i + 8);
const widths = [320, 390] as const;
const locales = [{ locale: 'ar-EG', lang: 'ar', dir: 'rtl' }, { locale: 'en-GB', lang: 'en', dir: 'ltr' }] as const;
const themes = ['light', 'dark'] as const;

test('phase 2 rider screen visual evidence and mobile overflow audit', async ({ browser }, testInfo) => {
  test.setTimeout(240000);
  const findings: string[] = [];
  for (const language of locales) {
    for (const theme of themes) {
      for (const width of widths) {
        const context = await browser.newContext({
          locale: language.locale,
          viewport: { width, height: 844 },
          reducedMotion: 'reduce',
          colorScheme: theme,
        });
        await context.addInitScript(({ lang, appearance }) => {
          localStorage.setItem('language_preference', lang);
          localStorage.setItem('theme_preference', appearance);
        }, { lang: language.lang, appearance: theme });
        const page = await context.newPage();
        const exceptions: string[] = [];
        page.on('pageerror', error => exceptions.push(error.message));
        for (const id of riderScreens) {
          const phase = id <= 14 ? 2 : 3;
          await page.goto('/?screen=' + id + '&preview=phase' + phase);
          await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
          await expect(page.locator('html')).toHaveAttribute('dir', language.dir);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const main = page.locator('main').first();
          await expect(main).toBeVisible();
          const heading = main.locator('h1,h2').first();
          if (await heading.count()) await expect(heading).not.toBeEmpty();
          const dimensions = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          if (dimensions.scrollWidth > dimensions.clientWidth + 2) {
            findings.push('Horizontal overflow: screen ' + id + ', ' + language.lang + ', ' + theme +
              ', ' + width + 'px (' + dimensions.scrollWidth + ' > ' + dimensions.clientWidth + ')');
          }
          const unnamed = await main.locator('button').evaluateAll(buttons => buttons
            .filter(button => ![button.getAttribute('aria-label'), button.title, button.textContent]
              .some(value => Boolean(value?.trim())))
            .map(button => button.outerHTML.slice(0, 150)));
          if (unnamed.length) findings.push('Unnamed buttons on screen ' + id + ': ' + unnamed.join(' | '));
          const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
          await testInfo.attach('rider-' + String(id).padStart(2, '0') + '-' + language.lang + '-' +
            theme + '-' + width + '.png', { body: screenshot, contentType: 'image/png' });
        }
        if (exceptions.length) findings.push(language.lang + ' / ' + theme + ' / ' + width +
          ' JS errors: ' + exceptions.join('; '));
        await context.close();
      }
    }
  }
  expect(findings, 'Inspect screenshots even when all automated checks pass').toEqual([]);
});
