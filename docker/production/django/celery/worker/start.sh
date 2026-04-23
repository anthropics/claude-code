#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

exec celery -A config.celery_app worker -l INFO
