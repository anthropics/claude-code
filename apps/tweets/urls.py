"""URL configuration for the tweets CRUD API (P1-08).

``config/urls.py`` の ``path("api/v1/tweets/", include("apps.tweets.urls"))`` から
マウントされる。``DefaultRouter`` で CRUD の 5 エンドポイントを一括生成する。

生成される URL:
    - GET  /api/v1/tweets/         -> list
    - POST /api/v1/tweets/         -> create
    - GET  /api/v1/tweets/<pk>/    -> retrieve
    - PATCH /api/v1/tweets/<pk>/   -> partial_update
    - DELETE /api/v1/tweets/<pk>/  -> destroy
"""

from __future__ import annotations

from rest_framework.routers import DefaultRouter

from apps.tweets.views import TweetViewSet

router = DefaultRouter()
# basename を明示しないと queryset 評価時に DB にアクセスしてしまうため
# 必ず ``basename`` を指定する。
router.register(r"", TweetViewSet, basename="tweets")

urlpatterns = router.urls
