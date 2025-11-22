import { test, expect } from '@playwright/test';

const ADMIN_BASE = process.env.ADMIN_BASE_URL || 'http://localhost:3003';

test.describe('Admin smoke', () => {
  test('open key pages', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await expect(page).toHaveURL(/dashboard/);

    // Click through sidebar where possible
    await page.getByText('Radna snaga').click();
    await expect(page).toHaveURL(/workforce/);
    await page.getByText('Command Center').click();
    await expect(page).toHaveURL(/command-center/);
    await page.getByText('Prijem').click();
    await expect(page).toHaveURL(/receiving/);
    await page.getByText('Otprema').click();
    await expect(page).toHaveURL(/shipping/);
    await page.getByText('Zalihe & Popis').click();
    await expect(page).toHaveURL(/stock/);
    await page.getByText('Etikete').click();
    await expect(page).toHaveURL(/labeling/);
    await page.getByText('SLA usklađenost').click();
    await expect(page).toHaveURL(/sla/);
    await page.getByText('KPI Dashboard').click();
    await expect(page).toHaveURL(/kpi/);
    await page.getByText('Mapa skladišta').click();
    await expect(page).toHaveURL(/warehouse-map/);
  });
});
