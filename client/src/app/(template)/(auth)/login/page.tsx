"use client";

import { Suspense } from "react";

import { AuthFormHeader, LoginForm } from "@/components/forms/auth";
import OauthButtons from "@/components/shared/OauthButtons";
import Spinner from "@/components/shared/Spinner";

export default function LoginPage() {
	return (
		<div>
			<AuthFormHeader
				title="ログイン"
				staticText="アカウントをお持ちでない方は"
				linkText="新規登録"
				linkHref="/register"
			/>
			<div className="mt-7 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-lightGrey dark:bg-deepBlueGrey rounded-xl px-6 py-12 shadow sm:rounded-lg sm:px-12 md:rounded-3xl">
					<Suspense
						fallback={
							<div className="flex justify-center py-6">
								<Spinner size="md" />
							</div>
						}
					>
						<LoginForm />
					</Suspense>
					<div className="flex-center mt-5 space-x-2">
						<div className="bg-richBlack dark:bg-platinum h-px flex-1"></div>
						<span className="dark:text-platinum px-2 text-sm">または</span>
						<div className="bg-richBlack dark:bg-platinum h-px flex-1"></div>
					</div>
					<OauthButtons />
				</div>
			</div>
		</div>
	);
}
