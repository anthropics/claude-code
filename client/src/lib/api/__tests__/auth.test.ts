/**
 * Auth helper tests (P1-13).
 *
 * Uses axios-mock-adapter on an isolated client so we exercise the real
 * request interceptor (CSRF header) and response path.
 */

import MockAdapter from "axios-mock-adapter";
import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import {
	activateAccount,
	completeGoogleOAuth,
	confirmPasswordReset,
	login,
	logout,
	registerAccount,
	requestPasswordReset,
	startGoogleOAuth,
} from "@/lib/api/auth";

function buildClient() {
	const client = createApiClient();
	const mock = new MockAdapter(client);
	mock.onGet("/auth/csrf/").reply(200, { detail: "CSRF cookie set" });
	return { client, mock };
}

describe("auth helpers", () => {
	it("login POSTs email + password to /auth/cookie/create/ after CSRF bootstrap", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/cookie/create/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({
				email: "a@b.com",
				password: "x",
			});
			return [200, { detail: "Login successful" }];
		});

		await login({ email: "a@b.com", password: "x" }, client);
		expect(mock.history.get.some((r) => r.url === "/auth/csrf/")).toBe(true);
		expect(
			mock.history.post.some((r) => r.url === "/auth/cookie/create/"),
		).toBe(true);
	});

	it("logout POSTs to /auth/cookie/logout/", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/cookie/logout/").reply(204);
		await logout(client);
		expect(
			mock.history.post.some((r) => r.url === "/auth/cookie/logout/"),
		).toBe(true);
	});

	it("registerAccount POSTs to /auth/users/", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/users/").reply((config) => {
			const body = JSON.parse(config.data);
			expect(body.username).toBe("alice");
			expect(body.re_password).toBe("secret12");
			return [201, { id: 1 }];
		});

		await registerAccount(
			{
				email: "a@b.com",
				username: "alice",
				first_name: "Alice",
				last_name: "Liddell",
				password: "secret12",
				re_password: "secret12",
			},
			client,
		);
	});

	it("activateAccount POSTs uid + token to /auth/users/activation/", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/users/activation/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({ uid: "U", token: "T" });
			return [204];
		});
		await activateAccount({ uid: "U", token: "T" }, client);
	});

	it("requestPasswordReset + confirmPasswordReset use correct endpoints", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/users/reset_password/").reply(204);
		mock.onPost("/auth/users/reset_password_confirm/").reply((config) => {
			expect(JSON.parse(config.data).new_password).toBe("newpass12");
			return [204];
		});

		await requestPasswordReset({ email: "a@b.com" }, client);
		await confirmPasswordReset(
			{
				uid: "U",
				token: "T",
				new_password: "newpass12",
				re_new_password: "newpass12",
			},
			client,
		);
	});

	it("startGoogleOAuth GETs the provider URL with redirect_uri query", async () => {
		const { client, mock } = buildClient();
		mock.onGet(/\/auth\/o\/google-oauth2\/.*/).reply((config) => {
			expect(config.url).toContain(
				"redirect_uri=https%3A%2F%2Fexample.com%2Fgoogle",
			);
			return [200, { authorization_url: "https://accounts.google.com/xyz" }];
		});

		const result = await startGoogleOAuth("https://example.com/google", client);
		expect(result.authorization_url).toBe("https://accounts.google.com/xyz");
	});

	it("completeGoogleOAuth POSTs state + code and returns user", async () => {
		const { client, mock } = buildClient();
		mock.onPost(/\/auth\/o\/google-oauth2\/cookie\/.*/).reply((config) => {
			expect(config.url).toContain("state=S");
			expect(config.url).toContain("code=C");
			expect(config.headers?.["Content-Type"]).toBe(
				"application/x-www-form-urlencoded",
			);
			return [
				200,
				{
					user: { id: "u1", email: "a@b.com", username: "alice" },
					detail: "ok",
				},
			];
		});

		const res = await completeGoogleOAuth({ state: "S", code: "C" }, client);
		expect(res.user.username).toBe("alice");
	});

	it("login surfaces DRF 401 as thrown AxiosError", async () => {
		const { client, mock } = buildClient();
		mock.onPost("/auth/cookie/create/").reply(401, { detail: "no match" });
		await expect(
			login({ email: "a@b.com", password: "x" }, client),
		).rejects.toThrowError();
	});
});
