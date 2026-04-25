"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseDrfErrors } from "@/lib/api/errors";
import { updateTweet, type TweetSummary } from "@/lib/api/tweets";
import { TWEET_MAX_CHARS, countTweetChars } from "@/lib/tweets/charCount";
import {
	evaluateEditPolicy,
	type TweetEditPolicyResult,
} from "@/lib/tweets/editPolicy";

interface TweetEditFormProps {
	tweet: Pick<TweetSummary, "id" | "body" | "created_at" | "edit_count">;
	onEdited: (tweet: TweetSummary) => void;
	onCancel: () => void;
}

function formatMinutes(ms: number): string {
	const minutes = Math.max(0, Math.floor(ms / 60_000));
	const seconds = Math.max(0, Math.floor((ms % 60_000) / 1000));
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function disabledReason(result: TweetEditPolicyResult): string | undefined {
	if (result.isEditable) return undefined;
	switch (result.reason) {
		case "time-exceeded":
			return "投稿から30分を超えたため編集できません";
		case "count-exceeded":
			return "編集回数が上限 (5 回) に達しました";
		default:
			return "編集できません";
	}
}

/**
 * Inline edit form for a tweet (P1-20).
 *
 * Respects SPEC §3.5 constraints (30 minutes, 5 edits) client-side via
 * ``evaluateEditPolicy``; the backend ``Tweet.record_edit`` is the authoritative
 * gate so even if the UI is bypassed the server will 400.
 */
export default function TweetEditForm({
	tweet,
	onEdited,
	onCancel,
}: TweetEditFormProps) {
	const textareaId = useId();
	const counterId = useId();
	const [body, setBody] = useState(tweet.body);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [summaryError, setSummaryError] = useState<string | undefined>();

	const policy = useMemo(
		() =>
			evaluateEditPolicy({
				createdAt: tweet.created_at,
				editCount: tweet.edit_count,
			}),
		[tweet.created_at, tweet.edit_count],
	);

	const charCount = useMemo(() => countTweetChars(body), [body]);
	const remaining = TWEET_MAX_CHARS - charCount;
	const isOverLimit = remaining < 0;
	const isUnchanged = body === tweet.body;

	const canSubmit =
		policy.isEditable &&
		!isSubmitting &&
		!isOverLimit &&
		!isUnchanged &&
		charCount > 0;

	const submit = useCallback(async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setSummaryError(undefined);
		try {
			const updated = await updateTweet(tweet.id, { body });
			toast.success("編集しました");
			onEdited(updated);
		} catch (error) {
			setSummaryError(parseDrfErrors(error).summary);
		} finally {
			setIsSubmitting(false);
		}
	}, [body, canSubmit, onEdited, tweet.id]);

	const reasonMessage = disabledReason(policy);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="flex flex-col gap-3"
			aria-labelledby={`${textareaId}-label`}
		>
			<label
				id={`${textareaId}-label`}
				htmlFor={textareaId}
				className="sr-only"
			>
				ツイートを編集
			</label>
			<Textarea
				id={textareaId}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				aria-describedby={counterId}
				disabled={!policy.isEditable || isSubmitting}
				rows={4}
			/>

			<div className="flex items-center justify-between text-xs">
				<div id={counterId} aria-live="polite">
					{charCount} / {TWEET_MAX_CHARS} |{" "}
					{policy.isEditable
						? `残り編集回数 ${policy.editsRemaining} / 時間 ${formatMinutes(policy.msRemaining)}`
						: reasonMessage ?? ""}
				</div>
			</div>

			{summaryError && (
				<p
					role="alert"
					aria-live="polite"
					className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-200"
				>
					{summaryError}
				</p>
			)}

			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="secondary"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					キャンセル
				</Button>
				<Button type="submit" disabled={!canSubmit}>
					{isSubmitting ? <Spinner size="sm" /> : "保存"}
				</Button>
			</div>
		</form>
	);
}
