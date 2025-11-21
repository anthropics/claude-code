#!/bin/bash

# Docker helper functions for integration tests

# Check if Docker is available
check_docker() {
  if ! docker info &>/dev/null; then
    return 1
  fi
  return 0
}

# Create a test container
create_test_container() {
  local image="$1"
  local name="$2"

  docker run -d --name "$name" "$image" tail -f /dev/null
}

# Cleanup test container
cleanup_container() {
  local name="$1"
  docker rm -f "$name" 2>/dev/null || true
}

# Run command in container
run_in_container() {
  local container="$1"
  shift
  docker exec "$container" "$@"
}

# Copy file to container
copy_to_container() {
  local src="$1"
  local container="$2"
  local dest="$3"

  docker cp "$src" "$container:$dest"
}

# Export functions for use in bats tests
export -f check_docker
export -f create_test_container
export -f cleanup_container
export -f run_in_container
export -f copy_to_container
