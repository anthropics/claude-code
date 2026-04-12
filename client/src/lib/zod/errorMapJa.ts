import type { ZodErrorMap } from "zod";

export const jaErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case "invalid_type": {
      if (issue.received === "undefined") return { message: "必須項目です" };
      return { message: "不正な値です" };
    }
    case "invalid_string": {
      if (issue.validation === "email") return { message: "有効なメールアドレスを入力してください" };
      if (issue.validation === "url") return { message: "有効なURLを入力してください" };
      if (issue.validation === "uuid") return { message: "有効なUUIDを入力してください" };
      return { message: "文字列の形式が正しくありません" };
    }
    case "too_small": {
      if (issue.type === "string") {
        return { message: `${issue.minimum}文字以上で入力してください` };
      }
      if (issue.type === "array") {
        return { message: `${issue.minimum}件以上を指定してください` };
      }
      if (issue.type === "number") {
        return { message: `${issue.minimum}以上の数値を入力してください` };
      }
      return { message: ctx.defaultError };
    }
    case "too_big": {
      if (issue.type === "string") {
        return { message: `${issue.maximum}文字以内で入力してください` };
      }
      if (issue.type === "array") {
        return { message: `${issue.maximum}件以内で指定してください` };
      }
      if (issue.type === "number") {
        return { message: `${issue.maximum}以下の数値を入力してください` };
      }
      return { message: ctx.defaultError };
    }
    case "custom": {
      return { message: (issue.params as any)?.message ?? ctx.defaultError };
    }
    default:
      return { message: ctx.defaultError };
  }
};

