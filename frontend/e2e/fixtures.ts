/**
 * E2E Test Fixtures and Helpers
 */
import { test as base, expect, Page } from '@playwright/test';

// Generate unique test data
export const generateTestUser = () => ({
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  fullName: 'Test User',
});

// Test content samples
export const SAMPLE_TRANSCRIPT = `
Welcome back to the show everyone. Today we're going to talk about something that I think
is really transforming how creators build their businesses online.

The shift we're seeing is massive. Content creators are no longer just making videos or
podcasts - they're building entire ecosystems. Think about it: you have your main content,
then you repurpose it into social clips, newsletter content, blog posts, and more.

The problem is, doing all of this manually is exhausting. You record a one-hour podcast,
and then you spend another three hours cutting it up, writing show notes, creating tweets...
it's not sustainable.

That's exactly why AI-powered content tools are becoming essential. They can take your
long-form content and intelligently extract the most shareable moments. They learn your
voice and style so the output actually sounds like you.

I've been experimenting with this approach for the past few months, and let me tell you -
the time savings are real. What used to take me a full day now takes about an hour.

But here's the key insight: these tools aren't replacing creativity. They're amplifying it.
You still need great ideas. You still need to show up authentically. The AI just handles
the tedious parts.

So if you're a creator who feels stretched thin, this is definitely something to explore.
Start small - maybe just use it for generating social clips from your main content.
See how it feels. Then expand from there.

Alright, that's it for today. Don't forget to subscribe if you found this helpful.
See you in the next one!
`.trim();

// Custom test fixture with auth helper
export interface TestFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Check if we have stored auth state
    const user = generateTestUser();

    // Register new user
    await page.goto('/auth/register');
    await page.fill('input[name="fullName"]', user.fullName);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await use(page);
  },
});

export { expect };

// Helper to wait for toast message
export async function waitForToast(page: Page, message: string) {
  await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
}

// Helper to fill form field by label
export async function fillField(page: Page, label: string, value: string) {
  const field = page.locator(`label:has-text("${label}") + input, label:has-text("${label}") ~ input`);
  await field.fill(value);
}
