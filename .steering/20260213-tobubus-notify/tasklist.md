# タスクリスト: 東武バス接近情報 LINE通知ツール

## タスク一覧

- [x] 1. `node-cron` 関連の削除
  - `package.json` から `node-cron`, `@types/node-cron` を削除
  - `npm install` で `package-lock.json` 更新

- [x] 2. `src/index.ts` の簡素化
  - `node-cron` import 削除
  - `--watch` モード削除
  - インメモリ重複防止ロジック（`notifiedMap`, `deduplicateApproaches`）削除
  - ワンショット実行のみに整理

- [x] 3. GitHub Actions workflow 作成
  - `.github/workflows/bus-notify.yml` を作成
  - cron: `*/5 22-23 * * 0-4`（平日JST 7:00-8:59）
  - `workflow_dispatch` で手動実行も可能に
  - Secrets/Variables を環境変数として渡す

- [x] 4. README.md 更新
  - GitHub Actions での運用方法を記載
  - Secrets/Variables の設定手順を追加
  - `--watch` モードの記述を削除

- [x] 5. TypeScript ビルド確認
  - `npx tsc --noEmit` でエラーなし
