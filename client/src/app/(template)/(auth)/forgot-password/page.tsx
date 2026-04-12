import React from "react";

import type { Metadata } from "next";
import { AuthFormHeader } from "@/components/forms/auth";
import PasswordResetRequestForm from "@/components/forms/auth/PasswordResetRequestForm";

export const metadata: Metadata = {
	title: "Alpha Apartments | Password Reset Request",
	description: "Password request reset page",
};

export default function ForgotPassword() {
	return (
		<div>
			<AuthFormHeader
				title="Reset Password Request"
				staticText="Want to go back?"
				linkText="Back to Login Page"
				linkHref="/login"
			/>
			<div className="mt-7 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-lightGrey dark:bg-deepBlueGrey px-6 py-12 shadow sm:rounded-lg sm:px-12 md:rounded-3xl">
					<PasswordResetRequestForm />
				</div>
			</div>
		</div>
	);
}
