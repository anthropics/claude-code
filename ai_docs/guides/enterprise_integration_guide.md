# Enterprise Integration Guide

This guide provides detailed instructions for integrating the Claude Neural Framework with enterprise environments and systems.

## Overview

The Enterprise Edition of the Claude Neural Framework offers enhanced capabilities for organizational deployment, including:

- **Security Features**: SSO, RBAC, compliance tools
- **Collaboration Tools**: Teams, access control, audit logging
- **Enterprise Integrations**: JIRA, GitHub Enterprise, CI/CD systems
- **Governance**: Approval workflows, policy enforcement, compliance
- **Scale**: Load balancing, high availability, monitoring

## Prerequisites

- Enterprise license key
- Node.js 18.x or higher
- Adequate system resources (8GB+ RAM, 4+ CPU cores recommended)
- Administrative access to identity providers (for SSO)
- Network access to enterprise systems for integration

## Installation

### 1. Standard Installation

Start with the standard installation process:

```bash
# Clone repository
git clone https://github.com/username/claude-neural-framework.git
cd claude-neural-framework

# Run the SAAR script with enterprise flag
./saar.sh setup --enterprise
```

### 2. Enterprise Configuration

Set up enterprise features:

```bash
# Activate enterprise license
./saar.sh enterprise license activate YOUR_LICENSE_KEY

# Enterprise configuration wizard
./saar.sh enterprise setup
```

## Configuration

### Identity Management

#### SSO Configuration

The framework supports various identity providers:

```bash
# Set up Okta SSO
./saar.sh enterprise sso configure okta \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET" \
  --auth-url="https://your-org.okta.com/oauth2/v1/authorize" \
  --token-url="https://your-org.okta.com/oauth2/v1/token"

# Set up Azure AD
./saar.sh enterprise sso configure azure \
  --tenant-id="YOUR_TENANT_ID" \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET"
```

Or edit the config file directly:

```yaml
# schema-ui-integration/enterprise/config/enterprise.yaml
security:
  sso:
    enabled: true
    providers:
      - name: "okta"
        enabled: true
        client_id: "YOUR_CLIENT_ID"
        client_secret: "YOUR_CLIENT_SECRET"
        auth_url: "https://your-org.okta.com/oauth2/v1/authorize"
        token_url: "https://your-org.okta.com/oauth2/v1/token"
```

#### Role-Based Access Control

Configure roles and permissions:

```bash
# Define roles
./saar.sh enterprise rbac role create --name="admin" --permissions="*"
./saar.sh enterprise rbac role create --name="developer" --permissions="read,write,execute"
./saar.sh enterprise rbac role create --name="viewer" --permissions="read"

# Set default role
./saar.sh enterprise rbac set-default --role="viewer"
```

### Team Management

Create and manage teams:

```bash
# Create a team
./saar.sh enterprise teams create --name="Engineering" --description="Engineering team"

# Add members to team
./saar.sh enterprise teams add-member --team="Engineering" --email="jane@example.com" --role="admin"
./saar.sh enterprise teams add-member --team="Engineering" --email="john@example.com" --role="member"
```

### Audit Logging

Configure audit logging:

```bash
# Configure audit logging
./saar.sh enterprise audit configure --retention-days=90 --storage="local"

# For external log storage (e.g., CloudWatch)
./saar.sh enterprise audit configure --storage="cloudwatch" --aws-region="us-west-2" --log-group="claude-framework-logs"
```

## Enterprise MCP Integration

The Enterprise Edition includes additional MCP servers for enterprise features.

### MCP Server Configuration

Configure the enterprise MCP servers:

```bash
# Start enterprise MCP servers
./saar.sh enterprise mcp start

# Check MCP server status
./saar.sh enterprise mcp status
```

### MCP Client Integration

Use the Enterprise MCP client in your code:

```javascript
const { getEnterpriseMcpClient } = require('./core/mcp/enterprise/enterprise_mcp');

async function checkUserPermission(userId, permission) {
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  const result = await client.hasPermission(userId, permission);
  return result.hasPermission;
}
```

## Security Features

### Data Encryption

Configure data encryption:

```bash
# Enable encryption
./saar.sh enterprise security encryption enable --algorithm="AES-256"

# Generate new encryption key
./saar.sh enterprise security encryption generate-key
```

### Compliance Tools

Run compliance checks:

```bash
# Run compliance check
./saar.sh enterprise compliance check --standard="GDPR"

# Generate compliance report
./saar.sh enterprise compliance report --standard="SOC2" --output="report.pdf"
```

## Third-Party Integrations

### JIRA Integration

Configure JIRA integration:

```bash
# Configure JIRA integration
./saar.sh enterprise integration jira configure \
  --url="https://your-org.atlassian.net" \
  --api-key="YOUR_API_KEY" \
  --project-key="PROJ"
```

### GitHub Enterprise Integration

```bash
# Configure GitHub Enterprise integration
./saar.sh enterprise integration github configure \
  --url="https://github.your-org.com" \
  --api-key="YOUR_API_KEY"
```

## Monitoring and Metrics

Configure monitoring:

```bash
# Enable metrics collection
./saar.sh enterprise monitoring metrics enable --interval=60

# Configure alerts
./saar.sh enterprise monitoring alerts configure --channel="slack" --webhook-url="YOUR_WEBHOOK_URL"
```

## Troubleshooting

### Common Issues

#### SSO Authentication Failures

If SSO authentication fails:

1. Check identity provider configuration
2. Verify that redirect URLs are correctly configured
3. Check network connectivity to identity provider
4. Review logs in `$HOME/.claude/enterprise/logs/auth.log`

#### Permission Errors

If users experience permission errors:

1. Check user roles in RBAC configuration
2. Verify team memberships
3. Look for audit logs of failed permission checks
4. Try to reproduce with an admin user

#### Connectivity Issues

If enterprise MCP servers are not responding:

1. Check if servers are running with `./saar.sh enterprise mcp status`
2. Verify network connectivity to MCP servers
3. Check MCP server logs in `$HOME/.claude/enterprise/logs/mcp.log`
4. Restart MCP servers with `./saar.sh enterprise mcp restart`

### Logs

Enterprise logs are stored in:

- Authentication logs: `$HOME/.claude/enterprise/logs/auth.log`
- Audit logs: `$HOME/.claude/enterprise/logs/audit.log`
- MCP server logs: `$HOME/.claude/enterprise/logs/mcp.log`
- RBAC logs: `$HOME/.claude/enterprise/logs/rbac.log`

## Updates and Migrations

Update the enterprise edition:

```bash
# Check for enterprise updates
./saar.sh enterprise check-updates

# Apply enterprise updates
./saar.sh enterprise update
```

Migrate configuration:

```bash
# Export enterprise configuration
./saar.sh enterprise config export --output="enterprise-config.json"

# Import enterprise configuration
./saar.sh enterprise config import --input="enterprise-config.json"
```

## Best Practices

1. **Regular Backups**: Back up enterprise configuration and data regularly
2. **Security Reviews**: Conduct periodic security reviews of your implementation
3. **Role Management**: Implement least privilege principle for roles
4. **Audit Log Reviews**: Regularly review audit logs for security incidents
5. **Update Policy**: Keep the framework updated with security patches
6. **Documentation**: Maintain documentation of your enterprise configuration
7. **Testing**: Test enterprise features in a staging environment before production

## Support

Enterprise customers have access to priority support channels:

- Email: enterprise-support@example.com
- Phone: +1-555-CLAUDE-HELP
- Support Portal: https://support.example.com/enterprise

## Additional Resources

- [Enterprise Architecture Guide](../enterprise/architecture.md)
- [Enterprise Security Guide](../enterprise/security.md)
- [Enterprise API Reference](../enterprise/api-reference.md)
- [Enterprise Configuration Reference](../enterprise/configuration-reference.md)
- [Enterprise Compliance Guide](../enterprise/compliance.md)