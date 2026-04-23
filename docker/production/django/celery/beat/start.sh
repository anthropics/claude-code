#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

python manage.py migrate django_celery_beat

exec celery -A config.celery_app beat -l INFO
