import { AuthFormHeader } from "@/components/forms/auth";
import PasswordResetConfirmForm from "@/components/forms/auth/PasswordResetConfirmForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Alpha Apartments | Password Reset Request",
	description: "Password request reset page",
};

export default function ForgotPassword() {
	return (
		<div>
			<AuthFormHeader title="Create your New Password" />
			<div className="mt-7 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-lightGrey dark:bg-deepBlueGrey px-6 py-12 shadow sm:rounded-lg sm:px-12 md:rounded-3xl">
					<PasswordResetConfirmForm />
				</div>
			</div>
		</div>
	);
}
