"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { activateAccount } from "@/lib/api/auth";
import { parseDrfErrors } from "@/lib/api/errors";

interface ActivationProps {
	params: {
		uid: string;
		token: string;
	};
}

type Status = "pending" | "success" | "error";

/**
 * djoser activation link handler (P1-13).
 *
 * The user clicks a link in their activation email and lands here. We fire a
 * one-shot POST to ``/auth/users/activation/``. On success we bounce them to
 * ``/login`` with ``?email=…`` so the login form is pre-filled. On failure
 * (invalid token / already activated) we show the error inline with a link
 * back to login.
 */
export default function ActivationPage({ params }: ActivationProps) {
	const router = useRouter();
	const [status, setStatus] = useState<Status>("pending");
	const [errorMessage, setErrorMessage] = useState<string>();
	const attempted = useRef(false);

	useEffect(() => {
		// React 18 dev StrictMode runs effects twice; guard so we don't double-POST.
		if (attempted.current) return;
		attempted.current = true;

		let cancelled = false;
		activateAccount({ uid: params.uid, token: params.token })
			.then(() => {
				if (cancelled) return;
				setStatus("success");
				toast.success("アカウントを有効化しました。ログインしてください。");
				const search = new URLSearchParams({ email: "" });
				router.push(`/login?${search.toString()}`);
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setStatus("error");
				setErrorMessage(parseDrfErrors(error).summary);
			});

		return () => {
			cancelled = true;
		};
	}, [params.uid, params.token, router]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div
				className="text-center"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				<h3 className="dark:text-platinum font-robotoSlab text-2xl font-bold text-gray-800 sm:text-4xl md:text-5xl">
					{status === "pending" && "アカウントを有効化しています…"}
					{status === "success" && "アカウントを有効化しました 🎉"}
					{status === "error" &&
						(errorMessage ??
							"有効化に失敗しました。リンクが無効か、既に有効化されています。")}
				</h3>
				{status === "error" && (
					<a
						href="/login"
						className="mt-4 inline-block text-sm underline hover:text-indigo-500 dark:hover:text-lime-400"
					>
						ログインページに戻る
					</a>
				)}
			</div>
		</div>
	);
}
