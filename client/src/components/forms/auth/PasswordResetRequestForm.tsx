"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { FormFieldComponent } from "@/components/forms/FormFieldComponent";
import { FormSummaryError } from "@/components/forms/auth/FormSummaryError";
import { Button } from "@/components/ui/button";
import { useAuthMutation } from "@/hooks/useAuthMutation";
import { requestPasswordReset } from "@/lib/api/auth";
import {
	passwordResetRequestSchema,
	type TPasswordResetRequestSchema,
} from "@/lib/validationSchemas";

/**
 * Request-a-reset-link form (P1-13). djoser ``/auth/users/reset_password/``
 * always returns 204 (ignores whether the email exists) to avoid user
 * enumeration, so we show a generic success message.
 */
export default function PasswordResetRequestForm() {
	const form = useForm<TPasswordResetRequestSchema>({
		resolver: zodResolver(passwordResetRequestSchema),
		mode: "all",
		defaultValues: { email: "" },
	});

	const { isSubmitting, summaryError, submit } = useAuthMutation({
		form,
		mutate: (values) => requestPasswordReset(values),
		onSuccess: () => {
			toast.success(
				"入力されたメールアドレスに、パスワード再設定のリンクを送信しました。",
			);
			form.reset();
		},
	});

	return (
		<form
			noValidate
			onSubmit={form.handleSubmit(submit)}
			className="flex w-full max-w-md flex-col gap-4"
		>
			<FormSummaryError message={summaryError} />
			<FormFieldComponent
				label="メールアドレス"
				name="email"
				register={form.register}
				errors={form.formState.errors}
				placeholder="you@example.com"
				type="email"
				startIcon={<MailIcon className="dark:text-babyPowder size-8" />}
			/>
			<Button
				type="submit"
				className="h4-semibold bg-eerieBlack dark:bg-pumpkin w-full text-white"
				disabled={isSubmitting}
			>
				{isSubmitting ? <Spinner size="sm" /> : "再設定リンクを送信"}
			</Button>
		</form>
	);
}
