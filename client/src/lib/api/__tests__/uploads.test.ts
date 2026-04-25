/**
 * Upload orchestration tests (P1-15).
 */

import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import {
	persistAvatarUrl,
	putToPresignedUrl,
	requestPresignedUpload,
	uploadImage,
} from "@/lib/api/uploads";

function stubClient() {
	const client = createApiClient();
	const mock = new MockAdapter(client);
	mock.onGet("/auth/csrf/").reply(200, { detail: "CSRF cookie set" });
	return { client, mock };
}

describe("requestPresignedUpload", () => {
	it("POSTs content_type + content_length and returns presigned result", async () => {
		const { client, mock } = stubClient();
		mock.onPost("/users/me/avatar-upload-url/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({
				content_type: "image/webp",
				content_length: 1024,
			});
			return [
				200,
				{
					upload_url: "https://s3/PUT",
					object_key: "users/1/avatar/u.webp",
					expires_at: "2026-04-24T01:00:00+00:00",
					public_url: "https://cdn/u.webp",
				},
			];
		});

		const result = await requestPresignedUpload(
			{ kind: "avatar", contentType: "image/webp", contentLength: 1024 },
			client,
		);
		expect(result.public_url).toBe("https://cdn/u.webp");
	});
});

describe("putToPresignedUrl", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("PUTs without credentials and the given content-type", async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 200 }));
		globalThis.fetch = fetchSpy as unknown as typeof fetch;

		await putToPresignedUrl(
			"https://s3/PUT",
			new Blob(["abc"], { type: "image/webp" }),
			"image/webp",
		);

		const [url, init] = fetchSpy.mock.calls[0]!;
		expect(url).toBe("https://s3/PUT");
		expect(init.method).toBe("PUT");
		expect(init.headers["Content-Type"]).toBe("image/webp");
		expect(init.credentials).toBe("omit");
	});

	it("throws when S3 responds non-2xx", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(null, { status: 403 }),
			) as unknown as typeof fetch;

		await expect(
			putToPresignedUrl("https://s3/PUT", new Blob(["a"]), "image/webp"),
		).rejects.toThrow(/403/);
	});
});

describe("persistAvatarUrl", () => {
	it("PATCHes /users/me/ with avatar_url", async () => {
		const { client, mock } = stubClient();
		mock.onPatch("/users/me/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({
				avatar_url: "https://cdn/u.webp",
			});
			return [200, { avatar_url: "https://cdn/u.webp" }];
		});

		await persistAvatarUrl("avatar", "https://cdn/u.webp", client);
	});

	it("PATCHes header_url when kind is header", async () => {
		const { client, mock } = stubClient();
		mock.onPatch("/users/me/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({
				header_url: "https://cdn/h.webp",
			});
			return [200, { header_url: "https://cdn/h.webp" }];
		});

		await persistAvatarUrl("header", "https://cdn/h.webp", client);
	});
});

describe("uploadImage orchestration", () => {
	const originalFetch = globalThis.fetch;
	beforeEach(() => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(null, { status: 200 }),
			) as unknown as typeof fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("chains presign → S3 PUT → PATCH and returns public_url", async () => {
		const { client, mock } = stubClient();
		mock.onPost("/users/me/avatar-upload-url/").reply(200, {
			upload_url: "https://s3/PUT",
			object_key: "users/1/avatar/u.webp",
			expires_at: "2026-04-24T01:00:00+00:00",
			public_url: "https://cdn/u.webp",
		});
		mock.onPatch("/users/me/").reply(200, {
			avatar_url: "https://cdn/u.webp",
		});

		const result = await uploadImage(
			"avatar",
			new Blob(["abcd"], { type: "image/webp" }),
			client,
		);
		expect(result).toBe("https://cdn/u.webp");
		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://s3/PUT",
			expect.objectContaining({ method: "PUT" }),
		);
	});
});
