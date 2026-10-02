import { execa } from 'execa';
import React, { useCallback, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { WorkflowMultiselectDialog } from '../../components/WorkflowMultiselectDialog.js';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app.js';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import { Box } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { getAnthropicApiKey, isAnthropicAuthEnabled } from '../../utils/auth.js';
import { openBrowser } from '../../utils/browser.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { getGithubRepo } from '../../utils/git.js';
import { plural } from '../../utils/stringUtils.js';
import { ApiKeyStep } from './ApiKeyStep.js';
import { CheckExistingSecretStep } from './CheckExistingSecretStep.js';
import { CheckGitHubStep } from './CheckGitHubStep.js';
import { ChooseRepoStep } from './ChooseRepoStep.js';
import { CreatingStep } from './CreatingStep.js';
import { ErrorStep } from './ErrorStep.js';
import { ExistingWorkflowStep } from './ExistingWorkflowStep.js';
import { InstallAppStep } from './InstallAppStep.js';
import { OAuthFlowStep } from './OAuthFlowStep.js';
import { SuccessStep } from './SuccessStep.js';
import { setupGitHubActions } from './setupGitHubActions.js';
import type { State, Warning, Workflow } from './types.js';
import { WarningsStep } from './WarningsStep.js';
const INITIAL_STATE: State = {
  step: 'check-gh',
  selectedRepoName: '',
  currentRepo: '',
  useCurrentRepo: false,
  // Default to false, will be set to true if repo detected
  apiKeyOrOAuthToken: '',
  useExistingKey: true,
  currentWorkflowInstallStep: 0,
  warnings: [],
  secretExists: false,
  secretName: 'ANTHROPIC_API_KEY',
  useExistingSecret: true,
  workflowExists: false,
  selectedWorkflows: ['claude', 'claude-review'] as Workflow[],
  selectedApiKeyOption: 'new' as 'existing' | 'new' | 'oauth',
  authType: 'api_key'
};
function InstallGitHubApp(props: {
  onDone: (message: string) => void;
}): React.ReactNode {
  const [existingApiKey] = useState(() => getAnthropicApiKey());
  const [state, setState] = useState({
    ...INITIAL_STATE,
    useExistingKey: !!existingApiKey,
    selectedApiKeyOption: (existingApiKey ? 'existing' : isAnthropicAuthEnabled() ? 'oauth' : 'new') as 'existing' | 'new' | 'oauth'
  });
  useExitOnCtrlCDWithKeybindings();
  React.useEffect(() => {
    logEvent('tengu_install_github_app_started', {});
  }, []);
  const checkGitHubCLI = useCallback(async () => {
    const warnings: Warning[] = [];

    // Check if gh is installed
    const ghVersionResult = await execa('gh --version', {
      shell: true,
      reject: false
    });
    if (ghVersionResult.exitCode !== 0) {
      warnings.push({
        title: 'GitHub CLI not found',
        message: 'GitHub CLI (gh) does not appear to be installed or accessible.',
        instructions: ['Install GitHub CLI from https://cli.github.com/', 'macOS: brew install gh', 'Windows: winget install --id GitHub.cli', 'Linux: See installation instructions at https://github.com/cli/cli#installation']
      });
    }

    // Check auth status
    const authResult = await execa('gh auth status -a', {
      shell: true,
      reject: false
    });
    if (authResult.exitCode !== 0) {
      warnings.push({
        title: 'GitHub CLI not authenticated',
        message: 'GitHub CLI does not appear to be authenticated.',
        instructions: ['Run: gh auth login', 'Follow the prompts to authenticate with GitHub', 'Or set up authentication using environment variables or other methods']
      });
    } else {
      // Check if required scopes are present in the Token scopes line
      const tokenScopesMatch = authResult.stdout.match(/Token scopes:.*$/m);
      if (tokenScopesMatch) {
        const scopes = tokenScopesMatch[0];
        const missingScopes: string[] = [];
        if (!scopes.includes('repo')) {
          missingScopes.push('repo');
        }
        if (!scopes.includes('workflow')) {
          missingScopes.push('workflow');
        }
        if (missingScopes.length > 0) {
          // Missing required scopes - exit immediately
          setState(prev => ({
            ...prev,
            step: 'error',
            error: `GitHub CLI is missing required permissions: ${missingScopes.join(', ')}.`,
            errorReason: 'Missing required scopes',
            errorInstructions: [`Your GitHub CLI authentication is missing the "${missingScopes.join('" and "')}" ${plural(missingScopes.length, 'scope')} needed to manage GitHub Actions and secrets.`, '', 'To fix this, run:', '  gh auth refresh -h github.com -s repo,workflow', '', 'This will add the necessary permissions to manage workflows and secrets.']
          }));
          return;
        }
      }
    }

    // Check if in a git repo and get remote URL
    const currentRepo = (await getGithubRepo()) ?? '';
    logEvent('tengu_install_github_app_step_completed', {
      step: 'check-gh' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setState(prev_0 => ({
      ...prev_0,
      warnings,
      currentRepo,
      selectedRepoName: currentRepo,
      useCurrentRepo: !!currentRepo,
      // Set to false if no repo detected
      step: warnings.length > 0 ? 'warnings' : 'choose-repo'
    }));
  }, []);
  React.useEffect(() => {
    if (state.step === 'check-gh') {
      void checkGitHubCLI();
    }
  }, [state.step, checkGitHubCLI]);
  const runSetupGitHubActions = useCallback(async (apiKeyOrOAuthToken: string | null, secretName: string) => {
    setState(prev_1 => ({
      ...prev_1,
      step: 'creating',
      currentWorkflowInstallStep: 0
    }));
    try {
      await setupGitHubActions(state.selectedRepoName, apiKeyOrOAuthToken, secretName, () => {
        setState(prev_4 => ({
          ...prev_4,
          currentWorkflowInstallStep: prev_4.currentWorkflowInstallStep + 1
        }));
      }, state.workflowAction === 'skip', state.selectedWorkflows, state.authType, {
        useCurrentRepo: state.useCurrentRepo,
        workflowExists: state.workflowExists,
        secretExists: state.secretExists
      });
      logEvent('tengu_install_github_app_step_completed', {
        step: 'creating' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      setState(prev_5 => ({
        ...prev_5,
        step: 'success'
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set up GitHub Actions';
      if (errorMessage.includes('workflow file already exists')) {
        logEvent('tengu_install_github_app_error', {
          reason: 'workflow_file_exists' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setState(prev_2 => ({
          ...prev_2,
          step: 'error',
          error: 'A Claude workflow file already exists in this repository.',
          errorReason: 'Workflow file conflict',
          errorInstructions: ['The file .github/workflows/claude.yml already exists', 'You can either:', '  1. Delete the existing file and run this command again', '  2. Update the existing file manually using the template from:', `     ${GITHUB_ACTION_SETUP_DOCS_URL}`]
        }));
      } else {
        logEvent('tengu_install_github_app_error', {
          reason: 'setup_github_actions_failed' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setState(prev_3 => ({
          ...prev_3,
          step: 'error',
          error: errorMessage,
          errorReason: 'GitHub Actions setup failed',
          errorInstructions: []
        }));
      }
    }
  }, [state.selectedRepoName, state.workflowAction, state.selectedWorkflows, state.useCurrentRepo, state.workflowExists, state.secretExists, state.authType]);
  async function openGitHubAppInstallation() {
    const installUrl = 'https://github.com/apps/claude';
    await openBrowser(installUrl);
  }
  async function checkRepositoryPermissions(repoName: string): Promise<{
    hasAccess: boolean;
    error?: string;
  }> {
    try {
      const result = await execFileNoThrow('gh', ['api', `repos/${repoName}`, '--jq', '.permissions.admin']);
      if (result.code === 0) {
        const hasAdmin = result.stdout.trim() === 'true';
        return {
          hasAccess: hasAdmin
        };
      }
      if (result.stderr.includes('404') || result.stderr.includes('Not Found')) {
        return {
          hasAccess: false,
          error: 'repository_not_found'
        };
      }
      return {
        hasAccess: false
      };
    } catch {
      return {
        hasAccess: false
      };
    }
  }
  async function checkExistingWorkflowFile(repoName_0: string): Promise<boolean> {
    const checkFileResult = await execFileNoThrow('gh', ['api', `repos/${repoName_0}/contents/.github/workflows/claude.yml`, '--jq', '.sha']);
    return checkFileResult.code === 0;
  }
  async function checkExistingSecret() {
    const checkSecretsResult = await execFileNoThrow('gh', ['secret', 'list', '--app', 'actions', '--repo', state.selectedRepoName]);
    if (checkSecretsResult.code === 0) {
      const lines = checkSecretsResult.stdout.split('\n');
      const hasAnthropicKey = lines.some((line: string) => {
        return /^ANTHROPIC_API_KEY\s+/.test(line);
      });
      if (hasAnthropicKey) {
        setState(prev_6 => ({
          ...prev_6,
          secretExists: true,
          step: 'check-existing-secret'
        }));
      } else {
        // No existing secret found
        if (existingApiKey) {
          // User has local key, skip to creating with it
          setState(prev_7 => ({
            ...prev_7,
            apiKeyOrOAuthToken: existingApiKey,
            useExistingKey: true
          }));
          await runSetupGitHubActions(existingApiKey, state.secretName);
        } else {
          // No local key, go to API key step
          setState(prev_8 => ({
            ...prev_8,
            step: 'api-key'
          }));
        }
      }
    } else {
      // Error checking secrets
      if (existingApiKey) {
        // User has local key, skip to creating with it
        setState(prev_9 => ({
          ...prev_9,
          apiKeyOrOAuthToken: existingApiKey,
          useExistingKey: true
        }));
        await runSetupGitHubActions(existingApiKey, state.secretName);
      } else {
        // No local key, go to API key step
        setState(prev_10 => ({
          ...prev_10,
          step: 'api-key'
        }));
      }
    }
  }
  const handleSubmit = async () => {
    if (state.step === 'warnings') {
      logEvent('tengu_install_github_app_step_completed', {
        step: 'warnings' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      setState(prev_11 => ({
        ...prev_11,
        step: 'install-app'
      }));
      setTimeout(openGitHubAppInstallation, 0);
    } else if (state.step === 'choose-repo') {
      let repoName_1 = state.useCurrentRepo ? state.currentRepo : state.selectedRepoName;
      if (!repoName_1.trim()) {
        return;
      }
      const repoWarnings: Warning[] = [];
      if (repoName_1.includes('github.com')) {
        const match = repoName_1.match(/github\.com[:/]([^/]+\/[^/]+)(\.git)?$/);
        if (!match) {
          repoWarnings.push({
            title: 'Invalid GitHub URL format',
            message: 'The repository URL format appears to be invalid.',
            instructions: ['Use format: owner/repo or https://github.com/owner/repo', 'Example: anthropics/claude-cli']
          });
        } else {
          repoName_1 = match[1]?.replace(/\.git$/, '') || '';
        }
      }
      if (!repoName_1.includes('/')) {
        repoWarnings.push({
          title: 'Repository format warning',
          message: 'Repository should be in format "owner/repo"',
          instructions: ['Use format: owner/repo', 'Example: anthropics/claude-cli']
        });
      }
      const permissionCheck = await checkRepositoryPermissions(repoName_1);
      if (permissionCheck.error === 'repository_not_found') {
        repoWarnings.push({
          title: 'Repository not found',
          message: `Repository ${repoName_1} was not found or you don't have access.`,
          instructions: [`Check that the repository name is correct: ${repoName_1}`, 'Ensure you have access to this repository', 'For private repositories, make sure your GitHub token has the "repo" scope', 'You can add the repo scope with: gh auth refresh -h github.com -s repo,workflow']
        });
      } else if (!permissionCheck.hasAccess) {
        repoWarnings.push({
          title: 'Admin permissions required',
          message: `You might need admin permissions on ${repoName_1} to set up GitHub Actions.`,
          instructions: ['Repository admins can install GitHub Apps and set secrets', 'Ask a repository admin to run this command if setup fails', 'Alternatively, you can use the manual setup instructions']
        });
      }
      const workflowExists = await checkExistingWorkflowFile(repoName_1);
      if (repoWarnings.length > 0) {
        const allWarnings = [...state.warnings, ...repoWarnings];
        setState(prev_12 => ({
          ...prev_12,
          selectedRepoName: repoName_1,
          workflowExists,
          warnings: allWarnings,
          step: 'warnings'
        }));
      } else {
        logEvent('tengu_install_github_app_step_completed', {
          step: 'choose-repo' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setState(prev_13 => ({
          ...prev_13,
          selectedRepoName: repoName_1,
          workflowExists,
          step: 'install-app'
        }));
        setTimeout(openGitHubAppInstallation, 0);
      }
    } else if (state.step === 'install-app') {
      logEvent('tengu_install_github_app_step_completed', {
        step: 'install-app' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (state.workflowExists) {
        setState(prev_14 => ({
          ...prev_14,
          step: 'check-existing-workflow'
        }));
      } else {
        setState(prev_15 => ({
          ...prev_15,
          step: 'select-workflows'
        }));
      }
    } else if (state.step === 'check-existing-workflow') {
      return;
    } else if (state.step === 'select-workflows') {
      // Handled by the WorkflowMultiselectDialog component
      return;
    } else if (state.step === 'check-existing-secret') {
      logEvent('tengu_install_github_app_step_completed', {
        step: 'check-existing-secret' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (state.useExistingSecret) {
        await runSetupGitHubActions(null, state.secretName);
      } else {
        // User wants to use a new secret name with their API key
        await runSetupGitHubActions(state.apiKeyOrOAuthToken, state.secretName);
      }
    } else if (state.step === 'api-key') {
      // In the new flow, api-key step only appears when user has no existing key
      // They either entered a new key or will create OAuth token
      if (state.selectedApiKeyOption === 'oauth') {
        // OAuth flow already handled by handleCreateOAuthToken
        return;
      }

      // If user selected 'existing' option, use the existing API key
      const apiKeyToUse = state.selectedApiKeyOption === 'existing' ? existingApiKey : state.apiKeyOrOAuthToken;
      if (!apiKeyToUse) {
        logEvent('tengu_install_github_app_error', {
          reason: 'api_key_missing' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setState(prev_16 => ({
          ...prev_16,
          step: 'error',
          error: 'API key is required'
        }));
        return;
      }

      // Store the API key being used (either existing or newly entered)
      setState(prev_17 => ({
        ...prev_17,
        apiKeyOrOAuthToken: apiKeyToUse,
        useExistingKey: state.selectedApiKeyOption === 'existing'
      }));

      // Check if ANTHROPIC_API_KEY secret already exists
      const checkSecretsResult_0 = await execFileNoThrow('gh', ['secret', 'list', '--app', 'actions', '--repo', state.selectedRepoName]);
      if (checkSecretsResult_0.code === 0) {
        const lines_0 = checkSecretsResult_0.stdout.split('\n');
        const hasAnthropicKey_0 = lines_0.some((line_0: string) => {
          return /^ANTHROPIC_API_KEY\s+/.test(line_0);
        });
        if (hasAnthropicKey_0) {
          logEvent('tengu_install_github_app_step_completed', {
            step: 'api-key' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          setState(prev_18 => ({
            ...prev_18,
            secretExists: true,
            step: 'check-existing-secret'
          }));
        } else {
          logEvent('tengu_install_github_app_step_completed', {
            step: 'api-key' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          // No existing secret, proceed to creating
          await runSetupGitHubActions(apiKeyToUse, state.secretName);
        }
      } else {
        logEvent('tengu_install_github_app_step_completed', {
          step: 'api-key' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        // Error checking secrets, proceed anyway
        await runSetupGitHubActions(apiKeyToUse, state.secretName);
      }
    }
  };
  const handleRepoUrlChange = (value: string) => {
    setState(prev_19 => ({
      ...prev_19,
      selectedRepoName: value
    }));
  };
  const handleApiKeyChange = (value_0: string) => {
    setState(prev_20 => ({
      ...prev_20,
      apiKeyOrOAuthToken: value_0
    }));
  };
  const handleApiKeyOptionChange = (option: 'existing' | 'new' | 'oauth') => {
    setState(prev_21 => ({
      ...prev_21,
      selectedApiKeyOption: option
    }));
  };
  const handleCreateOAuthToken = useCallback(() => {
    logEvent('tengu_install_github_app_step_completed', {
      step: 'api-key' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setState(prev_22 => ({
      ...prev_22,
      step: 'oauth-flow'
    }));
  }, []);
  const handleOAuthSuccess = useCallback((token: string) => {
    logEvent('tengu_install_github_app_step_completed', {
      step: 'oauth-flow' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setState(prev_23 => ({
      ...prev_23,
      apiKeyOrOAuthToken: token,
      useExistingKey: false,
      secretName: 'CLAUDE_CODE_OAUTH_TOKEN',
      authType: 'oauth_token'
    }));
    void runSetupGitHubActions(token, 'CLAUDE_CODE_OAUTH_TOKEN');
  }, [runSetupGitHubActions]);
  const handleOAuthCancel = useCallback(() => {
    setState(prev_24 => ({
      ...prev_24,
      step: 'api-key'
    }));
  }, []);
  const handleSecretNameChange = (value_1: string) => {
    if (value_1 && !/^[a-zA-Z0-9_]+$/.test(value_1)) return;
    setState(prev_25 => ({
      ...prev_25,
      secretName: value_1
    }));
  };
  const handleToggleUseCurrentRepo = (useCurrentRepo: boolean) => {
    setState(prev_26 => ({
      ...prev_26,
      useCurrentRepo,
      selectedRepoName: useCurrentRepo ? prev_26.currentRepo : ''
    }));
  };
  const handleToggleUseExistingKey = (useExistingKey: boolean) => {
    setState(prev_27 => ({
      ...prev_27,
      useExistingKey
    }));
  };
  const handleToggleUseExistingSecret = (useExistingSecret: boolean) => {
    setState(prev_28 => ({
      ...prev_28,
      useExistingSecret,
      secretName: useExistingSecret ? 'ANTHROPIC_API_KEY' : ''
    }));
  };
  const handleWorkflowAction = async (action: 'update' | 'skip' | 'exit') => {
    if (action === 'exit') {
      props.onDone('Installation cancelled by user');
      return;
    }
    logEvent('tengu_install_github_app_step_completed', {
      step: 'check-existing-workflow' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setState(prev_29 => ({
      ...prev_29,
      workflowAction: action
    }));
    if (action === 'skip' || action === 'update') {
      // Check if user has existing local API key
      if (existingApiKey) {
        await checkExistingSecret();
      } else {
        // No local key, go straight to API key step
        setState(prev_30 => ({
          ...prev_30,
          step: 'api-key'
        }));
      }
    }
  };
  function handleDismissKeyDown(e: KeyboardEvent): void {
    e.preventDefault();
    if (state.step === 'success') {
      logEvent('tengu_install_github_app_completed', {});
    }
    props.onDone(state.step === 'success' ? 'GitHub Actions setup complete!' : state.error ? `Couldn't install GitHub App: ${state.error}\nFor manual setup instructions, see: ${GITHUB_ACTION_SETUP_DOCS_URL}` : `GitHub App installation failed\nFor manual setup instructions, see: ${GITHUB_ACTION_SETUP_DOCS_URL}`);
  }
  switch (state.step) {
    case 'check-gh':
      return <CheckGitHubStep />;
    case 'warnings':
      return <WarningsStep warnings={state.warnings} onContinue={handleSubmit} />;
    case 'choose-repo':
      return <ChooseRepoStep currentRepo={state.currentRepo} useCurrentRepo={state.useCurrentRepo} repoUrl={state.selectedRepoName} onRepoUrlChange={handleRepoUrlChange} onToggleUseCurrentRepo={handleToggleUseCurrentRepo} onSubmit={handleSubmit} />;
    case 'install-app':
      return <InstallAppStep repoUrl={state.selectedRepoName} onSubmit={handleSubmit} />;
    case 'check-existing-workflow':
      return <ExistingWorkflowStep repoName={state.selectedRepoName} onSelectAction={handleWorkflowAction} />;
    case 'check-existing-secret':
      return <CheckExistingSecretStep useExistingSecret={state.useExistingSecret} secretName={state.secretName} onToggleUseExistingSecret={handleToggleUseExistingSecret} onSecretNameChange={handleSecretNameChange} onSubmit={handleSubmit} />;
    case 'api-key':
      return <ApiKeyStep existingApiKey={existingApiKey} useExistingKey={state.useExistingKey} apiKeyOrOAuthToken={state.apiKeyOrOAuthToken} onApiKeyChange={handleApiKeyChange} onToggleUseExistingKey={handleToggleUseExistingKey} onSubmit={handleSubmit} onCreateOAuthToken={isAnthropicAuthEnabled() ? handleCreateOAuthToken : undefined} selectedOption={state.selectedApiKeyOption} onSelectOption={handleApiKeyOptionChange} />;
    case 'creating':
      return <CreatingStep currentWorkflowInstallStep={state.currentWorkflowInstallStep} secretExists={state.secretExists} useExistingSecret={state.useExistingSecret} secretName={state.secretName} skipWorkflow={state.workflowAction === 'skip'} selectedWorkflows={state.selectedWorkflows} />;
    case 'success':
      return <Box tabIndex={0} autoFocus onKeyDown={handleDismissKeyDown}>
          <SuccessStep secretExists={state.secretExists} useExistingSecret={state.useExistingSecret} secretName={state.secretName} skipWorkflow={state.workflowAction === 'skip'} />
        </Box>;
    case 'error':
      return <Box tabIndex={0} autoFocus onKeyDown={handleDismissKeyDown}>
          <ErrorStep error={state.error} errorReason={state.errorReason} errorInstructions={state.errorInstructions} />
        </Box>;
    case 'select-workflows':
      return <WorkflowMultiselectDialog defaultSelections={state.selectedWorkflows} onSubmit={selectedWorkflows => {
        logEvent('tengu_install_github_app_step_completed', {
          step: 'select-workflows' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setState(prev_31 => ({
          ...prev_31,
          selectedWorkflows
        }));
        // Check if user has existing local API key
        if (existingApiKey) {
          void checkExistingSecret();
        } else {
          // No local key, go straight to API key step
          setState(prev_32 => ({
            ...prev_32,
            step: 'api-key'
          }));
        }
      }} />;
    case 'oauth-flow':
      return <OAuthFlowStep onSuccess={handleOAuthSuccess} onCancel={handleOAuthCancel} />;
  }
}
export async function call(onDone: LocalJSXCommandOnDone): Promise<React.ReactNode> {
  return <InstallGitHubApp onDone={onDone} />;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJleGVjYSIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VTdGF0ZSIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIldvcmtmbG93TXVsdGlzZWxlY3REaWFsb2ciLCJHSVRIVUJfQUNUSU9OX1NFVFVQX0RPQ1NfVVJMIiwidXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIiwiS2V5Ym9hcmRFdmVudCIsIkJveCIsIkxvY2FsSlNYQ29tbWFuZE9uRG9uZSIsImdldEFudGhyb3BpY0FwaUtleSIsImlzQW50aHJvcGljQXV0aEVuYWJsZWQiLCJvcGVuQnJvd3NlciIsImV4ZWNGaWxlTm9UaHJvdyIsImdldEdpdGh1YlJlcG8iLCJwbHVyYWwiLCJBcGlLZXlTdGVwIiwiQ2hlY2tFeGlzdGluZ1NlY3JldFN0ZXAiLCJDaGVja0dpdEh1YlN0ZXAiLCJDaG9vc2VSZXBvU3RlcCIsIkNyZWF0aW5nU3RlcCIsIkVycm9yU3RlcCIsIkV4aXN0aW5nV29ya2Zsb3dTdGVwIiwiSW5zdGFsbEFwcFN0ZXAiLCJPQXV0aEZsb3dTdGVwIiwiU3VjY2Vzc1N0ZXAiLCJzZXR1cEdpdEh1YkFjdGlvbnMiLCJTdGF0ZSIsIldhcm5pbmciLCJXb3JrZmxvdyIsIldhcm5pbmdzU3RlcCIsIklOSVRJQUxfU1RBVEUiLCJzdGVwIiwic2VsZWN0ZWRSZXBvTmFtZSIsImN1cnJlbnRSZXBvIiwidXNlQ3VycmVudFJlcG8iLCJhcGlLZXlPck9BdXRoVG9rZW4iLCJ1c2VFeGlzdGluZ0tleSIsImN1cnJlbnRXb3JrZmxvd0luc3RhbGxTdGVwIiwid2FybmluZ3MiLCJzZWNyZXRFeGlzdHMiLCJzZWNyZXROYW1lIiwidXNlRXhpc3RpbmdTZWNyZXQiLCJ3b3JrZmxvd0V4aXN0cyIsInNlbGVjdGVkV29ya2Zsb3dzIiwic2VsZWN0ZWRBcGlLZXlPcHRpb24iLCJhdXRoVHlwZSIsIkluc3RhbGxHaXRIdWJBcHAiLCJwcm9wcyIsIm9uRG9uZSIsIm1lc3NhZ2UiLCJSZWFjdE5vZGUiLCJleGlzdGluZ0FwaUtleSIsInN0YXRlIiwic2V0U3RhdGUiLCJ1c2VFZmZlY3QiLCJjaGVja0dpdEh1YkNMSSIsImdoVmVyc2lvblJlc3VsdCIsInNoZWxsIiwicmVqZWN0IiwiZXhpdENvZGUiLCJwdXNoIiwidGl0bGUiLCJpbnN0cnVjdGlvbnMiLCJhdXRoUmVzdWx0IiwidG9rZW5TY29wZXNNYXRjaCIsInN0ZG91dCIsIm1hdGNoIiwic2NvcGVzIiwibWlzc2luZ1Njb3BlcyIsImluY2x1ZGVzIiwibGVuZ3RoIiwicHJldiIsImVycm9yIiwiam9pbiIsImVycm9yUmVhc29uIiwiZXJyb3JJbnN0cnVjdGlvbnMiLCJydW5TZXR1cEdpdEh1YkFjdGlvbnMiLCJ3b3JrZmxvd0FjdGlvbiIsImVycm9yTWVzc2FnZSIsIkVycm9yIiwicmVhc29uIiwib3BlbkdpdEh1YkFwcEluc3RhbGxhdGlvbiIsImluc3RhbGxVcmwiLCJjaGVja1JlcG9zaXRvcnlQZXJtaXNzaW9ucyIsInJlcG9OYW1lIiwiUHJvbWlzZSIsImhhc0FjY2VzcyIsInJlc3VsdCIsImNvZGUiLCJoYXNBZG1pbiIsInRyaW0iLCJzdGRlcnIiLCJjaGVja0V4aXN0aW5nV29ya2Zsb3dGaWxlIiwiY2hlY2tGaWxlUmVzdWx0IiwiY2hlY2tFeGlzdGluZ1NlY3JldCIsImNoZWNrU2VjcmV0c1Jlc3VsdCIsImxpbmVzIiwic3BsaXQiLCJoYXNBbnRocm9waWNLZXkiLCJzb21lIiwibGluZSIsInRlc3QiLCJoYW5kbGVTdWJtaXQiLCJzZXRUaW1lb3V0IiwicmVwb1dhcm5pbmdzIiwicmVwbGFjZSIsInBlcm1pc3Npb25DaGVjayIsImFsbFdhcm5pbmdzIiwiYXBpS2V5VG9Vc2UiLCJoYW5kbGVSZXBvVXJsQ2hhbmdlIiwidmFsdWUiLCJoYW5kbGVBcGlLZXlDaGFuZ2UiLCJoYW5kbGVBcGlLZXlPcHRpb25DaGFuZ2UiLCJvcHRpb24iLCJoYW5kbGVDcmVhdGVPQXV0aFRva2VuIiwiaGFuZGxlT0F1dGhTdWNjZXNzIiwidG9rZW4iLCJoYW5kbGVPQXV0aENhbmNlbCIsImhhbmRsZVNlY3JldE5hbWVDaGFuZ2UiLCJoYW5kbGVUb2dnbGVVc2VDdXJyZW50UmVwbyIsImhhbmRsZVRvZ2dsZVVzZUV4aXN0aW5nS2V5IiwiaGFuZGxlVG9nZ2xlVXNlRXhpc3RpbmdTZWNyZXQiLCJoYW5kbGVXb3JrZmxvd0FjdGlvbiIsImFjdGlvbiIsImhhbmRsZURpc21pc3NLZXlEb3duIiwiZSIsInByZXZlbnREZWZhdWx0IiwidW5kZWZpbmVkIiwiY2FsbCJdLCJzb3VyY2VzIjpbImluc3RhbGwtZ2l0aHViLWFwcC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhlY2EgfSBmcm9tICdleGVjYSdcbmltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgeyBXb3JrZmxvd011bHRpc2VsZWN0RGlhbG9nIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9Xb3JrZmxvd011bHRpc2VsZWN0RGlhbG9nLmpzJ1xuaW1wb3J0IHsgR0lUSFVCX0FDVElPTl9TRVRVUF9ET0NTX1VSTCB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy9naXRodWItYXBwLmpzJ1xuaW1wb3J0IHsgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzLmpzJ1xuaW1wb3J0IHR5cGUgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vaW5rL2V2ZW50cy9rZXlib2FyZC1ldmVudC5qcydcbmltcG9ydCB7IEJveCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgTG9jYWxKU1hDb21tYW5kT25Eb25lIH0gZnJvbSAnLi4vLi4vdHlwZXMvY29tbWFuZC5qcydcbmltcG9ydCB7IGdldEFudGhyb3BpY0FwaUtleSwgaXNBbnRocm9waWNBdXRoRW5hYmxlZCB9IGZyb20gJy4uLy4uL3V0aWxzL2F1dGguanMnXG5pbXBvcnQgeyBvcGVuQnJvd3NlciB9IGZyb20gJy4uLy4uL3V0aWxzL2Jyb3dzZXIuanMnXG5pbXBvcnQgeyBleGVjRmlsZU5vVGhyb3cgfSBmcm9tICcuLi8uLi91dGlscy9leGVjRmlsZU5vVGhyb3cuanMnXG5pbXBvcnQgeyBnZXRHaXRodWJSZXBvIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0LmpzJ1xuaW1wb3J0IHsgcGx1cmFsIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyBBcGlLZXlTdGVwIH0gZnJvbSAnLi9BcGlLZXlTdGVwLmpzJ1xuaW1wb3J0IHsgQ2hlY2tFeGlzdGluZ1NlY3JldFN0ZXAgfSBmcm9tICcuL0NoZWNrRXhpc3RpbmdTZWNyZXRTdGVwLmpzJ1xuaW1wb3J0IHsgQ2hlY2tHaXRIdWJTdGVwIH0gZnJvbSAnLi9DaGVja0dpdEh1YlN0ZXAuanMnXG5pbXBvcnQgeyBDaG9vc2VSZXBvU3RlcCB9IGZyb20gJy4vQ2hvb3NlUmVwb1N0ZXAuanMnXG5pbXBvcnQgeyBDcmVhdGluZ1N0ZXAgfSBmcm9tICcuL0NyZWF0aW5nU3RlcC5qcydcbmltcG9ydCB7IEVycm9yU3RlcCB9IGZyb20gJy4vRXJyb3JTdGVwLmpzJ1xuaW1wb3J0IHsgRXhpc3RpbmdXb3JrZmxvd1N0ZXAgfSBmcm9tICcuL0V4aXN0aW5nV29ya2Zsb3dTdGVwLmpzJ1xuaW1wb3J0IHsgSW5zdGFsbEFwcFN0ZXAgfSBmcm9tICcuL0luc3RhbGxBcHBTdGVwLmpzJ1xuaW1wb3J0IHsgT0F1dGhGbG93U3RlcCB9IGZyb20gJy4vT0F1dGhGbG93U3RlcC5qcydcbmltcG9ydCB7IFN1Y2Nlc3NTdGVwIH0gZnJvbSAnLi9TdWNjZXNzU3RlcC5qcydcbmltcG9ydCB7IHNldHVwR2l0SHViQWN0aW9ucyB9IGZyb20gJy4vc2V0dXBHaXRIdWJBY3Rpb25zLmpzJ1xuaW1wb3J0IHR5cGUgeyBTdGF0ZSwgV2FybmluZywgV29ya2Zsb3cgfSBmcm9tICcuL3R5cGVzLmpzJ1xuaW1wb3J0IHsgV2FybmluZ3NTdGVwIH0gZnJvbSAnLi9XYXJuaW5nc1N0ZXAuanMnXG5cbmNvbnN0IElOSVRJQUxfU1RBVEU6IFN0YXRlID0ge1xuICBzdGVwOiAnY2hlY2stZ2gnLFxuICBzZWxlY3RlZFJlcG9OYW1lOiAnJyxcbiAgY3VycmVudFJlcG86ICcnLFxuICB1c2VDdXJyZW50UmVwbzogZmFsc2UsIC8vIERlZmF1bHQgdG8gZmFsc2UsIHdpbGwgYmUgc2V0IHRvIHRydWUgaWYgcmVwbyBkZXRlY3RlZFxuICBhcGlLZXlPck9BdXRoVG9rZW46ICcnLFxuICB1c2VFeGlzdGluZ0tleTogdHJ1ZSxcbiAgY3VycmVudFdvcmtmbG93SW5zdGFsbFN0ZXA6IDAsXG4gIHdhcm5pbmdzOiBbXSxcbiAgc2VjcmV0RXhpc3RzOiBmYWxzZSxcbiAgc2VjcmV0TmFtZTogJ0FOVEhST1BJQ19BUElfS0VZJyxcbiAgdXNlRXhpc3RpbmdTZWNyZXQ6IHRydWUsXG4gIHdvcmtmbG93RXhpc3RzOiBmYWxzZSxcbiAgc2VsZWN0ZWRXb3JrZmxvd3M6IFsnY2xhdWRlJywgJ2NsYXVkZS1yZXZpZXcnXSBhcyBXb3JrZmxvd1tdLFxuICBzZWxlY3RlZEFwaUtleU9wdGlvbjogJ25ldycgYXMgJ2V4aXN0aW5nJyB8ICduZXcnIHwgJ29hdXRoJyxcbiAgYXV0aFR5cGU6ICdhcGlfa2V5Jyxcbn1cblxuZnVuY3Rpb24gSW5zdGFsbEdpdEh1YkFwcChwcm9wczoge1xuICBvbkRvbmU6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWRcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbZXhpc3RpbmdBcGlLZXldID0gdXNlU3RhdGUoKCkgPT4gZ2V0QW50aHJvcGljQXBpS2V5KCkpXG4gIGNvbnN0IFtzdGF0ZSwgc2V0U3RhdGVdID0gdXNlU3RhdGUoe1xuICAgIC4uLklOSVRJQUxfU1RBVEUsXG4gICAgdXNlRXhpc3RpbmdLZXk6ICEhZXhpc3RpbmdBcGlLZXksXG4gICAgc2VsZWN0ZWRBcGlLZXlPcHRpb246IChleGlzdGluZ0FwaUtleVxuICAgICAgPyAnZXhpc3RpbmcnXG4gICAgICA6IGlzQW50aHJvcGljQXV0aEVuYWJsZWQoKVxuICAgICAgICA/ICdvYXV0aCdcbiAgICAgICAgOiAnbmV3JykgYXMgJ2V4aXN0aW5nJyB8ICduZXcnIHwgJ29hdXRoJyxcbiAgfSlcbiAgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzKClcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV9pbnN0YWxsX2dpdGh1Yl9hcHBfc3RhcnRlZCcsIHt9KVxuICB9LCBbXSlcblxuICBjb25zdCBjaGVja0dpdEh1YkNMSSA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB3YXJuaW5nczogV2FybmluZ1tdID0gW11cblxuICAgIC8vIENoZWNrIGlmIGdoIGlzIGluc3RhbGxlZFxuICAgIGNvbnN0IGdoVmVyc2lvblJlc3VsdCA9IGF3YWl0IGV4ZWNhKCdnaCAtLXZlcnNpb24nLCB7XG4gICAgICBzaGVsbDogdHJ1ZSxcbiAgICAgIHJlamVjdDogZmFsc2UsXG4gICAgfSlcbiAgICBpZiAoZ2hWZXJzaW9uUmVzdWx0LmV4aXRDb2RlICE9PSAwKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgdGl0bGU6ICdHaXRIdWIgQ0xJIG5vdCBmb3VuZCcsXG4gICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgJ0dpdEh1YiBDTEkgKGdoKSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgaW5zdGFsbGVkIG9yIGFjY2Vzc2libGUuJyxcbiAgICAgICAgaW5zdHJ1Y3Rpb25zOiBbXG4gICAgICAgICAgJ0luc3RhbGwgR2l0SHViIENMSSBmcm9tIGh0dHBzOi8vY2xpLmdpdGh1Yi5jb20vJyxcbiAgICAgICAgICAnbWFjT1M6IGJyZXcgaW5zdGFsbCBnaCcsXG4gICAgICAgICAgJ1dpbmRvd3M6IHdpbmdldCBpbnN0YWxsIC0taWQgR2l0SHViLmNsaScsXG4gICAgICAgICAgJ0xpbnV4OiBTZWUgaW5zdGFsbGF0aW9uIGluc3RydWN0aW9ucyBhdCBodHRwczovL2dpdGh1Yi5jb20vY2xpL2NsaSNpbnN0YWxsYXRpb24nLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBDaGVjayBhdXRoIHN0YXR1c1xuICAgIGNvbnN0IGF1dGhSZXN1bHQgPSBhd2FpdCBleGVjYSgnZ2ggYXV0aCBzdGF0dXMgLWEnLCB7XG4gICAgICBzaGVsbDogdHJ1ZSxcbiAgICAgIHJlamVjdDogZmFsc2UsXG4gICAgfSlcbiAgICBpZiAoYXV0aFJlc3VsdC5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgIHRpdGxlOiAnR2l0SHViIENMSSBub3QgYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6ICdHaXRIdWIgQ0xJIGRvZXMgbm90IGFwcGVhciB0byBiZSBhdXRoZW50aWNhdGVkLicsXG4gICAgICAgIGluc3RydWN0aW9uczogW1xuICAgICAgICAgICdSdW46IGdoIGF1dGggbG9naW4nLFxuICAgICAgICAgICdGb2xsb3cgdGhlIHByb21wdHMgdG8gYXV0aGVudGljYXRlIHdpdGggR2l0SHViJyxcbiAgICAgICAgICAnT3Igc2V0IHVwIGF1dGhlbnRpY2F0aW9uIHVzaW5nIGVudmlyb25tZW50IHZhcmlhYmxlcyBvciBvdGhlciBtZXRob2RzJyxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENoZWNrIGlmIHJlcXVpcmVkIHNjb3BlcyBhcmUgcHJlc2VudCBpbiB0aGUgVG9rZW4gc2NvcGVzIGxpbmVcbiAgICAgIGNvbnN0IHRva2VuU2NvcGVzTWF0Y2ggPSBhdXRoUmVzdWx0LnN0ZG91dC5tYXRjaCgvVG9rZW4gc2NvcGVzOi4qJC9tKVxuICAgICAgaWYgKHRva2VuU2NvcGVzTWF0Y2gpIHtcbiAgICAgICAgY29uc3Qgc2NvcGVzID0gdG9rZW5TY29wZXNNYXRjaFswXVxuICAgICAgICBjb25zdCBtaXNzaW5nU2NvcGVzOiBzdHJpbmdbXSA9IFtdXG5cbiAgICAgICAgaWYgKCFzY29wZXMuaW5jbHVkZXMoJ3JlcG8nKSkge1xuICAgICAgICAgIG1pc3NpbmdTY29wZXMucHVzaCgncmVwbycpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzY29wZXMuaW5jbHVkZXMoJ3dvcmtmbG93JykpIHtcbiAgICAgICAgICBtaXNzaW5nU2NvcGVzLnB1c2goJ3dvcmtmbG93JylcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtaXNzaW5nU2NvcGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBNaXNzaW5nIHJlcXVpcmVkIHNjb3BlcyAtIGV4aXQgaW1tZWRpYXRlbHlcbiAgICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgc3RlcDogJ2Vycm9yJyxcbiAgICAgICAgICAgIGVycm9yOiBgR2l0SHViIENMSSBpcyBtaXNzaW5nIHJlcXVpcmVkIHBlcm1pc3Npb25zOiAke21pc3NpbmdTY29wZXMuam9pbignLCAnKX0uYCxcbiAgICAgICAgICAgIGVycm9yUmVhc29uOiAnTWlzc2luZyByZXF1aXJlZCBzY29wZXMnLFxuICAgICAgICAgICAgZXJyb3JJbnN0cnVjdGlvbnM6IFtcbiAgICAgICAgICAgICAgYFlvdXIgR2l0SHViIENMSSBhdXRoZW50aWNhdGlvbiBpcyBtaXNzaW5nIHRoZSBcIiR7bWlzc2luZ1Njb3Blcy5qb2luKCdcIiBhbmQgXCInKX1cIiAke3BsdXJhbChtaXNzaW5nU2NvcGVzLmxlbmd0aCwgJ3Njb3BlJyl9IG5lZWRlZCB0byBtYW5hZ2UgR2l0SHViIEFjdGlvbnMgYW5kIHNlY3JldHMuYCxcbiAgICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAgICdUbyBmaXggdGhpcywgcnVuOicsXG4gICAgICAgICAgICAgICcgIGdoIGF1dGggcmVmcmVzaCAtaCBnaXRodWIuY29tIC1zIHJlcG8sd29ya2Zsb3cnLFxuICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgJ1RoaXMgd2lsbCBhZGQgdGhlIG5lY2Vzc2FyeSBwZXJtaXNzaW9ucyB0byBtYW5hZ2Ugd29ya2Zsb3dzIGFuZCBzZWNyZXRzLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgaW4gYSBnaXQgcmVwbyBhbmQgZ2V0IHJlbW90ZSBVUkxcbiAgICBjb25zdCBjdXJyZW50UmVwbyA9IChhd2FpdCBnZXRHaXRodWJSZXBvKCkpID8/ICcnXG5cbiAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgc3RlcDogJ2NoZWNrLWdoJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG5cbiAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgd2FybmluZ3MsXG4gICAgICBjdXJyZW50UmVwbyxcbiAgICAgIHNlbGVjdGVkUmVwb05hbWU6IGN1cnJlbnRSZXBvLFxuICAgICAgdXNlQ3VycmVudFJlcG86ICEhY3VycmVudFJlcG8sIC8vIFNldCB0byBmYWxzZSBpZiBubyByZXBvIGRldGVjdGVkXG4gICAgICBzdGVwOiB3YXJuaW5ncy5sZW5ndGggPiAwID8gJ3dhcm5pbmdzJyA6ICdjaG9vc2UtcmVwbycsXG4gICAgfSkpXG4gIH0sIFtdKVxuXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHN0YXRlLnN0ZXAgPT09ICdjaGVjay1naCcpIHtcbiAgICAgIHZvaWQgY2hlY2tHaXRIdWJDTEkoKVxuICAgIH1cbiAgfSwgW3N0YXRlLnN0ZXAsIGNoZWNrR2l0SHViQ0xJXSlcblxuICBjb25zdCBydW5TZXR1cEdpdEh1YkFjdGlvbnMgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAoYXBpS2V5T3JPQXV0aFRva2VuOiBzdHJpbmcgfCBudWxsLCBzZWNyZXROYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgc3RlcDogJ2NyZWF0aW5nJyxcbiAgICAgICAgY3VycmVudFdvcmtmbG93SW5zdGFsbFN0ZXA6IDAsXG4gICAgICB9KSlcblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2V0dXBHaXRIdWJBY3Rpb25zKFxuICAgICAgICAgIHN0YXRlLnNlbGVjdGVkUmVwb05hbWUsXG4gICAgICAgICAgYXBpS2V5T3JPQXV0aFRva2VuLFxuICAgICAgICAgIHNlY3JldE5hbWUsXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICBjdXJyZW50V29ya2Zsb3dJbnN0YWxsU3RlcDogcHJldi5jdXJyZW50V29ya2Zsb3dJbnN0YWxsU3RlcCArIDEsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRlLndvcmtmbG93QWN0aW9uID09PSAnc2tpcCcsXG4gICAgICAgICAgc3RhdGUuc2VsZWN0ZWRXb3JrZmxvd3MsXG4gICAgICAgICAgc3RhdGUuYXV0aFR5cGUsXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXNlQ3VycmVudFJlcG86IHN0YXRlLnVzZUN1cnJlbnRSZXBvLFxuICAgICAgICAgICAgd29ya2Zsb3dFeGlzdHM6IHN0YXRlLndvcmtmbG93RXhpc3RzLFxuICAgICAgICAgICAgc2VjcmV0RXhpc3RzOiBzdGF0ZS5zZWNyZXRFeGlzdHMsXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICAgIHN0ZXA6ICdjcmVhdGluZycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnc3VjY2VzcycgfSkpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPVxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgICAgICAgID8gZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgOiAnRmFpbGVkIHRvIHNldCB1cCBHaXRIdWIgQWN0aW9ucydcblxuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCd3b3JrZmxvdyBmaWxlIGFscmVhZHkgZXhpc3RzJykpIHtcbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX2Vycm9yJywge1xuICAgICAgICAgICAgcmVhc29uOlxuICAgICAgICAgICAgICAnd29ya2Zsb3dfZmlsZV9leGlzdHMnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgc3RlcDogJ2Vycm9yJyxcbiAgICAgICAgICAgIGVycm9yOiAnQSBDbGF1ZGUgd29ya2Zsb3cgZmlsZSBhbHJlYWR5IGV4aXN0cyBpbiB0aGlzIHJlcG9zaXRvcnkuJyxcbiAgICAgICAgICAgIGVycm9yUmVhc29uOiAnV29ya2Zsb3cgZmlsZSBjb25mbGljdCcsXG4gICAgICAgICAgICBlcnJvckluc3RydWN0aW9uczogW1xuICAgICAgICAgICAgICAnVGhlIGZpbGUgLmdpdGh1Yi93b3JrZmxvd3MvY2xhdWRlLnltbCBhbHJlYWR5IGV4aXN0cycsXG4gICAgICAgICAgICAgICdZb3UgY2FuIGVpdGhlcjonLFxuICAgICAgICAgICAgICAnICAxLiBEZWxldGUgdGhlIGV4aXN0aW5nIGZpbGUgYW5kIHJ1biB0aGlzIGNvbW1hbmQgYWdhaW4nLFxuICAgICAgICAgICAgICAnICAyLiBVcGRhdGUgdGhlIGV4aXN0aW5nIGZpbGUgbWFudWFsbHkgdXNpbmcgdGhlIHRlbXBsYXRlIGZyb206JyxcbiAgICAgICAgICAgICAgYCAgICAgJHtHSVRIVUJfQUNUSU9OX1NFVFVQX0RPQ1NfVVJMfWAsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pbnN0YWxsX2dpdGh1Yl9hcHBfZXJyb3InLCB7XG4gICAgICAgICAgICByZWFzb246XG4gICAgICAgICAgICAgICdzZXR1cF9naXRodWJfYWN0aW9uc19mYWlsZWQnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICBzdGVwOiAnZXJyb3InLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yTWVzc2FnZSxcbiAgICAgICAgICAgIGVycm9yUmVhc29uOiAnR2l0SHViIEFjdGlvbnMgc2V0dXAgZmFpbGVkJyxcbiAgICAgICAgICAgIGVycm9ySW5zdHJ1Y3Rpb25zOiBbXSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgW1xuICAgICAgc3RhdGUuc2VsZWN0ZWRSZXBvTmFtZSxcbiAgICAgIHN0YXRlLndvcmtmbG93QWN0aW9uLFxuICAgICAgc3RhdGUuc2VsZWN0ZWRXb3JrZmxvd3MsXG4gICAgICBzdGF0ZS51c2VDdXJyZW50UmVwbyxcbiAgICAgIHN0YXRlLndvcmtmbG93RXhpc3RzLFxuICAgICAgc3RhdGUuc2VjcmV0RXhpc3RzLFxuICAgICAgc3RhdGUuYXV0aFR5cGUsXG4gICAgXSxcbiAgKVxuXG4gIGFzeW5jIGZ1bmN0aW9uIG9wZW5HaXRIdWJBcHBJbnN0YWxsYXRpb24oKSB7XG4gICAgY29uc3QgaW5zdGFsbFVybCA9ICdodHRwczovL2dpdGh1Yi5jb20vYXBwcy9jbGF1ZGUnXG4gICAgYXdhaXQgb3BlbkJyb3dzZXIoaW5zdGFsbFVybClcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGNoZWNrUmVwb3NpdG9yeVBlcm1pc3Npb25zKFxuICAgIHJlcG9OYW1lOiBzdHJpbmcsXG4gICk6IFByb21pc2U8eyBoYXNBY2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCdnaCcsIFtcbiAgICAgICAgJ2FwaScsXG4gICAgICAgIGByZXBvcy8ke3JlcG9OYW1lfWAsXG4gICAgICAgICctLWpxJyxcbiAgICAgICAgJy5wZXJtaXNzaW9ucy5hZG1pbicsXG4gICAgICBdKVxuXG4gICAgICBpZiAocmVzdWx0LmNvZGUgPT09IDApIHtcbiAgICAgICAgY29uc3QgaGFzQWRtaW4gPSByZXN1bHQuc3Rkb3V0LnRyaW0oKSA9PT0gJ3RydWUnXG4gICAgICAgIHJldHVybiB7IGhhc0FjY2VzczogaGFzQWRtaW4gfVxuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIHJlc3VsdC5zdGRlcnIuaW5jbHVkZXMoJzQwNCcpIHx8XG4gICAgICAgIHJlc3VsdC5zdGRlcnIuaW5jbHVkZXMoJ05vdCBGb3VuZCcpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBoYXNBY2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiAncmVwb3NpdG9yeV9ub3RfZm91bmQnLFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGhhc0FjY2VzczogZmFsc2UgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgaGFzQWNjZXNzOiBmYWxzZSB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gY2hlY2tFeGlzdGluZ1dvcmtmbG93RmlsZShyZXBvTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgY2hlY2tGaWxlUmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCdnaCcsIFtcbiAgICAgICdhcGknLFxuICAgICAgYHJlcG9zLyR7cmVwb05hbWV9L2NvbnRlbnRzLy5naXRodWIvd29ya2Zsb3dzL2NsYXVkZS55bWxgLFxuICAgICAgJy0tanEnLFxuICAgICAgJy5zaGEnLFxuICAgIF0pXG5cbiAgICByZXR1cm4gY2hlY2tGaWxlUmVzdWx0LmNvZGUgPT09IDBcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGNoZWNrRXhpc3RpbmdTZWNyZXQoKSB7XG4gICAgY29uc3QgY2hlY2tTZWNyZXRzUmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCdnaCcsIFtcbiAgICAgICdzZWNyZXQnLFxuICAgICAgJ2xpc3QnLFxuICAgICAgJy0tYXBwJyxcbiAgICAgICdhY3Rpb25zJyxcbiAgICAgICctLXJlcG8nLFxuICAgICAgc3RhdGUuc2VsZWN0ZWRSZXBvTmFtZSxcbiAgICBdKVxuXG4gICAgaWYgKGNoZWNrU2VjcmV0c1Jlc3VsdC5jb2RlID09PSAwKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGNoZWNrU2VjcmV0c1Jlc3VsdC5zdGRvdXQuc3BsaXQoJ1xcbicpXG4gICAgICBjb25zdCBoYXNBbnRocm9waWNLZXkgPSBsaW5lcy5zb21lKChsaW5lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgcmV0dXJuIC9eQU5USFJPUElDX0FQSV9LRVlcXHMrLy50ZXN0KGxpbmUpXG4gICAgICB9KVxuXG4gICAgICBpZiAoaGFzQW50aHJvcGljS2V5KSB7XG4gICAgICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHNlY3JldEV4aXN0czogdHJ1ZSxcbiAgICAgICAgICBzdGVwOiAnY2hlY2stZXhpc3Rpbmctc2VjcmV0JyxcbiAgICAgICAgfSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBleGlzdGluZyBzZWNyZXQgZm91bmRcbiAgICAgICAgaWYgKGV4aXN0aW5nQXBpS2V5KSB7XG4gICAgICAgICAgLy8gVXNlciBoYXMgbG9jYWwga2V5LCBza2lwIHRvIGNyZWF0aW5nIHdpdGggaXRcbiAgICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgYXBpS2V5T3JPQXV0aFRva2VuOiBleGlzdGluZ0FwaUtleSxcbiAgICAgICAgICAgIHVzZUV4aXN0aW5nS2V5OiB0cnVlLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIGF3YWl0IHJ1blNldHVwR2l0SHViQWN0aW9ucyhleGlzdGluZ0FwaUtleSwgc3RhdGUuc2VjcmV0TmFtZSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBObyBsb2NhbCBrZXksIGdvIHRvIEFQSSBrZXkgc3RlcFxuICAgICAgICAgIHNldFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgc3RlcDogJ2FwaS1rZXknIH0pKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEVycm9yIGNoZWNraW5nIHNlY3JldHNcbiAgICAgIGlmIChleGlzdGluZ0FwaUtleSkge1xuICAgICAgICAvLyBVc2VyIGhhcyBsb2NhbCBrZXksIHNraXAgdG8gY3JlYXRpbmcgd2l0aCBpdFxuICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICBhcGlLZXlPck9BdXRoVG9rZW46IGV4aXN0aW5nQXBpS2V5LFxuICAgICAgICAgIHVzZUV4aXN0aW5nS2V5OiB0cnVlLFxuICAgICAgICB9KSlcbiAgICAgICAgYXdhaXQgcnVuU2V0dXBHaXRIdWJBY3Rpb25zKGV4aXN0aW5nQXBpS2V5LCBzdGF0ZS5zZWNyZXROYW1lKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gbG9jYWwga2V5LCBnbyB0byBBUEkga2V5IHN0ZXBcbiAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnYXBpLWtleScgfSkpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaGFuZGxlU3VibWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChzdGF0ZS5zdGVwID09PSAnd2FybmluZ3MnKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICBzdGVwOiAnd2FybmluZ3MnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnaW5zdGFsbC1hcHAnIH0pKVxuICAgICAgc2V0VGltZW91dChvcGVuR2l0SHViQXBwSW5zdGFsbGF0aW9uLCAwKVxuICAgIH0gZWxzZSBpZiAoc3RhdGUuc3RlcCA9PT0gJ2Nob29zZS1yZXBvJykge1xuICAgICAgbGV0IHJlcG9OYW1lID0gc3RhdGUudXNlQ3VycmVudFJlcG9cbiAgICAgICAgPyBzdGF0ZS5jdXJyZW50UmVwb1xuICAgICAgICA6IHN0YXRlLnNlbGVjdGVkUmVwb05hbWVcblxuICAgICAgaWYgKCFyZXBvTmFtZS50cmltKCkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlcG9XYXJuaW5nczogV2FybmluZ1tdID0gW11cblxuICAgICAgaWYgKHJlcG9OYW1lLmluY2x1ZGVzKCdnaXRodWIuY29tJykpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSByZXBvTmFtZS5tYXRjaCgvZ2l0aHViXFwuY29tWzovXShbXi9dK1xcL1teL10rKShcXC5naXQpPyQvKVxuICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgcmVwb1dhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgdGl0bGU6ICdJbnZhbGlkIEdpdEh1YiBVUkwgZm9ybWF0JyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdUaGUgcmVwb3NpdG9yeSBVUkwgZm9ybWF0IGFwcGVhcnMgdG8gYmUgaW52YWxpZC4nLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zOiBbXG4gICAgICAgICAgICAgICdVc2UgZm9ybWF0OiBvd25lci9yZXBvIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9vd25lci9yZXBvJyxcbiAgICAgICAgICAgICAgJ0V4YW1wbGU6IGFudGhyb3BpY3MvY2xhdWRlLWNsaScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVwb05hbWUgPSBtYXRjaFsxXT8ucmVwbGFjZSgvXFwuZ2l0JC8sICcnKSB8fCAnJ1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghcmVwb05hbWUuaW5jbHVkZXMoJy8nKSkge1xuICAgICAgICByZXBvV2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgdGl0bGU6ICdSZXBvc2l0b3J5IGZvcm1hdCB3YXJuaW5nJyxcbiAgICAgICAgICBtZXNzYWdlOiAnUmVwb3NpdG9yeSBzaG91bGQgYmUgaW4gZm9ybWF0IFwib3duZXIvcmVwb1wiJyxcbiAgICAgICAgICBpbnN0cnVjdGlvbnM6IFtcbiAgICAgICAgICAgICdVc2UgZm9ybWF0OiBvd25lci9yZXBvJyxcbiAgICAgICAgICAgICdFeGFtcGxlOiBhbnRocm9waWNzL2NsYXVkZS1jbGknLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBlcm1pc3Npb25DaGVjayA9IGF3YWl0IGNoZWNrUmVwb3NpdG9yeVBlcm1pc3Npb25zKHJlcG9OYW1lKVxuXG4gICAgICBpZiAocGVybWlzc2lvbkNoZWNrLmVycm9yID09PSAncmVwb3NpdG9yeV9ub3RfZm91bmQnKSB7XG4gICAgICAgIHJlcG9XYXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICB0aXRsZTogJ1JlcG9zaXRvcnkgbm90IGZvdW5kJyxcbiAgICAgICAgICBtZXNzYWdlOiBgUmVwb3NpdG9yeSAke3JlcG9OYW1lfSB3YXMgbm90IGZvdW5kIG9yIHlvdSBkb24ndCBoYXZlIGFjY2Vzcy5gLFxuICAgICAgICAgIGluc3RydWN0aW9uczogW1xuICAgICAgICAgICAgYENoZWNrIHRoYXQgdGhlIHJlcG9zaXRvcnkgbmFtZSBpcyBjb3JyZWN0OiAke3JlcG9OYW1lfWAsXG4gICAgICAgICAgICAnRW5zdXJlIHlvdSBoYXZlIGFjY2VzcyB0byB0aGlzIHJlcG9zaXRvcnknLFxuICAgICAgICAgICAgJ0ZvciBwcml2YXRlIHJlcG9zaXRvcmllcywgbWFrZSBzdXJlIHlvdXIgR2l0SHViIHRva2VuIGhhcyB0aGUgXCJyZXBvXCIgc2NvcGUnLFxuICAgICAgICAgICAgJ1lvdSBjYW4gYWRkIHRoZSByZXBvIHNjb3BlIHdpdGg6IGdoIGF1dGggcmVmcmVzaCAtaCBnaXRodWIuY29tIC1zIHJlcG8sd29ya2Zsb3cnLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2UgaWYgKCFwZXJtaXNzaW9uQ2hlY2suaGFzQWNjZXNzKSB7XG4gICAgICAgIHJlcG9XYXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICB0aXRsZTogJ0FkbWluIHBlcm1pc3Npb25zIHJlcXVpcmVkJyxcbiAgICAgICAgICBtZXNzYWdlOiBgWW91IG1pZ2h0IG5lZWQgYWRtaW4gcGVybWlzc2lvbnMgb24gJHtyZXBvTmFtZX0gdG8gc2V0IHVwIEdpdEh1YiBBY3Rpb25zLmAsXG4gICAgICAgICAgaW5zdHJ1Y3Rpb25zOiBbXG4gICAgICAgICAgICAnUmVwb3NpdG9yeSBhZG1pbnMgY2FuIGluc3RhbGwgR2l0SHViIEFwcHMgYW5kIHNldCBzZWNyZXRzJyxcbiAgICAgICAgICAgICdBc2sgYSByZXBvc2l0b3J5IGFkbWluIHRvIHJ1biB0aGlzIGNvbW1hbmQgaWYgc2V0dXAgZmFpbHMnLFxuICAgICAgICAgICAgJ0FsdGVybmF0aXZlbHksIHlvdSBjYW4gdXNlIHRoZSBtYW51YWwgc2V0dXAgaW5zdHJ1Y3Rpb25zJyxcbiAgICAgICAgICBdLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCB3b3JrZmxvd0V4aXN0cyA9IGF3YWl0IGNoZWNrRXhpc3RpbmdXb3JrZmxvd0ZpbGUocmVwb05hbWUpXG5cbiAgICAgIGlmIChyZXBvV2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBhbGxXYXJuaW5ncyA9IFsuLi5zdGF0ZS53YXJuaW5ncywgLi4ucmVwb1dhcm5pbmdzXVxuICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICBzZWxlY3RlZFJlcG9OYW1lOiByZXBvTmFtZSxcbiAgICAgICAgICB3b3JrZmxvd0V4aXN0cyxcbiAgICAgICAgICB3YXJuaW5nczogYWxsV2FybmluZ3MsXG4gICAgICAgICAgc3RlcDogJ3dhcm5pbmdzJyxcbiAgICAgICAgfSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICAgIHN0ZXA6ICdjaG9vc2UtcmVwbycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgc2VsZWN0ZWRSZXBvTmFtZTogcmVwb05hbWUsXG4gICAgICAgICAgd29ya2Zsb3dFeGlzdHMsXG4gICAgICAgICAgc3RlcDogJ2luc3RhbGwtYXBwJyxcbiAgICAgICAgfSkpXG4gICAgICAgIHNldFRpbWVvdXQob3BlbkdpdEh1YkFwcEluc3RhbGxhdGlvbiwgMClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXRlLnN0ZXAgPT09ICdpbnN0YWxsLWFwcCcpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pbnN0YWxsX2dpdGh1Yl9hcHBfc3RlcF9jb21wbGV0ZWQnLCB7XG4gICAgICAgIHN0ZXA6ICdpbnN0YWxsLWFwcCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG4gICAgICBpZiAoc3RhdGUud29ya2Zsb3dFeGlzdHMpIHtcbiAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnY2hlY2stZXhpc3Rpbmctd29ya2Zsb3cnIH0pKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnc2VsZWN0LXdvcmtmbG93cycgfSkpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5zdGVwID09PSAnY2hlY2stZXhpc3Rpbmctd29ya2Zsb3cnKSB7XG4gICAgICByZXR1cm5cbiAgICB9IGVsc2UgaWYgKHN0YXRlLnN0ZXAgPT09ICdzZWxlY3Qtd29ya2Zsb3dzJykge1xuICAgICAgLy8gSGFuZGxlZCBieSB0aGUgV29ya2Zsb3dNdWx0aXNlbGVjdERpYWxvZyBjb21wb25lbnRcbiAgICAgIHJldHVyblxuICAgIH0gZWxzZSBpZiAoc3RhdGUuc3RlcCA9PT0gJ2NoZWNrLWV4aXN0aW5nLXNlY3JldCcpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pbnN0YWxsX2dpdGh1Yl9hcHBfc3RlcF9jb21wbGV0ZWQnLCB7XG4gICAgICAgIHN0ZXA6ICdjaGVjay1leGlzdGluZy1zZWNyZXQnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgICAgaWYgKHN0YXRlLnVzZUV4aXN0aW5nU2VjcmV0KSB7XG4gICAgICAgIGF3YWl0IHJ1blNldHVwR2l0SHViQWN0aW9ucyhudWxsLCBzdGF0ZS5zZWNyZXROYW1lKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVXNlciB3YW50cyB0byB1c2UgYSBuZXcgc2VjcmV0IG5hbWUgd2l0aCB0aGVpciBBUEkga2V5XG4gICAgICAgIGF3YWl0IHJ1blNldHVwR2l0SHViQWN0aW9ucyhzdGF0ZS5hcGlLZXlPck9BdXRoVG9rZW4sIHN0YXRlLnNlY3JldE5hbWUpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5zdGVwID09PSAnYXBpLWtleScpIHtcbiAgICAgIC8vIEluIHRoZSBuZXcgZmxvdywgYXBpLWtleSBzdGVwIG9ubHkgYXBwZWFycyB3aGVuIHVzZXIgaGFzIG5vIGV4aXN0aW5nIGtleVxuICAgICAgLy8gVGhleSBlaXRoZXIgZW50ZXJlZCBhIG5ldyBrZXkgb3Igd2lsbCBjcmVhdGUgT0F1dGggdG9rZW5cbiAgICAgIGlmIChzdGF0ZS5zZWxlY3RlZEFwaUtleU9wdGlvbiA9PT0gJ29hdXRoJykge1xuICAgICAgICAvLyBPQXV0aCBmbG93IGFscmVhZHkgaGFuZGxlZCBieSBoYW5kbGVDcmVhdGVPQXV0aFRva2VuXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBJZiB1c2VyIHNlbGVjdGVkICdleGlzdGluZycgb3B0aW9uLCB1c2UgdGhlIGV4aXN0aW5nIEFQSSBrZXlcbiAgICAgIGNvbnN0IGFwaUtleVRvVXNlID1cbiAgICAgICAgc3RhdGUuc2VsZWN0ZWRBcGlLZXlPcHRpb24gPT09ICdleGlzdGluZydcbiAgICAgICAgICA/IGV4aXN0aW5nQXBpS2V5XG4gICAgICAgICAgOiBzdGF0ZS5hcGlLZXlPck9BdXRoVG9rZW5cblxuICAgICAgaWYgKCFhcGlLZXlUb1VzZSkge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX2Vycm9yJywge1xuICAgICAgICAgIHJlYXNvbjpcbiAgICAgICAgICAgICdhcGlfa2V5X21pc3NpbmcnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHN0ZXA6ICdlcnJvcicsXG4gICAgICAgICAgZXJyb3I6ICdBUEkga2V5IGlzIHJlcXVpcmVkJyxcbiAgICAgICAgfSkpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBTdG9yZSB0aGUgQVBJIGtleSBiZWluZyB1c2VkIChlaXRoZXIgZXhpc3Rpbmcgb3IgbmV3bHkgZW50ZXJlZClcbiAgICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgYXBpS2V5T3JPQXV0aFRva2VuOiBhcGlLZXlUb1VzZSxcbiAgICAgICAgdXNlRXhpc3RpbmdLZXk6IHN0YXRlLnNlbGVjdGVkQXBpS2V5T3B0aW9uID09PSAnZXhpc3RpbmcnLFxuICAgICAgfSkpXG5cbiAgICAgIC8vIENoZWNrIGlmIEFOVEhST1BJQ19BUElfS0VZIHNlY3JldCBhbHJlYWR5IGV4aXN0c1xuICAgICAgY29uc3QgY2hlY2tTZWNyZXRzUmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCdnaCcsIFtcbiAgICAgICAgJ3NlY3JldCcsXG4gICAgICAgICdsaXN0JyxcbiAgICAgICAgJy0tYXBwJyxcbiAgICAgICAgJ2FjdGlvbnMnLFxuICAgICAgICAnLS1yZXBvJyxcbiAgICAgICAgc3RhdGUuc2VsZWN0ZWRSZXBvTmFtZSxcbiAgICAgIF0pXG5cbiAgICAgIGlmIChjaGVja1NlY3JldHNSZXN1bHQuY29kZSA9PT0gMCkge1xuICAgICAgICBjb25zdCBsaW5lcyA9IGNoZWNrU2VjcmV0c1Jlc3VsdC5zdGRvdXQuc3BsaXQoJ1xcbicpXG4gICAgICAgIGNvbnN0IGhhc0FudGhyb3BpY0tleSA9IGxpbmVzLnNvbWUoKGxpbmU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiAvXkFOVEhST1BJQ19BUElfS0VZXFxzKy8udGVzdChsaW5lKVxuICAgICAgICB9KVxuXG4gICAgICAgIGlmIChoYXNBbnRocm9waWNLZXkpIHtcbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICAgICAgc3RlcDogJ2FwaS1rZXknIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgc2VjcmV0RXhpc3RzOiB0cnVlLFxuICAgICAgICAgICAgc3RlcDogJ2NoZWNrLWV4aXN0aW5nLXNlY3JldCcsXG4gICAgICAgICAgfSkpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2luc3RhbGxfZ2l0aHViX2FwcF9zdGVwX2NvbXBsZXRlZCcsIHtcbiAgICAgICAgICAgIHN0ZXA6ICdhcGkta2V5JyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLy8gTm8gZXhpc3Rpbmcgc2VjcmV0LCBwcm9jZWVkIHRvIGNyZWF0aW5nXG4gICAgICAgICAgYXdhaXQgcnVuU2V0dXBHaXRIdWJBY3Rpb25zKGFwaUtleVRvVXNlLCBzdGF0ZS5zZWNyZXROYW1lKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICAgIHN0ZXA6ICdhcGkta2V5JyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICB9KVxuICAgICAgICAvLyBFcnJvciBjaGVja2luZyBzZWNyZXRzLCBwcm9jZWVkIGFueXdheVxuICAgICAgICBhd2FpdCBydW5TZXR1cEdpdEh1YkFjdGlvbnMoYXBpS2V5VG9Vc2UsIHN0YXRlLnNlY3JldE5hbWUpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaGFuZGxlUmVwb1VybENoYW5nZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzZWxlY3RlZFJlcG9OYW1lOiB2YWx1ZSB9KSlcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZUFwaUtleUNoYW5nZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBhcGlLZXlPck9BdXRoVG9rZW46IHZhbHVlIH0pKVxuICB9XG5cbiAgY29uc3QgaGFuZGxlQXBpS2V5T3B0aW9uQ2hhbmdlID0gKG9wdGlvbjogJ2V4aXN0aW5nJyB8ICduZXcnIHwgJ29hdXRoJykgPT4ge1xuICAgIHNldFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgc2VsZWN0ZWRBcGlLZXlPcHRpb246IG9wdGlvbiB9KSlcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZUNyZWF0ZU9BdXRoVG9rZW4gPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2luc3RhbGxfZ2l0aHViX2FwcF9zdGVwX2NvbXBsZXRlZCcsIHtcbiAgICAgIHN0ZXA6ICdhcGkta2V5JyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG4gICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGVwOiAnb2F1dGgtZmxvdycgfSkpXG4gIH0sIFtdKVxuXG4gIGNvbnN0IGhhbmRsZU9BdXRoU3VjY2VzcyA9IHVzZUNhbGxiYWNrKFxuICAgICh0b2tlbjogc3RyaW5nKSA9PiB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX3N0ZXBfY29tcGxldGVkJywge1xuICAgICAgICBzdGVwOiAnb2F1dGgtZmxvdycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG4gICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgIC4uLnByZXYsXG4gICAgICAgIGFwaUtleU9yT0F1dGhUb2tlbjogdG9rZW4sXG4gICAgICAgIHVzZUV4aXN0aW5nS2V5OiBmYWxzZSxcbiAgICAgICAgc2VjcmV0TmFtZTogJ0NMQVVERV9DT0RFX09BVVRIX1RPS0VOJyxcbiAgICAgICAgYXV0aFR5cGU6ICdvYXV0aF90b2tlbicsXG4gICAgICB9KSlcbiAgICAgIHZvaWQgcnVuU2V0dXBHaXRIdWJBY3Rpb25zKHRva2VuLCAnQ0xBVURFX0NPREVfT0FVVEhfVE9LRU4nKVxuICAgIH0sXG4gICAgW3J1blNldHVwR2l0SHViQWN0aW9uc10sXG4gIClcblxuICBjb25zdCBoYW5kbGVPQXV0aENhbmNlbCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTdGF0ZShwcmV2ID0+ICh7IC4uLnByZXYsIHN0ZXA6ICdhcGkta2V5JyB9KSlcbiAgfSwgW10pXG5cbiAgY29uc3QgaGFuZGxlU2VjcmV0TmFtZUNoYW5nZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKHZhbHVlICYmICEvXlthLXpBLVowLTlfXSskLy50ZXN0KHZhbHVlKSkgcmV0dXJuXG4gICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzZWNyZXROYW1lOiB2YWx1ZSB9KSlcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZVVzZUN1cnJlbnRSZXBvID0gKHVzZUN1cnJlbnRSZXBvOiBib29sZWFuKSA9PiB7XG4gICAgc2V0U3RhdGUocHJldiA9PiAoe1xuICAgICAgLi4ucHJldixcbiAgICAgIHVzZUN1cnJlbnRSZXBvLFxuICAgICAgc2VsZWN0ZWRSZXBvTmFtZTogdXNlQ3VycmVudFJlcG8gPyBwcmV2LmN1cnJlbnRSZXBvIDogJycsXG4gICAgfSkpXG4gIH1cblxuICBjb25zdCBoYW5kbGVUb2dnbGVVc2VFeGlzdGluZ0tleSA9ICh1c2VFeGlzdGluZ0tleTogYm9vbGVhbikgPT4ge1xuICAgIHNldFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgdXNlRXhpc3RpbmdLZXkgfSkpXG4gIH1cblxuICBjb25zdCBoYW5kbGVUb2dnbGVVc2VFeGlzdGluZ1NlY3JldCA9ICh1c2VFeGlzdGluZ1NlY3JldDogYm9vbGVhbikgPT4ge1xuICAgIHNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICB1c2VFeGlzdGluZ1NlY3JldCxcbiAgICAgIHNlY3JldE5hbWU6IHVzZUV4aXN0aW5nU2VjcmV0ID8gJ0FOVEhST1BJQ19BUElfS0VZJyA6ICcnLFxuICAgIH0pKVxuICB9XG5cbiAgY29uc3QgaGFuZGxlV29ya2Zsb3dBY3Rpb24gPSBhc3luYyAoYWN0aW9uOiAndXBkYXRlJyB8ICdza2lwJyB8ICdleGl0JykgPT4ge1xuICAgIGlmIChhY3Rpb24gPT09ICdleGl0Jykge1xuICAgICAgcHJvcHMub25Eb25lKCdJbnN0YWxsYXRpb24gY2FuY2VsbGVkIGJ5IHVzZXInKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2luc3RhbGxfZ2l0aHViX2FwcF9zdGVwX2NvbXBsZXRlZCcsIHtcbiAgICAgIHN0ZXA6ICdjaGVjay1leGlzdGluZy13b3JrZmxvdycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICB9KVxuXG4gICAgc2V0U3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCB3b3JrZmxvd0FjdGlvbjogYWN0aW9uIH0pKVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gJ3NraXAnIHx8IGFjdGlvbiA9PT0gJ3VwZGF0ZScpIHtcbiAgICAgIC8vIENoZWNrIGlmIHVzZXIgaGFzIGV4aXN0aW5nIGxvY2FsIEFQSSBrZXlcbiAgICAgIGlmIChleGlzdGluZ0FwaUtleSkge1xuICAgICAgICBhd2FpdCBjaGVja0V4aXN0aW5nU2VjcmV0KClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGxvY2FsIGtleSwgZ28gc3RyYWlnaHQgdG8gQVBJIGtleSBzdGVwXG4gICAgICAgIHNldFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgc3RlcDogJ2FwaS1rZXknIH0pKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZURpc21pc3NLZXlEb3duKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBpZiAoc3RhdGUuc3RlcCA9PT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfaW5zdGFsbF9naXRodWJfYXBwX2NvbXBsZXRlZCcsIHt9KVxuICAgIH1cbiAgICBwcm9wcy5vbkRvbmUoXG4gICAgICBzdGF0ZS5zdGVwID09PSAnc3VjY2VzcydcbiAgICAgICAgPyAnR2l0SHViIEFjdGlvbnMgc2V0dXAgY29tcGxldGUhJ1xuICAgICAgICA6IHN0YXRlLmVycm9yXG4gICAgICAgICAgPyBgQ291bGRuJ3QgaW5zdGFsbCBHaXRIdWIgQXBwOiAke3N0YXRlLmVycm9yfVxcbkZvciBtYW51YWwgc2V0dXAgaW5zdHJ1Y3Rpb25zLCBzZWU6ICR7R0lUSFVCX0FDVElPTl9TRVRVUF9ET0NTX1VSTH1gXG4gICAgICAgICAgOiBgR2l0SHViIEFwcCBpbnN0YWxsYXRpb24gZmFpbGVkXFxuRm9yIG1hbnVhbCBzZXR1cCBpbnN0cnVjdGlvbnMsIHNlZTogJHtHSVRIVUJfQUNUSU9OX1NFVFVQX0RPQ1NfVVJMfWAsXG4gICAgKVxuICB9XG5cbiAgc3dpdGNoIChzdGF0ZS5zdGVwKSB7XG4gICAgY2FzZSAnY2hlY2stZ2gnOlxuICAgICAgcmV0dXJuIDxDaGVja0dpdEh1YlN0ZXAgLz5cbiAgICBjYXNlICd3YXJuaW5ncyc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8V2FybmluZ3NTdGVwIHdhcm5pbmdzPXtzdGF0ZS53YXJuaW5nc30gb25Db250aW51ZT17aGFuZGxlU3VibWl0fSAvPlxuICAgICAgKVxuICAgIGNhc2UgJ2Nob29zZS1yZXBvJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxDaG9vc2VSZXBvU3RlcFxuICAgICAgICAgIGN1cnJlbnRSZXBvPXtzdGF0ZS5jdXJyZW50UmVwb31cbiAgICAgICAgICB1c2VDdXJyZW50UmVwbz17c3RhdGUudXNlQ3VycmVudFJlcG99XG4gICAgICAgICAgcmVwb1VybD17c3RhdGUuc2VsZWN0ZWRSZXBvTmFtZX1cbiAgICAgICAgICBvblJlcG9VcmxDaGFuZ2U9e2hhbmRsZVJlcG9VcmxDaGFuZ2V9XG4gICAgICAgICAgb25Ub2dnbGVVc2VDdXJyZW50UmVwbz17aGFuZGxlVG9nZ2xlVXNlQ3VycmVudFJlcG99XG4gICAgICAgICAgb25TdWJtaXQ9e2hhbmRsZVN1Ym1pdH1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdpbnN0YWxsLWFwcCc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8SW5zdGFsbEFwcFN0ZXBcbiAgICAgICAgICByZXBvVXJsPXtzdGF0ZS5zZWxlY3RlZFJlcG9OYW1lfVxuICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgY2FzZSAnY2hlY2stZXhpc3Rpbmctd29ya2Zsb3cnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEV4aXN0aW5nV29ya2Zsb3dTdGVwXG4gICAgICAgICAgcmVwb05hbWU9e3N0YXRlLnNlbGVjdGVkUmVwb05hbWV9XG4gICAgICAgICAgb25TZWxlY3RBY3Rpb249e2hhbmRsZVdvcmtmbG93QWN0aW9ufVxuICAgICAgICAvPlxuICAgICAgKVxuICAgIGNhc2UgJ2NoZWNrLWV4aXN0aW5nLXNlY3JldCc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Q2hlY2tFeGlzdGluZ1NlY3JldFN0ZXBcbiAgICAgICAgICB1c2VFeGlzdGluZ1NlY3JldD17c3RhdGUudXNlRXhpc3RpbmdTZWNyZXR9XG4gICAgICAgICAgc2VjcmV0TmFtZT17c3RhdGUuc2VjcmV0TmFtZX1cbiAgICAgICAgICBvblRvZ2dsZVVzZUV4aXN0aW5nU2VjcmV0PXtoYW5kbGVUb2dnbGVVc2VFeGlzdGluZ1NlY3JldH1cbiAgICAgICAgICBvblNlY3JldE5hbWVDaGFuZ2U9e2hhbmRsZVNlY3JldE5hbWVDaGFuZ2V9XG4gICAgICAgICAgb25TdWJtaXQ9e2hhbmRsZVN1Ym1pdH1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdhcGkta2V5JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxBcGlLZXlTdGVwXG4gICAgICAgICAgZXhpc3RpbmdBcGlLZXk9e2V4aXN0aW5nQXBpS2V5fVxuICAgICAgICAgIHVzZUV4aXN0aW5nS2V5PXtzdGF0ZS51c2VFeGlzdGluZ0tleX1cbiAgICAgICAgICBhcGlLZXlPck9BdXRoVG9rZW49e3N0YXRlLmFwaUtleU9yT0F1dGhUb2tlbn1cbiAgICAgICAgICBvbkFwaUtleUNoYW5nZT17aGFuZGxlQXBpS2V5Q2hhbmdlfVxuICAgICAgICAgIG9uVG9nZ2xlVXNlRXhpc3RpbmdLZXk9e2hhbmRsZVRvZ2dsZVVzZUV4aXN0aW5nS2V5fVxuICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVTdWJtaXR9XG4gICAgICAgICAgb25DcmVhdGVPQXV0aFRva2VuPXtcbiAgICAgICAgICAgIGlzQW50aHJvcGljQXV0aEVuYWJsZWQoKSA/IGhhbmRsZUNyZWF0ZU9BdXRoVG9rZW4gOiB1bmRlZmluZWRcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZWN0ZWRPcHRpb249e3N0YXRlLnNlbGVjdGVkQXBpS2V5T3B0aW9ufVxuICAgICAgICAgIG9uU2VsZWN0T3B0aW9uPXtoYW5kbGVBcGlLZXlPcHRpb25DaGFuZ2V9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgY2FzZSAnY3JlYXRpbmcnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPENyZWF0aW5nU3RlcFxuICAgICAgICAgIGN1cnJlbnRXb3JrZmxvd0luc3RhbGxTdGVwPXtzdGF0ZS5jdXJyZW50V29ya2Zsb3dJbnN0YWxsU3RlcH1cbiAgICAgICAgICBzZWNyZXRFeGlzdHM9e3N0YXRlLnNlY3JldEV4aXN0c31cbiAgICAgICAgICB1c2VFeGlzdGluZ1NlY3JldD17c3RhdGUudXNlRXhpc3RpbmdTZWNyZXR9XG4gICAgICAgICAgc2VjcmV0TmFtZT17c3RhdGUuc2VjcmV0TmFtZX1cbiAgICAgICAgICBza2lwV29ya2Zsb3c9e3N0YXRlLndvcmtmbG93QWN0aW9uID09PSAnc2tpcCd9XG4gICAgICAgICAgc2VsZWN0ZWRXb3JrZmxvd3M9e3N0YXRlLnNlbGVjdGVkV29ya2Zsb3dzfVxuICAgICAgICAvPlxuICAgICAgKVxuICAgIGNhc2UgJ3N1Y2Nlc3MnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCB0YWJJbmRleD17MH0gYXV0b0ZvY3VzIG9uS2V5RG93bj17aGFuZGxlRGlzbWlzc0tleURvd259PlxuICAgICAgICAgIDxTdWNjZXNzU3RlcFxuICAgICAgICAgICAgc2VjcmV0RXhpc3RzPXtzdGF0ZS5zZWNyZXRFeGlzdHN9XG4gICAgICAgICAgICB1c2VFeGlzdGluZ1NlY3JldD17c3RhdGUudXNlRXhpc3RpbmdTZWNyZXR9XG4gICAgICAgICAgICBzZWNyZXROYW1lPXtzdGF0ZS5zZWNyZXROYW1lfVxuICAgICAgICAgICAgc2tpcFdvcmtmbG93PXtzdGF0ZS53b3JrZmxvd0FjdGlvbiA9PT0gJ3NraXAnfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3ggdGFiSW5kZXg9ezB9IGF1dG9Gb2N1cyBvbktleURvd249e2hhbmRsZURpc21pc3NLZXlEb3dufT5cbiAgICAgICAgICA8RXJyb3JTdGVwXG4gICAgICAgICAgICBlcnJvcj17c3RhdGUuZXJyb3J9XG4gICAgICAgICAgICBlcnJvclJlYXNvbj17c3RhdGUuZXJyb3JSZWFzb259XG4gICAgICAgICAgICBlcnJvckluc3RydWN0aW9ucz17c3RhdGUuZXJyb3JJbnN0cnVjdGlvbnN9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApXG4gICAgY2FzZSAnc2VsZWN0LXdvcmtmbG93cyc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8V29ya2Zsb3dNdWx0aXNlbGVjdERpYWxvZ1xuICAgICAgICAgIGRlZmF1bHRTZWxlY3Rpb25zPXtzdGF0ZS5zZWxlY3RlZFdvcmtmbG93c31cbiAgICAgICAgICBvblN1Ym1pdD17c2VsZWN0ZWRXb3JrZmxvd3MgPT4ge1xuICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2luc3RhbGxfZ2l0aHViX2FwcF9zdGVwX2NvbXBsZXRlZCcsIHtcbiAgICAgICAgICAgICAgc3RlcDogJ3NlbGVjdC13b3JrZmxvd3MnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgc2V0U3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICBzZWxlY3RlZFdvcmtmbG93cyxcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdXNlciBoYXMgZXhpc3RpbmcgbG9jYWwgQVBJIGtleVxuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQXBpS2V5KSB7XG4gICAgICAgICAgICAgIHZvaWQgY2hlY2tFeGlzdGluZ1NlY3JldCgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBObyBsb2NhbCBrZXksIGdvIHN0cmFpZ2h0IHRvIEFQSSBrZXkgc3RlcFxuICAgICAgICAgICAgICBzZXRTdGF0ZShwcmV2ID0+ICh7IC4uLnByZXYsIHN0ZXA6ICdhcGkta2V5JyB9KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9fVxuICAgICAgICAvPlxuICAgICAgKVxuICAgIGNhc2UgJ29hdXRoLWZsb3cnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPE9BdXRoRmxvd1N0ZXBcbiAgICAgICAgICBvblN1Y2Nlc3M9e2hhbmRsZU9BdXRoU3VjY2Vzc31cbiAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlT0F1dGhDYW5jZWx9XG4gICAgICAgIC8+XG4gICAgICApXG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGwoXG4gIG9uRG9uZTogTG9jYWxKU1hDb21tYW5kT25Eb25lLFxuKTogUHJvbWlzZTxSZWFjdC5SZWFjdE5vZGU+IHtcbiAgcmV0dXJuIDxJbnN0YWxsR2l0SHViQXBwIG9uRG9uZT17b25Eb25lfSAvPlxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTQSxLQUFLLFFBQVEsT0FBTztBQUM3QixPQUFPQyxLQUFLLElBQUlDLFdBQVcsRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDcEQsU0FDRSxLQUFLQywwREFBMEQsRUFDL0RDLFFBQVEsUUFDSCxpQ0FBaUM7QUFDeEMsU0FBU0MseUJBQXlCLFFBQVEsK0NBQStDO0FBQ3pGLFNBQVNDLDRCQUE0QixRQUFRLCtCQUErQjtBQUM1RSxT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O0FBRTFELFFBQVEsRUFBRSxHQUFHLENBQUM7SUFFVixLQUFLLE9BQU87TUFDVixPQUNFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQytDLG9CQUFvQixDQUFDO0FBQ3BFLFVBQVUsQ0FBQyxTQUFTLENBQ1IsS0FBSyxDQUFDLENBQUN4RSxLQUFLLENBQUNvQixLQUFLLENBQUMsQ0FDbkIsV0FBVyxDQUFDLENBQUNwQixLQUFLLENBQUNzQixXQUFXLENBQUMsQ0FDL0IsaUJBQWlCLENBQUMsQ0FBQ3RCLEtBQUssQ0FBQ3VCLGlCQUFpQixDQUFDO0FBRXZELFFBQVEsRUFBRSxHQUFHLENBQUM7SUFFVixLQUFLLGtCQUFrQjtNQUNyQixPQUNFLENBQUMseUJBQXlCLENBQ3hCLGlCQUFpQixDQUFDLENBQUN2QixLQUFLLENBQUNULGlCQUFpQixDQUFDLENBQzNDLFFBQVEsQ0FBQyxDQUFDQSxpQkFBaUIsSUFBSTtRQUM3QnpDLFFBQVEsQ0FBQyx5Q0FBeUMsRUFBRTtVQUNsRDZCLElBQUksRUFBRSxrQkFBa0IsSUFBSTlCO1FBQzlCLENBQUMsQ0FBQztRQUNGb0QsUUFBUSxDQUFDa0IsT0FBSSxLQUFLO1VBQ2hCLEdBQUdBLE9BQUk7VUFDUDVCO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSDtRQUNBLElBQUlRLGNBQWMsRUFBRTtVQUNsQixLQUFLMkMsbUJBQW1CLENBQUMsQ0FBQztRQUM1QixDQUFDLE1BQU07VUFDTDtVQUNBekMsUUFBUSxDQUFDa0IsT0FBSSxLQUFLO1lBQUUsR0FBR0EsT0FBSTtZQUFFeEMsSUFBSSxFQUFFO1VBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEQ7TUFDRixDQUFDLENBQUMsR0FDRjtJQUVOLEtBQUssWUFBWTtNQUNmLE9BQ0UsQ0FBQyxhQUFhLENBQ1osU0FBUyxDQUFDLENBQUNvRixrQkFBa0IsQ0FBQyxDQUM5QixRQUFRLENBQUMsQ0FBQ0UsaUJBQWlCLENBQUMsR0FDNUI7RUFFUjtBQUNGO0FBRUEsT0FBTyxlQUFlVyxJQUFJQSxDQUN4QmhGLE1BQU0sRUFBRXhDLHFCQUFxQixDQUM5QixFQUFFNkUsT0FBTyxDQUFDdkYsS0FBSyxDQUFDb0QsU0FBUyxDQUFDLENBQUM7RUFDMUIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDRixNQUFNLENBQUMsR0FBRztBQUM3QyIsImlnbm9yZUxpc3QiOltdfQ==