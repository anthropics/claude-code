/**
 * Workflow Validation Tests
 *
 * Tests for GitHub Actions workflow logic and trigger conditions
 */

const fs = require('fs');
const path = require('path');

describe('GitHub Workflows', () => {
  const repoRoot = path.join(__dirname, '../..');
  const workflowsDir = path.join(repoRoot, '.github/workflows');

  describe('claude.yml', () => {
    const workflowPath = path.join(workflowsDir, 'claude.yml');
    let workflow;

    beforeAll(() => {
      workflow = fs.readFileSync(workflowPath, 'utf8');
    });

    test('exists', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('triggers on issue_comment', () => {
      expect(workflow).toMatch(/issue_comment:/);
    });

    test('triggers on pull_request_review_comment', () => {
      expect(workflow).toMatch(/pull_request_review_comment:/);
    });

    test('triggers on issues opened', () => {
      expect(workflow).toMatch(/issues:/);
      expect(workflow).toMatch(/types:.*opened/);
    });

    test('triggers on pull_request_review', () => {
      expect(workflow).toMatch(/pull_request_review:/);
    });

    test('has conditional check for @claude mention', () => {
      expect(workflow).toMatch(/@claude/);
      expect(workflow).toMatch(/contains.*@claude/);
    });

    test('uses anthropics/claude-code-action', () => {
      expect(workflow).toMatch(/uses:\s*anthropics\/claude-code-action@beta/);
    });

    test('requires ANTHROPIC_API_KEY secret', () => {
      expect(workflow).toMatch(/secrets\.ANTHROPIC_API_KEY/);
    });

    test('has proper permissions', () => {
      expect(workflow).toMatch(/permissions:/);
      expect(workflow).toMatch(/contents:\s*read/);
      expect(workflow).toMatch(/pull-requests:\s*read/);
      expect(workflow).toMatch(/issues:\s*read/);
    });

    test('runs on ubuntu-latest', () => {
      expect(workflow).toMatch(/runs-on:\s*ubuntu-latest/);
    });

    test('has checkout step', () => {
      expect(workflow).toMatch(/uses:\s*actions\/checkout@v4/);
    });

    test('has conditional if statement for job', () => {
      expect(workflow).toMatch(/if:\s*\|/);
    });
  });

  describe('claude-issue-triage.yml', () => {
    const workflowPath = path.join(workflowsDir, 'claude-issue-triage.yml');
    let workflow;

    beforeAll(() => {
      workflow = fs.readFileSync(workflowPath, 'utf8');
    });

    test('exists', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('triggers on issues opened', () => {
      expect(workflow).toMatch(/on:/);
      expect(workflow).toMatch(/issues:/);
      expect(workflow).toMatch(/types:.*opened/);
    });

    test('uses local claude-issue-triage-action', () => {
      expect(workflow).toMatch(/uses:\s*\.\/\.github\/actions\/claude-issue-triage-action/);
    });

    test('has timeout configured', () => {
      expect(workflow).toMatch(/timeout-minutes:/);
    });

    test('requires ANTHROPIC_API_KEY', () => {
      expect(workflow).toMatch(/secrets\.ANTHROPIC_API_KEY/);
    });

    test('requires GITHUB_TOKEN', () => {
      expect(workflow).toMatch(/secrets\.GITHUB_TOKEN/);
    });

    test('has proper permissions for issues', () => {
      expect(workflow).toMatch(/permissions:/);
      expect(workflow).toMatch(/issues:\s*write/);
    });

    test('has checkout step', () => {
      expect(workflow).toMatch(/uses:\s*actions\/checkout@v4/);
    });
  });

  describe('docker-publish.yml', () => {
    const workflowPath = path.join(workflowsDir, 'docker-publish.yml');
    let workflow;

    beforeAll(() => {
      workflow = fs.readFileSync(workflowPath, 'utf8');
    });

    test('exists', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('triggers on schedule', () => {
      expect(workflow).toMatch(/schedule:/);
      expect(workflow).toMatch(/cron:/);
    });

    test('triggers on push to main', () => {
      expect(workflow).toMatch(/push:/);
      expect(workflow).toMatch(/branches:.*main/);
    });

    test('triggers on version tags', () => {
      expect(workflow).toMatch(/tags:.*v\*/);
    });

    test('triggers on pull requests to main', () => {
      expect(workflow).toMatch(/pull_request:/);
    });

    test('uses GitHub Container Registry', () => {
      expect(workflow).toMatch(/REGISTRY:\s*ghcr\.io/);
    });

    test('has checkout step', () => {
      expect(workflow).toMatch(/uses:\s*actions\/checkout@v4/);
    });

    test('installs cosign for signing', () => {
      expect(workflow).toMatch(/sigstore\/cosign-installer/);
    });

    test('sets up Docker Buildx', () => {
      expect(workflow).toMatch(/docker\/setup-buildx-action/);
    });

    test('logs into registry', () => {
      expect(workflow).toMatch(/docker\/login-action/);
    });

    test('extracts Docker metadata', () => {
      expect(workflow).toMatch(/docker\/metadata-action/);
    });

    test('builds and pushes Docker image', () => {
      expect(workflow).toMatch(/docker\/build-push-action/);
    });

    test('signs published image', () => {
      expect(workflow).toMatch(/cosign sign/);
    });

    test('does not push on pull requests', () => {
      expect(workflow).toMatch(/push:.*github\.event_name != 'pull_request'/);
    });

    test('only signs on non-PR events', () => {
      expect(workflow).toMatch(/if:.*github\.event_name != 'pull_request'/);
    });

    test('has proper permissions', () => {
      expect(workflow).toMatch(/permissions:/);
      expect(workflow).toMatch(/contents:\s*read/);
      expect(workflow).toMatch(/packages:\s*write/);
      expect(workflow).toMatch(/id-token:\s*write/);
    });

    test('uses pinned action versions (SHA)', () => {
      const actionMatches = workflow.match(/uses:.*@[a-f0-9]{40}/g);
      expect(actionMatches).toBeTruthy();
      expect(actionMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Security', () => {
    const workflowFiles = fs.readdirSync(workflowsDir)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => path.join(workflowsDir, f));

    workflowFiles.forEach(workflowPath => {
      describe(path.basename(workflowPath), () => {
        let workflow;

        beforeAll(() => {
          workflow = fs.readFileSync(workflowPath, 'utf8');
        });

        test('does not contain hardcoded secrets', () => {
          // Should not have actual secret values, only references
          const secretPattern = /(?:password|api_key|token|secret):\s*['"][^'"]{20,}['"]/i;
          expect(workflow).not.toMatch(secretPattern);
        });

        test('uses secrets correctly', () => {
          // If secrets are used, they should be referenced properly
          const secretRefs = workflow.match(/\$\{\{\s*secrets\.\w+\s*\}\}/g);
          if (secretRefs) {
            secretRefs.forEach(ref => {
              // Secret names should be UPPERCASE
              expect(ref).toMatch(/secrets\.[A-Z_]+/);
            });
          }
        });

        test('has permissions defined if writing', () => {
          const hasWrite = workflow.match(/:\s*write/);
          if (hasWrite) {
            expect(workflow).toMatch(/permissions:/);
          }
        });

        test('uses checkout with appropriate fetch-depth', () => {
          if (workflow.includes('actions/checkout')) {
            // If fetch-depth is specified, ensure it's reasonable
            const fetchDepthMatch = workflow.match(/fetch-depth:\s*(\d+)/);
            if (fetchDepthMatch) {
              const depth = parseInt(fetchDepthMatch[1]);
              expect(depth).toBeGreaterThanOrEqual(0);
              expect(depth).toBeLessThanOrEqual(100);
            }
          }
        });
      });
    });
  });
});
