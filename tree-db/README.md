# 樹木台帳 🌳

シンプルで使いやすい樹木写真データベース。iPhone・iPad・PC対応。

## セットアップ

```bash
cd tree-db
pip install -r requirements.txt
python app.py
```

ブラウザで `http://localhost:5000` を開く。

## 機能

- 📷 写真付き樹木登録（カメラ直接撮影対応）
- 🔍 名前・場所・備考でリアルタイム検索
- 🎚️ 樹種・状態でフィルター
- 📱 iPhone / iPad 完全対応（ホーム画面追加可能）
- 🗑️ 削除時の確認モーダル

## 技術構成

- Python + Flask
- SQLite（`trees.db` が自動作成）
- Vanilla HTML/CSS/JS（依存なし）
