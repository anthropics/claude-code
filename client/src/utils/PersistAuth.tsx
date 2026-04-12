"use client";
import { getCookie } from "cookies-next";
import { useAppDispatch } from "@/lib/redux/hooks/typedHooks";
import { useEffect } from "react";
import { setAuth, setLogout } from "@/lib/redux/features/auth/authSlice";

export default function PersistAuth() {
	const dispatch = useAppDispatch();

	useEffect(() => {
		const isLoggedIn = getCookie("logged_in") === "true";
		if (isLoggedIn) {
			dispatch(setAuth());
		} else {
			dispatch(setLogout());
		}
	}, [dispatch]);

	return null;
}
