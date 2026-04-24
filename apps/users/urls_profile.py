"""プロフィール API の URL 定義 (SPEC §2)。

``config/urls.py`` で ``path("api/v1/users/", include("apps.users.urls_profile"))``
として登録する。既存の ``apps.users.urls`` (= 認証系) と棲み分けるため別ファイルで
管理する。

ルーティング:
- ``GET/PATCH /api/v1/users/me/``                    → MeView
- ``POST      /api/v1/users/me/avatar-upload-url/``  → AvatarUploadUrlView (P1-04)
- ``POST      /api/v1/users/me/header-upload-url/``  → HeaderUploadUrlView (P1-04)
- ``GET       /api/v1/users/<handle>/``              → PublicProfileView

NOTE: ``<str:username>`` は greedy に ``me`` にもマッチしてしまうため、
``me/`` 配下のエンドポイントは public profile より先に定義して優先させる。
"""

from django.urls import path

from .views import (
    AvatarUploadUrlView,
    HeaderUploadUrlView,
    MeView,
    PublicProfileView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="users-me"),
    # P1-04: avatar / header 画像 S3 presigned URL 発行。
    path(
        "me/avatar-upload-url/",
        AvatarUploadUrlView.as_view(),
        name="users-me-avatar-upload-url",
    ),
    path(
        "me/header-upload-url/",
        HeaderUploadUrlView.as_view(),
        name="users-me-header-upload-url",
    ),
    path("<str:username>/", PublicProfileView.as_view(), name="users-public-profile"),
]
