import { test, expect } from '@playwright/test';

async function loadSample(page) {
  await page.getByRole('button', { name: 'Load sample' }).click();
  await expect(page.locator('.status.success')).toContainText('Sample records loaded');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Custom Labels Generator' })).toBeVisible();
});

test('loads sample records and updates production dashboard metrics', async ({ page }) => {
  await loadSample(page);

  const metrics = page.locator('.production-kpi');
  await expect(metrics).toHaveCount(4);
  await expect(metrics.nth(0)).toContainText('3');
  await expect(metrics.nth(1)).toContainText('3');
  await expect(page.locator('.production-check').nth(0)).toContainText('3 records loaded');
  await expect(page.locator('.production-check').nth(1)).toContainText('Label design');
  await expect(page.locator('.production-check').nth(2)).toContainText('labels fit per sheet');
});

test('imports a CSV and previews the imported student records', async ({ page }) => {
  const csv = [
    'Student Name,Reg No,City',
    'Regression Student,RG-001,Delhi',
    'Second Student,RG-002,Noida'
  ].join('\n');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'regression-students.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  await expect(page.locator('.status.success')).toContainText('2 records loaded');
  await expect(page.locator('.production-kpi').nth(0)).toContainText('2');
  await expect(page.locator('.preview-grid .label').first()).toContainText('Regression Student');
});

test('custom line layout renders the expected address content', async ({ page }) => {
  await loadSample(page);
  await page.getByLabel('Use custom line layout').check();

  const firstLabel = page.locator('.preview-grid .label').first();
  await expect(firstLabel).toContainText('Aashima Aggarwal');
  await expect(firstLabel).toContainText('Address:');
  await expect(firstLabel).toContainText('Mo.');
});

test('saves and reapplies a label template', async ({ page }) => {
  await loadSample(page);
  await page.getByPlaceholder('Template name (e.g. Student address)').fill('Regression Template');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.locator('.status.success')).toContainText('Template "Regression Template" saved');

  const customLayout = page.getByLabel('Use custom line layout');
  await customLayout.check();
  await page.getByLabel('Saved templates').selectOption({ label: 'Regression Template' });
  await page.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(customLayout).not.toBeChecked();
  await expect(page.locator('.status.success')).toContainText('Template "Regression Template" applied');
});

test('adds, duplicates and deletes design pages without losing the active page', async ({ page }) => {
  await loadSample(page);

  const pageName = page.getByLabel('Design page name');
  await page.locator('.design-pages-toolbar').getByRole('button', { name: 'Add page' }).click();
  await expect(pageName).toHaveValue('Design 2');

  await page.locator('.design-pages-toolbar').getByRole('button', { name: 'Duplicate' }).click();
  await expect(pageName).toHaveValue('Design 2 copy');

  await page.locator('.design-pages-toolbar').getByRole('button', { name: 'Delete' }).click();
  await expect(pageName).toHaveValue('Design 2');
  await expect(page.getByLabel('Active design page').locator('option')).toHaveCount(2);
});

test('persists independent page margins into the browser print rule', async ({ page }) => {
  await loadSample(page);
  await page.getByLabel('Right margin (mm)').fill('5.4');
  await page.getByLabel('Left margin (mm)').fill('4.2');

  await expect.poll(() => page.locator('#label-page-rule').evaluate(style => style.textContent || '')).toContain('12mm 5.4mm 12mm 4.2mm');
});

test('blocks print when the label grid exceeds the printable page area', async ({ page }) => {
  await loadSample(page);
  await page.getByLabel('Label width (mm)').fill('110');
  await page.locator('.header-actions').getByRole('button', { name: 'Print all' }).click();

  await expect(page.locator('.status.error')).toContainText('exceeds the printable area');
});

test('updates batch totals when queued design copies change', async ({ page }) => {
  await loadSample(page);
  await expect(page.locator('.print-queue-item')).toHaveCount(1);

  await page.getByRole('button', { name: 'Add to print queue' }).click();
  await expect(page.locator('.print-queue-item')).toHaveCount(2);

  await page.locator('.print-queue-item').nth(1).locator('.quantity-control input').fill('2');
  await expect(page.locator('.production-kpi').nth(1)).toContainText('9');
  await expect(page.locator('.production-kpi').nth(3)).toContainText('2 / 2');
});

test('starter student design generates its QR code preview', async ({ page }) => {
  await loadSample(page);
  await page.locator('.starter-library').getByRole('button', { name: 'Student', exact: true }).click();

  await expect(page.locator('.preview-grid .qr-image').first()).toBeVisible();
  await expect(page.locator('.preview-grid .code-error')).toHaveCount(0);
});

test('exports the current label design to a PDF download', async ({ page }) => {
  await loadSample(page);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.header-actions').getByRole('button', { name: 'Export PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('custom-labels.pdf');
  await expect(page.locator('.status.success')).toContainText('3 labels across 1 print sheets exported to PDF');
});

test('mobile viewport keeps workflow navigation usable without page overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'This layout assertion is specific to the mobile browser project.');
  await loadSample(page);

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  const workflow = page.locator('.workflow-nav');
  await expect(workflow).toBeVisible();
  await expect(workflow).toHaveCSS('overflow-x', 'auto');
  await expect(workflow.locator('button')).toHaveCount(4);
});
