#!/bin/bash -ue

CLEAN=${CLEAN:-""}
RUN_TESTS=${RUN_TESTS:-true}

if [ -n "$CLEAN" ]; then
  rm -rf build build-tmp*
  rm -rf lib/binding
  rm -rf prebuilds
fi

npm i -g prebuildify@5 node-gyp@9
npm ci
#npm run build

for PLATFORM in linux/amd64 linux/arm64/v8 linux/arm/v7; do
  echo -- build for $PLATFORM --
  BUILDER_NAME="bcryptjs-${PLATFORM//\/-}-builder"
  docker build -t "$BUILDER_NAME" \
      --build-arg RUN_TESTS="$RUN_TESTS" \
      --platform "$PLATFORM" .
  CONTAINER=$(docker create --platform "$PLATFORM" "$BUILDER_NAME")
  docker cp "$CONTAINER:/usr/local/opt/bcrypt-js/prebuilds" .
  docker rm "$CONTAINER"

  echo -- build for $PLATFORM Alpine --
  BUILDER_NAME="bcryptjs-${PLATFORM//\/-}-alpine-builder"
  docker build -t "$BUILDER_NAME" -f Dockerfile-alpine \
      --build-arg RUN_TESTS="$RUN_TESTS" \
      --platform "$PLATFORM" .
  CONTAINER=$(docker create --platform "$PLATFORM" "$BUILDER_NAME")
  docker cp "$CONTAINER:/usr/local/opt/bcrypt-js/prebuilds" .
  docker rm "$CONTAINER"

done

ls -lF prebuilds/
