/**
 * Mailpit HTTP API helper for E2E tests (P1-22 / Issue #124).
 *
 * Mailpit exposes ``GET /api/v1/messages`` (list) + ``GET /api/v1/message/:id``
 * (detail). Production uses SES so mailpit is a dev/E2E-only dependency. We
 * poll the inbox by address, extract the activation URL from the message body,
 * and return it so the test can ``page.goto`` the link.
 */

const DEFAULT_MAILPIT_URL = "http://localhost:8025";

interface MailpitListResponse {
	messages: Array<{
		ID: string;
		To: Array<{ Address: string }>;
		Subject: string;
		Created: string;
	}>;
}

interface MailpitMessageResponse {
	Text: string;
	HTML: string;
}

function mailpitBase(): string {
	return process.env.PLAYWRIGHT_MAILPIT_URL ?? DEFAULT_MAILPIT_URL;
}

export async function waitForActivationUrl(
	address: string,
	options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
	const timeoutMs = options.timeoutMs ?? 20_000;
	const pollMs = options.pollMs ?? 500;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const res = await fetch(
			`${mailpitBase()}/api/v1/search?query=${encodeURIComponent(
				`to:${address}`,
			)}`,
		);
		if (res.ok) {
			const data = (await res.json()) as MailpitListResponse;
			const latest = data.messages[0];
			if (latest) {
				const detail = await fetch(
					`${mailpitBase()}/api/v1/message/${latest.ID}`,
				);
				if (detail.ok) {
					const body = (await detail.json()) as MailpitMessageResponse;
					const url = extractActivationUrl(body.Text || body.HTML);
					if (url) return url;
				}
			}
		}
		await new Promise((r) => setTimeout(r, pollMs));
	}
	throw new Error(`Activation email for ${address} did not arrive in time`);
}

function extractActivationUrl(body: string): string | undefined {
	const match = body.match(/https?:\/\/\S*\/activate\/[^\s"<>]+/);
	return match?.[0];
}
