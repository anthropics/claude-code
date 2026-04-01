#!/usr/bin/env bash

# --- DevContainer Startup & Connection Script ---
# This script brings up a DevContainer using either Docker or Podman
# and opens an interactive zsh session running 'claude'.

set -e

# --- Argument Parsing ---
BACKEND="docker"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -b|--backend) BACKEND="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [[ "$BACKEND" != "docker" && "$BACKEND" != "podman" ]]; then
    echo "Error: Backend must be 'docker' or 'podman'."
    exit 1
fi

echo "--- DevContainer Startup & Connection Script ---"
echo "Using backend: $BACKEND"

# --- Prerequisite Check ---
echo "Checking for required commands..."
if ! command -v "$BACKEND" &> /dev/null; then
    echo "Error: Required command '$BACKEND' not found."
    echo "Please ensure '$BACKEND' is installed and accessible in your system's PATH."
    exit 1
fi
echo "- $BACKEND command found."

if ! command -v devcontainer &> /dev/null; then
    echo "Error: Required command 'devcontainer' not found."
    echo "Please ensure 'devcontainer' (from @devcontainers/cli) is installed and accessible."
    exit 1
fi
echo "- devcontainer command found."

# --- Backend-Specific Initialization ---
if [[ "$BACKEND" == "podman" ]]; then
    echo "--- Podman Backend Initialization ---"
    
    echo "Initializing Podman machine 'claudeVM'..."
    if ! podman machine init claudeVM 2>/dev/null; then
        echo "Podman machine 'claudeVM' already initialized or failed to initialize."
    fi
    
    echo "Starting Podman machine 'claudeVM'..."
    if ! podman machine start claudeVM -q 2>/dev/null; then
        echo "Podman machine started or already running."
    fi
    
    echo "Setting default Podman connection to 'claudeVM'..."
    if ! podman system connection default claudeVM 2>/dev/null; then
        echo "Warning: Failed to set default Podman connection."
    fi
elif [[ "$BACKEND" == "docker" ]]; then
    echo "--- Docker Backend Initialization ---"
    echo "Checking if Docker daemon is running..."
    if ! docker info &> /dev/null; then
        echo "Error: Docker daemon is not running."
        echo "Please ensure Docker is started."
        exit 1
    fi
    echo "Docker daemon is running."
fi

# --- Step 3: Bring up DevContainer ---
echo "Bringing up DevContainer in the current folder..."
ARGS=("up" "--workspace-folder" ".")
if [[ "$BACKEND" == "podman" ]]; then
    ARGS+=("--docker-path" "podman")
fi

if ! devcontainer "${ARGS[@]}"; then
    echo "Error: Failed to bring up DevContainer."
    exit 1
fi
echo "DevContainer startup process completed."

# --- Step 4: Get DevContainer ID ---
echo "Finding the DevContainer ID..."
CURRENT_FOLDER=$(pwd)
# Devcontainer CLI sets the local_folder label to the workspace folder path
CONTAINER_ID=$("$BACKEND" ps --filter "label=devcontainer.local_folder=$CURRENT_FOLDER" --format '{{.ID}}' | head -n 1)

if [[ -z "$CONTAINER_ID" ]]; then
    echo "Error: Could not find DevContainer ID for the current folder ('$CURRENT_FOLDER')."
    echo "Please check if 'devcontainer up' was successful and the container is running."
    exit 1
fi
echo "Found container ID: $CONTAINER_ID"

# --- Step 5 & 6: Execute command and enter interactive shell inside container ---
echo "Executing 'claude' (if available) and starting interactive shell inside container $CONTAINER_ID..."
# Try running 'claude' if available
if "$BACKEND" exec -it "$CONTAINER_ID" sh -c 'command -v claude >/dev/null 2>&1'; then
    echo "Running 'claude' inside container..."
    "$BACKEND" exec -it "$CONTAINER_ID" sh -c 'claude || true'
fi

# Start interactive shell
echo "Starting interactive shell inside container..."
"$BACKEND" exec -it "$CONTAINER_ID" sh

echo "--- Script completed ---"
