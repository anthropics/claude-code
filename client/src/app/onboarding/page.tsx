"use client";

import type { Metadata } from "next";

import OnboardingForm from "@/components/forms/onboarding/OnboardingForm";

export default function OnboardingPage() {
	return (
		<main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
			<ol
				className="mb-6 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"
				aria-label="オンボーディングの進行状況"
			>
				<li
					className="flex items-center gap-2 font-semibold text-foreground"
					aria-current="step"
				>
					<span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
						1
					</span>
					プロフィール
				</li>
				<li className="flex items-center gap-2 opacity-50">
					<span className="flex size-6 items-center justify-center rounded-full border">
						2
					</span>
					スキルタグ (近日公開)
				</li>
				<li className="flex items-center gap-2 opacity-50">
					<span className="flex size-6 items-center justify-center rounded-full border">
						3
					</span>
					興味タグ (近日公開)
				</li>
			</ol>
			<header className="mb-6 space-y-2">
				<h1 className="text-2xl font-bold">ようこそ 🎉</h1>
				<p className="text-sm text-muted-foreground">
					最初に表示名と自己紹介だけ設定しましょう。タグ設定はあとから追加できます。
				</p>
			</header>
			<OnboardingForm />
		</main>
	);
}
