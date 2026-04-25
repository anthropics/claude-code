"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { completeGoogleOAuth } from "@/lib/api/auth";
import { parseDrfErrors } from "@/lib/api/errors";
import { setAuth } from "@/lib/redux/features/auth/authSlice";
import { useAppDispatch } from "@/lib/redux/hooks/typedHooks";

export type SocialStatus = "idle" | "processing" | "success" | "error";

/**
 * Completes a Google OAuth redirect by reading ``state`` + ``code`` from the
 * URL and exchanging them for a Cookie JWT via ``POST /auth/o/google-oauth2/cookie/``.
 * Runs once even under React 18 Strict Mode double-invocation.
 */
export default function useSocialAuth(): SocialStatus {
	const router = useRouter();
	const dispatch = useAppDispatch();
	const searchParams = useSearchParams();
	const attempted = useRef(false);
	const [status, setStatus] = useState<SocialStatus>("idle");

	useEffect(() => {
		const state = searchParams.get("state");
		const code = searchParams.get("code");
		if (!state || !code) return;
		if (attempted.current) return;
		attempted.current = true;

		setStatus("processing");
		completeGoogleOAuth({ state, code })
			.then(() => {
				dispatch(setAuth());
				setStatus("success");
				toast.success("Google アカウントでログインしました。");
				router.push("/");
			})
			.catch((error: unknown) => {
				setStatus("error");
				const message = parseDrfErrors(error).summary;
				toast.error(message ?? "Google ログインに失敗しました。");
				router.push("/login");
			});
	}, [dispatch, router, searchParams]);

	return status;
}
