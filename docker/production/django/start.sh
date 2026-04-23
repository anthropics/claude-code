#!/bin/bash

set -o errexit

set -o pipefail

set -o nounset

python /app/manage.py collectstatic --noinput
python /app/manage.py migrate

NUM_WORKERS=${GUNICORN_WORKERS:-3}

exec /usr/local/bin/gunicorn config.wsgi --bind 0.0.0.0:8000 --chdir=/app --workers $NUM_WORKERS
