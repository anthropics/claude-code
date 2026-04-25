/**
 * Source-file validation tests for P1-15 (cropToWebp core).
 *
 * The full cropToWebp path uses canvas.toBlob / HTMLImageElement which are
 * not trivially exercised in jsdom. We only unit-test the deterministic
 * validation helpers here; the end-to-end encode path is covered by the E2E
 * scenario in P1-22 (#124).
 */

import { describe, expect, it } from "vitest";
import {
	MAX_SOURCE_BYTES,
	MIN_SOURCE_EDGE,
	validateSourceDimensions,
	validateSourceFile,
} from "@/lib/images/cropToWebp";

function fakeFile(size: number, type: string): File {
	const blob = new Blob([new Uint8Array(size)], { type });
	return new File([blob], "x", { type });
}

describe("validateSourceFile", () => {
	it("accepts JPEG under the size limit", () => {
		const file = fakeFile(1024, "image/jpeg");
		expect(validateSourceFile(file)).toEqual({ ok: true });
	});

	it("accepts PNG and WebP", () => {
		expect(validateSourceFile(fakeFile(1024, "image/png")).ok).toBe(true);
		expect(validateSourceFile(fakeFile(1024, "image/webp")).ok).toBe(true);
	});

	it("rejects unsupported MIME types", () => {
		const result = validateSourceFile(fakeFile(1024, "image/gif"));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toMatch(/JPEG/);
		}
	});

	it("rejects files over 5 MiB", () => {
		const result = validateSourceFile(
			fakeFile(MAX_SOURCE_BYTES + 1, "image/jpeg"),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toMatch(/5MB/);
		}
	});
});

describe("validateSourceDimensions", () => {
	function fakeImage(w: number, h: number): HTMLImageElement {
		return {
			naturalWidth: w,
			naturalHeight: h,
		} as HTMLImageElement;
	}

	it("accepts images at least MIN_SOURCE_EDGE on both axes", () => {
		expect(
			validateSourceDimensions(fakeImage(MIN_SOURCE_EDGE, MIN_SOURCE_EDGE)).ok,
		).toBe(true);
		expect(validateSourceDimensions(fakeImage(1024, 1024)).ok).toBe(true);
	});

	it("rejects undersized images", () => {
		const result = validateSourceDimensions(fakeImage(100, 1024));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toMatch(/200/);
		}
	});
});
