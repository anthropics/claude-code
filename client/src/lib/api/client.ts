/**
 * axios wrapper for the SPA (P1-13a / Issue #114).
 *
 * Foundation for every Frontend Issue that calls the Django API. Responsibilities:
 *
 * 1. Cookie JWT transport: `withCredentials: true` so the browser attaches the
 *    ``access`` / ``refresh`` HttpOnly cookies set by ``/auth/cookie/create/``.
 * 2. CSRF Double-Submit Cookie: read ``csrftoken`` cookie on unsafe methods and
 *    mirror its value into the ``X-CSRFToken`` header. The Django side
 *    (``CSRFEnforcingAuthentication`` / ``CookieAuthentication``) enforces that
 *    the header matches the cookie. See ADR-0003 + apps/common/cookie_auth.py.
 * 3. 401 → refresh → retry: on access-token expiry, call
 *    ``POST /auth/cookie/refresh/`` exactly once, retry the original request.
 *    Concurrent 401s share a single in-flight refresh promise (pending queue)
 *    so we never stampede the refresh endpoint. Refresh failure invokes the
 *    caller-supplied ``onUnauthorized`` handler (typically redirect to /login).
 *
 * This module runs in the browser. For Server Components, use
 * ``@/lib/api/server`` which forwards ``cookies()`` from ``next/headers`` into
 * a one-shot ``fetch`` — axios and interceptors would not help there because
 * Server Components cannot redirect the browser or share a refresh promise.
 */

import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from "axios";

const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const REFRESH_URL = "/auth/cookie/refresh/";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_BASE_URL = "/api/v1";

export interface CreateApiClientOptions {
	baseURL?: string;
	/**
	 * Called exactly once when a refresh attempt fails. Typical use is
	 * redirecting the browser to /login. No-op by default in non-browser
	 * contexts (SSR, tests without window).
	 */
	onUnauthorized?: () => void;
}

type RetriedRequestConfig = InternalAxiosRequestConfig & {
	_p1_13a_retried?: boolean;
};

function readCookie(name: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	const needle = `${encodeURIComponent(name)}=`;
	for (const raw of document.cookie.split(";")) {
		const part = raw.trim();
		if (part.startsWith(needle)) {
			return decodeURIComponent(part.slice(needle.length));
		}
	}
	return undefined;
}

function isRefreshRequest(config: AxiosRequestConfig | undefined): boolean {
	return Boolean(config?.url && config.url.endsWith(REFRESH_URL));
}

/**
 * Create a configured axios instance. Use the default export ``api`` unless
 * tests / server-side helpers need an isolated instance with its own mock
 * adapter or onUnauthorized handler.
 */
export function createApiClient(
	options: CreateApiClientOptions = {},
): AxiosInstance {
	const instance = axios.create({
		baseURL: options.baseURL ?? DEFAULT_BASE_URL,
		withCredentials: true,
		xsrfCookieName: undefined,
		xsrfHeaderName: undefined,
	});

	instance.interceptors.request.use((config) => {
		const method = (config.method ?? "get").toUpperCase();
		if (UNSAFE_METHODS.has(method)) {
			const token = readCookie(CSRF_COOKIE_NAME);
			if (token) {
				config.headers.set(CSRF_HEADER_NAME, token);
			}
		}
		return config;
	});

	let inflightRefresh: Promise<void> | null = null;

	const refreshOnce = (): Promise<void> => {
		if (!inflightRefresh) {
			inflightRefresh = instance
				.post(REFRESH_URL)
				.then(() => undefined)
				.finally(() => {
					inflightRefresh = null;
				});
		}
		return inflightRefresh;
	};

	instance.interceptors.response.use(
		(response) => response,
		async (error: AxiosError) => {
			const original = error.config as RetriedRequestConfig | undefined;
			const status = error.response?.status;

			if (!original || status !== 401) throw error;
			if (original._p1_13a_retried) throw error;
			if (isRefreshRequest(original)) throw error;

			original._p1_13a_retried = true;

			try {
				await refreshOnce();
			} catch {
				options.onUnauthorized?.();
				throw error;
			}

			return instance.request(original);
		},
	);

	return instance;
}

/**
 * Default browser-side singleton. Redirects to /login on refresh failure.
 */
export const api: AxiosInstance = createApiClient({
	onUnauthorized: () => {
		if (typeof window === "undefined") return;
		if (window.location.pathname.startsWith("/login")) return;
		window.location.href = "/login";
	},
});

/**
 * Bootstrap helper: call once on app load (e.g., from a client-only root
 * effect or before the first unsafe request) to seed the csrftoken cookie.
 * Safe to call repeatedly — Django re-emits the same cookie via
 * ``@ensure_csrf_cookie``.
 */
export async function ensureCsrfToken(
	client: AxiosInstance = api,
): Promise<void> {
	await client.get("/auth/csrf/");
}
