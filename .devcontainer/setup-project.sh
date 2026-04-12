#!/bin/bash
set -e

WORKSPACE="/workspace"

echo "=== Project Setup Start ==="

# --- Python venv setup ---
if [ -f "$WORKSPACE/requirements/local.txt" ]; then
  if [ ! -d "$WORKSPACE/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$WORKSPACE/.venv"
  fi
  echo "Installing Python dependencies..."
  "$WORKSPACE/.venv/bin/pip" install --upgrade pip
  "$WORKSPACE/.venv/bin/pip" install -r "$WORKSPACE/requirements/local.txt"
  echo "Python setup complete."
else
  echo "No requirements/local.txt found, skipping Python setup."
fi

# --- Next.js client setup ---
if [ -f "$WORKSPACE/client/package.json" ]; then
  if [ ! -d "$WORKSPACE/client/node_modules" ]; then
    echo "Installing Next.js client dependencies..."
    cd "$WORKSPACE/client" && npm install
  else
    echo "client/node_modules already exists, skipping npm install."
  fi
  echo "Next.js client setup complete."
else
  echo "No client/package.json found, skipping Next.js setup."
fi

# --- Generate .env.local from defaults if missing ---
if [ ! -f "$WORKSPACE/.envs/.env.local" ]; then
  echo "Generating .envs/.env.local with default values..."
  mkdir -p "$WORKSPACE/.envs"
  DJANGO_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(38))")
  SIGNING_KEY_VAL=$(python3 -c "import secrets; print(secrets.token_urlsafe(38))")
  cat > "$WORKSPACE/.envs/.env.local" <<EOF
SITE_NAME="MyApp"
DJANGO_SECRET_KEY="$DJANGO_SECRET"
DJANGO_ADMIN_URL="admin/"
EMAIL_HOST="mailpit"
EMAIL_PORT=1025
DEFAULT_FROM_EMAIL="noreply@example.com"
DOMAIN="localhost:3000"
CELERY_FLOWER_USER="admin"
CELERY_FLOWER_PASSWORD="admin"
CELERY_BROKER_URL="redis://redis:6379/0"
CELERY_RESULT_BACKEND="redis://redis:6379/0"
POSTGRES_HOST="postgres"
POSTGRES_PORT=5432
POSTGRES_DB="app_db"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
COOKIE_SECURE="False"
SIGNING_KEY="$SIGNING_KEY_VAL"
EOF
  echo ".env.local generated. Update SITE_NAME, EMAIL settings as needed."
fi

echo "=== Project Setup Complete ==="
