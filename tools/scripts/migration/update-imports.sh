#!/bin/bash

# Script to update import paths to use the new module structure
# This script searches for relative imports and updates them to use module aliases

set -e

TARGET_ROOT="/home/jan/Schreibtisch/TEST/claude-code/claude-framework"

# Function to update imports in TypeScript/JavaScript files
update_imports() {
  local dir="$1"
  local pattern="$2"
  
  echo "Updating imports in $dir..."
  
  # Find TypeScript and JavaScript files
  find "$dir" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    echo "Processing $file..."
    
    # Create a backup
    cp "$file" "$file.bak"
    
    # Replace relative imports with module aliases
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/core/([^'\"]+)['\"]|import \\1 from '@claude-framework/core/\\3'|g" "$file"
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/workflows/([^'\"]+)['\"]|import \\1 from '@claude-framework/workflows/\\3'|g" "$file"
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/agents/([^'\"]+)['\"]|import \\1 from '@claude-framework/agents/\\3'|g" "$file"
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/mcp/([^'\"]+)['\"]|import \\1 from '@claude-framework/mcp/\\3'|g" "$file"
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/rag/([^'\"]+)['\"]|import \\1 from '@claude-framework/rag/\\3'|g" "$file"
    sed -i.temp -E "s|import (.+) from ['\"](\.\./)+libs/shared/([^'\"]+)['\"]|import \\1 from '@claude-framework/shared/\\3'|g" "$file"
    
    # Replace require statements with module aliases
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/core/([^'\"]+)['\"]\)|require('@claude-framework/core/\\2')|g" "$file"
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/workflows/([^'\"]+)['\"]\)|require('@claude-framework/workflows/\\2')|g" "$file"
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/agents/([^'\"]+)['\"]\)|require('@claude-framework/agents/\\2')|g" "$file"
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/mcp/([^'\"]+)['\"]\)|require('@claude-framework/mcp/\\2')|g" "$file"
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/rag/([^'\"]+)['\"]\)|require('@claude-framework/rag/\\2')|g" "$file"
    sed -i.temp -E "s|require\(['\"](\.\./)+libs/shared/([^'\"]+)['\"]\)|require('@claude-framework/shared/\\2')|g" "$file"
    
    # Remove temporary files
    rm -f "$file.temp"
  done
  
  echo "Import paths updated in $dir."
}

# Create a tsconfig.paths.json file for path aliases
create_tsconfig_paths() {
  echo "Creating tsconfig.paths.json..."
  
  cat > "$TARGET_ROOT/tsconfig.paths.json" << 'EOF'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@claude-framework/core/*": ["libs/core/src/*"],
      "@claude-framework/workflows/*": ["libs/workflows/src/*"],
      "@claude-framework/agents/*": ["libs/agents/src/*"],
      "@claude-framework/mcp/*": ["libs/mcp/src/*"],
      "@claude-framework/rag/*": ["libs/rag/src/*"],
      "@claude-framework/shared/*": ["libs/shared/src/*"]
    }
  }
}
EOF
  
  echo "tsconfig.paths.json created."
}

# Update the main tsconfig.base.json
update_tsconfig_base() {
  echo "Updating tsconfig.base.json..."
  
  local tsconfig="$TARGET_ROOT/tsconfig.base.json"
  
  # Create a backup
  cp "$tsconfig" "$tsconfig.bak"
  
  # Read the current content
  local content=$(cat "$tsconfig")
  
  # Check if content is a valid JSON
  if jq empty "$tsconfig" 2>/dev/null; then
    # Modify the JSON to include the paths file
    jq '. += {"extends": "./tsconfig.paths.json"}' "$tsconfig" > "$tsconfig.temp"
    mv "$tsconfig.temp" "$tsconfig"
    echo "Updated tsconfig.base.json to extend tsconfig.paths.json."
  else
    echo "WARNING: tsconfig.base.json is not valid JSON. Manual update required."
    echo "Please add the following line to tsconfig.base.json:"
    echo '"extends": "./tsconfig.paths.json"'
  fi
}

# Create an index.ts file for each library module to simplify imports
create_index_files() {
  local modules=("core" "workflows" "agents" "mcp" "rag" "shared")
  
  for module in "${modules[@]}"; do
    local module_dir="$TARGET_ROOT/libs/$module/src"
    
    if [ -d "$module_dir" ]; then
      echo "Creating index.ts for $module..."
      
      # Start with the main export file
      local index_file="$module_dir/index.ts"
      
      # Create or clean the file
      echo "/**
 * Main exports for @claude-framework/$module
 */
" > "$index_file"
      
      # Get subdirectories (excluding node_modules and tests)
      for subdir in $(find "$module_dir" -maxdepth 1 -type d | sort | grep -v "node_modules" | grep -v "test" | grep -v "$module_dir\$"); do
        local subdir_name=$(basename "$subdir")
        local subdir_index="$subdir/index.ts"
        
        # Create index file for subdirectory if it doesn't exist
        if [ ! -f "$subdir_index" ]; then
          echo "Creating index.ts for $module/$subdir_name..."
          
          # Start with the subdirectory export file
          echo "/**
 * Exports for @claude-framework/$module/$subdir_name
 */
" > "$subdir_index"
          
          # Find TypeScript files in the subdirectory
          for ts_file in $(find "$subdir" -maxdepth 1 -name "*.ts" | sort | grep -v "index.ts"); do
            local file_name=$(basename "$ts_file" .ts)
            
            # Add export statement for the file
            echo "export * from './$file_name';" >> "$subdir_index"
          done
        fi
        
        # Add export statement for the subdirectory to the main index file
        echo "export * from './$subdir_name';" >> "$index_file"
      done
      
      echo "Created index.ts for $module."
    fi
  done
}

# Update package.json to include module mapping
update_package_json() {
  echo "Updating package.json..."
  
  local package_json="$TARGET_ROOT/package.json"
  
  # Create a backup
  cp "$package_json" "$package_json.bak"
  
  # Add workspace mapping for better imports
  if jq empty "$package_json" 2>/dev/null; then
    # Add the imports field for package mappings
    jq '.imports = {
      "@claude-framework/core/*": ["./libs/core/src/*"],
      "@claude-framework/workflows/*": ["./libs/workflows/src/*"],
      "@claude-framework/agents/*": ["./libs/agents/src/*"],
      "@claude-framework/mcp/*": ["./libs/mcp/src/*"],
      "@claude-framework/rag/*": ["./libs/rag/src/*"],
      "@claude-framework/shared/*": ["./libs/shared/src/*"]
    }' "$package_json" > "$package_json.temp"
    mv "$package_json.temp" "$package_json"
    echo "Updated package.json with module mappings."
  else
    echo "WARNING: package.json is not valid JSON. Manual update required."
  fi
}

# Main execution
echo "Starting import path updates..."

# Update imports in the libs directory
update_imports "$TARGET_ROOT/libs" "**/*.ts"

# Update imports in the apps directory
update_imports "$TARGET_ROOT/apps" "**/*.ts"

# Create TypeScript path configuration
create_tsconfig_paths
update_tsconfig_base

# Create index files for better imports
create_index_files

# Update package.json
update_package_json

echo "Import path updates completed."

# Explain next steps
echo "
To complete the import path updates, you should:

1. Install required development dependencies:
   npm install --save-dev typescript tsconfig-paths

2. Configure the build system to handle path aliases:
   - For webpack, add TsconfigPathsPlugin
   - For Jest, configure moduleNameMapper
   - For Node.js, use ts-node with tsconfig-paths/register

3. Test the application to ensure all imports work correctly:
   - Run the TypeScript compiler (tsc) to check for errors
   - Check for runtime errors in imported modules
   - Verify that proxies correctly import from the new paths

For IDE support, make sure your editor recognizes the path aliases:
- VS Code should work automatically with the tsconfig.paths.json
- For other editors, you may need additional configuration
"