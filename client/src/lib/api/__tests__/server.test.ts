/**
 * Server-side fetch helper tests (P1-13a / Issue #114).
 *
 * ``next/headers`` requires a Next.js server context to work for real, so we
 * mock it with vitest. We stub global ``fetch`` per test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiServerError, serverFetch } from "@/lib/api/server";

const cookiesMock = vi.fn();
vi.mock("next/headers", () => ({
	cookies: () => ({
		getAll: cookiesMock,
	}),
}));

describe("serverFetch", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		cookiesMock.mockReturnValue([
			{ name: "access", value: "ACC" },
			{ name: "refresh", value: "REF" },
			{ name: "csrftoken", value: "CSRF123" },
		]);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.clearAllMocks();
	});

	it("forwards cookies from next/headers into the fetch", async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: "u1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		globalThis.fetch = fetchSpy as unknown as typeof fetch;

		await serverFetch("/users/me/", { baseURL: "http://api:8000/api/v1" });

		expect(fetchSpy).toHaveBeenCalledOnce();
		const [, init] = fetchSpy.mock.calls[0]!;
		expect(init.headers.cookie).toBe(
			"access=ACC; refresh=REF; csrftoken=CSRF123",
		);
	});

	it("returns the parsed JSON body on 2xx", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ handle: "alice" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		) as unknown as typeof fetch;

		const data = await serverFetch<{ handle: string }>("/users/me/");
		expect(data).toEqual({ handle: "alice" });
	});

	it("returns null for 204 No Content", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(null, { status: 204 }),
			) as unknown as typeof fetch;

		const data = await serverFetch("/auth/cookie/logout/", { method: "POST" });
		expect(data).toBeNull();
	});

	it("throws ApiServerError with parsed body on non-2xx", async () => {
		const makeResponse = () =>
			new Response(JSON.stringify({ detail: "forbidden" }), {
				status: 403,
				headers: { "content-type": "application/json" },
			});
		globalThis.fetch = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(makeResponse()),
			) as unknown as typeof fetch;

		await expect(serverFetch("/users/me/")).rejects.toBeInstanceOf(
			ApiServerError,
		);
		try {
			await serverFetch("/users/me/");
		} catch (err) {
			const e = err as ApiServerError;
			expect(e.status).toBe(403);
			expect(e.body).toEqual({ detail: "forbidden" });
		}
	});

	it("falls back to text body when content-type is not JSON", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response("plain bad gateway", {
				status: 502,
				headers: { "content-type": "text/plain" },
			}),
		) as unknown as typeof fetch;

		try {
			await serverFetch("/x");
			throw new Error("should have thrown");
		} catch (err) {
			const e = err as ApiServerError;
			expect(e.status).toBe(502);
			expect(e.body).toBe("plain bad gateway");
		}
	});

	it("omits cookie header when there are no cookies to forward", async () => {
		cookiesMock.mockReturnValue([]);
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		globalThis.fetch = fetchSpy as unknown as typeof fetch;

		await serverFetch("/public/");

		const [, init] = fetchSpy.mock.calls[0]!;
		expect(init.headers.cookie).toBeUndefined();
	});

	it("respects a custom baseURL and merges custom headers", async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		globalThis.fetch = fetchSpy as unknown as typeof fetch;

		await serverFetch("/users/me/", {
			baseURL: "https://api.example.test/api/v1",
			headers: { "X-Request-Id": "r-1" },
		});

		const [url, init] = fetchSpy.mock.calls[0]!;
		expect(url).toBe("https://api.example.test/api/v1/users/me/");
		expect(init.headers["X-Request-Id"]).toBe("r-1");
		expect(init.headers.accept).toBe("application/json");
	});
});
