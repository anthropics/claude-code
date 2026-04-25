import { describe, expect, it } from "vitest";
import {
	EDIT_MAX_COUNT,
	EDIT_WINDOW_MS,
	evaluateEditPolicy,
} from "@/lib/tweets/editPolicy";

const now = new Date("2026-04-24T12:00:00Z");

describe("evaluateEditPolicy", () => {
	it("allows editing inside the 30-minute window with edits remaining", () => {
		const result = evaluateEditPolicy({
			createdAt: new Date(now.getTime() - 60_000),
			editCount: 0,
			now,
		});
		expect(result.isEditable).toBe(true);
		expect(result.editsRemaining).toBe(EDIT_MAX_COUNT);
	});

	it("blocks after 30 minutes", () => {
		const result = evaluateEditPolicy({
			createdAt: new Date(now.getTime() - EDIT_WINDOW_MS - 1),
			editCount: 0,
			now,
		});
		expect(result.isEditable).toBe(false);
		expect(result.reason).toBe("time-exceeded");
	});

	it("blocks exactly at the 30-minute boundary", () => {
		const result = evaluateEditPolicy({
			createdAt: new Date(now.getTime() - EDIT_WINDOW_MS),
			editCount: 0,
			now,
		});
		expect(result.isEditable).toBe(false);
		expect(result.reason).toBe("time-exceeded");
	});

	it("blocks once 5 edits are used", () => {
		const result = evaluateEditPolicy({
			createdAt: now,
			editCount: EDIT_MAX_COUNT,
			now,
		});
		expect(result.isEditable).toBe(false);
		expect(result.reason).toBe("count-exceeded");
	});

	it("reports remaining edits correctly", () => {
		const result = evaluateEditPolicy({
			createdAt: now,
			editCount: 3,
			now,
		});
		expect(result.editsRemaining).toBe(EDIT_MAX_COUNT - 3);
	});

	it("reports remaining time correctly", () => {
		const result = evaluateEditPolicy({
			createdAt: new Date(now.getTime() - 10 * 60_000),
			editCount: 0,
			now,
		});
		expect(result.msRemaining).toBe(EDIT_WINDOW_MS - 10 * 60_000);
	});

	it("rejects future-dated createdAt defensively", () => {
		const result = evaluateEditPolicy({
			createdAt: new Date(now.getTime() + 60_000),
			editCount: 0,
			now,
		});
		expect(result.isEditable).toBe(false);
		expect(result.reason).toBe("future-created");
	});

	it("rejects invalid createdAt strings", () => {
		const result = evaluateEditPolicy({
			createdAt: "not-a-date",
			editCount: 0,
			now,
		});
		expect(result.isEditable).toBe(false);
		expect(result.reason).toBe("future-created");
	});
});
