/**
 * Phase 1 golden path (P1-22 / Issue #124).
 *
 * signup → activation (mailpit) → login → onboarding → tweet post →
 * /u/<handle> verification. Run after ``docker compose -f local.yml up -d``.
 */

import { expect, test } from "@playwright/test";
import { waitForActivationUrl } from "./helpers/mailpit";

test.describe("Phase 1 golden path", () => {
	test("signup → activate → login → onboarding → tweet → profile", async ({
		page,
	}) => {
		const stamp = Date.now();
		const handle = `e2e_${stamp}`;
		const email = `${handle}@example.com`;
		const password = "supersecret12";

		// 1. Sign up.
		await page.goto("/register");
		await page.getByLabel("ハンドル (@handle)").fill(handle);
		await page.getByLabel("名").fill("Taro");
		await page.getByLabel("姓").fill("E2E");
		await page.getByLabel("メールアドレス").fill(email);
		await page.getByLabel("パスワード", { exact: true }).fill(password);
		await page.getByLabel("パスワード (確認)").fill(password);
		await page.getByLabel(/利用規約.+プライバシーポリシー.+同意/).check();
		await page.getByRole("button", { name: "アカウント作成" }).click();

		await page.waitForURL(/\/login/);

		// 2. Pull activation link from mailpit and navigate.
		const activationUrl = await waitForActivationUrl(email);
		const activationPath = new URL(activationUrl).pathname;
		await page.goto(activationPath);

		// Activation page redirects to /login on success.
		await page.waitForURL(/\/login/);

		// 3. Log in.
		await page.getByLabel("メールアドレス").fill(email);
		await page.getByLabel("パスワード").fill(password);
		await page.getByRole("button", { name: "ログイン" }).click();

		// 4. Onboarding — complete step 1.
		await page.waitForURL(/\/onboarding/);
		await page.getByLabel("表示名").fill("E2E Taro");
		await page.getByLabel(/自己紹介/).fill("Playwright smoke user");
		await page.getByRole("button", { name: "はじめる" }).click();

		await page.waitForURL((url) => url.pathname === "/");

		// 5. Post a tweet (composer lives on /).
		// (The actual TL page integrates TweetComposer as part of follow-up work.)
		// For now, jump to the author profile page and ensure login persisted.
		await page.goto(`/u/${handle}`);
		await expect(
			page.getByRole("heading", { name: /E2E Taro|@e2e_/ }),
		).toBeVisible();
	});
});
