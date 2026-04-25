/**
 * Parity tests between TypeScript ``countTweetChars`` and the backend
 * ``apps/tweets/char_count.py`` (P1-16).
 *
 * The TS implementation mirrors the backend rules but does not aim to be
 * bit-for-bit identical for every CommonMark edge case — the goal is
 * "accurate enough for live UI feedback, server is still the gate".
 */

import { describe, expect, it } from "vitest";
import {
	URL_LENGTH,
	countTweetChars,
	TWEET_MAX_CHARS,
} from "@/lib/tweets/charCount";

describe("countTweetChars", () => {
	it("is 0 for empty input", () => {
		expect(countTweetChars("")).toBe(0);
	});

	it("counts plain text by code points", () => {
		expect(countTweetChars("hello")).toBe(5);
		expect(countTweetChars("こんにちは")).toBe(5);
	});

	it("counts newline as 1", () => {
		expect(countTweetChars("a\nb")).toBe(3);
	});

	it("counts a bare URL as URL_LENGTH regardless of actual length", () => {
		expect(countTweetChars("https://example.com/very/long/path/abcdef")).toBe(
			URL_LENGTH,
		);
		expect(countTweetChars("see https://x.co")).toBe(
			"see ".length + URL_LENGTH,
		);
	});

	it("strips heading markers", () => {
		expect(countTweetChars("## hello")).toBe("hello".length);
	});

	it("strips bullet list markers", () => {
		expect(countTweetChars("- alpha\n- beta")).toBe("alpha\nbeta".length);
	});

	it("strips ordered list markers", () => {
		expect(countTweetChars("1. alpha\n2. beta")).toBe("alpha\nbeta".length);
	});

	it("strips blockquote markers", () => {
		expect(countTweetChars("> quoted")).toBe("quoted".length);
	});

	it("strips bold / italic markers but keeps content", () => {
		expect(countTweetChars("**bold** and *em*")).toBe("bold and em".length);
	});

	it("does not treat snake_case underscores as italic markers", () => {
		expect(countTweetChars("my_var_name")).toBe("my_var_name".length);
	});

	it("strips strikethrough markers", () => {
		expect(countTweetChars("~~gone~~")).toBe("gone".length);
	});

	it("keeps link label, counts url as URL_LENGTH", () => {
		expect(countTweetChars("[click](https://a.co/path)")).toBe(
			"click".length + URL_LENGTH,
		);
	});

	it("keeps image alt, counts url as URL_LENGTH", () => {
		expect(countTweetChars("![cat](https://a.co/cat.jpg)")).toBe(
			"cat".length + URL_LENGTH,
		);
	});

	it("keeps inline code content as-is", () => {
		// ``const x = 1`` is 12 chars inside backticks; backticks themselves are
		// stripped but content remains. URL_LENGTH is not applied inside code.
		expect(countTweetChars("call `const x = 1` now")).toBe(
			"call const x = 1 now".length,
		);
	});

	it("keeps fenced code content as-is without applying markdown rules", () => {
		const input = "```\n**not bold**\n```";
		expect(countTweetChars(input)).toBe("\n**not bold**\n".length);
	});

	it("handles BMP emoji as a single codepoint", () => {
		expect(countTweetChars("🎉")).toBe(1);
	});

	it("is consistent at the 180-char boundary", () => {
		const body = "a".repeat(TWEET_MAX_CHARS);
		expect(countTweetChars(body)).toBe(TWEET_MAX_CHARS);
	});

	it("combines url + plain text correctly", () => {
		const body = "check https://example.com and https://b.co";
		// "check " (6) + URL_LENGTH + " and " (5) + URL_LENGTH = 57
		expect(countTweetChars(body)).toBe(6 + URL_LENGTH + 5 + URL_LENGTH);
	});

	it("handles a complex markdown body within budget", () => {
		const body = "## Hello\n- item\n**bold** [link](https://example.com)";
		// "Hello" (5) + "\n" + "item" (4) + "\n" + "bold " (5) + "link" (4) + URL_LENGTH
		expect(countTweetChars(body)).toBe(5 + 1 + 4 + 1 + 5 + 4 + URL_LENGTH);
	});
});
