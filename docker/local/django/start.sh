#!/bin/bash

set -o errexit

set -o pipefail

set -o nounset

python manage.py migrate --no-input
python manage.py collectstatic --no-input
exec python manage.py runserver 0.0.0.0:8000