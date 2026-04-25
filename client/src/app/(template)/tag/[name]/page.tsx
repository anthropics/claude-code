import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiServerError, serverFetch } from "@/lib/api/server";
import type { TweetSummary } from "@/lib/api/tweets";

interface TagDetail {
	name: string;
	display_name: string;
	description: string;
	usage_count: number;
	is_approved: boolean;
	related?: Array<{ name: string; display_name: string }>;
}

interface TweetListPage {
	count: number;
	next: string | null;
	previous: string | null;
	results: TweetSummary[];
}

interface PageProps {
	params: { name: string };
}

async function loadTag(name: string): Promise<TagDetail | null> {
	try {
		return await serverFetch<TagDetail>(
			`/tags/${encodeURIComponent(name.toLowerCase())}/`,
		);
	} catch (error) {
		if (error instanceof ApiServerError && error.status === 404) return null;
		throw error;
	}
}

async function loadTweets(name: string): Promise<TweetSummary[]> {
	try {
		const page = await serverFetch<TweetListPage>(
			`/tweets/?tag=${encodeURIComponent(name.toLowerCase())}`,
		);
		return page.results;
	} catch {
		return [];
	}
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const tag = await loadTag(params.name);
	if (!tag) return { title: "タグが見つかりません", robots: { index: false } };
	const title = `#${tag.display_name} のツイート`;
	const description =
		tag.description || `#${tag.display_name} タグが付いた最新ツイート。`;
	return {
		title,
		description,
		openGraph: { title, description, type: "website" },
	};
}

export default async function TagPage({ params }: PageProps) {
	const tag = await loadTag(params.name);
	if (!tag) notFound();
	const tweets = await loadTweets(tag.name);

	return (
		<main className="mx-auto max-w-3xl px-4 pb-10 pt-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold">#{tag.display_name}</h1>
				{tag.description && (
					<p className="mt-2 text-sm text-muted-foreground">
						{tag.description}
					</p>
				)}
				<p className="mt-3 text-xs text-muted-foreground">
					{tag.usage_count} 件のツイート
				</p>
			</header>

			{tag.related && tag.related.length > 0 && (
				<section className="mb-8" aria-labelledby="related-heading">
					<h2
						id="related-heading"
						className="mb-2 text-sm font-semibold text-muted-foreground"
					>
						関連タグ
					</h2>
					<ul className="flex flex-wrap gap-2">
						{tag.related.map((r) => (
							<li key={r.name}>
								<a
									href={`/tag/${r.name}`}
									className="rounded-full bg-muted px-2 py-0.5 text-sm hover:bg-accent"
								>
									#{r.display_name}
								</a>
							</li>
						))}
					</ul>
				</section>
			)}

			<section aria-labelledby="tweets-heading">
				<h2 id="tweets-heading" className="mb-3 text-lg font-semibold">
					このタグのツイート
				</h2>
				{tweets.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						まだこのタグのツイートはありません。
					</p>
				) : (
					<ul className="space-y-4">
						{tweets.map((t) => (
							<li key={t.id}>
								<article className="rounded-lg border bg-card p-4 shadow-sm">
									<a href={`/tweet/${t.id}`} className="block">
										<div className="mb-2 text-sm font-semibold">
											@{t.author_handle}
										</div>
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
