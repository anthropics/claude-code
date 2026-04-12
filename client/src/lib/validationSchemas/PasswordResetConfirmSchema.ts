import * as z from "zod";

export const passwordResetConfirmSchema = z
	.object({
		uid: z.string().trim(),
		token: z.string().trim(),
		new_password: z
			.string()
			.min(8, { message: "パスワードは8文字以上で入力してください" }),
		re_new_password: z.string().min(8, {
			message: "確認用パスワードは8文字以上で入力してください",
		}),
	})
	.refine((data) => data.new_password === data.re_new_password, {
		message: "パスワードが一致しません",
		path: ["re_new_password"],
	});

export type TPasswordResetConfirmSchema = z.infer<
	typeof passwordResetConfirmSchema
>;
