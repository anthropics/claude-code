# Enterprise Workflow Guide

This guide describes the enterprise workflow features of the Claude Neural Framework Enterprise Edition, including:

- Branch approval workflows
- Security policy enforcement
- Audit logging
- Team collaboration
- JIRA integration
- Change management

## Overview

The Enterprise Edition provides a comprehensive workflow system designed for team collaboration, governance, and compliance. These workflows integrate with your existing development processes to provide:

- **Governance**: Approvals, policy enforcement, and change management
- **Security**: Code reviews, security policy enforcement, and prevention of vulnerabilities
- **Traceability**: Audit logs, change history, and compliance reports
- **Integration**: Connection with enterprise systems like JIRA and GitHub Enterprise

## Branch Approval Workflows

### Branch Policies

Branch policies define the rules for working with specific branches:

| Branch Type | Approval Required | Min Approvers | Required Teams |
|-------------|------------------|---------------|----------------|
| main        | Yes              | 2             | Engineering    |
| staging     | Yes              | 1             | -              |
| development | No               | 0             | -              |
| feature/*   | No               | 0             | -              |
| hotfix/*    | Yes              | 1             | -              |

You can configure branch policies using the SAAR script:

```bash
./saar.sh enterprise workflow branch-policy \
  --branch="main" \
  --require-approval=true \
  --min-approvers=2 \
  --required-teams="Engineering"
```

### Approval Process

The approval process works as follows:

1. Developer creates a pull request to a protected branch
2. System automatically creates an approval request
3. Required approvers review the changes
4. When all required approvals are received, the PR can be merged

Example of requesting an approval:

```bash
./saar.sh enterprise workflow request-approval \
  --branch="main" \
  --description="Add new feature X" \
  --reviewer="jane@example.com,john@example.com"
```

Example of approving a request:

```bash
./saar.sh enterprise workflow approve \
  --request-id="APR-12345" \
  --comment="Looks good to me"
```

## Security Policy Enforcement

The Enterprise Edition includes security policy enforcement that automatically checks code for:

- Secure file patterns (configuration files, keys, etc.)
- Blocked patterns (hardcoded secrets, etc.)
- Compliance with security best practices

### Configuring Security Policies

Security policies can be configured using:

```bash
./saar.sh enterprise workflow security-policy \
  --secure-files="**/config/*.json,**/secrets.*.js,**/*.key" \
  --blocked-patterns="password\s*=,apiKey\s*=,token\s*="
```

### Security Checks

Security checks are automatically run during:

- Pull request creation
- Commit creation (via pre-commit hook)
- Manual security scans

Example of running a manual security check:

```bash
./saar.sh enterprise workflow security-check \
  --files="src/config.js,src/api/client.js"
```

## Audit Logging

The Enterprise Edition provides comprehensive audit logging of all workflow actions:

- Branch access
- Approval requests and decisions
- Security policy violations
- Configuration changes
- User actions

### Viewing Audit Logs

Audit logs can be viewed using:

```bash
# View all audit logs
./saar.sh enterprise logs view --type=workflow

# View filtered audit logs
./saar.sh enterprise logs view --type=workflow --action=approval --user="john@example.com"
```

### Audit Log Format

Audit logs are stored in JSON format with the following structure:

```json
{
  "timestamp": "2025-05-11T12:34:56Z",
  "action": "approve_request",
  "user": "john@example.com",
  "details": {
    "requestId": "APR-12345",
    "branch": "main",
    "newStatus": "approved"
  }
}
```

## Team Collaboration

The Enterprise Edition provides team-based collaboration features:

- Team creation and management
- Role-based access control
- Team-based approvals
- Resource sharing within teams

### Managing Teams

Teams can be managed using:

```bash
# Create a team
./saar.sh enterprise teams create --name="Engineering" --description="Engineering team"

# Add members to team
./saar.sh enterprise teams add-member --team="Engineering" --email="jane@example.com" --role="admin"
./saar.sh enterprise teams add-member --team="Engineering" --email="john@example.com" --role="member"
```

### Team Roles

Teams can have different roles with different permissions:

- **Admin**: Can manage team members and approve all changes
- **Lead**: Can approve changes and manage projects
- **Senior**: Can approve changes in their area of expertise
- **Member**: Regular team member

## JIRA Integration

The Enterprise Edition integrates with JIRA for:

- Issue tracking
- Branch naming conventions
- Automatic updates to JIRA issues
- Release notes generation

### Configuring JIRA Integration

JIRA integration can be configured using:

```bash
./saar.sh enterprise integration jira configure \
  --url="https://your-org.atlassian.net" \
  --api-key="YOUR_API_KEY" \
  --project-key="PROJ"
```

### Branch Naming Conventions

When JIRA integration is enabled, branches should follow the naming convention:

```
<type>/<JIRA-KEY>-<description>
```

For example:
- `feature/PROJ-123-add-new-login-screen`
- `bugfix/PROJ-456-fix-login-validation`
- `hotfix/PROJ-789-fix-security-issue`

The system will automatically extract the JIRA issue key and link the branch to the issue.

## Change Management

The Enterprise Edition provides change management features:

- Changelog generation
- Release notes
- Change history
- Dependency tracking

### Configuring Change Management

Change management can be configured using:

```bash
./saar.sh enterprise workflow change-management \
  --enabled=true \
  --require-issue-reference=true \
  --require-changelog=true \
  --changelog-path="CHANGELOG.md"
```

### Automatic Changelog Updates

When change management is enabled, the system will automatically update the changelog when:

- A pull request is merged
- A release is created
- A hotfix is applied

The changelog entry includes:
- Date
- Branch type
- JIRA reference (if available)
- Changes description
- Author

## Custom Workflows

The Enterprise Edition allows you to create custom workflows:

```bash
# Create a custom workflow
./saar.sh enterprise workflow create \
  --name="security-review" \
  --steps="request,security-review,approve,implement" \
  --approvers="security-team" \
  --template="security-review-template.json"
```

## Integration with CI/CD

The Enterprise Edition integrates with CI/CD systems to:

- Enforce branch policies in CI/CD pipelines
- Run security checks as part of CI/CD
- Require approvals before deployment
- Track deployments in audit logs

### Example Jenkins Integration

```groovy
pipeline {
    agent any
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Enterprise Workflow Check') {
            steps {
                sh './saar.sh enterprise workflow ci-check'
            }
        }
        
        stage('Build') {
            when {
                expression { return env.WORKFLOW_CHECK_PASSED == 'true' }
            }
            steps {
                sh 'npm install && npm run build'
            }
        }
        
        stage('Deploy') {
            when {
                expression { return env.WORKFLOW_CHECK_PASSED == 'true' }
            }
            steps {
                sh './saar.sh enterprise workflow deployment-start'
                sh './deploy.sh'
                sh './saar.sh enterprise workflow deployment-complete'
            }
        }
    }
    
    post {
        always {
            sh './saar.sh enterprise workflow ci-result --status=$BUILD_STATUS'
        }
    }
}
```

## Troubleshooting

### Common Issues

#### Approval Request Not Created

If approval requests are not being created:

1. Check branch policy configuration
2. Verify user permissions
3. Check that the branch matches a protected branch pattern
4. Check workflow audit logs for errors

#### Security Policy Violations

If security policy violations are blocking progress:

1. Review the security policy to ensure it's appropriate
2. Check for false positives in the patterns
3. Fix the actual security issues in the code
4. Consider using temporary exceptions for special cases

#### JIRA Integration Issues

If JIRA integration is not working:

1. Verify JIRA configuration (URL, API key, project key)
2. Check branch naming convention
3. Verify network connectivity to JIRA
4. Check JIRA API logs

## Best Practices

1. **Define Clear Policies**: Establish clear branch policies and security requirements
2. **Automate Everything**: Use automation to enforce policies and reduce manual work
3. **Train Your Team**: Ensure everyone understands the workflow and requirements
4. **Regular Audits**: Review audit logs regularly to identify issues
5. **Iterate and Improve**: Refine your workflow based on feedback and experience

## Additional Resources

- [Enterprise API Reference](../enterprise/api-reference.md)
- [Enterprise Integration Guide](../guides/enterprise_integration_guide.md)
- [Enterprise Security Guide](../enterprise/security.md)
- [Enterprise Compliance Guide](../enterprise/compliance.md)