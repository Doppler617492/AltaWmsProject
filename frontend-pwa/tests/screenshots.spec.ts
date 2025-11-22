import { test, expect } from '@playwright/test';

async function authenticate(page) {
  // assumes token already exists or this is a public route; add auth if needed
}

test.describe('PWA screenshots', () => {
  test('Home /pwa/home', async ({ page }) => {
    await page.goto('/pwa/home');
    await page.screenshot({ path: 'screenshots/pwa-home.png', fullPage: true });
  });

  test('Receiving list /pwa/receiving', async ({ page }) => {
    await page.goto('/pwa/receiving');
    await page.screenshot({ path: 'screenshots/pwa-receiving-list.png', fullPage: true });
  });

  test('Receiving work /pwa/receiving/:id (best effort)', async ({ page }) => {
    // If you know a test id, set PWA_DOC_ID env var; otherwise, this test will be skipped
    const docId = process.env.PWA_DOC_ID;
    test.skip(!docId, 'PWA_DOC_ID not provided');
    if (!docId) return;
    await page.goto(`/pwa/receiving/${docId}`);
    await page.screenshot({ path: 'screenshots/pwa-receiving-work.png', fullPage: true });
  });
});

