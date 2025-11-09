# Usage:
#
#   docker build -t bcryptjs-builder .
#   CONTAINER=$(docker create bcryptjs-builder)
#   # Then copy the artifact to your host:
#   docker cp "$CONTAINER:/usr/local/opt/bcrypt-js/prebuilds" .
#   docker rm "$CONTAINER"
#
# Use --platform to build cross-platform i.e. for ARM:
#
#   docker build -t bcryptjs-builder --platform "linux/arm64/v8" .
#   CONTAINER=$docker create --platform "linux/arm64/v8" bcryptjs-builder)
#   # this copies the prebuilds/linux-arm artifacts
#   docker cp "$CONTAINER:/usr/local/opt/bcrypt-js/prebuilds" .
#   docker rm "$CONTAINER"


ARG FROM_IMAGE=node:18-bullseye
#ARG FROM_IMAGE=arm32v7/node:16-bullseye
#ARG FROM_IMAGE=arm64v8/node:16-bullseye
FROM ${FROM_IMAGE}

ENV project bcrypt-js
ENV DEBIAN_FRONTEND noninteractive
ENV LC_ALL en_US.UTF-8
ENV LANG ${LC_ALL}

RUN echo "#log: ${project}: Setup system" \
  && set -x \
  && apt-get update -y \
  && apt-get install -y \
    build-essential \
    python3 \
  && apt-get clean \
  && update-alternatives --install /usr/local/bin/python python /usr/bin/python3 20 \
  && npm i -g prebuildify@5 node-gyp@9 \
  && sync

ADD . /usr/local/opt/${project}
WORKDIR /usr/local/opt/${project}

RUN echo "#log: ${project}: Running build" \
  && set -x \
  && npm ci \
  && npm run build

ARG RUN_TESTS=true
ARG TEST_TIMEOUT_SECONDS=

RUN if "${RUN_TESTS}"; then \
    echo "#log ${project}: Running tests" \
    && npm test; \
  else \
    echo "#log ${project}: Tests were skipped!"; \
  fi

CMD /bin/bash -l
