import * as z from "zod";

// SPEC §2 + apps/users/models.py の制約と揃える。
// - display_name: 1〜50 字必須 (backend CharField max_length=50)
// - bio: 0〜160 字任意 (backend CharField max_length=160)
export const onboardingSchema = z.object({
	display_name: z
		.string()
		.trim()
		.min(1, { message: "表示名を入力してください" })
		.max(50, { message: "表示名は50文字以内で入力してください" }),
	bio: z
		.string()
		.max(160, { message: "自己紹介は160文字以内で入力してください" })
		.optional()
		.default(""),
});

export type TOnboardingSchema = z.infer<typeof onboardingSchema>;
