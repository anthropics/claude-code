"use client";
import { AuthFormHeader, LoginForm } from "@/components/forms/auth";
import OauthButtons from "@/components/shared/OauthButtons";
import { useRedirectIfAuthenticated } from "@/hooks";

export default function LoginPage() {
	useRedirectIfAuthenticated();
	return (
		<div>
			<AuthFormHeader
				title="Login to your account"
				staticText="Don't have an account?"
				linkText="Register Here"
				linkHref="/register"
			/>
			<div className="mt-7 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-lightGrey dark:bg-deepBlueGrey rounded-xl px-6 py-12 shadow sm:rounded-lg sm:px-12 md:rounded-3xl">
					<LoginForm />
					{/* <div className="flex-center mt-5 space-x-2">
						<div className="bg-richBlack dark:bg-platinum h-px flex-1"></div>
						<span className="dark:text-platinum px-2 text-sm">Or</span>
						<div className="bg-richBlack dark:bg-platinum h-px flex-1"></div>
					</div>
					<OauthButtons /> */}
				</div>
			</div>
		</div>
	);
}
