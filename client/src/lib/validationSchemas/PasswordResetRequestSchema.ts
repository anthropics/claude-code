import * as z from "zod";

export const passwordResetRequestSchema = z.object({
	email: z
		.string()
		.trim()
		.email({ message: "有効なメールアドレスを入力してください" })
		.toLowerCase(),
});

export type TPasswordResetRequestSchema = z.infer<
	typeof passwordResetRequestSchema
>;
