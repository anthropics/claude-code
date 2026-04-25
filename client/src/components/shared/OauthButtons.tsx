"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import OauthButton from "./OauthButton";
import { startGoogleOAuth } from "@/lib/api/auth";
import { parseDrfErrors } from "@/lib/api/errors";

/**
 * Social-login buttons (P1-13). The Google handshake is a two-step flow:
 *
 * 1. Call ``GET /auth/o/google-oauth2/?redirect_uri=<frontend>/google`` to
 *    obtain the Google authorization URL.
 * 2. ``window.location.href`` to that URL. Google bounces back to
 *    ``/google?state=…&code=…`` where ``useSocialAuth`` exchanges the code
 *    for a Cookie JWT via ``POST /auth/o/google-oauth2/cookie/``.
 */
export default function OauthButtons() {
	const [isLoading, setIsLoading] = useState(false);

	const onGoogleClick = async () => {
		if (typeof window === "undefined") return;
		setIsLoading(true);
		try {
			const redirectUri = `${window.location.origin}/google`;
			const { authorization_url } = await startGoogleOAuth(redirectUri);
			window.location.href = authorization_url;
		} catch (error) {
			const message = parseDrfErrors(error).summary;
			toast.error(message ?? "Google ログインを開始できませんでした。");
			setIsLoading(false);
		}
	};

	return (
		<div className="mt-3 flex items-center justify-between gap-2">
			<OauthButton
				provider="google"
				onClick={onGoogleClick}
				disabled={isLoading}
			>
				Google でログイン
			</OauthButton>
		</div>
	);
}
