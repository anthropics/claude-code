/**
 * Server-side fetch helper for React Server Components (P1-13a / Issue #114).
 *
 * Unlike the browser axios instance, Server Components cannot use the document
 * cookie jar or redirect on 401. This helper does the narrow job of forwarding
 * the incoming request's cookies (read via ``next/headers``) to the Django API
 * over a single ``fetch``. No interceptors, no refresh, no retry — if the
 * access token is expired, let the RSC return whatever default (or 401 flag)
 * is appropriate and surface that to the client layout, which will handle the
 * refresh through the axios client and rerender.
 *
 * Why not reuse axios here? Axios's node adapter can be used server-side, but
 * (a) we do not want cross-request sharing of the refresh promise (which the
 * browser singleton intentionally does), and (b) RSC code must use
 * ``next/headers`` to read per-request cookies; wrapping that in an axios
 * interceptor muddles the single-responsibility boundary.
 */

import { cookies } from "next/headers";

const DEFAULT_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api:8000/api/v1";

export class ApiServerError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, body: unknown, message?: string) {
		super(message ?? `API request failed with ${status}`);
		this.name = "ApiServerError";
		this.status = status;
		this.body = body;
	}
}

// eslint-disable-next-line no-undef
type FetchInit = RequestInit;

export interface ServerFetchInit extends Omit<FetchInit, "headers"> {
	headers?: Record<string, string>;
	/**
	 * Override the base URL (defaults to NEXT_PUBLIC_API_BASE_URL or the
	 * in-cluster Django host). Tests and edge cases that must target a
	 * different origin can pass this.
	 */
	baseURL?: string;
}

function buildCookieHeader(): string {
	// next/headers#cookies() is available in Server Components and Route
	// Handlers. In a Client Components context this import would fail at
	// build time — that is intentional.
	const jar = cookies();
	return jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
}

async function readBodySafely(res: Response): Promise<unknown> {
	const contentType = res.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		return res.json().catch(() => null);
	}
	return res.text().catch(() => "");
}

/**
 * Fetch JSON from the Django API while forwarding the caller's cookies.
 * Throws {@link ApiServerError} on non-2xx so RSC can branch on status.
 */
export async function serverFetch<T = unknown>(
	path: string,
	init: ServerFetchInit = {},
): Promise<T> {
	const { baseURL, headers, ...rest } = init;
	const url = `${baseURL ?? DEFAULT_BASE_URL}${path}`;
	const cookieHeader = buildCookieHeader();

	const res = await fetch(url, {
		...rest,
		headers: {
			accept: "application/json",
			...(cookieHeader ? { cookie: cookieHeader } : {}),
			...(headers ?? {}),
		},
		// RSC data should never be cached across requests by the Next runtime —
		// user-scoped data must re-fetch each render.
		cache: "no-store",
	});

	if (!res.ok) {
		throw new ApiServerError(res.status, await readBodySafely(res));
	}

	// 204 No Content — return null cast to T since callers should not read a body.
	if (res.status === 204) {
		return null as unknown as T;
	}

	return (await res.json()) as T;
}
