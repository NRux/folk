// Requires Playwright and its Chromium browser. No editorial writes or signup submissions.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [375, 390, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      for (const route of ['/', '/new-orleans-second-line', '/archive', '/about', '/subscribe']) {
        await page.goto((process.env.FOLKLY_VERIFY_ORIGIN || 'https://www.folkly.com') + route);
        assert(await page.locator('main').isVisible());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${route}`);
        if (route !== '/subscribe') {
          await page.locator('nav .subscribe-button').click();
          await page.waitForURL('**/subscribe');
          assert(await page.locator('#email').isVisible());
        }
      }
      await page.close();
    }
    console.log('Mobile reader passed at 375, 390, and 768 pixels.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
