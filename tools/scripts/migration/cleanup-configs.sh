#!/bin/bash

# Script to clean up duplicate configuration files
# This script standardizes configuration file names and removes duplicates

set -e

CONFIG_ROOT="/home/jan/Schreibtisch/TEST/claude-code/claude-framework/configs"

echo "Cleaning up configuration files..."

# Function to standardize JSON files
standardize_json() {
  local file="$1"
  if [ -f "$file" ]; then
    # Format JSON with 2 spaces indentation
    temp_file=$(mktemp)
    jq . "$file" > "$temp_file"
    mv "$temp_file" "$file"
    echo "Standardized formatting for $file"
  fi
}

# Clean up API schema files
if [ -f "$CONFIG_ROOT/api-schema.json" ] && [ -f "$CONFIG_ROOT/api/schema.json" ]; then
  echo "Resolving duplicate API schema files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/api-schema.json") -gt $(stat -c %s "$CONFIG_ROOT/api/schema.json") ]; then
    cp "$CONFIG_ROOT/api-schema.json" "$CONFIG_ROOT/api/schema.json"
    echo "Updated api/schema.json with content from api-schema.json"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/api-schema.json"
  echo "Removed duplicate file api-schema.json"
  # Standardize the kept file
  standardize_json "$CONFIG_ROOT/api/schema.json"
fi

# Clean up color schema files
if [ -f "$CONFIG_ROOT/color-schema.json" ] && [ -f "$CONFIG_ROOT/color-schema/config.json" ]; then
  echo "Resolving duplicate color schema files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/color-schema.json") -gt $(stat -c %s "$CONFIG_ROOT/color-schema/config.json") ]; then
    cp "$CONFIG_ROOT/color-schema.json" "$CONFIG_ROOT/color-schema/config.json"
    echo "Updated color-schema/config.json with content from color-schema.json"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/color-schema.json"
  echo "Removed duplicate file color-schema.json"
  # Standardize the kept file
  standardize_json "$CONFIG_ROOT/color-schema/config.json"
fi

# Clean up i18n files
if [ -f "$CONFIG_ROOT/i18n.json" ] && [ -f "$CONFIG_ROOT/i18n/config.json" ]; then
  echo "Resolving duplicate i18n files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/i18n.json") -gt $(stat -c %s "$CONFIG_ROOT/i18n/config.json") ]; then
    cp "$CONFIG_ROOT/i18n.json" "$CONFIG_ROOT/i18n/config.json"
    echo "Updated i18n/config.json with content from i18n.json"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/i18n.json"
  echo "Removed duplicate file i18n.json"
  # Standardize the kept file
  standardize_json "$CONFIG_ROOT/i18n/config.json"
fi

# Clean up debug workflow files
if [ -f "$CONFIG_ROOT/debug-workflow.json" ] && [ -f "$CONFIG_ROOT/debug/workflow-config.json" ]; then
  echo "Resolving duplicate debug workflow files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/debug-workflow.json") -gt $(stat -c %s "$CONFIG_ROOT/debug/workflow-config.json") ]; then
    cp "$CONFIG_ROOT/debug-workflow.json" "$CONFIG_ROOT/debug/workflow-config.json"
    echo "Updated debug/workflow-config.json with content from debug-workflow.json"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/debug-workflow.json"
  echo "Removed duplicate file debug-workflow.json"
  # Standardize the kept file
  standardize_json "$CONFIG_ROOT/debug/workflow-config.json"
fi

# Clean up security files
if [ -f "$CONFIG_ROOT/security.json" ] && [ -f "$CONFIG_ROOT/security/constraints.json" ]; then
  echo "Resolving duplicate security files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/security.json") -gt $(stat -c %s "$CONFIG_ROOT/security/constraints.json") ]; then
    cp "$CONFIG_ROOT/security.json" "$CONFIG_ROOT/security/constraints.json"
    echo "Updated security/constraints.json with content from security.json"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/security.json"
  echo "Removed duplicate file security.json"
  # Standardize the kept file
  standardize_json "$CONFIG_ROOT/security/constraints.json"
fi

if [ -f "$CONFIG_ROOT/security.md" ] && [ -f "$CONFIG_ROOT/security/constraints.md" ]; then
  echo "Resolving duplicate security markdown files..."
  # Choose the newer/more complete file
  if [ $(stat -c %s "$CONFIG_ROOT/security.md") -gt $(stat -c %s "$CONFIG_ROOT/security/constraints.md") ]; then
    cp "$CONFIG_ROOT/security.md" "$CONFIG_ROOT/security/constraints.md"
    echo "Updated security/constraints.md with content from security.md"
  fi
  # Remove the root file
  rm "$CONFIG_ROOT/security.md"
  echo "Removed duplicate file security.md"
fi

# Create an index.js file in each config directory to standardize imports
echo "Creating index.js files for standardized imports..."

for dir in "$CONFIG_ROOT"/*; do
  if [ -d "$dir" ]; then
    dir_name=$(basename "$dir")
    index_file="$dir/index.js"
    
    echo "// Configuration index for $dir_name" > "$index_file"
    echo "// This file provides standardized imports for configuration" >> "$index_file"
    echo "" >> "$index_file"
    
    # Add exports for each JSON file
    for json_file in "$dir"/*.json; do
      if [ -f "$json_file" ]; then
        file_name=$(basename "$json_file" .json)
        var_name=$(echo "$file_name" | sed 's/-/_/g')
        echo "const $var_name = require('./$file_name.json');" >> "$index_file"
      fi
    done
    
    echo "" >> "$index_file"
    echo "module.exports = {" >> "$index_file"
    
    # Add export entries
    first=true
    for json_file in "$dir"/*.json; do
      if [ -f "$json_file" ]; then
        file_name=$(basename "$json_file" .json)
        var_name=$(echo "$file_name" | sed 's/-/_/g')
        
        if [ "$first" = true ]; then
          echo "  $var_name," >> "$index_file"
          first=false
        else
          echo "  $var_name," >> "$index_file"
        fi
      fi
    done
    
    echo "};" >> "$index_file"
    echo "Created index.js for $dir_name"
  fi
done

# Create main config index.js
main_index="$CONFIG_ROOT/index.js"
echo "// Main configuration index" > "$main_index"
echo "// This file provides standardized imports for all configuration" >> "$main_index"
echo "" >> "$main_index"

for dir in "$CONFIG_ROOT"/*; do
  if [ -d "$dir" ]; then
    dir_name=$(basename "$dir")
    # Convert directory name to camelCase for variable name
    var_name=$(echo "$dir_name" | sed 's/-\([a-z]\)/\U\1/g')
    echo "const $var_name = require('./$dir_name');" >> "$main_index"
  fi
done

echo "" >> "$main_index"
echo "module.exports = {" >> "$main_index"

first=true
for dir in "$CONFIG_ROOT"/*; do
  if [ -d "$dir" ]; then
    dir_name=$(basename "$dir")
    # Convert directory name to camelCase for variable name
    var_name=$(echo "$dir_name" | sed 's/-\([a-z]\)/\U\1/g')
    
    if [ "$first" = true ]; then
      echo "  $var_name," >> "$main_index"
      first=false
    else
      echo "  $var_name," >> "$main_index"
    fi
  fi
done

if [ -f "$CONFIG_ROOT/global.json" ]; then
  echo "  global: require('./global.json')," >> "$main_index"
fi

echo "};" >> "$main_index"
echo "Created main config index.js"

echo "Configuration cleanup completed!"