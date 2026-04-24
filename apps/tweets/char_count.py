"""ツイート本文の「見た目の文字数」を数えるユーティリティ (P1-10 / SPEC §3.3)。

SPEC §3.3 に基づき、ツイート本文の 180 字制限を以下のルールで計算する:

- URL (http/https) は一律 ``URL_LENGTH`` (=23) 字に換算する。
- Markdown 記号 (``**``, ``##``, ``-``, ``>``, バッククォート等) はカウントしない。
- コードブロック / インラインコードの「中身」は通常どおりカウントする
  (マーカー (`` ``` ``, `` ` ``) のみ除去する)。コードブロック内の ``**bold**``
  などの Markdown 記号は **マーカー扱いされずそのままカウントされる**
  (コードとしての字面をそのまま数えるのが CommonMark 仕様に近い)。
- 改行文字は 1 字として数える。
- 絵文字 1 つの数え方は **Unicode codepoint 数** (``len(str)``) とする
  (grapheme cluster ベースではない点に注意)。
    - Python 標準ライブラリのみで実装するため。grapheme cluster 単位で
      厳密に数える必要が生じたら ``regex`` パッケージ導入を別途検討する。
    - BMP 内の絵文字 (``🎉`` など) は codepoint 1 なので 1 字となり
      SPEC §3.3 の「絵文字 1 つは 1 字」要件を満たす。SKIN TONE 等の ZWJ
      シーケンスは複数 codepoint になる点を docstring に明記しておく。

URL 抽出の既知の制限:

- 現状の URL 正規表現 ``_URL_RE`` は末尾の ``)`` ``]`` を URL に含めない。
  これは Markdown リンク ``[label](url)`` と共存させるための妥協で、
  ``https://en.wikipedia.org/wiki/Foo)`` のような閉じ括弧を **含む** URL
  には対応しない。そうした URL を使いたい場合は Markdown のリンク構文
  ``[label](https://en.wikipedia.org/wiki/Foo)`` で記述することを推奨する。

本モジュールは **Backend 側の実装**。Frontend 側 (P1-16) は TypeScript で
同じロジックを再実装する (``docs/operations/tweet-char-count.md`` 参照)。
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# 公開定数
# ---------------------------------------------------------------------------

#: URL 1 件あたりの換算文字数 (SPEC §3.3)。
URL_LENGTH: int = 23

#: ツイート本文の上限文字数 (SPEC §3)。
TWEET_MAX_CHARS: int = 180


# ---------------------------------------------------------------------------
# 内部 regex
# ---------------------------------------------------------------------------

# URL 抽出: http(s)://... をスペース区切りの 1 トークンとして拾う。
# ただし Markdown リンク構文 ``[label](url)`` と共存するため、
# 閉じ括弧 ``)`` と閉じ角括弧 ``]`` は URL に含めない (そこで切る)。
# これにより ``[label](https://example.com)`` の URL 部分が ``)`` を含まず
# 純粋な URL として抽出される。ツイート本文で URL に生 ``)`` を含める用途は
# 稀だが、必要なら Markdown リンク ``[label](url)`` 形式で回避する運用前提。
_URL_RE: re.Pattern[str] = re.compile(r"https?://[^\s)\]]+", re.IGNORECASE)

# URL を一時的に 1 文字の placeholder に置き換えてから Markdown 記号除去を
# かける。Markdown 記号除去で誤って URL の `_` / `*` / `~` を削らないため。
# U+0000 (NUL) は通常のテキストに現れないので安全。
_URL_PLACEHOLDER: str = "\x00"

# コードブロック / インラインコードの中身退避用 placeholder。
# ``\x01<index>\x01`` の形でテキストに埋め込み、Markdown 記号除去を終えた後に
# 元の中身へ復元する。これによりコード内の ``**`` ``_`` ``~~`` などが
# Markdown マーカーとして誤って削除されるのを防ぐ (code-reviewer HIGH)。
_CODE_PLACEHOLDER: str = "\x01"
_CODE_PLACEHOLDER_RE: re.Pattern[str] = re.compile(rf"{_CODE_PLACEHOLDER}(\d+){_CODE_PLACEHOLDER}")

# フェンスコード (```...```) — 複数行対応。貪欲でないマッチで最短ペアを取る。
_CODE_FENCE_RE: re.Pattern[str] = re.compile(r"```[\s\S]*?```", re.MULTILINE)
# インラインコード (`...`) — 改行は跨がない。
_CODE_INLINE_RE: re.Pattern[str] = re.compile(r"`[^`\n]+`")

# Markdown 記号 — 各パターンは「マーカーだけ削り、中身は残す」のが基本方針。
# ただし「行頭プレフィクス」 (見出し・リスト・引用) は行頭トークンごと削る。

# 画像 `![alt](url)` — alt だけ残す。url は既に placeholder 化されている。
_IMAGE_RE: re.Pattern[str] = re.compile(r"!\[([^\]]*)\]\([^)]*\)")

# リンク `[label](url)` — label だけ残し、url は placeholder のまま残す。
# Markdown の仕様上 label と url の間に空白は入らない。
_LINK_RE: re.Pattern[str] = re.compile(r"\[([^\]]*)\]\(([^)]*)\)")

# 強調・打ち消し。いずれも「マーカーだけ削る」。非貪欲マッチで最短の対にしておく。
#
# ``_`` / ``__`` 系は CommonMark 仕様に従い単語の内部では強調マーカーにしない
# (code-reviewer HIGH: ``my_var_name`` 等の snake_case 識別子が誤って
# 強調として扱われるのを防ぐ)。
# ``(?<!\w)`` / ``(?!\w)`` で単語文字に挟まれていないことを要求する。
_STRONG_ASTERISK_RE: re.Pattern[str] = re.compile(r"\*\*(.+?)\*\*")
_STRONG_UNDERSCORE_RE: re.Pattern[str] = re.compile(r"(?<!\w)__(.+?)__(?!\w)")
_EM_ASTERISK_RE: re.Pattern[str] = re.compile(r"\*(.+?)\*")
_EM_UNDERSCORE_RE: re.Pattern[str] = re.compile(r"(?<!\w)_(.+?)_(?!\w)")
_STRIKE_RE: re.Pattern[str] = re.compile(r"~~(.+?)~~")

# 行頭トークン (見出し・リスト・引用・水平線)。`re.MULTILINE` 前提。
_HEADING_RE: re.Pattern[str] = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_BULLET_RE: re.Pattern[str] = re.compile(r"^\s*[-*+]\s+", re.MULTILINE)
_NUMBERED_RE: re.Pattern[str] = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)
_QUOTE_RE: re.Pattern[str] = re.compile(r"^\s*>+\s*", re.MULTILINE)
_HR_RE: re.Pattern[str] = re.compile(r"^\s*-{3,}\s*$", re.MULTILINE)

# フェンスコードの内側を取り出すための補助 regex。
# ``` または ```lang のマーカー部分だけを除去し、前後の改行は中身として残す。
# 既存テスト (test_fenced_code_block_content_counts) の期待どおり
# ``"```\nabc\n```"`` → 中身 ``"\nabc\n"`` = 5 字として復元される。
# 開始: 行頭の ``` + 任意の lang 指定 (改行手前まで) を除去
_FENCE_OPEN_RE: re.Pattern[str] = re.compile(r"^```[^\n]*")
# 終了: 末尾の ``` を除去
_FENCE_CLOSE_RE: re.Pattern[str] = re.compile(r"```$")


# ---------------------------------------------------------------------------
# 内部ヘルパ: コードセグメントの退避と復元
# ---------------------------------------------------------------------------


def _protect_code_segments(source: str) -> tuple[str, list[str]]:
    """コードブロック / インラインコードの中身を placeholder に退避する。

    コード内の ``**`` ``_`` ``~~`` などの記号は Markdown マーカーとしてではなく
    コードの字面としてカウントすべきなので、Markdown 記号除去の前に一時退避する。

    - フェンスコード (``` ... ```) はバッククォート 3 本のマーカーを除去し
      中身のみ復元する (中身の改行もそのまま残す)。
    - インラインコード (`...`) は前後のバッククォート 1 本を除去し中身のみ復元。

    :param source: 元の Markdown テキスト。
    :returns: ``(placeholder 置換済みテキスト, 退避された中身のリスト)``。
    """

    segments: list[str] = []

    def _stash(match: re.Match[str]) -> str:
        content = match.group(0)
        if content.startswith("```"):
            # フェンス: 最初と最後の ``` を除去し、中身だけ退避
            inner = _FENCE_OPEN_RE.sub("", content)
            inner = _FENCE_CLOSE_RE.sub("", inner)
            segments.append(inner)
        else:
            # インライン: バッククォートのみ除去
            segments.append(content[1:-1])
        return f"{_CODE_PLACEHOLDER}{len(segments) - 1}{_CODE_PLACEHOLDER}"

    # フェンスコード優先 → 残りのインラインを処理
    # (フェンス内のシングルバッククォートが誤ってインラインとして拾われないように順序固定)
    source = _CODE_FENCE_RE.sub(_stash, source)
    source = _CODE_INLINE_RE.sub(_stash, source)
    return source, segments


def _restore_code_segments(text: str, segments: list[str]) -> str:
    """``_protect_code_segments`` で退避した中身を placeholder から復元する。"""

    def _restore(match: re.Match[str]) -> str:
        idx = int(match.group(1))
        return segments[idx]

    return _CODE_PLACEHOLDER_RE.sub(_restore, text)


# ---------------------------------------------------------------------------
# 公開関数
# ---------------------------------------------------------------------------


def count_tweet_chars(source: str) -> int:
    """ツイート本文の「見た目の文字数」を返す。

    処理順:

    1. コードブロック / インラインコードの中身を placeholder に退避する
       (コード内の Markdown 記号を保護する)。
    2. URL (http/https) を抽出し、``URL_LENGTH`` (=23) 文字ぶん予約する。
       URL 本体は placeholder 1 文字に置換しておく。
    3. Markdown 記号を除去する (マーカーのみ除去し、中身は残す)。
    4. コード placeholder を元の中身に復元する。
    5. 残った URL placeholder を ``URL_LENGTH`` に展開したのと同じ字数になるよう
       加算する (実際には placeholder 数 × ``URL_LENGTH`` を足し、
       placeholder 自身の文字数 1 を引くことで等価に計算する)。
    6. 最終的な codepoint 数を返す (``len``)。

    :param source: Markdown 原文。``None`` は想定せず、空文字列は 0 を返す。
    :returns: カウント結果 (非負整数)。
    """

    if not source:
        return 0

    # --- 1. コードブロック / インラインコードの中身を退避 ----------------
    # コード内の `**` `_` `~~` が Markdown マーカーとして誤削除されないように
    # Markdown 記号除去の前に placeholder 化する。
    text, code_segments = _protect_code_segments(source)

    # --- 2. URL を placeholder に退避 -----------------------------------
    # placeholder 1 文字あたり「実際は 23 字」と後で換算するため、件数を数える。
    url_matches = _URL_RE.findall(text)
    url_count = len(url_matches)
    text = _URL_RE.sub(_URL_PLACEHOLDER, text)

    # --- 3. Markdown 記号を除去 ----------------------------------------
    # 行頭プレフィクス (削除) — 見出し → リスト → 引用 → 水平線 の順で処理する。
    # フェンスコードは 1 で退避済みなので、行頭トークン処理では扱わない。
    text = _HR_RE.sub("", text)
    text = _HEADING_RE.sub("", text)
    # 番号付きリストは "-* +" 記号との衝突がないので先に落として良い。
    text = _NUMBERED_RE.sub("", text)
    text = _BULLET_RE.sub("", text)
    text = _QUOTE_RE.sub("", text)

    # インライン系 (マーカーだけ削って中身を残す) — 画像 → リンク の順が必須
    # (`!` を先に処理しないと画像がリンクとしてマッチしてしまう)。
    text = _IMAGE_RE.sub(r"\1", text)
    text = _LINK_RE.sub(r"\1", text)

    # 強調系は **/__ を先に落とさないと */_ 1 対で切られてしまうので順序重要。
    text = _STRONG_ASTERISK_RE.sub(r"\1", text)
    text = _STRONG_UNDERSCORE_RE.sub(r"\1", text)
    text = _EM_ASTERISK_RE.sub(r"\1", text)
    text = _EM_UNDERSCORE_RE.sub(r"\1", text)

    text = _STRIKE_RE.sub(r"\1", text)

    # --- 4. コード placeholder を元の中身に復元 -------------------------
    text = _restore_code_segments(text, code_segments)

    # --- 5. URL 分を換算 -----------------------------------------------
    # URL placeholder は 1 文字として text 内にまだ残っている。これを 23 字扱いに
    # するため、(URL_LENGTH - 1) × url_count を加算する。
    visible_chars = len(text) + (URL_LENGTH - 1) * url_count
    return visible_chars


def is_tweet_within_limit(source: str, limit: int = TWEET_MAX_CHARS) -> bool:
    """見た目の文字数が ``limit`` 以下なら ``True``。

    :param source: Markdown 原文。
    :param limit: 上限文字数。既定は ``TWEET_MAX_CHARS`` (=180)。
    """

    return count_tweet_chars(source) <= limit
