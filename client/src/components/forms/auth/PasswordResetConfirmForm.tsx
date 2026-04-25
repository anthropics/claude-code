"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { FormFieldComponent } from "@/components/forms/FormFieldComponent";
import { FormSummaryError } from "@/components/forms/auth/FormSummaryError";
import { Button } from "@/components/ui/button";
import { useAuthMutation } from "@/hooks/useAuthMutation";
import { confirmPasswordReset } from "@/lib/api/auth";
import {
	passwordResetConfirmSchema,
	type TPasswordResetConfirmSchema,
} from "@/lib/validationSchemas";

/**
 * Reset-confirm form (P1-13). ``uid`` / ``token`` come from the URL path;
 * user fills in the new password fields only.
 */
export default function PasswordResetConfirmForm() {
	const router = useRouter();
	const params = useParams();
	const uid = params.uid as string;
	const token = params.token as string;

	const form = useForm<TPasswordResetConfirmSchema>({
		resolver: zodResolver(passwordResetConfirmSchema),
		mode: "all",
		defaultValues: { uid, token, new_password: "", re_new_password: "" },
	});

	const { isSubmitting, summaryError, submit } = useAuthMutation({
		form,
		mutate: (values) => confirmPasswordReset({ ...values, uid, token }),
		onSuccess: () => {
			toast.success("パスワードを再設定しました。ログインしてください。");
			router.push("/login");
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
				label="新しいパスワード"
				name="new_password"
				register={form.register}
				errors={form.formState.errors}
				placeholder="8文字以上"
				isPassword
			/>
			<FormFieldComponent
				label="新しいパスワード (確認)"
				name="re_new_password"
				register={form.register}
				errors={form.formState.errors}
				placeholder="もう一度入力"
				isPassword
			/>
			<Button
				type="submit"
				className="h4-semibold bg-eerieBlack dark:bg-pumpkin w-full text-white"
				disabled={isSubmitting}
			>
				{isSubmitting ? <Spinner size="sm" /> : "パスワードを再設定"}
			</Button>
		</form>
	);
}
