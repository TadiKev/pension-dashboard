# backend-django/backend/settings.py
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from corsheaders.defaults import default_headers  # noqa: E402
import warnings

# =========================
# BASE DIRECTORY
# =========================
BASE_DIR = Path(__file__).resolve().parents[2]  # go up to repo root

# =========================
# LOAD ENV VARIABLES
# =========================
load_dotenv(dotenv_path=BASE_DIR / "backend-django" / ".env", verbose=True)
# =========================
# SECURITY SETTINGS
# =========================
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "please-change-me-in-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")

# =========================
# APPLICATION DEFINITION
# =========================
INSTALLED_APPS = [
    # Django defaults
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party apps
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",

    # Local apps
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

# =========================
# TEMPLATES
# =========================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

# =========================
# DATABASE
# =========================
if os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql_psycopg2",
            "NAME": os.environ.get("POSTGRES_DB"),
            "USER": os.environ.get("POSTGRES_USER"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# =========================
# PASSWORD VALIDATION
# =========================
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# =========================
# INTERNATIONALIZATION
# =========================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# =========================
# STATIC / MEDIA
# =========================
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =========================
# CUSTOM USER MODEL
# =========================
AUTH_USER_MODEL = "api.CustomUser"

# =========================
# REST FRAMEWORK + JWT
# =========================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", 60))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": os.environ.get("SIMPLE_JWT_SIGNING_KEY", SECRET_KEY),
    "ALGORITHM": os.environ.get("JWT_ALGO", "HS256"),
}

# =========================
# CORS CONFIGURATION
# =========================
_default_origins = os.environ.get("DJANGO_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _default_origins.split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "Authorization",
    "authorization",
    "content-type",
]

if os.environ.get("DJANGO_CORS_ALLOW_ALL", "False") == "True":
    CORS_ALLOWED_ORIGINS = []
    CORS_ALLOW_ALL_ORIGINS = True

# =========================
# FASTAPI INTEGRATION
# =========================
FASTAPI_BASE_URL = os.environ.get("FASTAPI_BASE_URL")
FASTAPI_BATCH_URL = os.environ.get("FASTAPI_BATCH_URL")

if not FASTAPI_BASE_URL or not FASTAPI_BATCH_URL:
    warnings.warn(
        "FASTAPI_BASE_URL or FASTAPI_BATCH_URL not configured! "
        "Batch uploads will fail."
    )

# =========================
# END OF SETTINGS
# =========================
