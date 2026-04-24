"""プロフィール API の URL 定義 (SPEC §2)。

``config/urls.py`` で ``path("api/v1/users/", include("apps.users.urls_profile"))``
として登録する。既存の ``apps.users.urls`` (= 認証系) と棲み分けるため別ファイルで
管理する。

ルーティング:
- ``GET/PATCH /api/v1/users/me/``    → MeView (自分のプロフィール)
- ``GET       /api/v1/users/<handle>/`` → PublicProfileView (他人の公開プロフィール)

NOTE: ``<str:username>`` は greedy に ``me`` もマッチしてしまうため、``me/`` を
先に定義して優先させる。
"""

from django.urls import path

from .views import MeView, PublicProfileView

urlpatterns = [
    path("me/", MeView.as_view(), name="users-me"),
    path("<str:username>/", PublicProfileView.as_view(), name="users-public-profile"),
]
