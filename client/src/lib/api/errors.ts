/**
 * DRF / djoser error normalization (P1-13).
 *
 * Django REST Framework returns validation errors in several shapes depending
 * on the endpoint and the serializer field:
 *
 *   {"detail": "Invalid credentials"}                        — top-level string
 *   {"non_field_errors": ["Passwords do not match"]}          — serializer-wide
 *   {"email": ["Enter a valid email"], "password": ["..."]}   — per field
 *   {"uid": ["Invalid token"], "token": ["Invalid token"]}    — activation
 *
 * This module flattens all three into ``FormErrors`` so react-hook-form can
 * call ``setError(name, ...)`` in one loop, and exposes a summary string for
 * toast / aria-live announcements.
 */

import type { AxiosError } from "axios";

export interface FormErrors {
	/** Top-level message shown near the submit button. */
	summary?: string;
	/** Per-field messages keyed by serializer field name. */
	fields: Record<string, string>;
}

const NON_FIELD_KEYS = new Set(["non_field_errors", "detail"]);

/**
 * Flatten a DRF / djoser error response into ``FormErrors``. Robust against
 * unknown shapes (returns an empty ``fields`` map with a generic summary).
 */
export function parseDrfErrors(error: unknown): FormErrors {
	const data = extractResponseData(error);
	const fields: Record<string, string> = {};
	let summary: string | undefined;

	if (typeof data === "string") {
		return { summary: data, fields };
	}

	if (data && typeof data === "object") {
		for (const [key, value] of Object.entries(data)) {
			const msg = firstString(value);
			if (!msg) continue;
			if (NON_FIELD_KEYS.has(key)) {
				summary = summary ?? msg;
			} else {
				fields[key] = msg;
			}
		}
	}

	if (!summary) {
		if (Object.keys(fields).length > 0) {
			// Pick the first field error as the summary so toast / aria-live has
			// *something* to speak without duplicating what inline errors show.
			summary = Object.values(fields)[0];
		} else {
			summary = fallbackMessageForStatus(extractStatus(error));
		}
	}

	return { summary, fields };
}

function extractResponseData(error: unknown): unknown {
	if (!error || typeof error !== "object") return error;
	const axiosLike = error as AxiosError;
	if (axiosLike.response && "data" in axiosLike.response) {
		return axiosLike.response.data;
	}
	// Fallback to any `.data` property (older shims / fetch wrappers).
	return (error as { data?: unknown }).data ?? undefined;
}

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") return undefined;
	const axiosLike = error as AxiosError;
	return axiosLike.response?.status;
}

function firstString(value: unknown): string | undefined {
	if (typeof value === "string") return value || undefined;
	if (Array.isArray(value)) {
		for (const entry of value) {
			const s = firstString(entry);
			if (s) return s;
		}
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value)) {
			const s = firstString(entry);
			if (s) return s;
		}
	}
	return undefined;
}

function fallbackMessageForStatus(status: number | undefined): string {
	switch (status) {
		case 400:
			return "入力内容を確認してください。";
		case 401:
			return "メールアドレスまたはパスワードが正しくありません。";
		case 403:
			return "この操作を行う権限がありません。";
		case 404:
			return "リソースが見つかりません。";
		case 429:
			return "しばらく時間をおいてから再度お試しください。";
		case undefined:
			return "ネットワークエラーが発生しました。接続を確認してください。";
		default:
			if (status >= 500)
				return "サーバーエラーが発生しました。時間をおいて再度お試しください。";
			return "想定外のエラーが発生しました。";
	}
}
