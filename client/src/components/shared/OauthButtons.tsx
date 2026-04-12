"use client";

import { UseGoogle } from "@/utils";
import OauthButton from "./OauthButton";

export default function OauthButtons() {
	return (
		<div className="mt-3 flex items-center justify-between gap-2">
			<OauthButton provider="google" onClick={UseGoogle}>
				Sign in with Google
			</OauthButton>
		</div>
	);
}
