"""Markdown レンダラ (P1-09 / SPEC §3)。

ツイート本文は 180 字以内の Markdown 原文として格納し、表示時に HTML を
生成する。XSS 対策として必ず bleach でサニタイズしたうえで、URL の自動
リンク化 (linkify) までをこのモジュールで完結させる。

方針:
    - markdown2 で Markdown → HTML。fenced-code-blocks は Shiki でフロント側
      再ハイライトする前提なので、Pygments 出力の ``<div class="codehilite">``
      ラッパは使わず ``highlightjs-lang`` extra で ``<code class="language-xxx">``
      レベルに留める。
    - bleach.clean で ``settings.MARKDOWN_BLEACH_*`` に宣言したホワイトリスト
      だけ残す。``javascript:`` / ``data:`` などの危険プロトコルはここで除去。
    - bleach.linkify でベア URL を ``<a>`` 化しつつ、``target="_blank"`` +
      ``rel="nofollow noopener"`` を強制付与する。既存の ``<a>`` にも同様の
      属性を注入する (target-blank-links extra の結果を上書き補強するイメージ)。

フロントエンド (Next.js / Shiki) との分担:
    - このモジュールは言語名のクラスまで付けた HTML を返す。
    - Shiki のシンタックスハイライト処理はクライアント側で行う
      (``<span style="...">`` を差し込むのは JS 側なので、ここで ``style``
      属性を許可しない方針で問題ない)。

docs/operations/markdown.md に将来的な Redis キャッシュ戦略もまとめている。
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

import bleach
import markdown2
from django.conf import settings

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

# markdown2 extras:
#   - fenced-code-blocks:  ```lang\n...\n``` 記法を有効化
#   - highlightjs-lang:    ↑ の出力に ``class="<lang> language-<lang>"`` を付与
#                          これにより Pygments の codehilite ラッパを回避しつつ
#                          Shiki / highlight.js 互換の class 名が得られる。
#   - code-friendly:       `_` で囲ったテキストを強調としては扱わない (変数名保持)
#   - tables:              パイプ記法のテーブル
#   - break-on-newline:    単一改行を <br> に変換 (SNS 投稿の慣習)
#   - strike:              ~~text~~ を <s>text</s> に
#   - target-blank-links:  外部 <a> に target="_blank" rel="noopener" を付与
_MARKDOWN_EXTRAS: dict[str, Any] = {
    "fenced-code-blocks": {},
    "highlightjs-lang": None,
    "code-friendly": None,
    "tables": None,
    "break-on-newline": None,
    "strike": None,
    "target-blank-links": None,
}

# linkify が <a> に強制付与する rel 値。security-reviewer 的には
# nofollow + noopener を最低限維持する (noreferrer は OGP プレビューを壊す
# ケースがあるので今回は入れない)。
_LINKIFY_REL_VALUES = ("nofollow", "noopener")

# cache key の衝突を避けるためのバージョンタグ。
# bleach allowlist を変えたが source は不変、という状況で古い cache を
# 踏まないよう、ハッシュ計算にこのタグを混ぜ込む。
#
# v2 (PR #134 review 吸収): protocol-relative URL の除去 / scripting block
# の前処理 / ATTRS & PROTOCOLS を cache key 材料に追加 のため bump。
_RENDER_PIPELINE_VERSION = "p1-09-v2"

# cache key の文字数。SHA-256 の前半 16 文字 = 64bit 相当で衝突率は実用上十分。
_CACHE_KEY_HEX_LENGTH = 16

# security-reviewer (PR #134) 指摘: bleach の ``protocols`` allowlist は
# ``javascript:`` など明示スキームしか見ないため ``//evil.example/x.gif`` の
# ような protocol-relative URL を素通りさせ、トラッキングピクセル / CSRF
# フォーム POST 踏み台に悪用される。``src``/``href`` 属性値がスラッシュ 2 個
# で始まるパターンを bleach 後段で潰す。
_PROTOCOL_RELATIVE_ATTR_RE = re.compile(
    r'\s(src|href)="//[^"]*"',
    re.IGNORECASE,
)

# security-reviewer (PR #134) 指摘: bleach.clean(strip=True) はタグを剥がすが
# text 内容 (例: ``<script>alert(1)</script>`` の ``alert(1)``) はそのまま
# 残してしまう。``extract_plaintext`` では OGP description や全文検索 index
# に使うため、scripting 意図の文字列自体を混入させない。``<script>``
# ``<style>`` ``<noscript>`` は開始タグ〜終了タグまでを前処理で丸ごと除去。
_SCRIPTING_BLOCK_RE = re.compile(
    r"<(script|style|noscript)\b[^>]*>.*?</\1\s*>",
    re.IGNORECASE | re.DOTALL,
)


# ---------------------------------------------------------------------------
# 内部ユーティリティ
# ---------------------------------------------------------------------------


def _strip_protocol_relative_urls(html: str) -> str:
    """``src="//..."`` / ``href="//..."`` 属性を除去する。

    bleach.clean 後段で呼ぶ前提。属性値のみ削除し、タグ自体は残す
    (``<img>`` / ``<a>`` の構造を壊さないほうがエスケープ漏れの面で安全)。
    該当属性が消えた ``<a>`` は inert になり、``<img>`` は何もロードしない。
    """
    if not html:
        return html
    return _PROTOCOL_RELATIVE_ATTR_RE.sub("", html)


def _strip_scripting_blocks(source: str) -> str:
    """``<script>``/``<style>``/``<noscript>`` ブロックを中身ごと除去する。

    ``extract_plaintext`` 用の前処理。bleach は strip=True でもタグ内テキスト
    を残すので、プレーンテキスト化前に regex でブロック全体を削る。
    """
    if not source:
        return source
    return _SCRIPTING_BLOCK_RE.sub("", source)


def _linkify_callback(attrs: dict, new: bool = False) -> dict:
    """bleach.linkify のコールバック。

    すべての ``<a>`` (既存 + linkify で新規作成されたもの) に以下を適用する:

    - ``target="_blank"``
    - ``rel="nofollow noopener"`` (既存の rel とマージ)

    bleach の callback シグネチャは ``(attrs, new)`` 固定なので ``new`` は
    使わない (どちらでも同じ処理)。
    """
    attrs[(None, "target")] = "_blank"

    existing_rel = attrs.get((None, "rel"), "")
    rel_set = set(existing_rel.split()) if existing_rel else set()
    rel_set.update(_LINKIFY_REL_VALUES)
    attrs[(None, "rel")] = " ".join(sorted(rel_set))

    return attrs


def _build_markdown() -> markdown2.Markdown:
    """markdown2.Markdown インスタンスを生成する。

    インスタンスを都度生成しているのは markdown2 の内部状態 (footnotes の
    連番など) がスレッド間で混ざらないようにするため。パフォーマンスが
    問題になれば P2 以降でスレッドローカルにキャッシュする。
    """
    return markdown2.Markdown(extras=_MARKDOWN_EXTRAS)


# ---------------------------------------------------------------------------
# 公開 API
# ---------------------------------------------------------------------------


def render_markdown(source: str) -> str:
    """Markdown ソースをサニタイズ済み HTML に変換する。

    パイプライン:
        1. markdown2 で HTML を生成
        2. bleach.clean で ``settings.MARKDOWN_BLEACH_*`` 準拠にフィルタ
        3. bleach.linkify でベア URL を ``<a>`` 化し、target/rel を強制
    """
    if not source:
        return ""

    converter = _build_markdown()
    rendered_html = converter.convert(source)

    sanitized = bleach.clean(
        rendered_html,
        tags=settings.MARKDOWN_BLEACH_ALLOWED_TAGS,
        attributes=settings.MARKDOWN_BLEACH_ALLOWED_ATTRS,
        protocols=settings.MARKDOWN_BLEACH_ALLOWED_PROTOCOLS,
        strip=True,  # 不許可タグは中身だけ残して外枠を除去 (例: <script>content</script> → "")
        strip_comments=True,
    )

    # bleach の protocols allowlist は ``//evil.example/x`` 形式を素通りさせるため
    # ここで追加フィルタをかける。
    sanitized = _strip_protocol_relative_urls(sanitized)

    linkified = bleach.linkify(
        sanitized,
        callbacks=[_linkify_callback],
        skip_tags=["pre", "code"],  # コード中の URL は自動リンクしない
    )

    return linkified


def extract_plaintext(source: str) -> str:
    """Markdown から全 tag を除いたプレーンテキストを返す。

    用途:
        - OGP description (検索流入時の抜粋)
        - 全文検索 index の本文フィールド
        - メール通知など HTML を扱えない媒体

    実装:
        一度 markdown2 で HTML に落としてから bleach で tags=[] と strip=True を
        指定して全タグ除去する。markdown2 の生原文から手で記号を剥がすより
        安定した結果になる (リンクテキストや alt 属性が正しく残る)。
    """
    if not source:
        return ""

    converter = _build_markdown()
    rendered_html = converter.convert(source)

    # bleach.clean(strip=True) はタグ内のテキストを残すため、スクリプト意図
    # の文字列 (``alert(1)`` など) が OGP description に漏れる。ブロック
    # 全体を除去してから plain text 化する。
    rendered_html = _strip_scripting_blocks(rendered_html)

    plain = bleach.clean(
        rendered_html,
        tags=[],
        attributes={},
        protocols=settings.MARKDOWN_BLEACH_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )

    # markdown2 は末尾に余分な改行を付けるのでトリムする
    return plain.strip()


def get_markdown_html_with_cache_key(source: str) -> tuple[str, str]:
    """HTML と将来の Redis キャッシュ用 key を同時に返す。

    Returns:
        ``(html, cache_key)`` のタプル。

    cache_key は以下を材料に SHA-256 を取った先頭 16 文字で生成する:
        - ``source`` 本文
        - ``settings.MARKDOWN_BLEACH_ALLOWED_TAGS`` (tag allowlist 変更検知)
        - ``settings.MARKDOWN_BLEACH_ALLOWED_ATTRS`` (attr allowlist 変更検知)
        - ``settings.MARKDOWN_BLEACH_ALLOWED_PROTOCOLS`` (protocol allowlist 変更検知)
        - pipeline version tag (bleach の allowlist 以外の変更検知)

    今回は Redis と繋ぎ込まず、呼び出し側が cache を導入したときに
    そのまま渡せるよう key だけ先出ししておく (P2+ で置換予定)。
    """
    html = render_markdown(source)
    cache_key = _compute_cache_key(source)
    return html, cache_key


def _compute_cache_key(source: str) -> str:
    """cache key を決定的に計算する。

    ハッシュ材料:
        - ``source`` 本文
        - ``MARKDOWN_BLEACH_ALLOWED_TAGS`` (allowlist 変更検知)
        - ``MARKDOWN_BLEACH_ALLOWED_ATTRS`` (属性 allowlist 変更検知)
        - ``MARKDOWN_BLEACH_ALLOWED_PROTOCOLS`` (プロトコル allowlist 変更検知)
        - ``_RENDER_PIPELINE_VERSION`` (上記以外のロジック変更検知)

    ATTRS / PROTOCOLS も材料に含めることで、tags を変えずに属性や
    プロトコルだけ絞った場合でも古い (= 緩い allowlist で生成された)
    キャッシュを踏まない。
    """
    digest = hashlib.sha256()
    digest.update(source.encode("utf-8"))
    digest.update(
        json.dumps(sorted(settings.MARKDOWN_BLEACH_ALLOWED_TAGS)).encode("utf-8"),
    )
    digest.update(
        json.dumps(
            settings.MARKDOWN_BLEACH_ALLOWED_ATTRS,
            sort_keys=True,
            default=list,
        ).encode("utf-8"),
    )
    digest.update(
        json.dumps(sorted(settings.MARKDOWN_BLEACH_ALLOWED_PROTOCOLS)).encode(
            "utf-8",
        ),
    )
    digest.update(_RENDER_PIPELINE_VERSION.encode("utf-8"))
    return digest.hexdigest()[:_CACHE_KEY_HEX_LENGTH]
