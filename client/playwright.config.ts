import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration (P1-22 / Issue #124).
 *
 * Runs the Phase 1 golden path: signup → activation (via mailpit) → login →
 * onboarding → tweet post → profile verification. The configuration assumes
 * an already-running stack:
 *
 *   docker compose -f local.yml up -d   # starts api (:8000), client (:3000),
 *                                       # mailpit (:8025), postgres, redis
 *
 * ``PLAYWRIGHT_BASE_URL`` / ``PLAYWRIGHT_MAILPIT_URL`` override the defaults
 * so the same spec runs against stg after P1-23.
 */
export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
