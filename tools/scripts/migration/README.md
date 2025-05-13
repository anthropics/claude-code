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
