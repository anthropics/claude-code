// Server-side Sentry SDK initialization.
// Runs in the Node.js server process for SSR / Route Handlers.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT ?? "local";
const release = process.env.SENTRY_RELEASE;

Sentry.init({
	dsn,
	environment,
	release,
	tracesSampleRate: environment === "production" ? 0.1 : 1.0,
	enabled: Boolean(dsn),
	sendDefaultPii: false,
});
