# ツイート文字数カウント (P1-10 / SPEC §3.3)

ツイート本文 (最大 180 字) は「見た目の文字数」で制限する。
本ドキュメントは `apps/tweets/char_count.py` の運用ガイドである。

Backend 実装: `apps/tweets/char_count.py`
Frontend 実装 (別 Issue): P1-16 (TypeScript で同一ロジックを再実装)

## 1. 計算ルール

| 要素               | カウント                                                    |
| ------------------ | ----------------------------------------------------------- |
| 通常の文字         | 1 codepoint = 1 字                                          |
| 全角 / 半角        | 区別しない (どちらも 1 字)                                  |
| 改行 `\n`          | 1 字                                                        |
| URL (http/https)   | **一律 23 字** (実際の長さに関わらず、SPEC §3.3)            |
| Markdown 記号      | **カウントしない** (マーカーのみ除去、中身はカウント)       |
| コードブロック中身 | 通常カウント (フェンス行 ` ``` ` とインライン `` ` `` 除去) |
| 絵文字 (BMP 内)    | 1 codepoint = 1 字                                          |
| 絵文字 ZWJ 連結    | 各 codepoint を 1 字として加算 (grapheme cluster ではない)  |

絵文字は Unicode **codepoint** ベースで数える。Python 標準 `len(str)`
相当。grapheme cluster 単位で数えたい場合は `regex` パッケージ等の導入が
必要だが、現フェーズでは codepoint 近似で十分としている。

## 2. 公開 API

`apps/tweets/char_count.py`:

| 関数 / 定数                                        | 用途                 |
| -------------------------------------------------- | -------------------- |
| `count_tweet_chars(source: str) -> int`            | 見た目の文字数を返す |
| `is_tweet_within_limit(source, limit=180) -> bool` | 上限チェック         |
| `URL_LENGTH = 23`                                  | URL 換算の定数       |
| `TWEET_MAX_CHARS = 180`                            | ツイート本文の上限   |

## 3. 処理フロー

````
source (Markdown 原文)
  ├─ 1. URL 抽出 (http(s)://...)
  │     - 抽出された URL を placeholder "\x00" 1 字に置換
  │     - URL 件数を保持 (後で 23 字換算で足し戻す)
  │
  ├─ 2. Markdown 記号の除去
  │     (行頭トークン)
  │     - フェンスコード開始/終了行 ```lang / ```  → 行ごと削除
  │     - 水平線 `^---+$`                          → 行ごと削除
  │     - 見出し `^#{1,6}\s+`                      → マーカー削除
  │     - 番号付きリスト `^\s*\d+\.\s+`            → マーカー削除
  │     - リスト `^\s*[-*+]\s+`                    → マーカー削除
  │     - 引用 `^\s*>+\s*`                         → マーカー削除
  │
  │     (インライン)
  │     - 画像 `![alt](url)`  → alt だけ残す
  │     - リンク `[label](url)` → label だけ残す
  │     - 強調 `**x**` / `__x__`  → x
  │     - 強調 `*x*`   / `_x_`    → x
  │     - 打ち消し `~~x~~`         → x
  │     - インラインコード `` `x` ``  → x
  │
  ├─ 3. URL を 23 字換算
  │     - placeholder 1 字を URL_LENGTH (23) に展開したと等価になるよう
  │       (URL_LENGTH - 1) × url_count を最終 len に足す
  │
  └─ 4. 最終 len(str) を返す (codepoint 数)
````

## 4. エッジケース

### URL 抽出と Markdown リンクの共存

`[label](https://example.com)` のような Markdown リンク内 URL も
URL として認識する必要がある。URL 抽出 regex は空白以外を拾う貪欲マッチ
だが、Markdown リンク共存のため **閉じ括弧 `)` / `]` は URL に含めない**。

### URL に `)` を含めたい場合

`(https://a.com)` → URL 部分は `https://a.com` (23 字) + カッコ 2 字 = 25 字。
URL 自体に `)` を含めたい用途は稀だが、必要なら行末に置くか
`<url>` アングル記法での表記を運用で推奨する (現状の regex は `<>` を処理しない)。

### 強調マーカーの重複

`***x***` の場合、まず `**` 除去 → `*x*` → 最終的に `x` (1 字) となる。
マーカー除去順は `**/__` → `*/_` の順で実装している。

### 水平線と区切り

行全体が `^\s*---+\s*$` にマッチするときのみ水平線として除去する。
本文中の `---` (ダッシュ 3 連続だが改行外) は通常テキスト扱い。

## 5. テスト

`apps/tweets/tests/test_char_count.py` に 40+ ケースを配置。

主な境界値:

- 空文字列 → 0
- 日本語 / 絵文字 / 半角 / 全角
- URL 単独 / 複数 / 長い URL / 短い URL / クエリ付き URL / 大文字スキーム
- Markdown: 見出し (`#` 〜 `######`) / 強調 (`**`, `__`, `*`, `_`) /
  打ち消し / インラインコード / リスト (`-`, `*`, `+`, 数字) / 引用 / 水平線
- リンク / 画像
- フェンスコード (言語指定あり / なし)
- 180 字ちょうど (OK) / 181 字 (NG)
- URL 5 個 + 区切り = 119 字 (OK)

## 6. 呼び出し箇所

- `apps.tweets.models.Tweet.clean()` — P1-08 の CRUD API で `full_clean` 経由
- `apps.tweets.models.Tweet.record_edit()` — 編集時の見た目文字数チェック

CharField(max_length=180) が **raw 文字数**を DB / Django レベルで強制し、
本モジュールは **見た目文字数** (URL 換算 + Markdown 除外) の追加制約を担う。
二重のガードで SPEC §3 / §3.3 / §3.5 を満たす。

## 7. Frontend (P1-16) との一致

P1-16 で実装する TypeScript 版は本 Python 版と **同じ結果** を返すこと。
具体的には以下の同値性を保証する。

- URL 抽出 regex: `https?://[^\s)\]]+` (大文字小文字無視)
- 置換順序: 行頭 → 画像 → リンク → 強調 → 打ち消し → インラインコード
- placeholder は内部実装 (TS 版は文字列切り出し +カウンタでも可)
- 最終値は JS `String.length` (UTF-16 code unit) ではなく
  `[...s].length` (codepoint 数) を使う (絵文字対応)

実装が乖離したら両方同時修正するのが原則。差分検出のために
同一テストケース (`test_char_count.py` / `charCount.test.ts`) を用意する。
