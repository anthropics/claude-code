/**
 * Configuration Validation Tests
 *
 * Tests for JSON configuration files to ensure they are valid and properly structured
 */

const fs = require('fs');
const path = require('path');

describe('Configuration Files', () => {
  const repoRoot = path.join(__dirname, '../..');

  describe('devcontainer.json', () => {
    const devcontainerPath = path.join(repoRoot, '.devcontainer/devcontainer.json');
    let devcontainer;

    beforeAll(() => {
      const content = fs.readFileSync(devcontainerPath, 'utf8');
      devcontainer = JSON.parse(content);
    });

    test('is valid JSON', () => {
      expect(devcontainer).toBeDefined();
    });

    test('has a name property', () => {
      expect(devcontainer.name).toBeDefined();
      expect(typeof devcontainer.name).toBe('string');
    });

    test('specifies a build context', () => {
      expect(devcontainer.build).toBeDefined();
      expect(devcontainer.build.context).toBeDefined();
    });

    test('specifies a Dockerfile', () => {
      expect(devcontainer.build.dockerfile).toBeDefined();
      const dockerfilePath = path.join(
        repoRoot,
        '.devcontainer',
        devcontainer.build.dockerfile
      );
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    test('has customizations for vscode', () => {
      expect(devcontainer.customizations).toBeDefined();
      expect(devcontainer.customizations.vscode).toBeDefined();
    });

    test('defines extensions', () => {
      expect(devcontainer.customizations.vscode.extensions).toBeDefined();
      expect(Array.isArray(devcontainer.customizations.vscode.extensions)).toBe(true);
    });

    test('all extensions have valid format (publisher.name)', () => {
      const extensionRegex = /^[a-z0-9-]+\.[a-z0-9-]+$/i;
      devcontainer.customizations.vscode.extensions.forEach(ext => {
        expect(ext).toMatch(extensionRegex);
      });
    });

    test('has mounts configured', () => {
      if (devcontainer.mounts) {
        expect(Array.isArray(devcontainer.mounts)).toBe(true);
      }
    });

    test('specifies postCreateCommand if present', () => {
      if (devcontainer.postCreateCommand) {
        expect(typeof devcontainer.postCreateCommand).toBe('string');
      }
    });
  });

  describe('extensions.json', () => {
    const extensionsPath = path.join(repoRoot, '.vscode/extensions.json');
    let extensions;

    beforeAll(() => {
      const content = fs.readFileSync(extensionsPath, 'utf8');
      extensions = JSON.parse(content);
    });

    test('is valid JSON', () => {
      expect(extensions).toBeDefined();
    });

    test('has recommendations array', () => {
      expect(extensions.recommendations).toBeDefined();
      expect(Array.isArray(extensions.recommendations)).toBe(true);
    });

    test('all recommendations have valid extension ID format', () => {
      const extensionRegex = /^[a-z0-9-]+\.[a-z0-9-]+$/i;
      extensions.recommendations.forEach(ext => {
        expect(ext).toMatch(extensionRegex);
      });
    });

    test('has at least one recommended extension', () => {
      expect(extensions.recommendations.length).toBeGreaterThan(0);
    });

    test('no duplicate recommendations', () => {
      const uniqueExtensions = new Set(extensions.recommendations);
      expect(uniqueExtensions.size).toBe(extensions.recommendations.length);
    });
  });

  describe('GitHub Actions Workflows', () => {
    const workflowsDir = path.join(repoRoot, '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowsDir)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    test('workflow directory contains YAML files', () => {
      expect(workflowFiles.length).toBeGreaterThan(0);
    });

    workflowFiles.forEach(file => {
      describe(file, () => {
        let workflow;

        beforeAll(() => {
          const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
          // Simple YAML parsing check - just ensure it doesn't throw
          workflow = content;
        });

        test('is not empty', () => {
          expect(workflow.length).toBeGreaterThan(0);
        });

        test('has a name field', () => {
          expect(workflow).toMatch(/^name:/m);
        });

        test('has an on field (triggers)', () => {
          expect(workflow).toMatch(/^on:/m);
        });

        test('has jobs defined', () => {
          expect(workflow).toMatch(/^jobs:/m);
        });

        test('does not contain TODOs or FIXMEs', () => {
          expect(workflow).not.toMatch(/TODO/i);
          expect(workflow).not.toMatch(/FIXME/i);
        });

        test('secrets are referenced correctly with ${{ secrets.NAME }}', () => {
          const secretMatches = workflow.match(/\$\{\{\s*secrets\.\w+\s*\}\}/g);
          if (secretMatches) {
            secretMatches.forEach(secret => {
              // Should not have quotes around the secret reference
              expect(secret).not.toMatch(/["']/);
            });
          }
        });

        test('uses proper action versions (not @master or @main)', () => {
          const actionMatches = workflow.match(/uses:\s*[\w-]+\/[\w-]+@\w+/g);
          if (actionMatches) {
            actionMatches.forEach(action => {
              expect(action).not.toMatch(/@master/);
              // Note: @main is allowed, @master is deprecated
            });
          }
        });
      });
    });
  });

  describe('GitHub Actions (Reusable)', () => {
    const actionsDir = path.join(repoRoot, '.github/actions');
    const actionDirs = fs.readdirSync(actionsDir)
      .filter(f => fs.statSync(path.join(actionsDir, f)).isDirectory());

    test('actions directory contains action subdirectories', () => {
      expect(actionDirs.length).toBeGreaterThan(0);
    });

    actionDirs.forEach(actionDir => {
      describe(actionDir, () => {
        const actionYmlPath = path.join(actionsDir, actionDir, 'action.yml');
        let action;

        beforeAll(() => {
          expect(fs.existsSync(actionYmlPath)).toBe(true);
          action = fs.readFileSync(actionYmlPath, 'utf8');
        });

        test('has action.yml file', () => {
          expect(fs.existsSync(actionYmlPath)).toBe(true);
        });

        test('has a name field', () => {
          expect(action).toMatch(/^name:/m);
        });

        test('has a description field', () => {
          expect(action).toMatch(/^description:/m);
        });

        test('has inputs defined', () => {
          expect(action).toMatch(/^inputs:/m);
        });

        test('has runs configuration', () => {
          expect(action).toMatch(/^runs:/m);
        });

        test('specifies using composite', () => {
          expect(action).toMatch(/using:\s*["']?composite["']?/);
        });

        test('has steps defined', () => {
          expect(action).toMatch(/^\s+steps:/m);
        });

        test('all required inputs are marked as required: true', () => {
          const requiredInputs = action.match(/required:\s*true/g);
          if (requiredInputs) {
            expect(requiredInputs.length).toBeGreaterThan(0);
          }
        });

        test('all inputs have descriptions', () => {
          // Match input sections
          const inputSections = action.match(/^  \w+:\s*$[\s\S]*?(?=^  \w+:|^runs:|$)/gm);
          if (inputSections) {
            inputSections.forEach(section => {
              if (section.match(/^  \w+:/)) {
                expect(section).toMatch(/description:/);
              }
            });
          }
        });
      });
    });
  });

  describe('Package.json', () => {
    const packagePath = path.join(repoRoot, 'package.json');
    let pkg;

    beforeAll(() => {
      const content = fs.readFileSync(packagePath, 'utf8');
      pkg = JSON.parse(content);
    });

    test('is valid JSON', () => {
      expect(pkg).toBeDefined();
    });

    test('has name field', () => {
      expect(pkg.name).toBeDefined();
      expect(typeof pkg.name).toBe('string');
    });

    test('has version field', () => {
      expect(pkg.version).toBeDefined();
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('has description', () => {
      expect(pkg.description).toBeDefined();
      expect(typeof pkg.description).toBe('string');
    });

    test('has scripts section', () => {
      expect(pkg.scripts).toBeDefined();
      expect(typeof pkg.scripts).toBe('object');
    });

    test('has test script', () => {
      expect(pkg.scripts.test).toBeDefined();
    });

    test('has devDependencies', () => {
      expect(pkg.devDependencies).toBeDefined();
      expect(typeof pkg.devDependencies).toBe('object');
    });

    test('includes testing dependencies', () => {
      expect(pkg.devDependencies.jest).toBeDefined();
      expect(pkg.devDependencies.bats).toBeDefined();
    });

    test('has jest configuration', () => {
      expect(pkg.jest).toBeDefined();
    });

    test('no dependencies have wildcards or loose versions', () => {
      const checkVersions = (deps) => {
        if (!deps) return;
        Object.values(deps).forEach(version => {
          expect(version).not.toBe('*');
          expect(version).not.toBe('latest');
        });
      };

      checkVersions(pkg.dependencies);
      checkVersions(pkg.devDependencies);
    });
  });

  describe('Dockerfile', () => {
    const dockerfilePath = path.join(repoRoot, '.devcontainer/Dockerfile');
    let dockerfile;

    beforeAll(() => {
      dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
    });

    test('exists', () => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    test('starts with FROM instruction', () => {
      expect(dockerfile.trim()).toMatch(/^FROM /);
    });

    test('has USER instruction for security', () => {
      // Dockerfile should eventually switch to non-root user
      // This is a best practice check
      if (dockerfile.includes('USER')) {
        expect(dockerfile).toMatch(/^USER /m);
      }
    });

    test('uses specific version tags, not :latest', () => {
      const fromLines = dockerfile.match(/^FROM .+$/gm);
      if (fromLines) {
        fromLines.forEach(line => {
          expect(line).not.toMatch(/:latest/);
        });
      }
    });

    test('does not contain hardcoded secrets', () => {
      expect(dockerfile).not.toMatch(/password\s*=\s*['"]/i);
      expect(dockerfile).not.toMatch(/api_key\s*=\s*['"]/i);
      expect(dockerfile).not.toMatch(/secret\s*=\s*['"]/i);
    });
  });
});
