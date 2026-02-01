/**
 * Content Pipeline E2E Tests
 * Tests the full flow: Transcript → Clips → Drafts
 */
import { test, expect } from './fixtures';
import { SAMPLE_TRANSCRIPT } from './fixtures';

test.describe('Content Pipeline', () => {
  // Helper to create a brand before tests
  async function createBrand(page: any) {
    await page.goto('/brands');
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', `Pipeline Test ${Date.now()}`);
    await page.click('button[type="submit"]:has-text("Create Brand")');
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });
  }

  test.describe('Transcripts', () => {
    test('should display transcripts page', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      await expect(page.locator('h1')).toContainText('Transcripts');
      await expect(page.locator('text=Upload an audio file or paste existing text')).toBeVisible();
    });

    test('should show upload and paste options', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      await expect(page.locator('text=Upload Audio')).toBeVisible();
      await expect(page.locator('text=Paste Text')).toBeVisible();
    });

    test('should create transcript from pasted text', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      // Click paste option
      await page.click('text=Paste Text');

      // Fill in the form
      await page.fill('input[placeholder="Content title"]', 'Test Episode Transcript');
      await page.fill('textarea[placeholder*="Paste your transcript"]', SAMPLE_TRANSCRIPT);

      // Verify word count
      await expect(page.locator('text=/\\d+ words/')).toBeVisible();

      // Submit
      await page.click('button:has-text("Create Transcript")');

      // Wait for success
      await expect(page.locator('text=Transcript created!')).toBeVisible({ timeout: 10000 });

      // Verify transcript appears in list
      await expect(page.locator('text=Test Episode Transcript')).toBeVisible();
    });

    test('should show transcript status badges', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      // Create transcript
      await page.click('text=Paste Text');
      await page.fill('input[placeholder="Content title"]', 'Status Test Transcript');
      await page.fill('textarea[placeholder*="Paste your transcript"]', SAMPLE_TRANSCRIPT);
      await page.click('button:has-text("Create Transcript")');
      await expect(page.locator('text=Transcript created!')).toBeVisible({ timeout: 10000 });

      // Check for status badge
      await expect(page.locator('[class*="badge"], .badge, [data-badge]').first()).toBeVisible();
    });

    test('should show Detect Clips button for ready transcripts', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      // Create transcript
      await page.click('text=Paste Text');
      await page.fill('input[placeholder="Content title"]', 'Clips Test Transcript');
      await page.fill('textarea[placeholder*="Paste your transcript"]', SAMPLE_TRANSCRIPT);
      await page.click('button:has-text("Create Transcript")');
      await expect(page.locator('text=Transcript created!')).toBeVisible({ timeout: 10000 });

      // Should show Detect Clips button (may be disabled depending on backend status)
      await expect(page.locator('button:has-text("Detect Clips"), text=Detect Clips')).toBeVisible();
    });

    test('should cancel paste mode', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/transcripts');

      // Enter paste mode
      await page.click('text=Paste Text');
      await expect(page.locator('textarea[placeholder*="Paste your transcript"]')).toBeVisible();

      // Cancel
      await page.click('button:has-text("Cancel")');

      // Should return to initial state
      await expect(page.locator('text=Upload Audio')).toBeVisible();
      await expect(page.locator('text=Paste Text')).toBeVisible();
    });
  });

  test.describe('Clips', () => {
    test('should display clips page', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/clips');

      await expect(page.locator('h1')).toContainText('Clips');
    });

    test('should show empty state when no clips', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/clips');

      await expect(page.locator('text=No clips to review')).toBeVisible();
    });

    test('should show filter tabs', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/clips');

      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("Pending")')).toBeVisible();
      await expect(page.locator('button:has-text("Approved")')).toBeVisible();
    });
  });

  test.describe('Drafts', () => {
    test('should display drafts page', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/drafts');

      await expect(page.locator('h1')).toContainText('Drafts');
    });

    test('should show empty state when no drafts', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/drafts');

      await expect(page.locator('text=No drafts yet')).toBeVisible();
    });

    test('should show filter tabs', async ({ authenticatedPage: page }) => {
      await createBrand(page);
      await page.goto('/drafts');

      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("In Progress")')).toBeVisible();
      await expect(page.locator('button:has-text("Ready")')).toBeVisible();
    });
  });

  test.describe('Dashboard', () => {
    test('should display dashboard with stats', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('h1')).toContainText('Dashboard');

      // Check for stat cards
      await expect(page.locator('text=Total Transcripts')).toBeVisible();
      await expect(page.locator('text=Clips Generated')).toBeVisible();
      await expect(page.locator('text=Drafts Created')).toBeVisible();
      await expect(page.locator('text=Content Published')).toBeVisible();
    });

    test('should show quick actions', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');

      await expect(page.locator('text=Quick Actions')).toBeVisible();
    });

    test('should navigate to transcripts from dashboard', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');

      // Find and click link to transcripts
      await page.click('a[href="/transcripts"], text=Upload');

      await expect(page).toHaveURL(/\/transcripts/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate through main pages', async ({ authenticatedPage: page }) => {
      // Dashboard
      await page.goto('/dashboard');
      await expect(page.locator('h1')).toContainText('Dashboard');

      // Brands
      await page.click('a[href="/brands"], nav >> text=Brands');
      await expect(page).toHaveURL(/\/brands/);
      await expect(page.locator('h1')).toContainText('Brand');

      // Create brand for other pages
      await page.click('text=New Brand');
      await page.fill('input[placeholder="My Podcast"]', 'Nav Test Brand');
      await page.click('button[type="submit"]:has-text("Create Brand")');
      await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

      // Transcripts
      await page.click('a[href="/transcripts"], nav >> text=Transcripts');
      await expect(page).toHaveURL(/\/transcripts/);
      await expect(page.locator('h1')).toContainText('Transcripts');

      // Clips
      await page.click('a[href="/clips"], nav >> text=Clips');
      await expect(page).toHaveURL(/\/clips/);
      await expect(page.locator('h1')).toContainText('Clips');

      // Drafts
      await page.click('a[href="/drafts"], nav >> text=Drafts');
      await expect(page).toHaveURL(/\/drafts/);
      await expect(page.locator('h1')).toContainText('Drafts');
    });
  });
});

test.describe('Full Pipeline Integration', () => {
  test('should complete transcript to clips workflow', async ({ authenticatedPage: page }) => {
    // 1. Create brand
    await page.goto('/brands');
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', `Integration Test ${Date.now()}`);
    await page.fill('input[placeholder*="Personal development"]', 'Business & Tech');
    await page.click('button[type="submit"]:has-text("Create Brand")');
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // 2. Add voice sample
    await page.fill('textarea[placeholder*="Paste your content"]', SAMPLE_TRANSCRIPT);
    await page.click('button:has-text("Add Sample")');
    await expect(page.locator('text=Sample added!')).toBeVisible({ timeout: 10000 });

    // 3. Create transcript
    await page.goto('/transcripts');
    await page.click('text=Paste Text');
    await page.fill('input[placeholder="Content title"]', 'Integration Test Episode');
    await page.fill('textarea[placeholder*="Paste your transcript"]', SAMPLE_TRANSCRIPT);
    await page.click('button:has-text("Create Transcript")');
    await expect(page.locator('text=Transcript created!')).toBeVisible({ timeout: 10000 });

    // 4. Verify transcript in list
    await expect(page.locator('text=Integration Test Episode')).toBeVisible();

    // 5. Navigate to clips
    await page.goto('/clips');
    await expect(page.locator('h1')).toContainText('Clips');

    // 6. Navigate to drafts
    await page.goto('/drafts');
    await expect(page.locator('h1')).toContainText('Drafts');

    // Pipeline structure verified - actual clip/draft generation requires backend
  });
});
