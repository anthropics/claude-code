# Claude Neural Framework - Enterprise Edition

## Overview

The Enterprise Edition of the Claude Neural Framework provides enhanced capabilities designed for organizational use with multi-user support, advanced security, and compliance features.

## Features

- **SSO Integration**: Connect with your organization's identity providers (Okta, Azure AD)
- **Team Collaboration**: Manage teams and shared resources
- **Audit Logging**: Comprehensive audit trails for all system activities
- **Enhanced Security**: Role-based access control and data encryption
- **Compliance Tools**: Features to help meet regulatory requirements
- **Performance Optimization**: Advanced caching and rate limiting
- **Enterprise Support**: Priority support channels

## Getting Started

```bash
# Set up enterprise features
./saar.sh enterprise setup

# Activate your license
./saar.sh enterprise license activate YOUR_LICENSE_KEY

# Configure SSO
./saar.sh enterprise sso configure

# Manage teams
./saar.sh enterprise teams manage
```

## Configuration

Enterprise configuration is stored in `schema-ui-integration/enterprise/config/enterprise.yaml`. You can edit this file directly or use the CLI commands to modify specific settings.

## License Management

Your enterprise license controls access to premium features. To activate or check your license:

```bash
# Activate license
./saar.sh enterprise license activate YOUR_LICENSE_KEY

# Check license status
./saar.sh enterprise license status
```

## User Management

Enterprise Edition supports multi-user environments with role-based access control:

```bash
# Add a new user
./saar.sh enterprise users add --name="John Doe" --email="john@example.com" --role="admin"

# List all users
./saar.sh enterprise users list

# Change user role
./saar.sh enterprise users update --email="john@example.com" --role="user"
```

## Team Management

Create and manage teams for collaborative work:

```bash
# Create a new team
./saar.sh enterprise teams create --name="Engineering" --description="Engineering team"

# Add users to team
./saar.sh enterprise teams add-member --team="Engineering" --email="john@example.com"

# List team members
./saar.sh enterprise teams list-members --team="Engineering"
```

## Enterprise Workflows

The Enterprise Edition includes advanced workflow features for development teams:

- Branch approval workflows
- Security policy enforcement
- Audit logging
- JIRA integration
- Change management

See the [Enterprise Workflow Guide](docs/guides/enterprise_workflow.md) for details.

## Support

For enterprise support, please contact support@example.com or use the in-app support channel.

## Documentation

For detailed documentation, see:

- [Enterprise Documentation](docs/enterprise/README.md)
- [Enterprise Integration Guide](docs/guides/enterprise_integration_guide.md)
- [Enterprise Workflow Guide](docs/guides/enterprise_workflow.md)
- [Enterprise Quick Start](docs/enterprise/quick_start.md)