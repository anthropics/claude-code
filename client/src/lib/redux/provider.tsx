"use client";
import { AppStore, makeStore } from "@/lib/redux/store";
import React, { useRef } from "react";
import { Provider } from "react-redux";

interface ProviderProps {
	children: React.ReactNode;
}

export default function ReduxProvider({ children }: ProviderProps) {
	const storeRef = useRef<AppStore>();
	if (!storeRef.current) {
		storeRef.current = makeStore();
	}
	return <Provider store={storeRef.current}>{children}</Provider>;
}
