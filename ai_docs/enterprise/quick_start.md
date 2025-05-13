# Enterprise Edition Quick Start Guide

This guide provides a quick introduction to getting started with the Claude Neural Framework Enterprise Edition. Follow these steps to quickly set up and configure the essential enterprise features.

## Prerequisites

- Valid enterprise license key
- Node.js 18+ installed
- 8GB+ RAM, 4+ CPU cores
- Administrative access to your identity provider (for SSO)

## 5-Minute Setup

### 1. Install the Enterprise Edition

```bash
# Clone repository
git clone https://github.com/username/claude-neural-framework.git
cd claude-neural-framework

# Quick setup with enterprise features
./saar.sh setup --enterprise --quick

# Activate your license
./saar.sh enterprise license activate YOUR_LICENSE_KEY
```

### 2. Configure Basic Security

```bash
# Configure basic RBAC with default roles
./saar.sh enterprise rbac setup --quick

# Enable audit logging
./saar.sh enterprise audit enable
```

### 3. Start Enterprise Services

```bash
# Start all enterprise services
./saar.sh enterprise start

# Check status
./saar.sh enterprise status
```

### 4. Add Your First User

```bash
# Add an admin user
./saar.sh enterprise users add --name="Admin User" --email="admin@example.com" --role="admin"
```

That's it! Your Enterprise Edition is now set up with basic features. Check the status dashboard:

```bash
./saar.sh enterprise dashboard
```

## Common Configurations

### SSO Configuration Examples

#### Okta

```bash
./saar.sh enterprise sso configure okta \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET" \
  --auth-url="https://your-org.okta.com/oauth2/v1/authorize" \
  --token-url="https://your-org.okta.com/oauth2/v1/token" \
  --redirect-url="http://localhost:3000/auth/callback"
```

#### Azure AD

```bash
./saar.sh enterprise sso configure azure \
  --tenant-id="YOUR_TENANT_ID" \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET" \
  --redirect-url="http://localhost:3000/auth/callback"
```

#### Google Workspace

```bash
./saar.sh enterprise sso configure google \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET" \
  --redirect-url="http://localhost:3000/auth/callback"
```

### Team Management

```bash
# Create a team
./saar.sh enterprise teams create --name="Engineering" --description="Engineering team"

# Add members
./saar.sh enterprise teams add-member --team="Engineering" --email="jane@example.com" --role="admin"
./saar.sh enterprise teams add-member --team="Engineering" --email="john@example.com" --role="member"
```

### JIRA Integration

```bash
./saar.sh enterprise integration jira configure \
  --url="https://your-org.atlassian.net" \
  --api-key="YOUR_API_KEY" \
  --project-key="PROJ"
```

### GitHub Enterprise Integration

```bash
./saar.sh enterprise integration github configure \
  --url="https://github.your-org.com" \
  --api-key="YOUR_API_KEY"
```

## Security Best Practices

For a secure deployment, we recommend:

1. **Enable all security features**:
   ```bash
   ./saar.sh enterprise security enable-all
   ```

2. **Set strong password policies** (if not using SSO):
   ```bash
   ./saar.sh enterprise security password-policy --min-length=12 --require-uppercase --require-numbers --require-symbols
   ```

3. **Configure IP restrictions**:
   ```bash
   ./saar.sh enterprise security ip-allow --ranges="192.168.1.0/24,10.0.0.0/8"
   ```

4. **Enable two-factor authentication**:
   ```bash
   ./saar.sh enterprise security 2fa enable
   ```

5. **Configure session timeouts**:
   ```bash
   ./saar.sh enterprise security session --timeout=30 --extend-on-activity=true
   ```

## Troubleshooting

### Common Issues

#### License Activation Fails

```bash
# Check license status
./saar.sh enterprise license status

# Try manual activation
./saar.sh enterprise license activate --file=/path/to/license.key
```

#### SSO Configuration Issues

```bash
# Test SSO configuration
./saar.sh enterprise sso test

# View SSO logs
./saar.sh enterprise logs view --type=sso --lines=100
```

#### Enterprise Services Not Starting

```bash
# Check service status
./saar.sh enterprise status --verbose

# Restart services
./saar.sh enterprise restart

# Check logs
./saar.sh enterprise logs view --type=services --lines=100
```

#### Permission Errors

```bash
# Check user roles
./saar.sh enterprise users get --email="user@example.com"

# Check permission for a specific action
./saar.sh enterprise rbac check --user="user@example.com" --permission="read:projects"
```

## Next Steps

After completing this quick start guide, consider these next steps:

1. **Explore advanced configurations** in the [Enterprise Configuration Guide](./configuration.md)
2. **Set up compliance frameworks** using the [Compliance Guide](./compliance.md)
3. **Configure advanced monitoring** with the [Monitoring Guide](./monitoring.md)
4. **Set up backup and recovery** procedures using the [Disaster Recovery Guide](./disaster-recovery.md)
5. **Integrate with additional enterprise systems** following the [Integration Guide](./integration.md)

## Resource Links

- [Enterprise Documentation](./README.md)
- [Enterprise API Reference](./api-reference.md)
- [Enterprise Configuration Reference](./configuration-reference.md)
- [Enterprise CLI Reference](./cli-reference.md)
- [Enterprise Troubleshooting Guide](./troubleshooting.md)
- [Enterprise Support Portal](https://support.example.com/enterprise)