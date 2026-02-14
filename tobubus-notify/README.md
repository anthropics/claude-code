# 東武バス接近情報 LINE通知ツール

東武バスの接近情報（遅延分数・到着予測時刻）を定期的にチェックし、遅延があればLINEに自動通知するツールです。

## 機能

- NAVITIMEの東武バス接近情報ページをスクレイピング
- 遅延情報をLINEまたはコンソールに通知
- しきい値による遅延フィルタリング
- GitHub Actionsで平日朝のみ定期実行

## アーキテクチャ

```
GitHub Actions (cron: 平日 JST 7:00-8:59 / 5分間隔)
  → npx tsx src/index.ts
    → fetch HTML (NAVITIME)
    → cheerio parse
    → LINE Messaging API push
```

## 必要環境

- Node.js 20以上

## ローカル実行

```bash
cd tobubus-notify
npm install
cp .env.example .env  # 設定を編集

# コンソール出力で確認
npx tsx src/index.ts

# LINE通知テスト
NOTIFICATION_TYPE=line npx tsx src/index.ts
```

## GitHub Actions での運用

### 1. LINE Messaging API のセットアップ

1. [LINE Developers](https://developers.line.biz/) にログイン
2. プロバイダーを作成（任意の名前）
3. 「Messaging API」チャンネルを作成
4. チャンネル基本設定から「チャンネルアクセストークン（長期）」を発行
5. チャンネル基本設定のQRコードから、LINE Official Accountを友だち追加
6. 「あなたのユーザーID」を確認

### 2. GitHub リポジトリの設定

**Settings → Secrets and variables → Actions** で以下を設定:

#### Secrets（機密情報）

| Name | 値 |
|------|-----|
| `LINE_CHANNEL_ACCESS_TOKEN` | チャンネルアクセストークン |
| `LINE_USER_ID` | ユーザーID |

#### Variables（設定値、任意）

| Name | デフォルト | 説明 |
|------|-----------|------|
| `DEPARTURE_BUSSTOP_ID` | `00310821` | 出発バス停ID |
| `ARRIVAL_BUSSTOP_ID` | `00310511` | 到着バス停ID |
| `DELAY_THRESHOLD_MINUTES` | `3` | 遅延通知しきい値（分） |

### 3. 動作確認

リポジトリの **Actions** タブ → **Bus Approach Notify** → **Run workflow** で手動実行できます。

### スケジュール

平日（月〜金）JST 7:00〜8:59 に5分間隔で自動実行されます。

## バス停IDの調べ方

NAVITIMEの東武バスページで路線を検索し、URLのパラメータから確認できます。

```
https://transfer-cloud.navitime.biz/tobubus/approachings?departure-busstop=XXXXXXXX&arrival-busstop=YYYYYYYY
```

`XXXXXXXX` が出発バス停ID、`YYYYYYYY` が到着バス停IDです。
