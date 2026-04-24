from datetime import timedelta
from os import getenv, path
from pathlib import Path

import sentry_sdk
from dotenv import load_dotenv
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.redis import RedisIntegration

BASE_DIR = Path(__file__).resolve(strict=True).parent.parent.parent
APPS_DIR = BASE_DIR / "apps"

local_env_file = path.join(BASE_DIR, ".envs", ".env.local")

if path.isfile(local_env_file):
    load_dotenv(local_env_file)


# --- Sentry observability (P0-06) ---
# DSN / environment / release はすべて env 経由。未設定なら SDK を無効化する。
# stg/prod では CI で必ず設定する（欠落は CD ワークフローで fail させる方針）。
SENTRY_DSN = getenv("SENTRY_DSN", "")
SENTRY_ENVIRONMENT = getenv("SENTRY_ENVIRONMENT", "local")
SENTRY_RELEASE = getenv("SENTRY_RELEASE")  # CI で git SHA を渡す


def _sentry_before_send(event, _hint):
    """Strip request body / form data / query string from Sentry events.

    security-reviewer (PR #38) フィードバック: DjangoIntegration は例外発生時に
    request.data / request.query_string をコンテキストとして送信する可能性がある。
    ツイート本文や DM 等のユーザー入力はどの API でも発生し得るため、一律で除去する。
    """
    request = event.get("request")
    if request:
        request.pop("data", None)
        request.pop("query_string", None)
        cookies = request.get("cookies")
        if cookies:
            # セッション Cookie などは PII に該当するため送らない
            request["cookies"] = {k: "[Filtered]" for k in cookies}
    return event


_SENTRY_SAMPLE_RATES = {
    "production": 0.1,
    "stg": 0.5,
    "local": 1.0,
}

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        release=SENTRY_RELEASE,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        # stg は prod より粗く、local はフルサンプリング。
        traces_sample_rate=_SENTRY_SAMPLE_RATES.get(SENTRY_ENVIRONMENT, 1.0),
        # PII は送らない。投稿本文やユーザー名が誤って Sentry に載らないようにする。
        send_default_pii=False,
        before_send=_sentry_before_send,
    )


# Application definition

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # P1-01: BLACKLIST_AFTER_ROTATION に必要
    "corsheaders",
    "django_countries",
    "phonenumber_field",
    "drf_yasg",
    "djoser",
    "taggit",
    "django_filters",
    "djcelery_email",
    "social_django",  # P1-01 + P1-12: Google OAuth
    "storages",  # P1-01: django-storages (S3)
]

LOCAL_APPS = [
    "apps.users",
    # Phase 0 scaffold (P0-04). Models/URLs are populated in later phases
    # — see docs/ROADMAP.md for ownership of each app.
    "apps.tweets",
    "apps.tags",
    "apps.follows",
    "apps.reactions",
    "apps.boxes",
    "apps.notifications",
    "apps.dm",
    "apps.boards",
    "apps.articles",
    "apps.moderation",
    "apps.bots",
    "apps.billing",
    "apps.search",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # P0-10: inject request_id / user_id / path into structlog contextvars
    "apps.common.logging.RequestContextMiddleware",
]

# --- Structured logging (P0-10) ---
# structlog を標準 logging に噛ませる。ローカルは色付き ConsoleRenderer、
# stg/prod は JSONRenderer に切替える。詳細は apps/common/logging.py。
from apps.common.logging import build_logging_dict, configure_structlog  # noqa: E402

configure_structlog(SENTRY_ENVIRONMENT)
LOGGING = build_logging_dict(SENTRY_ENVIRONMENT)

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [str(APPS_DIR / "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": getenv("POSTGRES_DB"),
        "USER": getenv("POSTGRES_USER"),
        "PASSWORD": getenv("POSTGRES_PASSWORD"),
        "HOST": getenv("POSTGRES_HOST"),
        "PORT": getenv("POSTGRES_PORT"),
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = "ja"

TIME_ZONE = "Asia/Tokyo"

USE_I18N = True

USE_TZ = True

SITE_ID = 1


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = "/static/"

STATIC_ROOT = str(BASE_DIR / "staticfiles")

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

TAGGIT_CASE_INSENSITIVE = True

AUTH_USER_MODEL = "users.User"

if USE_TZ:
    CELERY_TIMEZONE = TIME_ZONE

CELERY_BROKER_URL = getenv("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = getenv("CELERY_RESULT_BACKEND")
CELERY_ACCEPT_CONTENT = ["application/json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_RESULT_BACKEND_MAX_RETRIES = 10

CELERY_TASK_SEND_ENENT = True
CELERY_RESULT_EXTEND = True

CELERY_RESULT_BACKEND_ALWAYS_RETRY = True
CELERY_TASK_TIME_LIMIT = 5 * 60
CELERY_TASK_SOFT_TIME_LIMIT = 60
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

CELERY_WORKERS_SEND_TASKS_EVENTS = True

# P1-01 + ADR-0003: HttpOnly Cookie で JWT を運搬する設定。
# Secure は stg/prod で True、local では False (mailpit 等で HTTP 疎通用)。
#
# security-reviewer (PR #84) 指摘: stg/prod で COOKIE_SECURE が False のまま起動すると
# Cookie が HTTP でも送信され、セッション盗聴に繋がる。環境別に fail-fast させる。
COOKIE_NAME = "access"
COOKIE_SAMESITE = "Lax"
COOKIE_PATH = "/"
COOKIE_HTTPONLY = True
COOKIE_SECURE = getenv("COOKIE_SECURE", "False").lower() == "true"

if SENTRY_ENVIRONMENT in ("stg", "production") and not COOKIE_SECURE:
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(
        f"COOKIE_SECURE must be True in {SENTRY_ENVIRONMENT} — "
        "set env COOKIE_SECURE=True (ADR-0003)."
    )


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "apps.common.cookie_auth.CookieAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "PAGE_SIZE": 10,
    # P1-01 + SPEC §14.5: スパム検知階層を意識した throttle 設定。
    # user_default は既定の 500/day、post_tweet は P1-08 で ScopedRateThrottle として
    # 個別使用し SPEC §14.5 の階層 (100/500/1000 /day) をアラート側 Celery Beat で検知する。
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    # P1-11 (#97) + SPEC §14.5: 階層 throttle の rate 定義。
    # 実際に階層を切り替える責務は ``apps.common.throttling.PostTweetThrottle``。
    # このマップは DRF が scope 名から rate を引くだけのテーブルに徹する。
    "DEFAULT_THROTTLE_RATES": {
        "anon": "200/day",
        "user": "500/day",
        # legacy: P1-08 以前に scope="post_tweet" で指定されていた互換用。
        # P1-11 時点で ``throttle_scope = "post_tweet"`` を直接指定している view は
        # 存在せず、実質 dead entry。ただし削除は破壊的変更になり得るため本 PR では
        # 据え置き、別 PR (後続の cleanup チケット) で削除する方針。
        # TODO(Phase2): post_tweet_tier_* へ全面移行済みの確認後、削除する。
        "post_tweet": "500/day",
        "post_tweet_tier_1": "100/day",  # 通常ユーザー
        "post_tweet_tier_2": "500/day",  # アクティブユーザー (Phase 2 で自動昇格)
        "post_tweet_tier_3": "1000/day",  # プレミアム (User.is_premium)
    },
}

# P1-01 + ADR-0003 準拠:
# - ALGORITHM              : HS256 を明示 (security-reviewer PR #84 指摘)
# - ACCESS_TOKEN_LIFETIME  : 60 min (SPEC §1.3 に合わせる、旧 30 分からアップ)
# - REFRESH_TOKEN_LIFETIME : 14 days (SPEC §1.3 に合わせる、旧 1 day からアップ)
# - ROTATE_REFRESH_TOKENS  : 継続使用時は自動ローテ、切断後は再ログイン
# - BLACKLIST_AFTER_ROTATION: ローテ後の旧 refresh を blacklist 追加して再利用拒否
SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": getenv("SIGNING_KEY"),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

DJOSER = {
    "USER_ID_FIELD": "id",
    "LOGIN_FIELD": "email",
    "DOMAIN": getenv("DOMAIN"),
    "TOKEN_MODEL": None,
    "USER_CREATE_PASSWORD_RETYPE": True,
    "SEND_ACTIVATION_EMAIL": True,
    "PASSWORD_CHANGED_EMAIL_CONFIRMATION": True,
    "PASSWORD_RESET_CONFIRM_RETYPE": True,
    "ACTIVATION_URL": "activate/{uid}/{token}",
    "PASSWORD_RESET_CONFIRM_URL": "password-reset/{uid}/{token}",
    "SERIALIZERS": {
        "user_create": "apps.users.serializers.CreateUserSerializer",
        "current_user": "apps.users.serializers.CustomUserSerializer",
    },
}


AUTHENTICATION_BACKENDS = [
    # P1-01 + P1-12: Google OAuth。`social-auth-app-django` の backend を追加して
    # social auth pipeline を使用可能に。ModelBackend は email + password 経由
    # (djoser + P1-12a) で引き続き使う。
    "social_core.backends.google.GoogleOAuth2",
    "django.contrib.auth.backends.ModelBackend",
]

# P1-01 + P1-12: social-auth-app-django (Google OAuth2) 設定
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = getenv("GOOGLE_OAUTH_CLIENT_ID", "")
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
SOCIAL_AUTH_GOOGLE_OAUTH2_SCOPE = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL
SOCIAL_AUTH_JSONFIELD_ENABLED = True
# pipeline は P1-12 で JWT 発行ステップを挿入するため先に定義しておく。
#
# security-reviewer (PR #84) 指摘: `associate_by_email` はアカウント乗っ取りリスクが
# あるため含めない。Google OAuth 経由でログインする際、email 一致だけで既存
# ローカル (djoser) アカウントに紐付けると、攻撃者が他人のメールを使った Google
# アカウントを作成することで侵入できてしまう。
#
# 代わりに:
#   - 新規 Google ユーザーは `create_user` で新規作成
#   - 既存ユーザーへの Google 連携は P1-12a で「ログイン済みユーザーが明示的に
#     リンクする」フローを別途実装する (settings 画面 → OAuth 開始)
SOCIAL_AUTH_PIPELINE = (
    "social_core.pipeline.social_auth.social_details",
    "social_core.pipeline.social_auth.social_uid",
    "social_core.pipeline.social_auth.auth_allowed",
    "social_core.pipeline.social_auth.social_user",
    "social_core.pipeline.user.get_username",
    # "social_core.pipeline.social_auth.associate_by_email",  # account takeover risk — intentionally omitted
    "social_core.pipeline.user.create_user",
    "social_core.pipeline.social_auth.associate_user",
    "social_core.pipeline.social_auth.load_extra_data",
    "social_core.pipeline.user.user_details",
    # "apps.users.pipeline.issue_jwt_and_set_cookie",  # P1-12 で追加
)

# ---------------------------------------------------------------------------
# P1-01 + ADR-0003: S3 / django-storages 設定。AWS_S3_BUCKET_NAME が空なら
# local の FileSystemStorage にフォールバックする。
# ---------------------------------------------------------------------------

AWS_ACCESS_KEY_ID = getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_S3_REGION_NAME = getenv("AWS_S3_REGION_NAME", "ap-northeast-1")
AWS_STORAGE_BUCKET_NAME = getenv("AWS_STORAGE_BUCKET_NAME", "")
AWS_DEFAULT_ACL = None  # BucketOwnerEnforced と整合 (ACL 無効化)
AWS_S3_FILE_OVERWRITE = False  # 同名ファイルは自動で suffix 付け
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_ADDRESSING_STYLE = "virtual"
AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": "max-age=86400",  # 1 day; CloudFront が前段なのでここは長め OK
}

# Django 4.2 STORAGES 設定: 新しい storages API
# https://docs.djangoproject.com/en/4.2/ref/settings/#storages
_use_s3 = bool(AWS_STORAGE_BUCKET_NAME)
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage"
        if _use_s3
        else "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "custom_domain": getenv("AWS_S3_CUSTOM_DOMAIN", "") or None,
            "location": "media",
        }
        if _use_s3
        else {},
    },
    "staticfiles": {
        # static は CloudFront + S3 (別バケット) から配信。Phase 0.5-08 の
        # sns-stg-static に collectstatic で push。ローカルは FS に fallback。
        "BACKEND": "storages.backends.s3.S3Storage"
        if _use_s3
        else "django.contrib.staticfiles.storage.StaticFilesStorage",
        "OPTIONS": {
            "bucket_name": getenv("AWS_STATIC_BUCKET_NAME", ""),
            "custom_domain": getenv("AWS_S3_STATIC_CUSTOM_DOMAIN", "") or None,
            "location": "static",
        }
        if _use_s3 and getenv("AWS_STATIC_BUCKET_NAME")
        else {},
    },
}

# ---------------------------------------------------------------------------
# P1-01 + SPEC §3: Markdown 描画 (markdown2 + bleach の共通設定)
# 実際のレンダリング関数は P1-09 で apps/tweets/rendering.py に実装。
# ---------------------------------------------------------------------------

MARKDOWN_BLEACH_ALLOWED_TAGS = [
    "a",
    "abbr",
    "acronym",
    "b",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "kbd",
    "li",
    "ol",
    "p",
    "pre",
    "q",
    "s",
    "small",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul",
    "div",  # div はシンタックスハイライトのラッパ用
]
# security-reviewer (PR #84) 指摘: `*` ワイルドカードで全タグに class/id を許可すると
# XSS 経由のクラス衝突 (例: admin ボタンと同じ class 名で UI を欺瞞) を許してしまう。
# シンタックスハイライト / コードブロック / コラプス用 div に限定して class を個別許可。
MARKDOWN_BLEACH_ALLOWED_ATTRS = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height", "loading"],
    "code": ["class"],  # e.g. language-python (Shiki 用)
    "pre": ["class"],
    "span": ["class"],  # Shiki のシンタックスハイライト (style は別途拒否)
    "div": ["class"],  # シンタックスハイライトのラッパ (highlight 等)
}
MARKDOWN_BLEACH_ALLOWED_PROTOCOLS = ["http", "https", "mailto"]  # javascript: を弾く
