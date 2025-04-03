#!/bin/bash
set -e

# Script to cache GitHub API data
# Used to prevent rate limiting during container builds

# Configuration
# Store cache in the home directory
CACHE_DIR="${HOME}/.github-meta-cache"
CACHE_FILE="${CACHE_DIR}/meta.json"
TIMESTAMP_FILE="${CACHE_DIR}/meta-timestamp.txt"
MAX_AGE_SECONDS=3600  # Cache expires after 1 hour

# Create cache directory if it doesn't exist
mkdir -p "${CACHE_DIR}"

# Function to get current timestamp
get_timestamp() {
  date +%s
}

# Function to check if cache is valid
is_cache_valid() {
  if [[ ! -f "${CACHE_FILE}" || ! -f "${TIMESTAMP_FILE}" ]]; then
    return 1
  fi
  
  local cache_time=$(cat "${TIMESTAMP_FILE}")
  local current_time=$(get_timestamp)
  local age=$((current_time - cache_time))
  
  if [[ ${age} -gt ${MAX_AGE_SECONDS} ]]; then
    echo "Cache is expired (${age} seconds old)"
    return 1
  fi
  
  echo "Using cached GitHub API data (${age} seconds old)"
  return 0
}

# Function to fetch data using authenticated gh cli
fetch_with_gh() {
  echo "Attempting to fetch GitHub API data using authenticated gh CLI..."
  if gh auth status &>/dev/null; then
    gh api meta > "${CACHE_FILE}" && 
      get_timestamp > "${TIMESTAMP_FILE}" &&
      echo "Successfully fetched and cached GitHub API data using gh CLI"
    return $?
  else
    echo "gh CLI not authenticated"
    return 1
  fi
}

# Function to fetch data using curl
fetch_with_curl() {
  echo "Attempting to fetch GitHub API data using curl..."
  # First try with GITHUB_TOKEN if available
  if [[ -n "${GITHUB_TOKEN}" ]]; then
    echo "Using GITHUB_TOKEN for authentication"
    curl -s -H "Authorization: token ${GITHUB_TOKEN}" https://api.github.com/meta > "${CACHE_FILE}" &&
      get_timestamp > "${TIMESTAMP_FILE}" &&
      echo "Successfully fetched and cached GitHub API data using curl with token"
    return $?
  else
    # Fall back to unauthenticated request
    echo "No GITHUB_TOKEN found, making unauthenticated request (may be rate limited)"
    curl -s https://api.github.com/meta > "${CACHE_FILE}"
    
    # Check if the response indicates rate limiting
    if grep -q "API rate limit exceeded" "${CACHE_FILE}"; then
      echo "Rate limit exceeded for unauthenticated request"
      return 1
    else
      get_timestamp > "${TIMESTAMP_FILE}"
      echo "Successfully fetched and cached GitHub API data using curl without auth"
      return 0
    fi
  fi
}

# Main logic
if is_cache_valid; then
  echo "Using existing cache from $(cat ${TIMESTAMP_FILE})"
  exit 0
fi

# Try with gh CLI first
if ! fetch_with_gh; then
  # Fall back to curl
  if ! fetch_with_curl; then
    # Both methods failed, check if we have an existing cache file
    if [[ -f "${CACHE_FILE}" ]]; then
      echo "Warning: Failed to update cache, using existing cached data (which may be expired)"
      exit 0
    else
      echo "Error: Failed to fetch GitHub API data and no cache exists"
      exit 1
    fi
  fi
fi

# Display a summary of the cached data
echo "GitHub API meta data cached successfully. Summary:"
jq -r '.domains.actions | length' "${CACHE_FILE}" > /dev/null 2>&1 && 
  echo "- Actions domains: $(jq -r '.domains.actions | length' "${CACHE_FILE}")" ||
  echo "- Could not parse actions domains from cache file"

exit 0