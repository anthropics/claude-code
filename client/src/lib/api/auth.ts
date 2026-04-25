/**
 * Auth-related API helpers built on the axios wrapper (P1-13).
 *
 * Thin, testable wrappers over djoser + apps.users cookie endpoints so UI
 * components don't need to remember URLs or orchestrate CSRF bootstrapping.
 * All functions:
 *
 *   - take a pre-configured ``AxiosInstance`` (default: ``api`` singleton).
 *   - throw the underlying AxiosError so callers can pipe it into
 *     ``parseDrfErrors`` for setError / toast.
 *   - call ``ensureCsrfToken`` before unsafe methods so the first POST does
 *     not 403 on a cold Cookie jar.
 */

import type { AxiosInstance } from "axios";
import { api, ensureCsrfToken } from "@/lib/api/client";

export interface LoginPayload {
	email: string;
	password: string;
}

export interface RegisterPayload {
	email: string;
	username: string;
	first_name: string;
	last_name: string;
	password: string;
	re_password: string;
}

export interface ActivationPayload {
	uid: string;
	token: string;
}

export interface ResetPasswordPayload {
	email: string;
}

export interface ResetPasswordConfirmPayload extends ActivationPayload {
	new_password: string;
	re_new_password: string;
}

async function withCsrf<T>(
	client: AxiosInstance,
	fn: () => Promise<T>,
): Promise<T> {
	await ensureCsrfToken(client);
	return fn();
}

export async function login(
	payload: LoginPayload,
	client: AxiosInstance = api,
): Promise<void> {
	await withCsrf(client, () => client.post("/auth/cookie/create/", payload));
}

export async function logout(client: AxiosInstance = api): Promise<void> {
	await withCsrf(client, () => client.post("/auth/cookie/logout/"));
}

export async function registerAccount(
	payload: RegisterPayload,
	client: AxiosInstance = api,
): Promise<void> {
	await withCsrf(client, () => client.post("/auth/users/", payload));
}

export async function activateAccount(
	payload: ActivationPayload,
	client: AxiosInstance = api,
): Promise<void> {
	await withCsrf(client, () => client.post("/auth/users/activation/", payload));
}

export async function requestPasswordReset(
	payload: ResetPasswordPayload,
	client: AxiosInstance = api,
): Promise<void> {
	await withCsrf(client, () =>
		client.post("/auth/users/reset_password/", payload),
	);
}

export async function confirmPasswordReset(
	payload: ResetPasswordConfirmPayload,
	client: AxiosInstance = api,
): Promise<void> {
	await withCsrf(client, () =>
		client.post("/auth/users/reset_password_confirm/", payload),
	);
}

export interface GoogleOAuthCompletePayload {
	state: string;
	code: string;
}

/**
 * Complete the Google OAuth handshake. The caller must first send the user to
 * Google's authorization URL (obtained from ``GET /auth/o/google-oauth2/?redirect_uri=...``)
 * and then pass the ``state`` + ``code`` returned to the redirect_uri back
 * here. Returns the authenticated user payload on success.
 */
export async function completeGoogleOAuth(
	{ state, code }: GoogleOAuthCompletePayload,
	client: AxiosInstance = api,
): Promise<{ user: { id: string; email: string; username: string } }> {
	const params = new URLSearchParams({ state, code });
	const res = await withCsrf(client, () =>
		client.post<{ user: { id: string; email: string; username: string } }>(
			`/auth/o/google-oauth2/cookie/?${params.toString()}`,
			null,
			{
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		),
	);
	return res.data;
}

/**
 * Fetch the Google authorization URL from djoser. Frontend sets
 * ``window.location.href`` to the returned URL to begin the handshake.
 */
export async function startGoogleOAuth(
	redirectUri: string,
	client: AxiosInstance = api,
): Promise<{ authorization_url: string }> {
	const params = new URLSearchParams({ redirect_uri: redirectUri });
	const res = await client.get<{ authorization_url: string }>(
		`/auth/o/google-oauth2/?${params.toString()}`,
	);
	return res.data;
}
