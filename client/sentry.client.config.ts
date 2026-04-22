// Browser-side Sentry SDK initialization.
// Runs in the user's browser for client components / App Router client boundaries.
//
// Configured from next.config.mjs via withSentryConfig().
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "local";
const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE; // set by CI via git SHA

Sentry.init({
  dsn,
  environment,
  release,
  // stg では低めのサンプリングに抑え、prod は Phase 9 で調整する。
  tracesSampleRate: environment === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // DSN が未設定のローカル環境では SDK を無効化してノイズを避ける。
  enabled: Boolean(dsn),
  // PII は送らない (ユーザーの投稿本文・プロフィール画像 URL など)。
  // 必要に応じて beforeSend で個別マスキングすること。
  sendDefaultPii: false,
  integrations: [
    // Session Replay の PII 漏洩対策 (security-reviewer PR #36 フィードバック)。
    // DM / ツイート本文 / プロフィール編集等を録画に含めないため、デフォルトで
    // 全文マスクと全メディアブロックを有効化する。特定のコンポーネントで
    // 表示内容を確認したい場合は DOM に `data-sentry-unmask` 属性を付与する。
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
