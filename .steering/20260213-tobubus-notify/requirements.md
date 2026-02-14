# 要求内容: 東武バス接近情報 LINE通知ツール

## 背景

東武バスの時刻表は遅延が多い。接近情報（遅延分数・到着予測時刻）はNAVITIMEのWebページで確認できるが、毎回サイトを開くのが面倒。定期的にチェックして遅延があればLINEに自動通知するツールを作成する。

## 変更・追加する機能

### スクレイピング
- NAVITIMEの東武バス接近情報ページ（SSR）をHTTP fetchで取得
- cheerioでHTML解析し、以下の情報を抽出:
  - 路線名
  - 接近状況（あと約X分で発車）
  - 状況詳細（始発バス停発車前 等）
  - 出発定刻・遅延分数・予測時刻
  - 到着定刻・遅延分数・予測時刻
  - 予測所要時間
  - 車両情報

### 通知
- **コンソール通知**: テスト・確認用にターミナルに出力
- **LINE通知**: LINE Messaging API（Push Message）を使用して遅延情報を送信

### 実行モード
- **ワンショット**: 1回取得して通知し終了
- **ウォッチ**: node-cronで定期チェック（デフォルト5分間隔）

### フィルタリング
- しきい値（分）以上の遅延のみ通知対象にする
- 同一バスの重複通知防止（30分以内の再通知を抑制）

## ユーザーストーリー

- バス利用者として、出発前に遅延状況をLINEで自動受信したい。毎回Webサイトを開く手間を省くために。
- バス利用者として、遅延がないときは通知を受けたくない。不要な通知でストレスを感じないために。

## 受け入れ条件

- [ ] `NOTIFICATION_TYPE=console npx tsx src/index.ts` で接近情報がコンソールに表示される
- [ ] LINE設定後、ワンショットモードでLINE通知が届く
- [ ] `--watch` で定期チェックが動作する
- [ ] `DELAY_THRESHOLD_MINUTES` で指定した分数未満の遅延は通知されない
- [ ] 同一バスの遅延が30分以内に再通知されない

## 制約事項

- NAVITIMEの接近情報はHTMLにのみ含まれる（JSON APIには遅延データなし）
- LINE Notifyは2025年3月末に終了済み → LINE Messaging APIを使用
- ページURLパラメータ: `departure-busstop`, `arrival-busstop`
- 対象ページURL: `https://transfer-cloud.navitime.biz/tobubus/approachings?departure-busstop={id}&arrival-busstop={id}`
