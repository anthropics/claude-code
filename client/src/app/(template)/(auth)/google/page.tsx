"use client";

import { Suspense } from "react";

import Spinner from "@/components/shared/Spinner";
import useSocialAuth from "@/hooks/useSocialAuth";

export default function GoogleLoginPage() {
	return (
		<Suspense
			fallback={
				<div className="flex-center pt-32">
					<Spinner size="xl" />
				</div>
			}
		>
			<GoogleLoginContent />
		</Suspense>
	);
}

function GoogleLoginContent() {
	const status = useSocialAuth();
	return (
		<div
			className="flex-center pt-32 flex-col gap-4"
			role="status"
			aria-live="polite"
		>
			<Spinner size="xl" />
			<p className="text-sm dark:text-platinum">
				{status === "error"
					? "Google ログインに失敗しました。ログインページに戻ります…"
					: "Google アカウントを確認しています…"}
			</p>
		</div>
	);
}
