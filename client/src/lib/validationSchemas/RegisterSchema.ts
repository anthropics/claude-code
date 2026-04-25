import * as z from "zod";

// SPEC §2.1 + apps/users/validators.py の `validate_handle` と一致させる。
// - 英数 + `_` のみ
// - 3〜30 文字
// - 予約語ブラックリスト
const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
const RESERVED_HANDLES = new Set([
	"admin",
	"api",
	"auth",
	"help",
	"me",
	"null",
	"root",
	"settings",
	"support",
	"system",
	"undefined",
]);

export const registerUserSchema = z
	.object({
		username: z
			.string()
			.trim()
			.regex(HANDLE_PATTERN, {
				message:
					"ハンドルは英数字とアンダースコア、3〜30 文字で入力してください",
			})
			.refine((value) => !RESERVED_HANDLES.has(value.toLowerCase()), {
				message: "このハンドルは使用できません",
			}),
		first_name: z
			.string()
			.trim()
			.min(1, { message: "名は1文字以上で入力してください" })
			.max(60, { message: "名は60文字以内で入力してください" }),
		last_name: z
			.string()
			.trim()
			.min(1, { message: "姓は1文字以上で入力してください" })
			.max(60, { message: "姓は60文字以内で入力してください" }),
		email: z
			.string()
			.trim()
			.email({ message: "有効なメールアドレスを入力してください" }),
		password: z
			.string()
			.min(8, { message: "パスワードは8文字以上で入力してください" })
			.max(128, { message: "パスワードは128文字以内で入力してください" }),
		re_password: z.string(),
		terms: z.literal(true, {
			errorMap: () => ({ message: "利用規約に同意してください" }),
		}),
	})
	.refine((data) => data.password === data.re_password, {
		message: "パスワードが一致しません",
		path: ["re_password"],
	});

export type TRegisterUserSchema = z.infer<typeof registerUserSchema>;

// NOTE: previously exported as TRregisterUserSchema (typo). Keep alias to avoid
// breaking ambient imports until all auth forms migrate to TRegisterUserSchema.
export type TRregisterUserSchema = TRegisterUserSchema;
