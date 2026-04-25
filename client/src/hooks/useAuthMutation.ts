"use client";

/**
 * Generic hook for posting a form to the Django API via the axios wrapper
 * (P1-13). Maps DRF errors back into react-hook-form ``setError`` calls and
 * exposes a summary message for a single aria-live region near the submit
 * button. Keeps the auth form components small and testable.
 */

import { useCallback, useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { parseDrfErrors } from "@/lib/api/errors";

export interface UseAuthMutationOptions<TValues extends FieldValues> {
	form: UseFormReturn<TValues>;
	mutate: (values: TValues) => Promise<void>;
	onSuccess?: (values: TValues) => void | Promise<void>;
}

export interface UseAuthMutationResult<TValues extends FieldValues> {
	isSubmitting: boolean;
	summaryError: string | undefined;
	submit: (values: TValues) => Promise<void>;
	clearSummary: () => void;
}

export function useAuthMutation<TValues extends FieldValues>({
	form,
	mutate,
	onSuccess,
}: UseAuthMutationOptions<TValues>): UseAuthMutationResult<TValues> {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [summaryError, setSummaryError] = useState<string | undefined>();

	const submit = useCallback(
		async (values: TValues): Promise<void> => {
			setIsSubmitting(true);
			setSummaryError(undefined);
			try {
				await mutate(values);
				await onSuccess?.(values);
			} catch (error) {
				const { summary, fields } = parseDrfErrors(error);
				for (const [name, message] of Object.entries(fields)) {
					// Only attach field errors for keys the form knows about; unknown
					// keys (e.g., server-only fields) flow into summary instead.
					if (name in form.getValues()) {
						form.setError(name as Path<TValues>, {
							type: "server",
							message,
						});
					}
				}
				setSummaryError(summary);
			} finally {
				setIsSubmitting(false);
			}
		},
		[form, mutate, onSuccess],
	);

	const clearSummary = useCallback(() => setSummaryError(undefined), []);

	return { isSubmitting, summaryError, submit, clearSummary };
}
