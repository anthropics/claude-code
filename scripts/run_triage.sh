#!/bin/bash
#
# Quick Setup and Run Script for Oncall Triage Workflow
# 
# This script will:
# 1. Install required dependencies
# 2. Set up environment variables
# 3. Run the oncall triage test script
#
# Usage:
#   chmod +x scripts/run_triage.sh
#   ./scripts/run_triage.sh [--dry-run]
#

set -e  # Exit on error

echo "============================================================"
echo "Oncall Triage Workflow - Quick Setup and Run"
echo "============================================================"
echo ""

# Check if running with --dry-run flag
DRY_RUN_FLAG=""
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN_FLAG="--dry-run"
    echo "Mode: DRY RUN (no labels will be added)"
else
    echo "Mode: LIVE RUN (will add labels to issues)"
fi
echo ""

# Install dependencies
echo "Step 1: Installing Python dependencies..."
pip install -q groq PyGithub
echo "✓ Dependencies installed"
echo ""

# Set up environment variables
echo "Step 2: Setting up environment variables..."

# GROQ API Key (already provided)
export GROQ_API_KEY="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"
echo "✓ GROQ_API_KEY configured"

# GitHub Token (check if already set, otherwise prompt)
if [ -z "$GITHUB_TOKEN" ]; then
    echo ""
    echo "GitHub Token not found in environment."
    echo "Please enter your GitHub Personal Access Token:"
    read -s GITHUB_TOKEN
    export GITHUB_TOKEN
    echo "✓ GITHUB_TOKEN configured"
else
    echo "✓ GITHUB_TOKEN already configured"
fi

# GitHub Repository
export GITHUB_REPOSITORY="ensideanderson-nova/claude-code"
echo "✓ GITHUB_REPOSITORY set to: $GITHUB_REPOSITORY"
echo ""

# Run the triage script
echo "Step 3: Running oncall triage script..."
echo "============================================================"
echo ""

python3 scripts/test_oncall_triage.py $DRY_RUN_FLAG

echo ""
echo "============================================================"
echo "✓ Oncall triage complete!"
echo "============================================================"
