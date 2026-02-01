/**
 * Brand & Voice E2E Tests
 */
import { test, expect } from './fixtures';
import { SAMPLE_TRANSCRIPT } from './fixtures';

test.describe('Brand Management', () => {
  test('should display brands page with create option', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    await expect(page.locator('h1')).toContainText('Brand & Voice');
    await expect(page.locator('text=New Brand')).toBeVisible();
  });

  test('should create a new brand', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    // Click new brand button
    await page.click('text=New Brand');

    // Fill in brand form
    await page.fill('input[placeholder="My Podcast"]', 'Test Podcast');
    await page.selectOption('select', 'growth');
    await page.fill('input[placeholder*="Personal development"]', 'Tech & Business');
    await page.fill('textarea[placeholder*="Describe your ideal"]', 'Young professionals interested in tech startups');

    // Submit
    await page.click('button[type="submit"]:has-text("Create Brand")');

    // Wait for success
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // Verify brand appears
    await expect(page.locator('text=Test Podcast')).toBeVisible();
  });

  test('should show brand details after creation', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    // Create a brand first
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', 'Detail Test Brand');
    await page.selectOption('select', 'monetize');
    await page.fill('input[placeholder*="Personal development"]', 'Marketing');
    await page.click('button[type="submit"]:has-text("Create Brand")');

    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // Verify brand info card
    await expect(page.locator('text=Detail Test Brand')).toBeVisible();
    await expect(page.locator('text=monetize')).toBeVisible();
    await expect(page.locator('text=Marketing')).toBeVisible();
  });

  test('should add content sample', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    // Create brand first
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', 'Sample Test Brand');
    await page.click('button[type="submit"]:has-text("Create Brand")');
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // Add content sample
    await page.fill('input[placeholder="Sample title"]', 'Episode 1 Transcript');
    await page.fill('textarea[placeholder*="Paste your content"]', SAMPLE_TRANSCRIPT);

    // Verify word count
    await expect(page.locator('text=/\\d+ words/')).toBeVisible();

    // Add sample
    await page.click('button:has-text("Add Sample")');

    // Wait for success
    await expect(page.locator('text=Sample added!')).toBeVisible({ timeout: 10000 });

    // Verify sample appears in list
    await expect(page.locator('text=Episode 1 Transcript')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  test('should show voice profile section', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    // Create brand
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', 'Voice Test Brand');
    await page.click('button[type="submit"]:has-text("Create Brand")');
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // Verify voice profile card exists
    await expect(page.locator('text=Voice Profile')).toBeVisible();
    await expect(page.locator('text=Add content samples and learn your voice')).toBeVisible();
  });

  test('should show Learn Voice button when samples exist', async ({ authenticatedPage: page }) => {
    await page.goto('/brands');

    // Create brand
    await page.click('text=New Brand');
    await page.fill('input[placeholder="My Podcast"]', 'Learn Voice Test');
    await page.click('button[type="submit"]:has-text("Create Brand")');
    await expect(page.locator('text=Brand created!')).toBeVisible({ timeout: 10000 });

    // Add sample
    await page.fill('textarea[placeholder*="Paste your content"]', SAMPLE_TRANSCRIPT);
    await page.click('button:has-text("Add Sample")');
    await expect(page.locator('text=Sample added!')).toBeVisible({ timeout: 10000 });

    // Verify Learn Voice button is enabled
    const learnButton = page.locator('button:has-text("Learn Voice")');
    await expect(learnButton).toBeVisible();
    await expect(learnButton).toBeEnabled();
  });
});
