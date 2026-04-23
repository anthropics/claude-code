import { withSentryConfig } from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // F-11: dev-only ページをバンドル含む/含まないで切り替える。
  // `dev.tsx` / `dev.ts` 拡張子は development ビルドだけ pageExtensions に含める。
  // production build では `page.dev.tsx` 等の dev-only ページ/ルートハンドラは
  // そもそも Next.js の page discovery 対象外になるため、bundle にも含まれない。
  // 詳細: https://nextjs.org/docs/app/api-reference/next-config-js/pageExtensions
  pageExtensions: isDevelopment
    ? ["dev.tsx", "dev.ts", "tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js"],
};

// Sentry webpack plugin options. DSN やプロジェクト設定は env 経由。
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
const sentryWebpackPluginOptions = {
  // 組織・プロジェクト名は CI で env から渡す (SENTRY_ORG / SENTRY_PROJECT)。
  // Auth token も SENTRY_AUTH_TOKEN (GitHub Actions secret) で提供。
  //
  // silent: false で sourceMap upload 失敗等をビルドログに表示する
  // (security-reviewer PR #36 フィードバック)。CI で拾えるようにしておく。
  silent: false,
  // sourceMaps を Sentry にアップロードするがクライアントには公開しない
  hideSourceMaps: true,
  // 未使用のバンドル解析を省略
  disableLogger: true,
};

const sentryOptions = {
  // Sentry SDK の tunneling を有効化してアドブロッカー経由での計測漏れを抑止
  // 参考: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/adblockers/
  tunnelRoute: "/monitoring/sentry",
};

// DSN が未設定のローカル環境では Sentry ラッピングをスキップし、
// ビルド時の auth token エラーを避ける。
//
// production / stg では DSN が必須なので、env で "production" 指定されている
// にも関わらず DSN が空の場合はビルドを fail させる
// (security-reviewer PR #36 フィードバック: prod 誤スキップ防止)。
const hasDsn = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
);
const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.SENTRY_ENVIRONMENT ||
  "local";

if (!hasDsn && (environment === "production" || environment === "stg")) {
  throw new Error(
    `Sentry DSN is required for environment="${environment}". ` +
      `Set NEXT_PUBLIC_SENTRY_DSN (and SENTRY_DSN for server runtime).`,
  );
}

export default hasDsn
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions)
  : nextConfig;
