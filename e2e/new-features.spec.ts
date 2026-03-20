import { test, expect } from '@playwright/test';

// ===========================================================================
// Analytics Page
// ===========================================================================

test.describe('Analytics Page', () => {
  test('loads with heading and three sections', async ({ page }) => {
    await page.goto('/crm/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    // Wait for data
    await expect(page.getByText(/Lead Funnel/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Source Attribution/i)).toBeVisible();
    await expect(page.getByText(/Cohort Funnel/i)).toBeVisible();
  });

  test('shows funnel stage counts', async ({ page }) => {
    await page.goto('/crm/analytics');
    await expect(page.getByText(/Lead Funnel/i)).toBeVisible({ timeout: 10_000 });
    // Should show status labels
    await expect(page.getByText('MATCHED').first()).toBeAttached();
  });

  test('shows source attribution cards', async ({ page }) => {
    await page.goto('/crm/analytics');
    await expect(page.getByText(/Source Attribution/i)).toBeVisible({ timeout: 10_000 });
    // Should show at least one source
    const sources = page.getByText(/CALL|SMS|WEB_FORM|WEB_WAITLIST/);
    expect(await sources.count()).toBeGreaterThan(0);
  });

  test('sidebar has Analytics link', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  });
});

// ===========================================================================
// Lead Detail — New Features
// ===========================================================================

test.describe('Lead Detail — New Features', () => {
  let leadUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/crm');
    await page.waitForSelector('table tbody tr:not(:has-text("Loading"))', { timeout: 15_000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/crm\/leads\/.+/);
    leadUrl = new URL(page.url()).pathname;
    await page.close();
  });

  test('shows engagement score badge', async ({ page }) => {
    await page.goto(leadUrl);
    await page.waitForSelector('text=Back', { timeout: 10_000 });
    // Should show both Score and Engagement badges
    await expect(page.getByText(/Score: \d+/)).toBeVisible();
    await expect(page.getByText(/Engagement: \d+/)).toBeVisible();
  });

  test('shows unified timeline section', async ({ page }) => {
    await page.goto(leadUrl);
    await page.waitForSelector('text=Back', { timeout: 10_000 });
    await expect(page.getByText('Timeline')).toBeVisible();
  });

  test('shows preferred days editor', async ({ page }) => {
    await page.goto(leadUrl);
    await page.waitForSelector('text=Back', { timeout: 10_000 });
    await expect(page.getByText('Preferred Days')).toBeVisible();
    // Should show day buttons
    await expect(page.getByText('Mon').first()).toBeAttached();
  });
});

// ===========================================================================
// Cohort Detail — New Features
// ===========================================================================

test.describe('Cohort Detail — New Features', () => {
  test('shows chat section on cohort detail', async ({ page }) => {
    await page.goto('/crm/cohorts');
    await page.waitForTimeout(2000);

    // Click first cohort
    const firstCohort = page.locator('[cursor=pointer]').first();
    if (await firstCohort.count() > 0) {
      await firstCohort.click();
      await page.waitForURL(/\/crm\/cohorts\/.+/);
      await page.waitForSelector('text=Back', { timeout: 10_000 });

      // Chat section should exist
      await expect(page.getByText(/Cohort Chat/i)).toBeAttached();
    }
  });

  test('shows NPS section on cohort detail', async ({ page }) => {
    await page.goto('/crm/cohorts');
    await page.waitForTimeout(2000);

    const firstCohort = page.locator('[cursor=pointer]').first();
    if (await firstCohort.count() > 0) {
      await firstCohort.click();
      await page.waitForURL(/\/crm\/cohorts\/.+/);
      await page.waitForSelector('text=Back', { timeout: 10_000 });

      await expect(page.getByText(/NPS/i).first()).toBeAttached();
    }
  });
});

// ===========================================================================
// Automations — Analytics Cards
// ===========================================================================

test.describe('Automations — Analytics', () => {
  test('shows analytics summary cards', async ({ page }) => {
    await page.goto('/crm/automations');
    // Wait for automations and analytics to load
    await page.waitForTimeout(3000);
    // Analytics cards should show "Total Sent" labels
    await expect(page.getByText('Total Sent').first()).toBeAttached();
  });
});

// ===========================================================================
// Full Navigation with All New Pages
// ===========================================================================

test.describe('Complete Navigation', () => {
  test('navigate through all pages including analytics', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('heading', { name: /Leads/i })).toBeVisible();

    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();

    await page.getByRole('link', { name: 'Cohorts' }).click();
    await expect(page.getByRole('heading', { name: 'Cohorts' })).toBeVisible();

    await page.getByRole('link', { name: 'Automations' }).click();
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'City Settings' })).toBeVisible();

    await page.getByRole('link', { name: 'Leads' }).click();
    await expect(page.getByRole('heading', { name: /Leads/i })).toBeVisible();
  });
});
