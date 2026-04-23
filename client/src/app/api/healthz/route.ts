// Lightweight Next.js health check (F-10).
//
// ALB target group "next" の health_check.path がこのエンドポイントを叩く。
// 従来は "/" を叩いていたが、SSR フルレンダがコストになるため 1 KB 未満の
// JSON レスポンスに差し替えた。body は version / env / time の最小限。
//
// architect PR #51 MEDIUM の指摘反映。Phase 1 Week 0 (F-10) で着手。
import { NextResponse } from "next/server";

// Route Handler をキャッシュさせない (ALB が 30s ごとに叩くので毎回最新を返す)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
	return NextResponse.json(
		{
			status: "ok",
			version: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "unknown",
			environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "local",
			time: new Date().toISOString(),
		},
		{
			status: 200,
			headers: {
				"Cache-Control": "no-store, max-age=0",
			},
		},
	);
}
