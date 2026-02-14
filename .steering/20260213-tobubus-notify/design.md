# 設計: 東武バス接近情報 LINE通知ツール

## 実装アプローチ

### アーキテクチャ

GitHub Actions Scheduled Workflow によるワンショット実行。

```
GitHub Actions (cron: */5 7-8 * * 1-5)
  → npm install & npx tsx src/index.ts
    → fetch HTML (NAVITIME)
    → cheerio parse
    → LINE Messaging API push
```

- 常駐プロセスなし（`node-cron` 不要）
- スケジューリングはGitHub Actions側の責務
- 実行時間: 数秒/回

### スケジュール

- **平日（月〜金）7:00〜8:59 JST** に5分間隔で実行
- GitHub Actionsのcronは **UTC** → `*/5 22-23 * * 0-4`（JST月〜金 7:00-8:59相当）
  - UTC日曜22:00 = JST月曜7:00
  - UTC木曜23:55 = JST金曜8:55
- 注意: GitHub Actionsのcronは数分の遅延がありうる（許容範囲）

### 重複通知防止の方針

GitHub Actionsは毎回新規プロセスのため、インメモリMapは使えない。

**方針: 重複防止は行わない**

- 5分間隔で同じバスの遅延を再通知しても実害が小さい（朝の時間帯、数回程度）
- 外部状態（Cache, DB等）を導入するとライトさが損なわれる
- しきい値フィルタリング（`DELAY_THRESHOLD_MINUTES`）で通知量を制御

## プロジェクト構造

```
tobubus-notify/
├── .github/
│   └── workflows/
│       └── bus-notify.yml    # GitHub Actions定義
├── package.json
├── tsconfig.json
├── .env.example              # ローカル開発用テンプレート
├── src/
│   ├── index.ts              # エントリポイント（ワンショット実行）
│   ├── scraper.ts            # HTML取得 + パース
│   ├── notifiers/
│   │   ├── line.ts           # LINE Messaging API送信
│   │   └── console.ts        # コンソール出力（テスト用）
│   └── types.ts              # 型定義
└── README.md
```

### 既存実装からの変更点

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| `node-cron` 依存 | あり | **削除** |
| `--watch` モード | あり | **削除** |
| インメモリ重複防止 | あり | **削除** |
| GitHub Actions workflow | なし | **追加** |
| `dotenv` 依存 | あり | ローカル開発用に**維持** |

## コンポーネント設計

### src/index.ts（エントリポイント）

- ワンショット実行のみ
- 環境変数から設定を読み込み
- `fetchApproaches()` → 遅延フィルタ → `notifier.notify()`
- 接近情報なし or しきい値未満 → 正常終了（通知なし）

### src/scraper.ts（スクレイパー）

変更なし。`fetchApproaches()` + `parseApproaches()` をそのまま利用。

### src/notifiers/line.ts（LINE通知）

変更なし。LINE Messaging API Push Messageを送信。

### src/notifiers/console.ts（コンソール通知）

変更なし。ローカルテスト用。

### .github/workflows/bus-notify.yml

```yaml
name: Bus Approach Notify
on:
  schedule:
    - cron: "*/5 22-23 * * 0-4"  # 平日JST 7:00-8:59
  workflow_dispatch: {}            # 手動実行用
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: tobubus-notify/package-lock.json
      - run: npm ci
        working-directory: tobubus-notify
      - run: npx tsx src/index.ts
        working-directory: tobubus-notify
        env:
          NOTIFICATION_TYPE: line
          LINE_CHANNEL_ACCESS_TOKEN: ${{ secrets.LINE_CHANNEL_ACCESS_TOKEN }}
          LINE_USER_ID: ${{ secrets.LINE_USER_ID }}
          DEPARTURE_BUSSTOP_ID: ${{ vars.DEPARTURE_BUSSTOP_ID }}
          ARRIVAL_BUSSTOP_ID: ${{ vars.ARRIVAL_BUSSTOP_ID }}
          DELAY_THRESHOLD_MINUTES: ${{ vars.DELAY_THRESHOLD_MINUTES }}
```

## シークレット・変数の管理

GitHub リポジトリの Settings で設定:

**Secrets**（機密情報）:
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_USER_ID`

**Variables**（設定値）:
- `DEPARTURE_BUSSTOP_ID`（デフォルト: `00310821`）
- `ARRIVAL_BUSSTOP_ID`（デフォルト: `00310511`）
- `DELAY_THRESHOLD_MINUTES`（デフォルト: `3`）

## 影響範囲

- `package.json`: `node-cron`, `@types/node-cron` 依存を削除
- `src/index.ts`: `--watch` モード、`node-cron` import、重複防止ロジックを削除
- 新規追加: `.github/workflows/bus-notify.yml`
