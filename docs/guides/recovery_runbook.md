# Claude Neural Framework Recovery Runbook

This runbook provides step-by-step procedures for recovering the Claude Neural Framework in various failure scenarios. Follow these procedures during outages or data loss events.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [Prerequisites](#prerequisites)
3. [Complete System Recovery](#complete-system-recovery)
4. [Database Recovery](#database-recovery)
5. [Configuration Recovery](#configuration-recovery)
6. [Component-Specific Recovery](#component-specific-recovery)
7. [Disaster Recovery](#disaster-recovery)
8. [Troubleshooting](#troubleshooting)
9. [Validation Procedures](#validation-procedures)

## Emergency Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Primary Admin | [Name] | [Email] | [Phone] |
| Backup Admin | [Name] | [Email] | [Phone] |
| Database Specialist | [Name] | [Email] | [Phone] |
| Security Officer | [Name] | [Email] | [Phone] |

## Prerequisites

Before beginning any recovery procedure, ensure you have:

1. System access credentials
2. Backup encryption keys (from secure storage)
3. Access to backup storage locations
4. Required permissions to restore data
5. Recovery environment if applicable

## Complete System Recovery

Use this procedure to recover the entire Claude Neural Framework system.

### Preparation

1. Identify the backup to restore from:
   ```bash
   # List available backups
   node scripts/backup/verify.js --latest

   # OR specify a date
   node scripts/backup/verify.js --date=YYYY-MM-DD
   ```

2. Verify backup integrity:
   ```bash
   node scripts/backup/verify.js --backup-id=<backup-id>
   ```

### Execution

1. Stop all running services:
   ```bash
   sudo systemctl stop claude-neural-framework.service
   sudo systemctl stop claude-mcp-server.service
   sudo systemctl stop claude-rag-service.service
   ```

2. Perform the restore:
   ```bash
   node scripts/backup/restore.js --backup-id=<backup-id> --full
   ```

3. Restart services:
   ```bash
   sudo systemctl start claude-neural-framework.service
   sudo systemctl start claude-mcp-server.service
   sudo systemctl start claude-rag-service.service
   ```

4. Verify system functionality:
   ```bash
   node scripts/backup/system_verification.js
   ```

## Database Recovery

Use this procedure to recover only the database components.

### Vector Database Recovery

1. Stop RAG services:
   ```bash
   sudo systemctl stop claude-rag-service.service
   ```

2. Restore vector database:
   ```bash
   node scripts/backup/restore.js --target=rag_vector_store
   ```

3. Validate database integrity:
   ```bash
   python core/rag/validate_db.py
   ```

4. Restart RAG services:
   ```bash
   sudo systemctl start claude-rag-service.service
   ```

## Configuration Recovery

Use this procedure to recover system configuration only.

1. Identify configuration backup:
   ```bash
   node scripts/backup/verify.js --category=critical
   ```

2. Restore configuration:
   ```bash
   node scripts/backup/restore.js --target=configuration
   ```

3. Verify configuration:
   ```bash
   node scripts/backup/verify.js --target=configuration
   ```

## Component-Specific Recovery

### MCP Server Recovery

1. Stop MCP server:
   ```bash
   sudo systemctl stop claude-mcp-server.service
   ```

2. Restore MCP configuration:
   ```bash
   node scripts/backup/restore.js --target=core/mcp
   ```

3. Restart MCP server:
   ```bash
   sudo systemctl start claude-mcp-server.service
   ```

4. Validate MCP functionality:
   ```bash
   node core/mcp/test_connection.js
   ```

### RAG System Recovery

1. Stop RAG services:
   ```bash
   sudo systemctl stop claude-rag-service.service
   ```

2. Restore RAG components:
   ```bash
   node scripts/backup/restore.js --target=core/rag
   ```

3. Restart RAG services:
   ```bash
   sudo systemctl start claude-rag-service.service
   ```

4. Validate RAG functionality:
   ```bash
   python core/rag/test_query.py
   ```

## Disaster Recovery

Follow these steps for complete disaster recovery to a new environment.

### New Environment Setup

1. Provision new server(s) according to [System Requirements](system_requirements.md)

2. Clone the repository:
   ```bash
   git clone https://github.com/username/claude-neural-framework.git
   cd claude-neural-framework
   ```

3. Install dependencies:
   ```bash
   ./installation/install.sh
   ```

4. Configure environment variables:
   ```bash
   export CLAUDE_API_KEY="YOUR_CLAUDE_API_KEY"
   export MCP_API_KEY="YOUR_MCP_API_KEY"
   export BACKUP_ENCRYPTION_KEY="YOUR_BACKUP_KEY"
   ```

### Data Restoration

1. Copy backup files to new environment:
   ```bash
   # For external storage backups
   aws s3 cp s3://claude-neural-framework-backups/backups/ /var/backups/claude-neural-framework/ --recursive
   
   # OR for manually transferred backups
   mkdir -p /var/backups/claude-neural-framework
   cp -r /path/to/backup/files/* /var/backups/claude-neural-framework/
   ```

2. Restore all critical data:
   ```bash
   node scripts/backup/restore.js --category=critical
   ```

3. Restore other categories as needed:
   ```bash
   node scripts/backup/restore.js --category=important
   node scripts/backup/restore.js --category=historical
   ```

4. Verify system:
   ```bash
   node scripts/backup/system_verification.js
   ```

5. Start all services:
   ```bash
   sudo systemctl start claude-neural-framework.service
   sudo systemctl start claude-mcp-server.service
   sudo systemctl start claude-rag-service.service
   ```

## Troubleshooting

### Decryption Errors

If you encounter errors related to decryption:

1. Verify the encryption key:
   ```bash
   echo $BACKUP_ENCRYPTION_KEY
   ```

2. Ensure the key matches the one used during backup

3. If the key is lost, retrieve from secure storage or key management system

### Incomplete Restores

If restore completes but system verification fails:

1. Check system logs:
   ```bash
   tail -100 /var/log/claude-neural-framework/backup.log
   ```

2. Verify all critical components were restored:
   ```bash
   node scripts/backup/verify.js --backup-id=<backup-id> --verbose
   ```

3. Try restoring specific components that failed:
   ```bash
   node scripts/backup/restore.js --backup-id=<backup-id> --target=<failed-component>
   ```

### Permission Issues

If encountering permission errors during restore:

1. Check current permissions:
   ```bash
   ls -la /path/to/restore/location
   ```

2. Fix permissions as needed:
   ```bash
   sudo chown -R correct-user:correct-group /path/to/restore/location
   sudo chmod -R 755 /path/to/restore/location
   ```

## Validation Procedures

After any recovery operation, validate the system:

1. Run system verification:
   ```bash
   node scripts/backup/system_verification.js
   ```

2. Check all services are running:
   ```bash
   sudo systemctl status claude-neural-framework.service
   sudo systemctl status claude-mcp-server.service
   sudo systemctl status claude-rag-service.service
   ```

3. Perform an end-to-end test:
   ```bash
   # Test MCP integration
   node core/mcp/test_client.js
   
   # Test RAG functionality
   python core/rag/query_test.py --query "test query"
   ```

4. Document the recovery operation:
   - Date and time
   - Backup used
   - Components restored
   - Any issues encountered
   - Verification results