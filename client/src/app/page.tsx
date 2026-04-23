// Next.js Hello World for Phase 0.5 smoke test (P0.5-12).
//
// 本ページは stg への初回デプロイ確認用。/api/health/ を fetch して
// バックエンド疎通を画面で可視化する。Phase 1 で本物のランディング/TL に置換する。
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "エンジニア特化型 SNS (stg)",
  description:
    "Engineer-focused SNS staging environment. Real landing page ships in Phase 1.",
};

// NEXT_PUBLIC_* はクライアントバンドルに埋め込まれ、サーバー/クライアント両方で
// 参照可能な公開値。Sentry の environment / release はクライアントの
// sentry.client.config.ts も参照するため NEXT_PUBLIC_ で共有する。
const ENV = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "local";
const VERSION = process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? "dev";

type HealthStatus = "ok" | "degraded";

interface HealthResponse {
  status: HealthStatus;
  version?: string;
  db?: "ok" | "unreachable";
  time?: string;
}

interface HealthError {
  error: string;
}

type HealthResult = HealthResponse | HealthError;

async function fetchHealth(): Promise<HealthResult> {
  // stg では nginx/ALB 経由で /api/health/ に届く。ローカル Docker Compose
  // では api コンテナの DNS 名で直接呼ぶ。
  const base = process.env.API_BASE_URL ?? "http://api:8000";
  try {
    const response = await fetch(`${base}/api/health/`, {
      // SSR 時にキャッシュさせない (毎リクエストで live status を見たい)
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      // 詳細 (status text / body) はサーバー側のログにとどめ、画面には HTTP code のみ。
      console.error(`health fetch HTTP ${response.status}`); // eslint-disable-line no-console
      return { error: `API returned HTTP ${response.status}` };
    }
    return (await response.json()) as HealthResponse;
  } catch (err) {
    // 内部ホスト名 (http://api:8000) や stack trace を画面に出さない
    // (typescript-reviewer PR #56 HIGH: 情報漏洩対策)。詳細はサーバーログへ。
    console.error("health fetch failed", err); // eslint-disable-line no-console
    return { error: "API unavailable" };
  }
}

export default async function HelloPage() {
  const health: HealthResult = await fetchHealth();
  const isHealthy = "status" in health && health.status === "ok";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12">
      <div className="w-full space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            engineer-focused SNS — stg
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hello, stg 環境 🎉
          </h1>
          <p className="text-base text-muted-foreground">
            Phase 0.5 smoke test page. Phase 1 で本物の TL / ログインに置き換わる。
          </p>
        </header>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Build info</h2>
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-muted-foreground">Environment</dt>
            <dd className="font-mono">{ENV}</dd>
            <dt className="font-medium text-muted-foreground">Release</dt>
            <dd className="font-mono">{VERSION}</dd>
            <dt className="font-medium text-muted-foreground">Rendered at</dt>
            <dd className="font-mono">{new Date().toISOString()}</dd>
          </dl>
        </section>

        <section
          className={`rounded-lg border p-6 shadow-sm ${
            isHealthy
              ? "border-green-500/40 bg-green-50 dark:bg-green-950/30"
              : "border-red-500/40 bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <h2 className="text-xl font-semibold">
            API health:{" "}
            <span
              className={isHealthy ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
            >
              {isHealthy ? "OK" : "DEGRADED"}
            </span>
          </h2>
          <pre className="mt-4 overflow-x-auto rounded bg-black/80 p-4 font-mono text-xs text-white">
            {JSON.stringify(health, null, 2)}
          </pre>
        </section>

        <footer className="text-center text-xs text-muted-foreground">
          If you see this page in production, something went wrong —
          Phase 1 のランディングページに差し替えるまで stg 専用です。
        </footer>
      </div>
    </main>
  );
}
