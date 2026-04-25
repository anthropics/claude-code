"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createTweet, type TweetSummary } from "@/lib/api/tweets";
import { parseDrfErrors } from "@/lib/api/errors";
import { TWEET_MAX_CHARS, countTweetChars } from "@/lib/tweets/charCount";

interface TweetComposerProps {
	onPosted?: (tweet: TweetSummary) => void;
	autoFocus?: boolean;
}

const MAX_TAGS = 3;
const TAG_RE = /^[a-z0-9]+(?:[-_.+][a-z0-9]+)*$/;

/**
 * Minimal tweet composer (P1-16).
 *
 * Scope for this PR:
 *  - Markdown-aware character counter (SPEC §3.3 parity with backend).
 *  - Tag chip input: free text, Enter / Space to commit, max 3, dedup.
 *  - POST /tweets/ with optimistic onPosted callback.
 *  - Cmd/Ctrl + Enter to submit.
 *  - aria-describedby on textarea so screen readers hear the char count /
 *    error.
 *
 * Explicitly deferred to follow-ups:
 *  - Image drag-and-drop (wire into ``uploadImage`` from P1-15 once the
 *    backend accepts image_url arrays in the composer UX flow).
 *  - Tag autocomplete via GET /tags/?q= — the primitive (``searchTags``) is
 *    shipped in this PR; the combobox UI ships next.
 *  - Rich markdown preview pane (react-markdown already a dep; leave as
 *    toggle until author demand is confirmed).
 */
export default function TweetComposer({
	onPosted,
	autoFocus,
}: TweetComposerProps) {
	const textareaId = useId();
	const counterId = useId();
	const tagsId = useId();
	const [body, setBody] = useState("");
	const [tagInput, setTagInput] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [tagError, setTagError] = useState<string | undefined>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [summaryError, setSummaryError] = useState<string | undefined>();

	const charCount = useMemo(() => countTweetChars(body), [body]);
	const remaining = TWEET_MAX_CHARS - charCount;
	const isOverLimit = remaining < 0;
	const isEmpty = charCount === 0;

	const canSubmit = !isSubmitting && !isEmpty && !isOverLimit;

	const addTag = useCallback(
		(raw: string) => {
			const value = raw.trim().toLowerCase();
			if (!value) return;
			if (tags.length >= MAX_TAGS) {
				setTagError(`タグは最大 ${MAX_TAGS} 個まで指定できます`);
				return;
			}
			if (!TAG_RE.test(value)) {
				setTagError("タグは英数字と -_.+ のみ使用できます");
				return;
			}
			if (tags.includes(value)) {
				setTagError("同じタグは 1 回までです");
				return;
			}
			setTags((prev) => [...prev, value]);
			setTagError(undefined);
			setTagInput("");
		},
		[tags],
	);

	const removeTag = (target: string) => {
		setTags((prev) => prev.filter((t) => t !== target));
		setTagError(undefined);
	};

	const onTagInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === " " || event.key === ",") {
			event.preventDefault();
			addTag(tagInput);
		} else if (
			event.key === "Backspace" &&
			tagInput === "" &&
			tags.length > 0
		) {
			setTags((prev) => prev.slice(0, -1));
		}
	};

	const submit = useCallback(async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setSummaryError(undefined);
		try {
			const tweet = await createTweet({ body, tags });
			onPosted?.(tweet);
			toast.success("投稿しました");
			setBody("");
			setTags([]);
			setTagInput("");
		} catch (error) {
			setSummaryError(parseDrfErrors(error).summary);
		} finally {
			setIsSubmitting(false);
		}
	}, [body, tags, canSubmit, onPosted]);

	const onBodyKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			submit();
		}
	};

	return (
		<section
			className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
			aria-labelledby={`${textareaId}-label`}
		>
			<label
				id={`${textareaId}-label`}
				htmlFor={textareaId}
				className="sr-only"
			>
				ツイート本文
			</label>
			<Textarea
				id={textareaId}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={onBodyKey}
				placeholder="いまどうしてる？ Markdown が使えます。Cmd/Ctrl + Enter で投稿。"
				aria-describedby={`${counterId}${summaryError ? ` ${counterId}-error` : ""}`}
				rows={5}
				autoFocus={autoFocus}
			/>

			<div
				className="flex flex-wrap items-center gap-2"
				data-testid="composer-tags"
			>
				{tags.map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
					>
						#{tag}
						<button
							type="button"
							onClick={() => removeTag(tag)}
							className="opacity-60 hover:opacity-100"
							aria-label={`タグ ${tag} を削除`}
						>
							×
						</button>
					</span>
				))}
				<input
					id={tagsId}
					value={tagInput}
					onChange={(e) => {
						setTagError(undefined);
						setTagInput(e.target.value);
					}}
					onKeyDown={onTagInputKey}
					placeholder={
						tags.length >= MAX_TAGS ? "タグは 3 個まで" : "タグを入力して Enter"
					}
					className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					aria-label="タグを追加"
					disabled={tags.length >= MAX_TAGS}
				/>
			</div>
			{tagError && (
				<p className="text-xs text-red-500" role="alert">
					{tagError}
				</p>
			)}

			<div className="flex items-center justify-between">
				<div
					id={counterId}
					aria-live="polite"
					className={
						isOverLimit
							? "text-sm font-semibold text-red-500"
							: "text-sm text-muted-foreground"
					}
				>
					{charCount} / {TWEET_MAX_CHARS}
				</div>
				<Button type="button" onClick={submit} disabled={!canSubmit}>
					{isSubmitting ? <Spinner size="sm" /> : "投稿"}
				</Button>
			</div>

			{summaryError && (
				<p
					id={`${counterId}-error`}
					role="alert"
					aria-live="polite"
					className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-200"
				>
					{summaryError}
				</p>
			)}
		</section>
	);
}
