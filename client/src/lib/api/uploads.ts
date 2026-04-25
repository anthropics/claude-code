/**
 * Avatar / header image upload orchestration (P1-15 / Issue #116).
 *
 * Flow:
 *  1. Client validates the selected file (size / type) and lets the user
 *     crop via ``react-easy-crop`` (``ImageCropper`` component).
 *  2. Client re-encodes the crop to WebP on ``canvas.toBlob``.
 *  3. Call ``POST /users/me/{kind}-upload-url/`` to obtain a pre-signed PUT URL.
 *  4. ``PUT`` the Blob directly to S3 (no proxy through Django).
 *  5. ``PATCH /users/me/`` with the returned ``public_url`` so the stored
 *     profile points at the new asset.
 *
 * Everything is kept in this module so the UI component can stay a thin shell.
 */

import type { AxiosInstance } from "axios";
import { api, ensureCsrfToken } from "@/lib/api/client";

export type UploadKind = "avatar" | "header";

export interface PresignedUpload {
	upload_url: string;
	object_key: string;
	expires_at: string;
	public_url: string;
}

export interface RequestPresignPayload {
	kind: UploadKind;
	contentType: "image/webp" | "image/jpeg" | "image/png";
	contentLength: number;
}

/**
 * Ask the backend for a pre-signed S3 PUT URL. Throws the AxiosError on
 * 400/403/429 so callers can surface DRF validation messages.
 */
export async function requestPresignedUpload(
	{ kind, contentType, contentLength }: RequestPresignPayload,
	client: AxiosInstance = api,
): Promise<PresignedUpload> {
	await ensureCsrfToken(client);
	const res = await client.post<PresignedUpload>(
		`/users/me/${kind}-upload-url/`,
		{
			content_type: contentType,
			content_length: contentLength,
		},
	);
	return res.data;
}

/**
 * Upload a Blob to an S3 presigned URL. Uses plain ``fetch`` because S3 PUT
 * must NOT send cookies or CSRF headers (they would fail the SigV4 signature).
 */
export async function putToPresignedUrl(
	uploadUrl: string,
	blob: Blob,
	contentType: string,
): Promise<void> {
	const res = await fetch(uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": contentType },
		body: blob,
		// Deliberately no credentials — signed URL is the auth.
		credentials: "omit",
		mode: "cors",
	});
	if (!res.ok) {
		throw new Error(`S3 upload failed with ${res.status}`);
	}
}

/**
 * Confirm the uploaded asset URL against the profile. Returns the updated
 * user payload so the SPA can refresh local state.
 */
export async function persistAvatarUrl(
	kind: UploadKind,
	publicUrl: string,
	client: AxiosInstance = api,
): Promise<unknown> {
	await ensureCsrfToken(client);
	const field = kind === "avatar" ? "avatar_url" : "header_url";
	const res = await client.patch("/users/me/", { [field]: publicUrl });
	return res.data;
}

/**
 * End-to-end upload that ties the three steps together. Returns the final
 * public URL so the caller can optimistically update UI state.
 */
export async function uploadImage(
	kind: UploadKind,
	blob: Blob,
	client: AxiosInstance = api,
): Promise<string> {
	const contentType = (blob.type || "image/webp") as
		| "image/webp"
		| "image/jpeg"
		| "image/png";
	const presigned = await requestPresignedUpload(
		{ kind, contentType, contentLength: blob.size },
		client,
	);
	await putToPresignedUrl(presigned.upload_url, blob, contentType);
	await persistAvatarUrl(kind, presigned.public_url, client);
	return presigned.public_url;
}
