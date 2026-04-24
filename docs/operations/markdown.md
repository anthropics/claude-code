# Markdown レンダリング (P1-09 / SPEC §3)

ツイート本文は 180 字以内の **Markdown 原文** として保存し、表示時に
サーバー側で HTML に変換する。XSS 防御は bleach の allowlist ベースで行う。

このドキュメントは `apps/tweets/rendering.py` の運用ガイドである。

## 1. パイプライン

```
Markdown source (<=180 chars)
  └─> markdown2.convert()               # Markdown -> HTML
      └─> bleach.clean()                # allowlist サニタイズ
          └─> bleach.linkify()          # 裸 URL を <a> 化 + target/rel 強制
              └─> safe HTML (to client, Shiki で再ハイライト)
```

## 2. 公開 API

| 関数                                                      | 用途                                      |
| --------------------------------------------------------- | ----------------------------------------- |
| `render_markdown(source) -> str`                          | 通常のレンダリング (一覧表示・詳細表示)   |
| `extract_plaintext(source) -> str`                        | OGP description / 検索 index / メール通知 |
| `get_markdown_html_with_cache_key(source) -> (html, key)` | 将来の Redis cache 用                     |

いずれも **入力側の 180 字上限は呼び出し側で保証する前提**。レンダラは
長さ検証を行わない (その責務は `apps/tweets/models.Tweet.body` の
`max_length` と `full_clean` にある)。

## 3. 許可タグ / 属性 / プロトコル

allowlist は `config/settings/base.py` にある以下の 3 定数で一元管理する:

- `MARKDOWN_BLEACH_ALLOWED_TAGS`
- `MARKDOWN_BLEACH_ALLOWED_ATTRS`
- `MARKDOWN_BLEACH_ALLOWED_PROTOCOLS` (= `['http', 'https', 'mailto']`)

allowlist を緩める変更は **security-reviewer agent でのレビュー必須**。
特に以下のタグ/属性を追加する場合は慎重に判断すること:

- `script`, `style`, `iframe`, `object`, `embed` -> 禁止
- 全タグへの `class` / `id` ワイルドカード付与 -> 禁止
  (UI を欺くクラス名による click-jacking 対策、PR #84 の指摘事項)
- `style` 属性 -> 禁止 (CSS injection によるユーザー位置の特定・フィッシング対策)
- `javascript:` / `data:` プロトコル -> 禁止

allowlist を変更したら **cache key の先頭 (`_RENDER_PIPELINE_VERSION`)
をインクリメント** する。古い cache から危険な HTML が復元されるのを防ぐ。

## 4. コードブロックと Shiki の分担

- サーバー側 (このモジュール):
  ` ```python\nprint(1)\n``` ` -> `<pre><code class="python language-python">print(1)\n</code></pre>`
  (markdown2 の `fenced-code-blocks` + `highlightjs-lang` extra による出力)
- クライアント側 (Next.js / Shiki):
  `<code class="language-*">` を検出して Shiki で再ハイライトする。
  結果として `<span style="color:#...">` がクライアント DOM に差し込まれるが、
  これはユーザー入力ではないのでサーバー側で `style` を許可する必要はない。

Pygments はサーバー側シンタックスハイライトには **使わない**
(見た目・テーマ切替をフロントエンド側で完結させるため)。

## 5. リンク処理

- Markdown の `[text](url)` は markdown2 の `target-blank-links` extra で
  `target="_blank" rel="noopener"` が付く。
- 生 HTML の `<a href="...">` や、本文中に貼られた裸 URL は bleach.linkify の
  コールバック `_linkify_callback` で以下を **上書き付与**:
  - `target="_blank"`
  - `rel="nofollow noopener"` (既存 rel とマージ)
- `javascript:` / `data:` は bleach.clean の `protocols` allowlist で除去される。
- `//evil.example/...` のような **protocol-relative URL** は bleach の `protocols`
  allowlist を素通りするため、`_strip_protocol_relative_urls` で bleach 後段に
  `src="//..."` / `href="//..."` 属性を除去する (PR #134 review HIGH)。

## 6. 将来の Redis キャッシュ戦略 (P2+)

`get_markdown_html_with_cache_key` は今は cache を叩かずに key だけ返す。
P2 以降で導入するときは以下の形を想定:

```python
html, key = get_markdown_html_with_cache_key(tweet.body)
cached = cache.get(f"md:{key}")
if cached is not None:
    return cached
cache.set(f"md:{key}", html, timeout=60 * 60 * 24)
return html
```

- key は `sha256(source + ALLOWED_TAGS + ALLOWED_ATTRS + ALLOWED_PROTOCOLS + pipeline_version)[:16]`
- tag だけでなく ATTRS / PROTOCOLS も材料に含めるため、属性やプロトコル
  だけ絞った場合でも古い (= 緩い allowlist で生成した) cache を踏まない
  (PR #134 review MEDIUM)
- pipeline version を上げれば allowlist 以外のロジック変更後も古い cache を踏まない
- 編集頻度が低い (1 ツイート最大 5 回編集) ため cache TTL は長め (24h) で良い

## 7. テスト

`apps/tweets/tests/test_rendering.py` に 47 ケース:

- 基本 syntax (見出し / 強調 / 取り消し線 / コード / リスト)
- リンクと XSS 防御 (`javascript:` / `data:` / `<script>` / `<iframe>` / on\* ハンドラ)
- Protocol-relative URL 除去 (`<img src="//...">` / `<a href="//...">`)
- `<span class="...">` の除去 (UI 欺瞞対策)
- URL 自動リンク (コード中は除外)
- `extract_plaintext` のタグ除去 + `<script>` / `<style>` / `<noscript>` 本体除去
- cache key の決定性 (source / ATTRS / PROTOCOLS 感度)

DB を必要としない純粋関数のテストなので CI での実行コストは小さい。
