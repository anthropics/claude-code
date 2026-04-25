// vitest setup file — runs once before each test file.
// Keep it intentionally small. Per-test setup belongs in the test file.

import { afterEach, beforeEach } from "vitest";

// Clear cookies between tests so CSRF / auth state never leaks.
beforeEach(() => {
	// jsdom's document.cookie does not support clearing via assignment to "".
	// Walk every cookie and set Max-Age=0 to remove it.
	for (const part of document.cookie.split(";")) {
		const name = part.split("=")[0]?.trim();
		if (name) {
			document.cookie = `${name}=; Path=/; Max-Age=0`;
		}
	}
});

afterEach(() => {
	// No-op placeholder — lets individual tests override safely.
});
