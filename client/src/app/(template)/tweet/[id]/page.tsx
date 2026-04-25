import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiServerError, serverFetch } from "@/lib/api/server";
import type { TweetSummary } from "@/lib/api/tweets";

interface PageProps {
	params: { id: string };
}

interface Tombstone {
	id: number;
	is_deleted: true;
	deleted_at: string;
}

type TweetResponse = TweetSummary | Tombstone;

function isTombstone(payload: TweetResponse): payload is Tombstone {
	return (payload as Tombstone).is_deleted === true;
}

async function loadTweet(id: string): Promise<TweetResponse | null> {
	try {
		return await serverFetch<TweetResponse>(`/tweets/${id}/`);
	} catch (error) {
		if (error instanceof ApiServerError) {
			// 410 Gone is the backend's tombstone signal (SPEC §3.9).
			if (
				error.status === 410 &&
				typeof error.body === "object" &&
				error.body
			) {
				return error.body as Tombstone;
			}
			if (error.status === 404) return null;
		}
		throw error;
	}
}

function truncate(text: string, limit: number): string {
	if (text.length <= limit) return text;
	return text.slice(0, limit - 1) + "…";
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const tweet = await loadTweet(params.id);
	if (!tweet || isTombstone(tweet)) {
		return {
			title: "このツイートは削除されました",
			robots: { index: false },
		};
	}
	const description = truncate(tweet.body.replace(/\s+/g, " ").trim(), 120);
	const image = tweet.images[0]?.image_url || tweet.author_avatar_url;
	const title = `${tweet.author_display_name ?? tweet.author_handle}のツイート`;
	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "article",
			...(image ? { images: [image] } : {}),
		},
		twitter: {
			card: image ? "summary_large_image" : "summary",
			title,
			description,
			...(image ? { images: [image] } : {}),
		},
	};
}

function Tombstoned({ deletedAt }: { deletedAt: string }) {
	return (
		<main className="mx-auto max-w-xl px-6 py-16 text-center">
			<h1 className="mb-4 text-2xl font-bold">このツイートは削除されました</h1>
			<p className="text-sm text-muted-foreground">
				削除日時: {new Date(deletedAt).toLocaleString("ja-JP")}
			</p>
		</main>
	);
}

export default async function TweetDetailPage({ params }: PageProps) {
	const tweet = await loadTweet(params.id);
	if (!tweet) notFound();
	if (isTombstone(tweet)) {
		return <Tombstoned deletedAt={tweet.deleted_at} />;
	}

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "SocialMediaPosting",
		author: {
			"@type": "Person",
			name: tweet.author_display_name ?? tweet.author_handle,
			identifier: `@${tweet.author_handle}`,
		},
		datePublished: tweet.created_at,
		dateModified: tweet.updated_at,
		articleBody: tweet.body,
		commentCount: 0,
		...(tweet.images[0]?.image_url ? { image: tweet.images[0].image_url } : {}),
	};

	return (
		<main className="mx-auto max-w-2xl px-6 py-10">
			<script
				type="application/ld+json"
				// generateMetadata + schema.org payload; no user input interpolated as HTML.
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<article className="rounded-lg border bg-card p-6 shadow-sm">
				<header className="mb-4 flex items-center gap-3">
					{tweet.author_avatar_url && (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={tweet.author_avatar_url}
							alt=""
							width={48}
							height={48}
							className="size-12 rounded-full"
						/>
					)}
					<div>
						<div className="font-semibold">
							{tweet.author_display_name ?? tweet.author_handle}
						</div>
						<a
							href={`/u/${tweet.author_handle}`}
							className="text-sm text-muted-foreground hover:underline"
						>
							@{tweet.author_handle}
						</a>
					</div>
				</header>

				<div
					className="prose prose-sm dark:prose-invert max-w-none"
					// Server-rendered Markdown via apps/tweets/rendering.render_markdown.
					// bleach already sanitizes on the backend, so this string is safe.
					dangerouslySetInnerHTML={{ __html: tweet.html }}
				/>

				{tweet.images.length > 0 && (
					<ul className="mt-4 grid grid-cols-2 gap-2">
						{tweet.images.map((img) => (
							<li key={img.image_url}>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={img.image_url}
									alt=""
									loading="lazy"
									width={img.width}
									height={img.height}
									className="w-full rounded-md"
								/>
							</li>
						))}
					</ul>
				)}

				{tweet.tags.length > 0 && (
					<ul className="mt-4 flex flex-wrap gap-2 text-sm">
						{tweet.tags.map((tag) => (
							<li key={tag}>
								<a
									href={`/tag/${tag}`}
									className="rounded-full bg-muted px-2 py-0.5 hover:bg-accent"
								>
									#{tag}
								</a>
							</li>
						))}
					</ul>
				)}

				<footer className="mt-6 text-xs text-muted-foreground">
					<time dateTime={tweet.created_at}>
						{new Date(tweet.created_at).toLocaleString("ja-JP")}
					</time>
					{tweet.edit_count > 0 && (
						<span className="ml-2">(編集済み × {tweet.edit_count})</span>
					)}
				</footer>
			</article>
		</main>
	);
}
