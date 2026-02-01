/**
 * Authentication E2E Tests
 */
import { test, expect } from '@playwright/test';
import { generateTestUser, waitForToast } from './fixtures';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('h2, [role="heading"]').filter({ hasText: 'Sign in' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('should display register page', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('h2, [role="heading"]').filter({ hasText: 'Create an account' })).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/auth/login');

    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('text=Invalid email')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation errors on empty register', async ({ page }) => {
    await page.goto('/auth/register');

    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('text=Name is required')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between login and register', async ({ page }) => {
    // Start at login
    await page.goto('/auth/login');
    await expect(page).toHaveURL('/auth/login');

    // Click sign up link
    await page.click('text=Sign up');
    await expect(page).toHaveURL('/auth/register');

    // Click sign in link
    await page.click('text=Sign in');
    await expect(page).toHaveURL('/auth/login');
  });

  test('should show password mismatch error', async ({ page }) => {
    await page.goto('/auth/register');

    const user = generateTestUser();
    await page.fill('input[name="fullName"]', user.fullName);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', 'different-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Passwords don\'t match')).toBeVisible({ timeout: 5000 });
  });

  test('should enforce minimum password length', async ({ page }) => {
    await page.goto('/auth/register');

    const user = generateTestUser();
    await page.fill('input[name="fullName"]', user.fullName);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', 'short');
    await page.fill('input[name="confirmPassword"]', 'short');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=at least 8 characters')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth Layout', () => {
  test('should display branding on large screens', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/auth/login');

    // Check for branding content
    await expect(page.locator('text=Creator Studio')).toBeVisible();
    await expect(page.locator('text=Record once')).toBeVisible();
  });
});
