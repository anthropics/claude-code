export function extractErrorMessage(error: unknown): string {
	try {
		const err = error as any;

		// Error インスタンスを優先
		if (
			err instanceof Error &&
			typeof err.message === "string" &&
			err.message
		) {
			return err.message;
		}

		const status = err?.status ?? err?.originalStatus;
		const data = err?.data ?? err?.error ?? err?.message ?? err;

		// 1) 文字列(HTML/テキスト)
		if (typeof data === "string") {
			const text = data.replace(/<[^>]*>/g, "").trim();
			if (text) return text;
		}

		// 2) number/boolean の場合
		if (typeof data === "number" || typeof data === "boolean") {
			return String(data);
		}

		// 3) Blob(バイナリ)の場合（同期的には中身を読めないため概要のみ）
		if (typeof Blob !== "undefined" && data instanceof Blob) {
			const ct = (data as Blob).type || "binary";
			return `Server returned ${ct} response. Please try again.`;
		}

		// 4) オブジェクト(JSON等)の場合
		if (data && typeof data === "object") {
			const obj = data as any;
			if (typeof obj.detail === "string" && obj.detail) return obj.detail;
			if (typeof obj.message === "string" && obj.message) return obj.message;
			if (Array.isArray(obj.non_field_errors)) {
				const joined = obj.non_field_errors
					.filter((x: unknown) => typeof x === "string")
					.join(" ");
				if (joined) return joined;
			}

			// 最初に見つかった文字列エラー（1段/2段ネストまで）
			try {
				for (const v of Object.values(obj)) {
					if (typeof v === "string" && v) return v;
					if (Array.isArray(v)) {
						const s = v.find((x) => typeof x === "string" && x);
						if (s) return s as string;
					}
					if (v && typeof v === "object") {
						for (const vv of Object.values(v as any)) {
							if (typeof vv === "string" && vv) return vv;
							if (Array.isArray(vv)) {
								const s2 = vv.find((x) => typeof x === "string" && x);
								if (s2) return s2 as string;
							}
						}
					}
				}
			} catch {
				// Object.values に失敗しても無視してフォールバックへ
			}
		}

		// 5) ここまでで拾えない場合のフォールバック
		if (typeof err === "string") {
			const text = err.replace?.(/<[^>]*>/g, "")?.trim?.() ?? String(err);
			if (text) return text;
		}

		if (status) return `Request failed (${status}). Please try again.`;
		return "Network or server error. Please try again.";
	} catch {
		return "An unexpected error occurred. Please try again.";
	}
}
