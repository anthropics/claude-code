"use client";

/**
 * Accessible, polite-announced summary error for auth forms (P1-13).
 *
 * ``role="alert"`` + ``aria-live="polite"`` so screen readers announce server
 * errors (e.g., invalid credentials, throttled requests) without stealing
 * focus. Rendered even when ``message`` is empty so the live region is in the
 * DOM before the first error (prevents first-error announcements from being
 * swallowed by some screen readers).
 */

interface FormSummaryErrorProps {
	message?: string;
}

export function FormSummaryError({ message }: FormSummaryErrorProps) {
	return (
		<div
			role="alert"
			aria-live="polite"
			aria-atomic="true"
			className={
				message
					? "rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-200"
					: "sr-only"
			}
			data-testid="auth-form-summary-error"
		>
			{message ?? ""}
		</div>
	);
}
