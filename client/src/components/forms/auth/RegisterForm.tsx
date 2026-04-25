"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Contact2Icon, MailIcon, UserCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { FormFieldComponent } from "@/components/forms/FormFieldComponent";
import { FormSummaryError } from "@/components/forms/auth/FormSummaryError";
import { Button } from "@/components/ui/button";
import { useAuthMutation } from "@/hooks/useAuthMutation";
import { registerAccount } from "@/lib/api/auth";
import {
	registerUserSchema,
	type TRegisterUserSchema,
} from "@/lib/validationSchemas";

/**
 * Sign-up form (P1-13). Posts to djoser ``/auth/users/`` which sends the
 * activation mail; the actual ``/login`` redirect is deferred until the user
 * clicks the activation link.
 */
export default function RegisterForm() {
	const router = useRouter();

	const form = useForm<TRegisterUserSchema>({
		resolver: zodResolver(registerUserSchema),
		mode: "all",
		defaultValues: {
			username: "",
			first_name: "",
			last_name: "",
			email: "",
			password: "",
			re_password: "",
			terms: false as unknown as true,
		},
	});

	const { isSubmitting, summaryError, submit } = useAuthMutation({
		form,
		mutate: async (values) => {
			// terms はクライアント側だけの validation 用フィールドなので送信しない。
			const { terms: _terms, ...payload } = values;
			await registerAccount(payload);
		},
		onSuccess: (values) => {
			toast.success(
				"確認メールを送信しました。メールに記載されたリンクからアカウントを有効化してください。",
			);
			const search = new URLSearchParams({ email: values.email });
			router.push(`/login?${search.toString()}`);
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
				label="ハンドル (@handle)"
				name="username"
				register={form.register}
				errors={form.formState.errors}
				placeholder="alice"
				startIcon={<UserCheck2 className="dark:text-babyPowder size-8" />}
			/>
			<FormFieldComponent
				label="名"
				name="first_name"
				register={form.register}
				errors={form.formState.errors}
				placeholder="太郎"
				startIcon={<Contact2Icon className="dark:text-babyPowder size-8" />}
			/>
			<FormFieldComponent
				label="姓"
				name="last_name"
				register={form.register}
				errors={form.formState.errors}
				placeholder="山田"
				startIcon={<Contact2Icon className="dark:text-babyPowder size-8" />}
			/>
			<FormFieldComponent
				label="メールアドレス"
				name="email"
				register={form.register}
				errors={form.formState.errors}
				placeholder="you@example.com"
				type="email"
				startIcon={<MailIcon className="dark:text-babyPowder size-8" />}
			/>
			<FormFieldComponent
				label="パスワード"
				name="password"
				register={form.register}
				errors={form.formState.errors}
				placeholder="8文字以上"
				isPassword
			/>
			<FormFieldComponent
				label="パスワード (確認)"
				name="re_password"
				register={form.register}
				errors={form.formState.errors}
				placeholder="もう一度入力"
				isPassword
			/>

			<label className="flex items-start gap-2 text-sm">
				<input
					type="checkbox"
					{...form.register("terms")}
					className="mt-1 size-4"
					aria-describedby="terms-error"
				/>
				<span className="dark:text-babyPowder">
					<a
						href="/terms"
						className="underline hover:text-indigo-500 dark:hover:text-lime-400"
					>
						利用規約
					</a>
					と
					<a
						href="/privacy"
						className="underline hover:text-indigo-500 dark:hover:text-lime-400"
					>
						プライバシーポリシー
					</a>
					に同意します
				</span>
			</label>
			{form.formState.errors.terms?.message && (
				<span
					id="terms-error"
					className="-mt-3 text-sm text-red-500"
					role="alert"
				>
					{form.formState.errors.terms.message}
				</span>
			)}

			<Button
				type="submit"
				className="h4-semibold bg-eerieBlack dark:bg-pumpkin w-full text-white"
				disabled={isSubmitting}
			>
				{isSubmitting ? <Spinner size="sm" /> : "アカウント作成"}
			</Button>
		</form>
	);
}
