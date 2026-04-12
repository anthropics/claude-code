import * as z from "zod";

export const loginUserSchema = z.object({
	email: z
		.string()
		.trim()
		.email({ message: "有効なメールアドレスを入力してください" }),
	password: z
		.string()
		.min(8, { message: "パスワードは8文字以上で入力してください" }),
});

export type TLoginUserSchema = z.infer<typeof loginUserSchema>;
