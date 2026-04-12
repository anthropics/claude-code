import * as z from "zod";

const usernameRegex = /^[a-zA-Z0-9_@+.-]+$/;

export const registerUserSchema = z
	.object({
		username: z.string().regex(usernameRegex, {
			message:
				"ユーザー名は英数字、_, @, +, ., - のみ使用できます",
		}),
		first_name: z
			.string()
			.trim()
			.min(2, { message: "名は2文字以上で入力してください" })
			.max(50, { message: "名は50文字以内で入力してください" }),
		last_name: z
			.string()
			.trim()
			.min(2, { message: "姓は2文字以上で入力してください" })
			.max(50, { message: "姓は50文字以内で入力してください" }),
		email: z
			.string()
			.trim()
			.email({ message: "有効なメールアドレスを入力してください" }),
		password: z
			.string()
			.min(8, { message: "パスワードは8文字以上で入力してください" }),
		re_password: z.string().min(8, {
			message: "確認用パスワードは8文字以上で入力してください",
		}),
	})
	.refine((data) => data.password === data.re_password, {
		message: "パスワードが一致しません",
		path: ["re_password"],
	});

export type TRregisterUserSchema = z.infer<typeof registerUserSchema>;
