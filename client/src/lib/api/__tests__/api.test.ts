/**
 * axios wrapper tests (P1-13a / Issue #114).
 *
 * Covers:
 * - Request interceptor: CSRF double-submit cookie → X-CSRFToken header
 * - Response interceptor: 401 → refresh → retry, pending queue, redirect
 *
 * axios-mock-adapter is installed on the axios *instance* returned by
 * createApiClient, so we exercise the real interceptor chain.
 */

import MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, ensureCsrfToken } from "@/lib/api/client";

const REFRESH_URL = "/auth/cookie/refresh/";

function setCookie(name: string, value: string): void {
	document.cookie = `${name}=${value}; Path=/`;
}

describe("createApiClient — CSRF request interceptor", () => {
	afterEach(() => {
		document.cookie = "csrftoken=; Path=/; Max-Age=0";
	});

	it("adds X-CSRFToken header to unsafe methods when csrftoken cookie exists", async () => {
		setCookie("csrftoken", "token-abc");
		const client = createApiClient();
		const mock = new MockAdapter(client);

		const seen: Record<string, string | undefined> = {};
		mock.onPost("/tweets/").reply((config) => {
			seen.csrf = config.headers?.["X-CSRFToken"] as string | undefined;
			return [201, { id: 1 }];
		});

		await client.post("/tweets/");
		expect(seen.csrf).toBe("token-abc");
	});

	it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
		"adds X-CSRFToken on %s",
		async (method) => {
			setCookie("csrftoken", "t1");
			const client = createApiClient();
			const mock = new MockAdapter(client);

			let seen: string | undefined;
			mock.onAny("/x").reply((config) => {
				seen = config.headers?.["X-CSRFToken"] as string | undefined;
				return [200, {}];
			});

			await client.request({ url: "/x", method });
			expect(seen).toBe("t1");
		},
	);

	it("does NOT add X-CSRFToken on GET (safe method)", async () => {
		setCookie("csrftoken", "t1");
		const client = createApiClient();
		const mock = new MockAdapter(client);

		let seen: unknown;
		mock.onGet("/x").reply((config) => {
			seen = config.headers?.["X-CSRFToken"];
			return [200, {}];
		});

		await client.get("/x");
		expect(seen).toBeUndefined();
	});

	it("omits X-CSRFToken when csrftoken cookie is absent", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);

		let seen: unknown;
		mock.onPost("/x").reply((config) => {
			seen = config.headers?.["X-CSRFToken"];
			return [201, {}];
		});

		await client.post("/x");
		expect(seen).toBeUndefined();
	});

	it("URL-decodes csrftoken cookie value", async () => {
		setCookie("csrftoken", encodeURIComponent("a b+c"));
		const client = createApiClient();
		const mock = new MockAdapter(client);

		let seen: unknown;
		mock.onPost("/x").reply((config) => {
			seen = config.headers?.["X-CSRFToken"];
			return [201, {}];
		});

		await client.post("/x");
		expect(seen).toBe("a b+c");
	});
});

describe("createApiClient — 401 → refresh → retry", () => {
	it("retries the original request after a successful refresh", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);

		let first = true;
		mock.onGet("/users/me/").reply(() => {
			if (first) {
				first = false;
				return [401, { detail: "expired" }];
			}
			return [200, { id: "u1" }];
		});
		mock.onPost(REFRESH_URL).reply(200, { detail: "refreshed" });

		const res = await client.get("/users/me/");
		expect(res.status).toBe(200);
		expect(res.data).toEqual({ id: "u1" });
	});

	it("collapses multiple concurrent 401s into a single refresh call", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);

		let refreshCount = 0;
		const firstTry: Record<string, boolean> = {};
		mock.onGet(/\/resource\/\d+/).reply((config) => {
			const key = config.url ?? "";
			if (!firstTry[key]) {
				firstTry[key] = true;
				return [401, { detail: "expired" }];
			}
			return [200, { url: key }];
		});
		mock.onPost(REFRESH_URL).reply(() => {
			refreshCount += 1;
			// Delay to make the pending-queue behavior observable.
			return new Promise((resolve) => {
				setTimeout(() => resolve([200, { detail: "refreshed" }]), 10);
			});
		});

		const results = await Promise.all([
			client.get("/resource/1"),
			client.get("/resource/2"),
			client.get("/resource/3"),
			client.get("/resource/4"),
			client.get("/resource/5"),
		]);

		expect(refreshCount).toBe(1);
		for (const r of results) {
			expect(r.status).toBe(200);
		}
	});

	it("calls onUnauthorized and rejects when refresh fails", async () => {
		const onUnauthorized = vi.fn();
		const client = createApiClient({ onUnauthorized });
		const mock = new MockAdapter(client);

		mock.onGet("/x").reply(401, { detail: "expired" });
		mock.onPost(REFRESH_URL).reply(401, { detail: "refresh expired" });

		await expect(client.get("/x")).rejects.toThrowError();
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("does NOT loop when the refresh endpoint itself returns 401", async () => {
		const onUnauthorized = vi.fn();
		const client = createApiClient({ onUnauthorized });
		const mock = new MockAdapter(client);

		mock.onPost(REFRESH_URL).reply(401, { detail: "refresh expired" });

		await expect(client.post(REFRESH_URL)).rejects.toThrowError();
		// Once for the outer 401; no infinite loop.
		expect(mock.history.post.filter((r) => r.url === REFRESH_URL)).toHaveLength(
			1,
		);
	});

	it("does not retry on non-401 errors", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);

		mock.onGet("/x").reply(500, { detail: "boom" });
		const refreshSpy = vi.fn(() => [200, { detail: "ok" }] as [number, object]);
		mock.onPost(REFRESH_URL).reply(refreshSpy);

		await expect(client.get("/x")).rejects.toThrowError();
		expect(refreshSpy).not.toHaveBeenCalled();
	});

	it("retries the original request only once per failure", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);

		// Always 401 — but since refresh succeeds, the retry's 401 must not
		// trigger another refresh/retry loop.
		mock.onGet("/x").reply(401, { detail: "expired" });
		let refreshCount = 0;
		mock.onPost(REFRESH_URL).reply(() => {
			refreshCount += 1;
			return [200, { detail: "refreshed" }];
		});

		await expect(client.get("/x")).rejects.toThrowError();
		expect(refreshCount).toBe(1);
	});
});

describe("ensureCsrfToken", () => {
	it("GETs /auth/csrf/ on the provided client", async () => {
		const client = createApiClient();
		const mock = new MockAdapter(client);
		mock.onGet("/auth/csrf/").reply(200, { detail: "CSRF cookie set" });

		await ensureCsrfToken(client);
		expect(mock.history.get.some((r) => r.url === "/auth/csrf/")).toBe(true);
	});
});

describe("createApiClient — configuration", () => {
	it("uses the provided baseURL", () => {
		const client = createApiClient({ baseURL: "/custom" });
		expect(client.defaults.baseURL).toBe("/custom");
	});

	it("defaults to /api/v1 baseURL", () => {
		const client = createApiClient();
		expect(client.defaults.baseURL).toBe("/api/v1");
	});

	it("sends credentials (cookies) with every request", () => {
		const client = createApiClient();
		expect(client.defaults.withCredentials).toBe(true);
	});
});
