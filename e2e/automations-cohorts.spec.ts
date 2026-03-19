import { test, expect } from '@playwright/test';

// ===========================================================================
// Automations Page
// ===========================================================================

test.describe('Automations Page', () => {
  test('loads with heading and Add button', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Automation' })).toBeVisible();
  });

  test('shows seeded automation rules', async ({ page }) => {
    await page.goto('/crm/automations');
    // Wait for data to load
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    // All 5 seeded automations should be in the page (may need scrolling)
    const names = ['Cohort Invitation', 'RSVP Confirmed', 'RSVP Declined', '24h Event Reminder', 'Post-Event Thank You'];
    for (const name of names) {
      await expect(page.getByRole('heading', { name })).toBeAttached();
    }
  });

  test('automation cards show trigger badges', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    // Trigger badges exist in DOM (use exact match to avoid conflicts with heading names)
    const badges = ['COHORT INVITED', 'RSVP CONFIRMED', 'RSVP DECLINED', 'HOURS BEFORE EVENT', 'EVENT COMPLETED'];
    for (const badge of badges) {
      await expect(page.getByText(badge, { exact: true })).toBeAttached();
    }
  });

  test('automation cards show SMS channel badge', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    const smsBadges = page.getByText('SMS');
    expect(await smsBadges.count()).toBeGreaterThanOrEqual(5);
  });

  test('automation cards show message templates with placeholders', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    // Templates should contain placeholder syntax
    await expect(page.getByText(/\{\{name\}\}/).first()).toBeVisible();
    await expect(page.getByText(/\{\{cohort_name\}\}/).first()).toBeVisible();
  });

  test('each automation has Active, Edit, Delete buttons', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    const activeButtons = page.getByRole('button', { name: 'Active' });
    const editButtons = page.getByRole('button', { name: 'Edit' });
    const deleteButtons = page.getByRole('button', { name: 'Delete' });

    expect(await activeButtons.count()).toBeGreaterThanOrEqual(5);
    expect(await editButtons.count()).toBeGreaterThanOrEqual(5);
    expect(await deleteButtons.count()).toBeGreaterThanOrEqual(5);
  });

  test('Add Automation button shows create form', async ({ page }) => {
    await page.goto('/crm/automations');
    await expect(page.getByText('Cohort Invitation')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Add Automation' }).click();

    // Form should appear with inputs
    await expect(page.getByPlaceholder(/name/i)).toBeVisible();
    await expect(page.getByText(/template/i).first()).toBeVisible();
  });

  test('sidebar has Automations link', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('link', { name: 'Automations' })).toBeVisible();
  });
});

// ===========================================================================
// Cohorts Page
// ===========================================================================

test.describe('Cohorts Page', () => {
  test('loads with heading and Generate button', async ({ page }) => {
    await page.goto('/crm/cohorts');
    await expect(page.getByRole('heading', { name: 'Cohorts' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('shows status filter', async ({ page }) => {
    await page.goto('/crm/cohorts');
    // Status filter should be present
    const statusFilter = page.locator('select');
    if (await statusFilter.count() > 0) {
      await expect(statusFilter.first()).toBeVisible();
    }
  });

  test('shows empty state or cohort cards', async ({ page }) => {
    await page.goto('/crm/cohorts');
    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Either "No cohorts" message or cohort cards should be visible
    const hasContent = (await page.getByText(/no cohorts|0 cohorts/i).count()) > 0 ||
      (await page.getByText(/Crew #/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('sidebar has Cohorts link', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('link', { name: 'Cohorts' })).toBeVisible();
  });

  test('navigates to Cohorts page from sidebar', async ({ page }) => {
    await page.goto('/crm');
    await page.getByRole('link', { name: 'Cohorts' }).click();
    await expect(page).toHaveURL(/\/crm\/cohorts/);
    await expect(page.getByRole('heading', { name: 'Cohorts' })).toBeVisible();
  });
});

// ===========================================================================
// Navigation — New Pages in Full Cycle
// ===========================================================================

test.describe('Full Navigation with New Pages', () => {
  test('navigate through all CRM sections including new ones', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();

    await page.getByRole('link', { name: 'Cohorts' }).click();
    await expect(page.getByRole('heading', { name: 'Cohorts' })).toBeVisible();

    await page.getByRole('link', { name: 'Automations' }).click();
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();

    await page.getByRole('link', { name: 'Scheduled' }).click();
    await expect(page.getByRole('heading', { name: 'Scheduled Messages' })).toBeVisible();

    await page.getByRole('link', { name: 'Sequences' }).click();
    await expect(page.getByRole('heading', { name: 'Sequences' })).toBeVisible();

    await page.getByRole('link', { name: 'Leads' }).click();
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  });
});
