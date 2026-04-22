
from pathlib import Path
from os import getenv,path

from dotenv import load_dotenv
from datetime import timedelta

import sentry_sdk
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
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    "django.contrib.sites"
]

THIRD_PARTY_APPS=[
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_countries",
    "phonenumber_field",
    "drf_yasg", 
    "djoser", 
    "taggit", 
    "django_filters", 
    "djcelery_email", 
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

MIDDLEWARE = []

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS+LOCAL_APPS

MIDDLEWARE =[
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [str(APPS_DIR / "templates")],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': getenv("POSTGRES_DB"),
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
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'ja'

TIME_ZONE = 'Asia/Tokyo'

USE_I18N = True

USE_TZ = True

SITE_ID = 1


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT = str(BASE_DIR / "staticfiles")

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TAGGIT_CASE_INSENSITIVE = True

AUTH_USER_MODEL = "users.User"

if USE_TZ:
    CELERY_TIMEZONE = TIME_ZONE

CELERY_BROKER_URL = getenv("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND=getenv("CELERY_RESULT_BACKEND")
CELERY_ACCEPT_CONTENT=['application/json']
CELERY_TASK_SERIALIZER='json'
CELERY_RESULT_SERIALIZER="json"
CELERY_RESULT_BACKEND_MAX_RETRIES =10

CELERY_TASK_SEND_ENENT=True
CELERY_RESULT_EXTEND=True

CELERY_RESULT_BACKEND_ALWAYS_RETRY= True
CELERY_TASK_TIME_LIMIT=5*60
CELERY_TASK_SOFT_TIME_LIMIT=60
CELERY_BEAT_SCHEDULER="django_celery_beat.schedulers:DatabaseScheduler"

CELERY_WORKERS_SEND_TASKS_EVENTS =True

COOKIE_NAME="access"
COOKIE_SAMESITE="Lax"
COOKIE_PATH="/"
COOKIE_HTTPONLY=True
COOKIE_SECURE= False


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
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "200/day",
        "user": "500/day",
    },
}

SIMPLE_JWT = {
    "SIGNING_KEY": getenv("SIGNING_KEY"),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
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
    "django.contrib.auth.backends.ModelBackend",
]