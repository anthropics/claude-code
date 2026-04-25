/**
 * Edit policy helpers (P1-20 / SPEC §3.5).
 *
 * SPEC §3.5 says:
 *   - A tweet can be edited up to 5 times.
 *   - Editing is only allowed within 30 minutes of the original ``created_at``.
 *
 * The backend enforces both constraints in ``Tweet.record_edit``. These
 * helpers mirror the same rules client-side so the edit button can be
 * disabled in-UI before the user types anything.
 */

export const EDIT_WINDOW_MS = 30 * 60 * 1000;
export const EDIT_MAX_COUNT = 5;

export interface TweetEditPolicyInput {
	createdAt: string | Date;
	editCount: number;
	now?: Date;
}

export interface TweetEditPolicyResult {
	isEditable: boolean;
	reason?: "time-exceeded" | "count-exceeded" | "future-created" | null;
	msRemaining: number;
	editsRemaining: number;
}

export function evaluateEditPolicy({
	createdAt,
	editCount,
	now = new Date(),
}: TweetEditPolicyInput): TweetEditPolicyResult {
	const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
	const elapsed = now.getTime() - created.getTime();
	const msRemaining = Math.max(0, EDIT_WINDOW_MS - elapsed);
	const editsRemaining = Math.max(0, EDIT_MAX_COUNT - editCount);

	if (Number.isNaN(created.getTime())) {
		return {
			isEditable: false,
			reason: "future-created",
			msRemaining: 0,
			editsRemaining,
		};
	}
	if (elapsed < 0) {
		return {
			isEditable: false,
			reason: "future-created",
			msRemaining: EDIT_WINDOW_MS,
			editsRemaining,
		};
	}
	if (editCount >= EDIT_MAX_COUNT) {
		return {
			isEditable: false,
			reason: "count-exceeded",
			msRemaining: 0,
			editsRemaining,
		};
	}
	if (msRemaining <= 0) {
		return {
			isEditable: false,
			reason: "time-exceeded",
			msRemaining: 0,
			editsRemaining,
		};
	}
	return {
		isEditable: true,
		reason: null,
		msRemaining,
		editsRemaining,
	};
}
