"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchCurrentUser } from "@/lib/api/users";

export type GuardStatus = "checking" | "authenticated" | "guest";

interface Options {
	/** Paths that should NOT trigger a redirect when the user is a guest. */
	publicPaths?: string[];
}

const DEFAULT_PUBLIC_PATHS = [
	"/login",
	"/register",
	"/forgot-password",
	"/password-reset",
	"/activate",
	"/google",
];

function isPublic(pathname: string, paths: string[]): boolean {
	return paths.some(
		(p) =>
			pathname === p ||
			pathname.startsWith(`${p}/`) ||
			pathname.startsWith(`${p}?`),
	);
}

/**
 * Client-side auth + onboarding guard (P1-14).
 *
 * On mount:
 *  - GET /users/me/ to resolve auth state
 *  - if 401 and current route is NOT public → redirect to /login?next=…
 *  - if authenticated and ``needs_onboarding`` is true → redirect to /onboarding
 *    (unless already there)
 *
 * Used by the shared layout to wrap private routes. Public auth routes opt
 * out by not rendering this hook or by listing themselves in ``publicPaths``.
 */
export function useOnboardingGuard(options: Options = {}): GuardStatus {
	const router = useRouter();
	const pathname = usePathname();
	const [status, setStatus] = useState<GuardStatus>("checking");
	const publicPaths = options.publicPaths ?? DEFAULT_PUBLIC_PATHS;

	useEffect(() => {
		let cancelled = false;

		fetchCurrentUser()
			.then((user) => {
				if (cancelled) return;
				setStatus("authenticated");
				if (user.needs_onboarding && pathname !== "/onboarding") {
					router.replace("/onboarding");
				} else if (!user.needs_onboarding && pathname === "/onboarding") {
					router.replace("/");
				}
			})
			.catch(() => {
				if (cancelled) return;
				setStatus("guest");
				if (!isPublic(pathname ?? "/", publicPaths)) {
					const next = encodeURIComponent(pathname ?? "/");
					router.replace(`/login?next=${next}`);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [pathname, publicPaths, router]);

	return status;
}
