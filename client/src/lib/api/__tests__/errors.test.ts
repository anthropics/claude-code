/**
 * DRF error normalization tests (P1-13).
 */

import { describe, expect, it } from "vitest";
import { parseDrfErrors } from "@/lib/api/errors";

function axiosErrorLike(status: number, data: unknown) {
	return {
		isAxiosError: true,
		response: { status, data },
	};
}

describe("parseDrfErrors", () => {
	it("returns top-level detail as summary", () => {
		const result = parseDrfErrors(
			axiosErrorLike(401, { detail: "Invalid credentials" }),
		);
		expect(result.summary).toBe("Invalid credentials");
		expect(result.fields).toEqual({});
	});

	it("returns non_field_errors first element as summary", () => {
		const result = parseDrfErrors(
			axiosErrorLike(400, {
				non_field_errors: ["Passwords do not match", "Second error"],
			}),
		);
		expect(result.summary).toBe("Passwords do not match");
		expect(result.fields).toEqual({});
	});

	it("maps per-field errors to fields map", () => {
		const result = parseDrfErrors(
			axiosErrorLike(400, {
				email: ["Enter a valid email"],
				password: ["Too short", "Second error"],
			}),
		);
		expect(result.fields.email).toBe("Enter a valid email");
		expect(result.fields.password).toBe("Too short");
	});

	it("promotes the first field error to summary when no detail/non_field_errors", () => {
		const result = parseDrfErrors(
			axiosErrorLike(400, { username: ["Already taken"] }),
		);
		expect(result.summary).toBe("Already taken");
		expect(result.fields.username).toBe("Already taken");
	});

	it("falls back to generic message for 401 with no body", () => {
		const result = parseDrfErrors(axiosErrorLike(401, {}));
		expect(result.summary).toMatch(/正しくありません/);
	});

	it("falls back to generic message for 500", () => {
		const result = parseDrfErrors(axiosErrorLike(500, {}));
		expect(result.summary).toMatch(/サーバーエラー/);
	});

	it("falls back to network error message when no response", () => {
		const result = parseDrfErrors({ message: "Network Error" });
		expect(result.summary).toMatch(/ネットワーク/);
	});

	it("handles top-level string payload", () => {
		const result = parseDrfErrors(axiosErrorLike(500, "Internal error"));
		expect(result.summary).toBe("Internal error");
		expect(result.fields).toEqual({});
	});

	it("returns 429 throttle message", () => {
		const result = parseDrfErrors(axiosErrorLike(429, {}));
		expect(result.summary).toMatch(/しばらく時間をおいてから/);
	});

	it("skips empty arrays and keeps first truthy value", () => {
		const result = parseDrfErrors(
			axiosErrorLike(400, {
				email: [],
				username: ["Invalid"],
			}),
		);
		expect(result.fields.username).toBe("Invalid");
		expect(result.fields.email).toBeUndefined();
	});

	it("handles null / undefined error gracefully", () => {
		expect(parseDrfErrors(null).summary).toBeDefined();
		expect(parseDrfErrors(undefined).summary).toBeDefined();
	});
});
