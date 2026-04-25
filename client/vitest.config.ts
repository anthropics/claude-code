import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		// Playwright E2E specs live under ``e2e/`` and use ``@playwright/test``;
		// keep them off the vitest run or @playwright/test's ``test.describe`` will
		// refuse to initialize outside the Playwright runner.
		exclude: ["node_modules/**", "dist/**", ".next/**", "e2e/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			// Scope coverage to modules that ship tests in this PR. As new
			// modules are added (UI components in #122 onward), extend this
			// include list rather than loosening the global gate.
			include: ["src/lib/api/**/*.ts"],
			exclude: ["src/lib/api/**/__tests__/**", "src/lib/api/**/*.d.ts"],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
