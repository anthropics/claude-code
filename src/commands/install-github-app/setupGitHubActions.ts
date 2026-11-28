import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { saveGlobalConfig } from 'src/utils/config.js'
import {
  CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT,
  PR_BODY,
  PR_TITLE,
  WORKFLOW_CONTENT,
} from '../../constants/github-app.js'
import { openBrowser } from '../../utils/browser.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'
import { logError } from '../../utils/log.js'
import type { Workflow } from './types.js'

async function createWorkflowFile(
  repoName: string,
  branchName: string,
  workflowPath: string,
  workflowContent: string,
  secretName: string,
  message: string,
  context?: {
    useCurrentRepo?: boolean
    workflowExists?: boolean
    secretExists?: boolean
  },
): Promise<void> {
  // Check if workflow file already exists
  const checkFileResult = await execFileNoThrow('gh', [
    'api',
    `repos/${repoName}/contents/${workflowPath}`,
    '--jq',
    '.sha',
  ])

  let fileSha: string | null = null
  if (checkFileResult.code === 0) {
    fileSha = checkFileResult.stdout.trim()
  }

  let content = workflowContent
  if (secretName === 'CLAUDE_CODE_OAUTH_TOKEN') {
    // For OAuth tokens, use the claude_code_oauth_token parameter
    content = workflowContent.replace(
      /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/g,
      `claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`,
    )
  } else if (secretName !== 'ANTHROPIC_API_KEY') {
    // For other custom secret names, keep using anthropic_api_key parameter
    content = workflowContent.replace(
      /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/g,
      `anthropic_api_key: \${{ secrets.${secretName} }}`,
    )
  }
  const base64Content = Buffer.from(content).toString('base64')

  const apiParams = [
    'api',
    '--method',
    'PUT',
    `repos/${repoName}/contents/${workflowPath}`,
    '-f',
    `message=${fileSha ? `"Update ${message}"` : `"${message}"`}`,
    '-f',
    `content=${base64Content}`,
    '-f',
    `branch=${branchName}`,
  ]

  if (fileSha) {
    apiParams.push('-f', `sha=${fileSha}`)
  }

  const createFileResult = await execFileNoThrow('gh', apiParams)
  if (createFileResult.code !== 0) {
    if (
      createFileResult.stderr.includes('422') &&
      createFileResult.stderr.includes('sha')
    ) {
      logEvent('tengu_setup_github_actions_failed', {
        reason:
          'failed_to_create_workflow_file' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        exit_code: createFileResult.code,
        ...context,
      })
      throw new Error(
        `Failed to create workflow file ${workflowPath}: A Claude workflow file already exists in this repository. Please remove it first or update it manually.`,
      )
    }

    logEvent('tengu_setup_github_actions_failed', {
      reason:
        'failed_to_create_workflow_file' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      exit_code: createFileResult.code,
      ...context,
    })

    const helpText =
      '\n\nNeed help? Common issues:\n' +
      '· Permission denied → Run: gh auth refresh -h github.com -s repo,workflow\n' +
      '· Not authorized → Ensure you have admin access to the repository\n' +
      '· For manual setup → Visit: https://github.com/anthropics/claude-code-action'

    throw new Error(
      `Failed to create workflow file ${workflowPath}: ${createFileResult.stderr}${helpText}`,
    )
  }
}

export async function setupGitHubActions(
  repoName: string,
  apiKeyOrOAuthToken: string | null,
  secretName: string,
  updateProgress: () => void,
  skipWorkflow = false,
  selectedWorkflows: Workflow[],
  authType: 'api_key' | 'oauth_token',
  context?: {
    useCurrentRepo?: boolean
    workflowExists?: boolean
    secretExists?: boolean
  },
) {
  try {
    logEvent('tengu_setup_github_actions_started', {
      skip_workflow: skipWorkflow,
      has_api_key: !!apiKeyOrOAuthToken,
      using_default_secret_name: secretName === 'ANTHROPIC_API_KEY',
      selected_claude_workflow: selectedWorkflows.includes('claude'),
      selected_claude_review_workflow:
        selectedWorkflows.includes('claude-review'),
      ...context,
    })

    // Check if repository exists
    const repoCheckResult = await execFileNoThrow('gh', [
      'api',
      `repos/${repoName}`,
      '--jq',
      '.id',
    ])
    if (repoCheckResult.code !== 0) {
      logEvent('tengu_setup_github_actions_failed', {
        reason:
          'repo_not_found' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        exit_code: repoCheckResult.code,
        ...context,
      })
      throw new Error(
        `Failed to access repository ${repoName}: ${repoCheckResult.stderr}`,
      )
    }

    // Get default branch
    const defaultBranchResult = await execFileNoThrow('gh', [
      'api',
      `repos/${repoName}`,
      '--jq',
      '.default_branch',
    ])
    if (defaultBranchResult.code !== 0) {
      logEvent('tengu_setup_github_actions_failed', {
        reason:
          'failed_to_get_default_branch' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        exit_code: defaultBranchResult.code,
        ...context,
      })
      throw new Error(
        `Failed to get default branch: ${defaultBranchResult.stderr}`,
      )
    }
    const defaultBranch = defaultBranchResult.stdout.trim()

    // Get SHA of default branch
    const shaResult = await execFileNoThrow('gh', [
      'api',
      `repos/${repoName}/git/ref/heads/${defaultBranch}`,
      '--jq',
      '.object.sha',
    ])
    if (shaResult.code !== 0) {
      logEvent('tengu_setup_github_actions_failed', {
        reason:
          'failed_to_get_branch_sha' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        exit_code: shaResult.code,
        ...context,
      })
      throw new Error(`Failed to get branch SHA: ${shaResult.stderr}`)
    }
    const sha = shaResult.stdout.trim()

    let branchName: string | null = null

    if (!skipWorkflow) {
      updateProgress()
      // Create new branch
      branchName = `add-claude-github-actions-${Date.now()}`
      const createBranchResult = await execFileNoThrow('gh', [
        'api',
        '--method',
        'POST',
        `repos/${repoName}/git/refs`,
        '-f',
        `ref=refs/heads/${branchName}`,
        '-f',
        `sha=${sha}`,
      ])
      if (createBranchResult.code !== 0) {
        logEvent('tengu_setup_github_actions_failed', {
          reason:
            'failed_to_create_branch' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          exit_code: createBranchResult.code,
          ...context,
        })
        throw new Error(`Failed to create branch: ${createBranchResult.stderr}`)
      }

      updateProgress()
      // Create selected workflow files
      const workflows = []

      if (selectedWorkflows.includes('claude')) {
        workflows.push({
          path: '.github/workflows/claude.yml',
          content: WORKFLOW_CONTENT,
          message: 'Claude PR Assistant workflow',
        })
      }

      if (selectedWorkflows.includes('claude-review')) {
        workflows.push({
          path: '.github/workflows/claude-code-review.yml',
          content: CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT,
          message: 'Claude Code Review workflow',
        })
      }

      for (const workflow of workflows) {
        await createWorkflowFile(
          repoName,
          branchName,
          workflow.path,
          workflow.content,
          secretName,
          workflow.message,
          context,
        )
      }
    }

    updateProgress()
    // Set the API key as a secret if provided
    if (apiKeyOrOAuthToken) {
      const setSecretResult = await execFileNoThrow('gh', [
        'secret',
        'set',
        secretName,
        '--body',
        apiKeyOrOAuthToken,
        '--repo',
        repoName,
      ])
      if (setSecretResult.code !== 0) {
        logEvent('tengu_setup_github_actions_failed', {
          reason:
            'failed_to_set_api_key_secret' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          exit_code: setSecretResult.code,
          ...context,
        })

        const helpText =
          '\n\nNeed help? Common issues:\n' +
          '· Permission denied → Run: gh auth refresh -h github.com -s repo\n' +
          '· Not authorized → Ensure you have admin access to the repository\n' +
          '· For manual setup → Visit: https://github.com/anthropics/claude-code-action'

        throw new Error(
          `Failed to set API key secret: ${setSecretResult.stderr || 'Unknown error'}${helpText}`,
        )
      }
    }

    if (!skipWorkflow && branchName) {
      updateProgress()
      // Create PR template URL instead of creating PR directly
      const compareUrl = `https://github.com/${repoName}/compare/${defaultBranch}...${branchName}?quick_pull=1&title=${encodeURIComponent(PR_TITLE)}&body=${encodeURIComponent(PR_BODY)}`

      await openBrowser(compareUrl)
    }

    logEvent('tengu_setup_github_actions_completed', {
      skip_workflow: skipWorkflow,
      has_api_key: !!apiKeyOrOAuthToken,
      auth_type:
        authType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      using_default_secret_name: secretName === 'ANTHROPIC_API_KEY',
      selected_claude_workflow: selectedWorkflows.includes('claude'),
      selected_claude_review_workflow:
        selectedWorkflows.includes('claude-review'),
      ...context,
    })
    saveGlobalConfig(current => ({
      ...current,
      githubActionSetupCount: (current.githubActionSetupCount ?? 0) + 1,
    }))
  } catch (error) {
    if (
      !error ||
      !(error instanceof Error) ||
      !error.message.includes('Failed to')
    ) {
      logEvent('tengu_setup_github_actions_failed', {
        reason:
          'unexpected_error' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ...context,
      })
    }
    if (error instanceof Error) {
      logError(error)
    }
    throw error
  }
}
