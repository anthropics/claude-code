"""social-auth-app-django 用のカスタムパイプラインステップ (P1-12).

`SOCIAL_AUTH_PIPELINE` (config/settings/base.py) に差し込む形で使う。
SPEC §1.2 + ADR-0003 + security-reviewer #84 対応のため、以下を担当する:

- `set_needs_onboarding`: 新規 Google ユーザーの `needs_onboarding` を明示的に
  True に設定する。既定の `create_user` パイプラインステップは User モデルの
  `default=True` を尊重するが、将来 default が変わった場合でもここで明示的に
  True を置くことで onboarding flow (P1-14) が確実に起動する。
  既存ユーザーには干渉しない (security-reviewer #84: `associate_by_email` 削除)。
"""

from __future__ import annotations

from typing import Any


def set_needs_onboarding(
    backend: Any,
    user: Any,
    *args: Any,
    is_new: bool = False,
    **kwargs: Any,
) -> dict[str, Any]:
    """新規 Google 登録時 `needs_onboarding=True` を確実に設定する.

    ``is_new`` は social-auth-core の ``create_user`` ステップが kwargs に差し込む
    フラグで、この pipeline 内で新規作成された場合のみ True になる。既存ユーザー
    (associate_user で紐付けただけ) には False で入ってくるため、その場合は
    ``needs_onboarding`` を触らない。

    security-reviewer #84 対応の補足:
        本プロジェクトでは ``associate_by_email`` を pipeline から除外している
        ため、email 一致だけで既存ローカルアカウントに紐付くことは無い。したがって
        Google OAuth 経由で初めて来るアドレスは常に新規ユーザーとして作成され、
        本ステップが ``needs_onboarding=True`` を立てる。
    """

    if not is_new:
        return {"user": user}

    if user is None:
        return {"user": user}

    # defensive: 新規ユーザーが ``needs_onboarding=False`` で作られた場合に
    # True へ昇格させる。``create_user`` パイプラインステップは User モデルの
    # ``default=True`` を尊重するが、将来 default 値が変更された/他の pipeline
    # step が False を書き戻した場合でも、ここで確実に True を立て直すことで
    # onboarding flow (P1-14) が取りこぼされないようにする。
    if not getattr(user, "needs_onboarding", False):
        user.needs_onboarding = True
        user.save(update_fields=["needs_onboarding"])

    return {"user": user}
