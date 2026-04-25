import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiServerError, serverFetch } from "@/lib/api/server";
import type { TweetSummary } from "@/lib/api/tweets";

interface PublicProfile {
	username: string;
	display_name: string;
	bio: string;
	avatar_url: string;
	header_url: string;
	full_name: string;
	github_url: string;
	x_url: string;
	zenn_url: string;
	qiita_url: string;
	note_url: string;
	linkedin_url: string;
	date_joined: string;
}

interface PageProps {
	params: { handle: string };
}

interface TweetListPage {
	count: number;
	next: string | null;
	previous: string | null;
	results: TweetSummary[];
}

async function loadProfile(handle: string): Promise<PublicProfile | null> {
	try {
		return await serverFetch<PublicProfile>(`/users/${handle}/`);
	} catch (error) {
		if (error instanceof ApiServerError && error.status === 404) return null;
		throw error;
	}
}

async function loadTweets(handle: string): Promise<TweetSummary[]> {
	try {
		const page = await serverFetch<TweetListPage>(
			`/tweets/?author=${encodeURIComponent(handle)}`,
		);
		return page.results;
	} catch {
		return [];
	}
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const profile = await loadProfile(params.handle);
	if (!profile) {
		return { title: "ユーザーが見つかりません", robots: { index: false } };
	}
	const title = `${profile.display_name || profile.username} (@${profile.username})`;
	const description = profile.bio || `@${profile.username} のプロフィール。`;
	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "profile",
			...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
		},
	};
}

const SNS_LINKS: Array<{
	key: keyof PublicProfile;
	label: string;
}> = [
	{ key: "github_url", label: "GitHub" },
	{ key: "x_url", label: "X" },
	{ key: "zenn_url", label: "Zenn" },
	{ key: "qiita_url", label: "Qiita" },
	{ key: "note_url", label: "note" },
	{ key: "linkedin_url", label: "LinkedIn" },
];

export default async function ProfilePage({ params }: PageProps) {
	const profile = await loadProfile(params.handle);
	if (!profile) notFound();

	const tweets = await loadTweets(profile.username);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Person",
		name: profile.display_name || profile.username,
		alternateName: `@${profile.username}`,
		description: profile.bio,
		...(profile.avatar_url ? { image: profile.avatar_url } : {}),
		sameAs: SNS_LINKS.map((l) => profile[l.key] as string).filter(Boolean),
	};

	return (
		<main className="mx-auto max-w-3xl px-4 pb-10">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>

			{profile.header_url && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={profile.header_url}
					alt=""
					className="aspect-[3/1] w-full rounded-lg object-cover"
				/>
			)}

			<header className="-mt-10 flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:gap-6">
				{profile.avatar_url ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={profile.avatar_url}
						alt=""
						className="size-24 rounded-full border-4 border-background bg-muted"
					/>
				) : (
					<div
						className="size-24 rounded-full border-4 border-background bg-muted"
						aria-hidden
					/>
				)}
				<div className="pb-2">
					<h1 className="text-xl font-bold sm:text-2xl">
						{profile.display_name || profile.username}
					</h1>
					<div className="text-sm text-muted-foreground">
						@{profile.username}
					</div>
				</div>
			</header>

			{profile.bio && (
				<p className="mt-4 whitespace-pre-wrap px-4 text-sm">{profile.bio}</p>
			)}

			<ul className="mt-3 flex flex-wrap gap-3 px-4 text-sm">
				{SNS_LINKS.filter(({ key }) => profile[key]).map(({ key, label }) => (
					<li key={key}>
						<a
							href={profile[key] as string}
							rel="noopener noreferrer"
							target="_blank"
							className="underline hover:text-indigo-500 dark:hover:text-lime-400"
						>
							{label}
						</a>
					</li>
				))}
			</ul>

			<section className="mt-8 px-4" aria-labelledby="tweets-heading">
				<h2 id="tweets-heading" className="mb-3 text-lg font-semibold">
					ツイート
				</h2>
				{tweets.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						まだツイートがありません。
					</p>
				) : (
					<ul className="space-y-4">
						{tweets.map((t) => (
							<li key={t.id}>
								<article className="rounded-lg border bg-card p-4 shadow-sm">
									<a href={`/tweet/${t.id}`} className="block">
										<div
											className="prose prose-sm dark:prose-invert max-w-none"
											dangerouslySetInnerHTML={{ __html: t.html }}
										/>
										<time
											dateTime={t.created_at}
											className="mt-2 block text-xs text-muted-foreground"
										>
											{new Date(t.created_at).toLocaleString("ja-JP")}
										</time>
									</a>
								</article>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
