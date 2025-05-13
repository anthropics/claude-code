#!/bin/bash

# Migration Script for Claude Framework Integration
# This script implements the file moves and consolidation defined in the Integration Plan

set -e

SOURCE_ROOT="/home/jan/Schreibtisch/TEST/claude-code"
TARGET_ROOT="/home/jan/Schreibtisch/TEST/claude-code/claude-framework"

# Create required directories if they don't exist
create_directories() {
  echo "Creating required directories..."
  
  # Core structure 
  mkdir -p "$TARGET_ROOT/apps/cli/src/commands"
  mkdir -p "$TARGET_ROOT/apps/cli/src/utils"
  mkdir -p "$TARGET_ROOT/apps/web/src/components"
  mkdir -p "$TARGET_ROOT/apps/web/src/hooks/mcp"
  mkdir -p "$TARGET_ROOT/apps/web/src/contexts"
  mkdir -p "$TARGET_ROOT/apps/web/src/pages"
  
  # Lib structure
  mkdir -p "$TARGET_ROOT/libs/agents/src/agent-base"
  mkdir -p "$TARGET_ROOT/libs/agents/src/debug"
  mkdir -p "$TARGET_ROOT/libs/agents/src/doc"
  mkdir -p "$TARGET_ROOT/libs/agents/src/git"
  mkdir -p "$TARGET_ROOT/libs/agents/src/orchestrator"
  
  mkdir -p "$TARGET_ROOT/libs/workflows/src/sequential/documentation"
  mkdir -p "$TARGET_ROOT/libs/workflows/src/sequential/integration"
  mkdir -p "$TARGET_ROOT/libs/workflows/src/sequential/services"
  
  # Configuration structure
  mkdir -p "$TARGET_ROOT/configs/api"
  mkdir -p "$TARGET_ROOT/configs/backup"
  mkdir -p "$TARGET_ROOT/configs/color-schema"
  mkdir -p "$TARGET_ROOT/configs/debug"
  mkdir -p "$TARGET_ROOT/configs/enterprise"
  mkdir -p "$TARGET_ROOT/configs/i18n"
  mkdir -p "$TARGET_ROOT/configs/mcp"
  mkdir -p "$TARGET_ROOT/configs/rag"
  mkdir -p "$TARGET_ROOT/configs/saar"
  mkdir -p "$TARGET_ROOT/configs/security"
  mkdir -p "$TARGET_ROOT/configs/workflows"
  
  # Tools structure
  mkdir -p "$TARGET_ROOT/tools/scripts/migration"
  mkdir -p "$TARGET_ROOT/tools/scripts/backup"
  mkdir -p "$TARGET_ROOT/tools/scripts/ci"
  mkdir -p "$TARGET_ROOT/tools/scripts/setup"
  
  echo "Directory structure created."
}

# Migrate Sequential Execution Manager
migrate_sequential_execution_manager() {
  echo "Migrating Sequential Execution Manager..."
  
  # Check if TypeScript implementation exists, if not, we need to create it first
  if [ ! -f "$TARGET_ROOT/libs/workflows/src/sequential/sequential-execution-manager.ts" ]; then
    # If not already migrated, copy the source file as a starting point for manual refactoring
    cp "$SOURCE_ROOT/src/tools/mcp/integration/sequential_execution_manager.js" "$TARGET_ROOT/libs/workflows/src/sequential/sequential-execution-manager.js"
    echo "WARNING: sequential-execution-manager.js has been copied but needs to be manually converted to TypeScript"
  fi
  
  # Create proxy module in the original location if it doesn't exist
  if [ ! -f "$SOURCE_ROOT/src/tools/mcp/integration/sequential_execution_manager.js.proxy" ]; then
    # Backup original file
    cp "$SOURCE_ROOT/src/tools/mcp/integration/sequential_execution_manager.js" "$SOURCE_ROOT/src/tools/mcp/integration/sequential_execution_manager.js.original"
    
    # Create proxy content
    cat > "$SOURCE_ROOT/src/tools/mcp/integration/sequential_execution_manager.js.proxy" << 'EOF'
// PROXY MODULE - This file now serves as a proxy to the main TypeScript implementation
// Import from claude-framework directly in new code

let sequentialExecutionManager;

try {
  sequentialExecutionManager = require('../../../../claude-framework/libs/workflows/src/sequential/sequential-execution-manager');
  
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      'DEPRECATED: Importing from src/tools/mcp/integration/sequential_execution_manager.js is deprecated. ' +
      'Import from @claude-framework/workflows/sequential/sequential-execution-manager directly.'
    );
  }
} catch (error) {
  console.warn('\x1b[31m%s\x1b[0m', 'Failed to load from framework, using legacy implementation.');
  // Fall back to original implementation
  sequentialExecutionManager = require('./sequential_execution_manager.js.original');
}

module.exports = sequentialExecutionManager;
EOF
    
    echo "Created proxy module for sequential_execution_manager.js"
  fi
  
  echo "Sequential Execution Manager migration prepared."
}

# Migrate configuration files
migrate_configs() {
  echo "Migrating configuration files..."
  
  # API schema
  if [ -f "$SOURCE_ROOT/src/core/config/api-schema.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/api-schema.json" "$TARGET_ROOT/configs/api/schema.json"
  fi
  
  # Backup config
  if [ -f "$SOURCE_ROOT/src/core/config/backup_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/backup_config.json" "$TARGET_ROOT/configs/backup/config.json"
  fi
  
  # Color schema config
  if [ -f "$SOURCE_ROOT/src/core/config/color_schema_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/color_schema_config.json" "$TARGET_ROOT/configs/color-schema/config.json"
  fi
  
  # Debug workflow config
  if [ -f "$SOURCE_ROOT/src/core/config/debug_workflow_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/debug_workflow_config.json" "$TARGET_ROOT/configs/debug/workflow-config.json"
  fi
  
  # Enterprise config
  if [ -f "$SOURCE_ROOT/src/core/config/enterprise_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/enterprise_config.json" "$TARGET_ROOT/configs/enterprise/config.json"
  fi
  
  # i18n config
  if [ -f "$SOURCE_ROOT/src/core/config/i18n_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/i18n_config.json" "$TARGET_ROOT/configs/i18n/config.json"
  fi
  
  # MCP config
  if [ -f "$SOURCE_ROOT/src/core/config/mcp_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/mcp_config.json" "$TARGET_ROOT/configs/mcp/config.json"
  fi
  
  # RAG config
  if [ -f "$SOURCE_ROOT/src/core/config/rag_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/rag_config.json" "$TARGET_ROOT/configs/rag/config.json"
  fi
  
  # SAAR config
  if [ -f "$SOURCE_ROOT/src/core/config/saa_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/saa_config.json" "$TARGET_ROOT/configs/saar/config.json"
  fi
  
  # Security constraints
  if [ -f "$SOURCE_ROOT/src/core/config/security_constraints.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/security_constraints.json" "$TARGET_ROOT/configs/security/constraints.json"
  fi
  
  if [ -f "$SOURCE_ROOT/src/core/config/security_constraints.md" ]; then
    cp "$SOURCE_ROOT/src/core/config/security_constraints.md" "$TARGET_ROOT/configs/security/constraints.md"
  fi
  
  # Global config
  if [ -f "$SOURCE_ROOT/src/core/config/global_config.json" ]; then
    cp "$SOURCE_ROOT/src/core/config/global_config.json" "$TARGET_ROOT/configs/global.json"
  fi
  
  echo "Configuration files migrated."
}

# Migrate documentation
migrate_documentation() {
  echo "Migrating documentation..."
  
  # Copy ai_docs to docs directory, avoiding duplication
  rsync -av --ignore-existing "$SOURCE_ROOT/ai_docs/" "$TARGET_ROOT/docs/"
  
  # Copy guides specifically to ensure latest versions
  if [ -d "$SOURCE_ROOT/ai_docs/guides" ]; then
    rsync -av "$SOURCE_ROOT/ai_docs/guides/" "$TARGET_ROOT/docs/guides/"
  fi
  
  echo "Documentation migrated."
}

# Migrate UI components
migrate_ui_components() {
  echo "Migrating UI components..."
  
  # Copy component directories
  if [ -d "$SOURCE_ROOT/src/components" ]; then
    # Dashboard components
    if [ -d "$SOURCE_ROOT/src/components/dashboard" ]; then
      rsync -av "$SOURCE_ROOT/src/components/dashboard/" "$TARGET_ROOT/apps/web/src/components/dashboard/"
    fi
    
    # Enterprise components
    if [ -d "$SOURCE_ROOT/src/components/enterprise" ]; then
      rsync -av "$SOURCE_ROOT/src/components/enterprise/" "$TARGET_ROOT/apps/web/src/components/enterprise/"
    fi
    
    # Form components
    if [ -d "$SOURCE_ROOT/src/components/form" ]; then
      rsync -av "$SOURCE_ROOT/src/components/form/" "$TARGET_ROOT/apps/web/src/components/form/"
    fi
    
    # Layout components
    if [ -d "$SOURCE_ROOT/src/components/layout" ]; then
      rsync -av "$SOURCE_ROOT/src/components/layout/" "$TARGET_ROOT/apps/web/src/components/layout/"
    fi
    
    # MCP components
    if [ -d "$SOURCE_ROOT/src/components/mcp" ]; then
      rsync -av "$SOURCE_ROOT/src/components/mcp/" "$TARGET_ROOT/apps/web/src/components/mcp/"
    fi
    
    # Profile components
    if [ -d "$SOURCE_ROOT/src/components/profile" ]; then
      rsync -av "$SOURCE_ROOT/src/components/profile/" "$TARGET_ROOT/apps/web/src/components/profile/"
    fi
    
    # Rewards components
    if [ -d "$SOURCE_ROOT/src/components/rewards" ]; then
      rsync -av "$SOURCE_ROOT/src/components/rewards/" "$TARGET_ROOT/apps/web/src/components/rewards/"
    fi
  fi
  
  # Copy hooks and contexts
  if [ -d "$SOURCE_ROOT/src/hooks" ]; then
    rsync -av "$SOURCE_ROOT/src/hooks/" "$TARGET_ROOT/apps/web/src/hooks/"
  fi
  
  if [ -d "$SOURCE_ROOT/src/contexts" ]; then
    rsync -av "$SOURCE_ROOT/src/contexts/" "$TARGET_ROOT/apps/web/src/contexts/"
  fi
  
  echo "UI components migrated."
}

# Migrate core functionality
migrate_core() {
  echo "Migrating core functionality..."
  
  # Core config to libs
  if [ -d "$SOURCE_ROOT/src/core/config" ]; then
    rsync -av --exclude="*.json" --exclude="*.md" "$SOURCE_ROOT/src/core/config/" "$TARGET_ROOT/libs/core/src/config/"
  fi
  
  # Error handling
  if [ -d "$SOURCE_ROOT/src/core/error" ]; then
    rsync -av "$SOURCE_ROOT/src/core/error/" "$TARGET_ROOT/libs/core/src/error/"
  fi
  
  # i18n
  if [ -d "$SOURCE_ROOT/src/core/i18n" ]; then
    rsync -av "$SOURCE_ROOT/src/core/i18n/" "$TARGET_ROOT/libs/core/src/i18n/"
  fi
  
  # Logging
  if [ -d "$SOURCE_ROOT/src/core/logging" ]; then
    rsync -av "$SOURCE_ROOT/src/core/logging/" "$TARGET_ROOT/libs/core/src/logging/"
  fi
  
  # MCP
  if [ -d "$SOURCE_ROOT/src/core/mcp" ]; then
    # Skip fallbacks and routes for now, they need special handling
    rsync -av --exclude="fallbacks" --exclude="routes" "$SOURCE_ROOT/src/core/mcp/" "$TARGET_ROOT/libs/mcp/src/"
    
    # Copy server configuration
    if [ -f "$SOURCE_ROOT/src/core/mcp/server_config.json" ]; then
      cp "$SOURCE_ROOT/src/core/mcp/server_config.json" "$TARGET_ROOT/configs/mcp/server_config.json"
    fi
  fi
  
  # RAG
  if [ -d "$SOURCE_ROOT/src/core/rag" ]; then
    rsync -av "$SOURCE_ROOT/src/core/rag/" "$TARGET_ROOT/libs/rag/src/"
  fi
  
  # Security
  if [ -d "$SOURCE_ROOT/src/core/security" ]; then
    rsync -av "$SOURCE_ROOT/src/core/security/" "$TARGET_ROOT/libs/core/src/security/"
  fi
  
  # Utils
  if [ -d "$SOURCE_ROOT/src/core/utils" ]; then
    rsync -av "$SOURCE_ROOT/src/core/utils/" "$TARGET_ROOT/libs/shared/src/utils/"
  fi
  
  echo "Core functionality migrated."
}

# Migrate agents
migrate_agents() {
  echo "Migrating agent system..."
  
  # Copy main agent code
  if [ -d "$SOURCE_ROOT/agents" ]; then
    rsync -av "$SOURCE_ROOT/agents/" "$TARGET_ROOT/libs/agents/src/"
  fi
  
  # A2A manager
  if [ -f "$SOURCE_ROOT/src/core/mcp/a2a_manager.js" ]; then
    cp "$SOURCE_ROOT/src/core/mcp/a2a_manager.js" "$TARGET_ROOT/libs/agents/src/a2a-manager.ts"
    echo "WARNING: a2a_manager.js has been copied but needs to be manually converted to TypeScript"
  fi
  
  echo "Agent system migrated."
}

# Migrate CLI tools
migrate_cli() {
  echo "Migrating CLI tools..."
  
  # Copy CLI commands
  if [ -d "$SOURCE_ROOT/cli/commands" ]; then
    rsync -av "$SOURCE_ROOT/cli/commands/" "$TARGET_ROOT/apps/cli/src/commands/"
  fi
  
  echo "CLI tools migrated."
}

# Migrate scripts and tools
migrate_scripts() {
  echo "Migrating scripts and tools..."
  
  # Copy important tools
  if [ -d "$SOURCE_ROOT/tools" ]; then
    rsync -av "$SOURCE_ROOT/tools/examples/" "$TARGET_ROOT/tools/examples/"
  fi
  
  # Copy important scripts from saar
  if [ -d "$SOURCE_ROOT/saar/scripts" ]; then
    # Backup scripts
    if [ -d "$SOURCE_ROOT/saar/scripts/backup" ]; then
      rsync -av "$SOURCE_ROOT/saar/scripts/backup/" "$TARGET_ROOT/tools/scripts/backup/"
    fi
    
    # Setup scripts
    if [ -d "$SOURCE_ROOT/saar/scripts/setup" ]; then
      rsync -av "$SOURCE_ROOT/saar/scripts/setup/" "$TARGET_ROOT/tools/scripts/setup/"
    fi
    
    # Git scripts
    if [ -d "$SOURCE_ROOT/saar/scripts/git" ]; then
      rsync -av "$SOURCE_ROOT/saar/scripts/git/" "$TARGET_ROOT/tools/scripts/git/"
    fi
  fi
  
  echo "Scripts and tools migrated."
}

# Create proxy modules for key files that need backward compatibility
create_proxy_modules() {
  echo "Creating proxy modules for backward compatibility..."
  
  # List of key files that need proxies
  declare -a proxy_files=(
    "src/core/mcp/fallbacks/sequential-planner.js"
    "src/core/mcp/fallbacks/sequential-planner-fallback.js"
    "src/core/mcp/routes/sequential-planner.js"
    "src/core/mcp/routes/sequential-thinking.js"
    "src/tools/mcp/sequential_planner.js"
    "tools/mcp/integration/sequential_execution_manager.js"
  )
  
  for file in "${proxy_files[@]}"; do
    if [ -f "$SOURCE_ROOT/$file" ]; then
      # Backup original file
      cp "$SOURCE_ROOT/$file" "$SOURCE_ROOT/$file.original"
      
      # Get filename without path and extension
      filename=$(basename "$file" .js)
      
      # Create proxy module content
      cat > "$SOURCE_ROOT/$file.proxy" << EOF
// PROXY MODULE - This file now serves as a proxy to the main TypeScript implementation
// Import from claude-framework directly in new code

let $filename;

try {
  // Path will need to be manually adjusted based on the actual location in the framework
  $filename = require('../../../claude-framework/libs/workflows/src/sequential/services/$filename');
  
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      'DEPRECATED: Importing from $file is deprecated. ' +
      'Import from @claude-framework/workflows/sequential/$filename directly.'
    );
  }
} catch (error) {
  console.warn('\x1b[31m%s\x1b[0m', 'Failed to load from framework, using legacy implementation.');
  // Fall back to original implementation
  $filename = require('./$filename.original');
}

module.exports = $filename;
EOF
      
      echo "Created proxy module for $file"
    fi
  done
  
  echo "Proxy modules created."
}

# Generate a README file for the migration
generate_readme() {
  echo "Generating migration README..."
  
  cat > "$TARGET_ROOT/tools/scripts/migration/README.md" << 'EOF'
# Migration Script for Claude Framework Integration

This directory contains scripts and documentation for migrating the codebase to the new Claude Framework structure.

## Script Functionality

The `migrate.sh` script performs the following actions:

1. Creates the necessary directory structure in the target location
2. Migrates configuration files to their new locations
3. Copies documentation from ai_docs to the docs directory
4. Migrates UI components to the apps/web directory
5. Migrates core functionality to appropriate library locations
6. Copies agent system code to the libs/agents directory
7. Migrates CLI tools to the apps/cli directory
8. Copies scripts and tools to the tools directory
9. Creates proxy modules for backward compatibility

## Manual Steps Required

After running the migration script, the following manual steps are required:

1. Convert JavaScript files to TypeScript
2. Update import paths throughout the codebase
3. Ensure TypeScript configuration is correct
4. Run tests to validate the migration
5. Update documentation references

## Migration Verification

To verify the migration was successful:

1. Check that all directories and files were created correctly
2. Ensure proxy modules are working by importing from old paths
3. Run the build process to check for TypeScript errors
4. Test the application to ensure functionality is maintained

## Rollback Procedure

If issues are encountered during migration:

1. Original files are backed up with .original extension
2. Proxy modules can be reverted by copying .original files back to their original names
3. The target directory can be removed and recreated if needed

## Future Steps

Once the migration is complete and stable:

1. Remove the .original backup files
2. Consider setting a deprecation timeline for the proxy modules
3. Update documentation to reference the new structure exclusively

For more details, see the INTEGRATION-PLAN.md file in the root directory.
EOF
  
  echo "Migration README generated."
}

# Main execution
main() {
  echo "Starting Claude Framework migration..."
  
  # Create directory structure
  create_directories
  
  # Migrate components
  migrate_sequential_execution_manager
  migrate_configs
  migrate_documentation
  migrate_ui_components
  migrate_core
  migrate_agents
  migrate_cli
  migrate_scripts
  
  # Create proxy modules
  create_proxy_modules
  
  # Generate documentation
  generate_readme
  
  echo "Migration completed. See README for manual steps required."
}

# Run the main function
main