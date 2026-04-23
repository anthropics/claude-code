"""Validation helpers for Tag proposals (P1-05).

SPEC §4:
    - タグ名は英数 + `_` / `-` / `+` / `#` のみ許容 (1〜50 文字)
    - 新規タグ提案時に既存 approved タグと Levenshtein 距離を比較、
      閾値以下なら「似たタグ既存」扱いで作成を拒否する

外部依存 (python-Levenshtein / rapidfuzz) を避け、標準ライブラリのみで実装する。
タグ名は 50 文字上限なので O(n*m) DP でも十分高速 (最悪 50*50 = 2,500 cell / tag)。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

MIN_TAG_LENGTH = 1
MAX_TAG_LENGTH = 50

# SPEC §4: 英数 + `_` `-` `+` `#` のみ (日本語タグは今フェーズでは扱わない)
#   - `#` はハッシュタグ互換
#   - `+` は `c++` のような名前を許容
TAG_NAME_PATTERN = re.compile(rf"^[A-Za-z0-9_\-+#]{{{MIN_TAG_LENGTH},{MAX_TAG_LENGTH}}}$")

# デフォルトで「編集距離 2 以下」を類似扱いにする。
# 例: `pythn` ↔ `python` (距離 1), `pyhton` ↔ `python` (距離 2) を検知する。
DEFAULT_SIMILARITY_THRESHOLD = 2


def validate_tag_name(value: str | None) -> None:
    """タグ名のフォーマット検証.

    Django の validator として使える形で ValidationError を raise する.
    ``value`` が ``None`` / 空文字の場合は ``tag_empty`` として拒否する。
    """
    if value is None or value == "":
        raise ValidationError(_("Tag name must not be empty."), code="tag_empty")

    if len(value) > MAX_TAG_LENGTH:
        raise ValidationError(
            _("Tag name must be at most %(max)d characters."),
            code="tag_too_long",
            params={"max": MAX_TAG_LENGTH},
        )

    if not TAG_NAME_PATTERN.fullmatch(value):
        raise ValidationError(
            _(
                "Tag name contains invalid characters. "
                "Only letters, digits, '_', '-', '+', '#' are allowed."
            ),
            code="tag_invalid_chars",
        )


def levenshtein_distance(a: str, b: str) -> int:
    """標準ライブラリのみで Levenshtein 距離を計算する.

    O(n*m) time / O(min(n, m)) space の DP. タグ名は 50 文字上限なので十分高速.
    """
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    # 幅が狭い方を内ループに置くことでメモリを抑える
    if len(a) < len(b):
        a, b = b, a

    previous_row = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current_row = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            insertions = previous_row[j] + 1
            deletions = current_row[j - 1] + 1
            substitutions = previous_row[j - 1] + (0 if ca == cb else 1)
            current_row[j] = min(insertions, deletions, substitutions)
        previous_row = current_row

    return previous_row[-1]


@dataclass(frozen=True)
class SimilarTag:
    """find_similar_tags の返却要素. name / display_name / distance を保持する."""

    name: str
    display_name: str
    distance: int


def find_similar_tags(
    name: str,
    *,
    threshold: int = DEFAULT_SIMILARITY_THRESHOLD,
    exclude_exact: bool = False,
) -> list[SimilarTag]:
    """既存 approved タグのうち編集距離 `threshold` 以下のものを距離昇順で返す.

    Args:
        name: 新規に提案されたタグ名 (呼び出し側で小文字正規化済みであること).
        threshold: この距離以下を「似ている」とみなす. デフォルト 2.
        exclude_exact: True のとき距離 0 (完全一致) を除外する. 重複チェック側で使う.

    Returns:
        距離の昇順に並んだ SimilarTag のリスト. 無ければ空リスト.
    """
    # 遅延 import: validators を models から import しても循環しないようにする
    from apps.tags.models import Tag

    normalized = (name or "").lower()
    if not normalized:
        return []

    results: list[SimilarTag] = []
    # Tag 名は最大 50 文字 / approved タグ件数も数百〜数千オーダーを想定しているため
    # 全件 Python 側で距離計算する. RDB 側の距離計算 (pg_trgm 等) は P1-06 で検討.
    # Tag.objects は既定で is_approved=True に絞り込む ApprovedTagManager.
    for tag_name, display_name in Tag.objects.values_list("name", "display_name"):
        distance = levenshtein_distance(normalized, tag_name)
        if distance > threshold:
            continue
        if exclude_exact and distance == 0:
            continue
        results.append(SimilarTag(name=tag_name, display_name=display_name, distance=distance))

    results.sort(key=lambda t: (t.distance, t.name))
    return results
