import axios from 'axios';
import chalk from 'chalk';
import { randomUUID } from 'crypto';
import React from 'react';
import { getOriginalCwd, getSessionId } from 'src/bootstrap/state.js';
import { checkGate_CACHED_OR_BLOCKING } from 'src/services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { isPolicyAllowed } from 'src/services/policyLimits/index.js';
import { z } from 'zod/v4';
import { getTeleportErrors, TeleportError, type TeleportLocalErrorType } from '../components/TeleportError.js';
import { getOauthConfig } from '../constants/oauth.js';
import type { SDKMessage } from '../entrypoints/agentSdkTypes.js';
import type { Root } from '../ink.js';
import { KeybindingSetup } from '../keybindings/KeybindingProviderSetup.js';
import { queryHaiku } from '../services/api/claude.js';
import { getSessionLogsViaOAuth, getTeleportEvents } from '../services/api/sessionIngress.js';
import { getOrganizationUUID } from '../services/oauth/client.js';
import { AppStateProvider } from '../state/AppState.js';
import type { Message, SystemMessage } from '../types/message.js';
import type { PermissionMode } from '../types/permissions.js';
import { checkAndRefreshOAuthTokenIfNeeded, getClaudeAIOAuthTokens } from './auth.js';
import { checkGithubAppInstalled } from './background/remote/preconditions.js';
import { deserializeMessages, type TeleportRemoteResponse } from './conversationRecovery.js';
import { getCwd } from './cwd.js';
import { logForDebugging } from './debug.js';
import { detectCurrentRepositoryWithHost, parseGitHubRepository, parseGitRemote } from './detectRepository.js';
import { isEnvTruthy } from './envUtils.js';
import { TeleportOperationError, toError } from './errors.js';
import { execFileNoThrow } from './execFileNoThrow.js';
import { truncateToWidth } from './format.js';
import { findGitRoot, getDefaultBranch, getIsClean, gitExe } from './git.js';
import { safeParseJSON } from './json.js';
import { logError } from './log.js';
import { createSystemMessage, createUserMessage } from './messages.js';
import { getMainLoopModel } from './model/model.js';
import { isTranscriptMessage } from './sessionStorage.js';
import { getSettings_DEPRECATED } from './settings/settings.js';
import { jsonStringify } from './slowOperations.js';
import { asSystemPrompt } from './systemPromptType.js';
import { fetchSession, type GitRepositoryOutcome, type GitSource, getBranchFromSession, getOAuthHeaders, type SessionResource } from './teleport/api.js';
import { fetchEnvironments } from './teleport/environments.js';
import { createAndUploadGitBundle } from './teleport/gitBundle.js';
export type TeleportResult = {
  messages: Message[];
  branchName: string;
};
export type TeleportProgressStep = 'validating' | 'fetching_logs' | 'fetching_branch' | 'checking_out' | 'done';
export type TeleportProgressCallback = (step: TeleportProgressStep) => void;

/**
 * Creates a system message to inform about teleport session resume
 * @returns SystemMessage indicating session was resumed from another machine
 */
function createTeleportResumeSystemMessage(branchError: Error | null): SystemMessage {
  if (branchError === null) {
    return createSystemMessage('Session resumed', 'suggestion');
  }
  const formattedError = branchError instanceof TeleportOperationError ? branchError.formattedMessage : branchError.message;
  return createSystemMessage(`Session resumed without branch: ${formattedError}`, 'warning');
}

/**
 * Creates a user message to inform the model about teleport session resume
 * @returns User message indicating session was resumed from another machine
 */
function createTeleportResumeUserMessage() {
  return createUserMessage({
    content: `This session is being continued from another machine. Application state may have changed. The updated working directory is ${getOriginalCwd()}`,
    isMeta: true
  });
}
type TeleportToRemoteResponse = {
  id: string;
  title: string;
};
const SESSION_TITLE_AND_BRANCH_PROMPT = `You are coming up with a succinct title and git branch name for a coding session based on the provided description. The title should be clear, concise, and accurately reflect the content of the coding task.
You should keep it short and simple, ideally no more than 6 words. Avoid using jargon or overly technical terms unless absolutely necessary. The title should be easy to understand for anyone reading it.
Use sentence case for the title (capitalize only the first word and proper nouns), not Title Case.

The branch name should be clear, concise, and accurately reflect the content of the coding task.
You should keep it short and simple, ideally no more than 4 words. The branch should always start with "claude/" and should be all lower case, with words separated by dashes.

Return a JSON object with "title" and "branch" fields.

Example 1: {"title": "Fix login button not working on mobile", "branch": "claude/fix-mobile-login-button"}
Example 2: {"title": "Update README with installation instructions", "branch": "claude/update-readme"}
Example 3: {"title": "Improve performance of data processing script", "branch": "claude/improve-data-processing"}

Here is the session description:
<description>{description}</description>
Please generate a title and branch name for this session.`;
type TitleAndBranch = {
  title: string;
  branchName: string;
};

/**
 * Generates a title and branch name for a coding session using Claude Haiku
 * @param description The description/prompt for the session
 * @returns Promise<TitleAndBranch> The generated title and branch name
 */
async function generateTitleAndBranch(description: string, signal: AbortSignal): Promise<TitleAndBranch> {
  const fallbackTitle = truncateToWidth(description, 75);
  const fallbackBranch = 'claude/task';
  try {
    const userPrompt = SESSION_TITLE_AND_BRANCH_PROMPT.replace('{description}', description);
    const response = await queryHaiku({
      systemPrompt: asSystemPrompt([]),
      userPrompt,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string'
            },
            branch: {
              type: 'string'
            }
          },
          required: ['title', 'branch'],
          additionalProperties: false
        }
      },
      signal,
      options: {
        querySource: 'teleport_generate_title',
        agents: [],
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        mcpTools: []
      }
    });

    // Extract text from the response
    const firstBlock = response.message.content[0];
    if (firstBlock?.type !== 'text') {
      return {
        title: fallbackTitle,
        branchName: fallbackBranch
      };
    }
    const parsed = safeParseJSON(firstBlock.text.trim());
    const parseResult = z.object({
      title: z.string(),
      branch: z.string()
    }).safeParse(parsed);
    if (parseResult.success) {
      return {
        title: parseResult.data.title || fallbackTitle,
        branchName: parseResult.data.branch || fallbackBranch
      };
    }
    return {
      title: fallbackTitle,
      branchName: fallbackBranch
    };
  } catch (error) {
    logError(new Error(`Error generating title and branch: ${error}`));
    return {
      title: fallbackTitle,
      branchName: fallbackBranch
    };
  }
}

/**
 * Validates that the git working directory is clean (ignoring untracked files)
 * Untracked files are ignored because they won't be lost during branch switching
 */
export async function validateGitState(): Promise<void> {
  const isClean = await getIsClean({
    ignoreUntracked: true
  });
  if (!isClean) {
    logEvent('tengu_teleport_error_git_not_clean', {});
    const error = new TeleportOperationError('Git working directory is not clean. Please commit or stash your changes before using --teleport.', chalk.red('Error: Git working directory is not clean. Please commit or stash your changes before using --teleport.\n'));
    throw error;
  }
}

/**
 * Fetches a specific branch from remote origin
 * @param branch The branch to fetch. If not specified, fetches all branches.
 */
async function fetchFromOrigin(branch?: string): Promise<void> {
  const fetchArgs = branch ? ['fetch', 'origin', `${branch}:${branch}`] : ['fetch', 'origin'];
  const {
    code: fetchCode,
    stderr: fetchStderr
  } = await execFileNoThrow(gitExe(), fetchArgs);
  if (fetchCode !== 0) {
    // If fetching a specific branch fails, it might not exist locally yet
    // Try fetching just the ref without mapping to local branch
    if (branch && fetchStderr.includes('refspec')) {
      logForDebugging(`Specific branch fetch failed, trying to fetch ref: ${branch}`);
      const {
        code: refFetchCode,
        stderr: refFetchStderr
      } = await execFileNoThrow(gitExe(), ['fetch', 'origin', branch]);
      if (refFetchCode !== 0) {
        logError(new Error(`Failed to fetch from remote origin: ${refFetchStderr}`));
      }
    } else {
      logError(new Error(`Failed to fetch from remote origin: ${fetchStderr}`));
    }
  }
}

/**
 * Ensures that the current branch has an upstream set
 * If not, sets it to origin/<branchName> if that remote branch exists
 */
async function ensureUpstreamIsSet(branchName: string): Promise<void> {
  // Check if upstream is already set
  const {
    code: upstreamCheckCode
  } = await execFileNoThrow(gitExe(), ['rev-parse', '--abbrev-ref', `${branchName}@{upstream}`]);
  if (upstreamCheckCode === 0) {
    // Upstream is already set
    logForDebugging(`Branch '${branchName}' already has upstream set`);
    return;
  }

  // Check if origin/<branchName> exists
  const {
    code: remoteCheckCode
  } = await execFileNoThrow(gitExe(), ['rev-parse', '--verify', `origin/${branchName}`]);
  if (remoteCheckCode === 0) {
    // Remote branch exists, set upstream
    logForDebugging(`Setting upstream for '${branchName}' to 'origin/${branchName}'`);
    const {
      code: setUpstreamCode,
      stderr: setUpstreamStderr
    } = await execFileNoThrow(gitExe(), ['branch', '--set-upstream-to', `origin/${branchName}`, branchName]);
    if (setUpstreamCode !== 0) {
      logForDebugging(`Failed to set upstream for '${branchName}': ${setUpstreamStderr}`);
      // Don't throw, just log - this is not critical
    } else {
      logForDebugging(`Successfully set upstream for '${branchName}'`);
    }
  } else {
    logForDebugging(`Remote branch 'origin/${branchName}' does not exist, skipping upstream setup`);
  }
}

/**
 * Checks out a specific branch
 */
async function checkoutBranch(branchName: string): Promise<void> {
  // First try to checkout the branch as-is (might be local)
  let {
    code: checkoutCode,
    stderr: checkoutStderr
  } = await execFileNoThrow(gitExe(), ['checkout', branchName]);

  // If that fails, try to checkout from origin
  if (checkoutCode !== 0) {
    logForDebugging(`Local checkout failed, trying to checkout from origin: ${checkoutStderr}`);

    // Try to checkout the remote branch and create a local tracking branch
    const result = await execFileNoThrow(gitExe(), ['checkout', '-b', branchName, '--track', `origin/${branchName}`]);
    checkoutCode = result.code;
    checkoutStderr = result.stderr;

    // If that also fails, try without -b in case the branch exists but isn't checked out
    if (checkoutCode !== 0) {
      logForDebugging(`Remote checkout with -b failed, trying without -b: ${checkoutStderr}`);
      const finalResult = await execFileNoThrow(gitExe(), ['checkout', '--track', `origin/${branchName}`]);
      checkoutCode = finalResult.code;
      checkoutStderr = finalResult.stderr;
    }
  }
  if (checkoutCode !== 0) {
    logEvent('tengu_teleport_error_branch_checkout_failed', {});
    throw new TeleportOperationError(`Failed to checkout branch '${branchName}': ${checkoutStderr}`, chalk.red(`Failed to checkout branch '${branchName}'\n`));
  }

  // After successful checkout, ensure upstream is set
  await ensureUpstreamIsSet(branchName);
}

/**
 * Gets the current branch name
 */
async function getCurrentBranch(): Promise<string> {
  const {
    stdout: currentBranch
  } = await execFileNoThrow(gitExe(), ['branch', '--show-current']);
  return currentBranch.trim();
}

/**
 * Processes messages for teleport resume, removing incomplete tool_use blocks
 * and adding teleport notice messages
 * @param messages The conversation messages
 * @param error Optional error from branch checkout
 * @returns Processed messages ready for resume
 */
export function processMessagesForTeleportResume(messages: Message[], error: Error | null): Message[] {
  // Shared logic with resume for handling interruped session transcripts
  const deserializedMessages = deserializeMessages(messages);

  // Add user message about teleport resume (visible to model)
  const messagesWithTeleportNotice = [...deserializedMessages, createTeleportResumeUserMessage(), createTeleportResumeSystemMessage(error)];
  return messagesWithTeleportNotice;
}

/**
 * Checks out the specified branch for a teleported session
 * @param branch Optional branch to checkout
 * @returns The current branch name and any error that occurred
 */
export async function checkOutTeleportedSessionBranch(branch?: string): Promise<{
  branchName: string;
  branchError: Error | null;
}> {
  try {
    const currentBranch = await getCurrentBranch();
    logForDebugging(`Current branch before teleport: '${currentBranch}'`);
    if (branch) {
      logForDebugging(`Switching to branch '${branch}'...`);
      await fetchFromOrigin(branch);
      await checkoutBranch(branch);
      const newBranch = await getCurrentBranch();
      logForDebugging(`Branch after checkout: '${newBranch}'`);
    } else {
      logForDebugging('No branch specified, staying on current branch');
    }
    const branchName = await getCurrentBranch();
    return {
      branchName,
      branchError: null
    };
  } catch (error) {
    const branchName = await getCurrentBranch();
    const branchError = toError(error);
    return {
      branchName,
      branchError
    };
  }
}

/**
 * Result of repository validation for teleport
 */
export type RepoValidationResult = {
  status: 'match' | 'mismatch' | 'not_in_repo' | 'no_repo_required' | 'error';
  sessionRepo?: string;
  currentRepo?: string | null;
  /** Host of the session repo (e.g. "github.com" or "ghe.corp.com") — for display only */
  sessionHost?: string;
  /** Host of the current repo (e.g. "github.com" or "ghe.corp.com") — for display only */
  currentHost?: string;
  errorMessage?: string;
};

/**
 * Validates that the current repository matches the session's repository.
 * Returns a result object instead of throwing, allowing the caller to handle mismatches.
 *
 * @param sessionData The session resource to validate against
 * @returns Validation result with status and repo information
 */
export async function validateSessionRepository(sessionData: SessionResource): Promise<RepoValidationResult> {
  const currentParsed = await detectCurrentRepositoryWithHost();
  const currentRepo = currentParsed ? `${currentParsed.owner}/${currentParsed.name}` : null;
  const gitSource = sessionData.session_context.sources.find((source): source is GitSource => source.type === 'git_repository');
  if (!gitSource?.url) {
    // Session has no repo requirement
    logForDebugging(currentRepo ? 'Session has no associated repository, proceeding without validation' : 'Session has no repo requirement and not in git directory, proceeding');
    return {
      status: 'no_repo_required'
    };
  }
  const sessionParsed = parseGitRemote(gitSource.url);
  const sessionRepo = sessionParsed ? `${sessionParsed.owner}/${sessionParsed.name}` : parseGitHubRepository(gitSource.url);
  if (!sessionRepo) {
    return {
      status: 'no_repo_required'
    };
  }
  logForDebugging(`Session is for repository: ${sessionRepo}, current repo: ${currentRepo ?? 'none'}`);
  if (!currentRepo) {
    // Not in a git repo, but session requires one
    return {
      status: 'not_in_repo',
      sessionRepo,
      sessionHost: sessionParsed?.host,
      currentRepo: null
    };
  }

  // Compare both owner/repo and host to avoid cross-instance mismatches.
  // Strip ports before comparing hosts — SSH remotes omit the port while
  // HTTPS remotes may include a non-standard port (e.g. ghe.corp.com:8443),
  // which would cause a false mismatch.
  const stripPort = (host: string): string => host.replace(/:\d+$/, '');
  const repoMatch = currentRepo.toLowerCase() === sessionRepo.toLowerCase();
  const hostMatch = !currentParsed || !sessionParsed || stripPort(currentParsed.host.toLowerCase()) === stripPort(sessionParsed.host.toLowerCase());
  if (repoMatch && hostMatch) {
    return {
      status: 'match',
      sessionRepo,
      currentRepo
    };
  }

  // Repo mismatch — keep sessionRepo/currentRepo as plain "owner/repo" so
  // downstream consumers (e.g. getKnownPathsForRepo) can use them as lookup keys.
  // Include host information in separate fields for display purposes.
  return {
    status: 'mismatch',
    sessionRepo,
    currentRepo,
    sessionHost: sessionParsed?.host,
    currentHost: currentParsed?.host
  };
}

/**
 * Handles teleporting from a code session ID.
 * Fetches session logs and validates repo.
 * @param sessionId The session ID to resume
 * @param onProgress Optional callback for progress updates
 * @returns The raw session log and branch name
 */
export async function teleportResumeCodeSession(sessionId: string, onProgress?: TeleportProgressCallback): Promise<TeleportRemoteResponse> {
  if (!isPolicyAllowed('allow_remote_sessions')) {
    throw new Error("Remote sessions are disabled by your organization's policy.");
  }
  logForDebugging(`Resuming code session ID: ${sessionId}`);
  try {
    const accessToken = getClaudeAIOAuthTokens()?.accessToken;
    if (!accessToken) {
      logEvent('tengu_teleport_resume_error', {
        error_type: 'no_access_token' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      throw new Error('Claude Code web sessions require authentication with a Claude.ai account. API key authentication is not sufficient. Please run /login to authenticate, or check your authentication status with /status.');
    }

    // Get organization UUID
    const orgUUID = await getOrganizationUUID();
    if (!orgUUID) {
      logEvent('tengu_teleport_resume_error', {
        error_type: 'no_org_uuid' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      throw new Error('Unable to get organization UUID for constructing session URL');
    }

    // Fetch and validate repository matches before resuming
    onProgress?.('validating');
    const sessionData = await fetchSession(sessionId);
    const repoValidation = await validateSessionRepository(sessionData);
    switch (repoValidation.status) {
      case 'match':
      case 'no_repo_required':
        // Proceed with teleport
        break;
      case 'not_in_repo':
        {
          logEvent('tengu_teleport_error_repo_not_in_git_dir_sessions_api', {
            sessionId: sessionId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          // Include host for GHE users so they know which instance the repo is on
          const notInRepoDisplay = repoValidation.sessionHost && repoValidation.sessionHost.toLowerCase() !== 'github.com' ? `${repoValidation.sessionHost}/${repoValidation.sessionRepo}` : repoValidation.sessionRepo;
          throw new TeleportOperationError(`You must run claude --teleport ${sessionId} from a checkout of ${notInRepoDisplay}.`, chalk.red(`You must run claude --teleport ${sessionId} from a checkout of ${chalk.bold(notInRepoDisplay)}.\n`));
        }
      case 'mismatch':
        {
          logEvent('tengu_teleport_error_repo_mismatch_sessions_api', {
            sessionId: sessionId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          // Only include host prefix when hosts actually differ to disambiguate
          // cross-instance mismatches; for same-host mismatches the host is noise.
          const hostsDiffer = repoValidation.sessionHost && repoValidation.currentHost && repoValidation.sessionHost.replace(/:\d+$/, '').toLowerCase() !== repoValidation.currentHost.replace(/:\d+$/, '').toLowerCase();
          const sessionDisplay = hostsDiffer ? `${repoValidation.sessionHost}/${repoValidation.sessionRepo}` : repoValidation.sessionRepo;
          const currentDisplay = hostsDiffer ? `${repoValidation.currentHost}/${repoValidation.currentRepo}` : repoValidation.currentRepo;
          throw new TeleportOperationError(`You must run claude --teleport ${sessionId} from a checkout of ${sessionDisplay}.\nThis repo is ${currentDisplay}.`, chalk.red(`You must run claude --teleport ${sessionId} from a checkout of ${chalk.bold(sessionDisplay)}.\nThis repo is ${chalk.bold(currentDisplay)}.\n`));
        }
      case 'error':
        throw new TeleportOperationError(repoValidation.errorMessage || 'Failed to validate session repository', chalk.red(`Error: ${repoValidation.errorMessage || 'Failed to validate session repository'}\n`));
      default:
        {
          const _exhaustive: never = repoValidation.status;
          throw new Error(`Unhandled repo validation status: ${_exhaustive}`);
        }
    }
    return await teleportFromSessionsAPI(sessionId, orgUUID, accessToken, onProgress, sessionData);
  } catch (error) {
    if (error instanceof TeleportOperationError) {
      throw error;
    }
    const err = toError(error);
    logError(err);
    logEvent('tengu_teleport_resume_error', {
      error_type: 'resume_session_id_catch' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    throw new TeleportOperationError(err.message, chalk.red(`Error: ${err.message}\n`));
  }
}

/**
 * Helper function to handle teleport prerequisites (authentication and git state)
 * Shows TeleportError dialog rendered into the existing root if needed
 */
async function handleTeleportPrerequisites(root: Root, errorsToIgnore?: Set<TeleportLocalErrorType>): Promise<void> {
  const errors = await getTeleportErrors();
  if (errors.size > 0) {
    // Log teleport errors detected
    logEvent('tengu_teleport_errors_detected', {
      error_types: Array.from(errors).join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      errors_ignored: Array.from(errorsToIgnore || []).join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });

    // Show TeleportError dialog for user interaction
    await new Promise<void>(resolve => {
      root.render(<AppStateProvider>
          <KeybindingSetup>
            <TeleportError errorsToIgnore={errorsToIgnore} onComplete={() => {
            // Log when errors are resolved
            logEvent('tengu_teleport_errors_resolved', {
              error_types: Array.from(errors).join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            void resolve();
          }} />
          </KeybindingSetup>
        </AppStateProvider>);
    });
  }
}

/**
 * Creates a remote Claude.ai session with error handling and UI feedback.
 * Shows prerequisite error dialog in the existing root if needed.
 * @param root The existing Ink root to render dialogs into
 * @param description The description/prompt for the new session (null for no initial prompt)
 * @param signal AbortSignal for cancellation
 * @param branchName Optional branch name for the remote session to use
 * @returns Promise<TeleportToRemoteResponse | null> The created session or null if creation fails
 */
export async function teleportToRemoteWithErrorHandling(root: Root, description: string | null, signal: AbortSignal, branchName?: string): Promise<TeleportToRemoteResponse | null> {
  const errorsToIgnore = new Set<TeleportLocalErrorType>(['needsGitStash']);
  await handleTeleportPrerequisites(root, errorsToIgnore);
  return teleportToRemote({
    initialMessage: description,
    signal,
    branchName,
    onBundleFail: msg => process.stderr.write(`\n${msg}\n`)
  });
}

/**
 * Fetches session data from the session ingress API (/v1/session_ingress/)
 * Uses session logs instead of SDK events to get the correct message structure
 * @param sessionId The session ID to fetch
 * @param orgUUID The organization UUID
 * @param accessToken The OAuth access token
 * @param onProgress Optional callback for progress updates
 * @param sessionData Optional session data (used to extract branch info)
 * @returns TeleportRemoteResponse with session logs as Message[]
 */
export async function teleportFromSessionsAPI(sessionId: string, orgUUID: string, accessToken: string, onProgress?: TeleportProgressCallback, sessionData?: SessionResource): Promise<TeleportRemoteResponse> {
  const startTime = Date.now();
  try {
    // Fetch session logs via session ingress
    logForDebugging(`[teleport] Starting fetch for session: ${sessionId}`);
    onProgress?.('fetching_logs');
    const logsStartTime = Date.now();
    // Try CCR v2 first (GetTeleportEvents — server dispatches Spanner/
    // threadstore). Fall back to session-ingress if it returns null
    // (endpoint not yet deployed, or transient error). Once session-ingress
    // is gone, the fallback becomes a no-op — getSessionLogsViaOAuth will
    // return null too and we fail with "Failed to fetch session logs".
    let logs = await getTeleportEvents(sessionId, accessToken, orgUUID);
    if (logs === null) {
      logForDebugging('[teleport] v2 endpoint returned null, trying session-ingress');
      logs = await getSessionLogsViaOAuth(sessionId, accessToken, orgUUID);
    }
    logForDebugging(`[teleport] Session logs fetched in ${Date.now() - logsStartTime}ms`);
    if (logs === null) {
      throw new Error('Failed to fetch session logs');
    }

    // Filter to get only transcript messages, excluding sidechain messages
    const filterStartTime = Date.now();
    const messages = logs.filter(entry => isTranscriptMessage(entry) && !entry.isSidechain) as Message[];
    logForDebugging(`[teleport] Filtered ${logs.length} entries to ${messages.length} messages in ${Date.now() - filterStartTime}ms`);

    // Extract branch info from session data
    onProgress?.('fetching_branch');
    const branch = sessionData ? getBranchFromSession(sessionData) : undefined;
    if (branch) {
      logForDebugging(`[teleport] Found branch: ${branch}`);
    }
    logForDebugging(`[teleport] Total teleportFromSessionsAPI time: ${Date.now() - startTime}ms`);
    return {
      log: messages,
      branch
    };
  } catch (error) {
    const err = toError(error);

    // Handle 404 specifically
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      logEvent('tengu_teleport_error_session_not_found_404', {
        sessionId: sessionId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      throw new TeleportOperationError(`${sessionId} not found.`, `${sessionId} not found.\n${chalk.dim('Run /status in Claude Code to check your account.')}`);
    }
    logError(err);
    throw new Error(`Failed to fetch session from Sessions API: ${err.message}`);
  }
}

/**
 * Response type for polling remote session events (uses SDK events format)
 */
export type PollRemoteSessionResponse = {
  newEvents: SDKMessage[];
  lastEventId: string | null;
  branch?: string;
  sessionStatus?: 'idle' | 'running' | 'requires_action' | 'archived';
};

/**
 * Polls remote session events. Pass the previous response's `lastEventId`
 * as `afterId` to fetch only the delta. Set `skipMetadata` to avoid the
 * per-call GET /v1/sessions/{id} when branch/status aren't needed.
 */
export async function pollRemoteSessionEvents(sessionId: string, afterId: string | null = null, opts?: {
  skipMetadata?: boolean;
}): Promise<PollRemoteSessionResponse> {
  const accessToken = getClaudeAIOAuthTokens()?.accessToken;
  if (!accessToken) {
    throw new Error('No access token for polling');
  }
  const orgUUID = await getOrganizationUUID();
  if (!orgUUID) {
    throw new Error('No org UUID for polling');
  }
  const headers = {
    ...getOAuthHeaders(accessToken),
    'anthropic-beta': 'ccr-byoc-2025-07-29',
    'x-organization-uuid': orgUUID
  };
  const eventsUrl = `${getOauthConfig().BASE_API_URL}/v1/sessions/${sessionId}/events`;
  type EventsResponse = {
    data: unknown[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
  };

  // Cap is a safety valve against stuck cursors; steady-state is 0–1 pages.
  const MAX_EVENT_PAGES = 50;
  const sdkMessages: SDKMessage[] = [];
  let cursor = afterId;
  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    const eventsResponse = await axios.get(eventsUrl, {
      headers,
      params: cursor ? {
        after_id: cursor
      } : undefined,
      timeout: 30000
    });
    if (eventsResponse.status !== 200) {
      throw new Error(`Failed to fetch session events: ${eventsResponse.statusText}`);
    }
    const eventsData: EventsResponse = eventsResponse.data;
    if (!eventsData?.data || !Array.isArray(eventsData.data)) {
      throw new Error('Invalid events response');
    }
    for (const event of eventsData.data) {
      if (event && typeof event === 'object' && 'type' in event) {
        if (event.type === 'env_manager_log' || event.type === 'control_response') {
          continue;
        }
        if ('session_id' in event) {
          sdkMessages.push(event as SDKMessage);
        }
      }
    }
    if (!eventsData.last_id) break;
    cursor = eventsData.last_id;
    if (!eventsData.has_more) break;
  }
  if (opts?.skipMetadata) {
    return {
      newEvents: sdkMessages,
      lastEventId: cursor
    };
  }

  // Fetch session metadata (branch, status)
  let branch: string | undefined;
  let sessionStatus: PollRemoteSessionResponse['sessionStatus'];
  try {
    const sessionData = await fetchSession(sessionId);
    branch = getBranchFromSession(sessionData);
    sessionStatus = sessionData.session_status as PollRemoteSessionResponse['sessionStatus'];
  } catch (e) {
    logForDebugging(`teleport: failed to fetch session ${sessionId} metadata: ${e}`, {
      level: 'debug'
    });
  }
  return {
    newEvents: sdkMessages,
    lastEventId: cursor,
    branch,
    sessionStatus
  };
}

/**
 * Creates a remote Claude.ai session using the Sessions API.
 *
 * Two source modes:
 * - GitHub (default): backend clones from the repo's origin URL. Requires a
 *   GitHub remote + CCR-side GitHub connection. 43% of CLI sessions have an
 *   origin remote; far fewer pass the full precondition chain.
 * - Bundle (CCR_FORCE_BUNDLE=1): CLI creates `git bundle --all`, uploads via Files
 *   API, passes file_id as seed_bundle_file_id on the session context. CCR
 *   downloads it and clones from the bundle. No GitHub dependency — works for
 *   local-only repos. Reach: 54% of CLI sessions (anything with .git/).
 *   Backend: anthropic#303856.
 */
export async function teleportToRemote(options: {
  initialMessage: string | null;
  branchName?: string;
  title?: string;
  /**
   * The description of the session. This is used to generate the title and
   * session branch name (unless they are explicitly provided).
   */
  description?: string;
  model?: string;
  permissionMode?: PermissionMode;
  ultraplan?: boolean;
  signal: AbortSignal;
  useDefaultEnvironment?: boolean;
  /**
   * Explicit environment_id (e.g. the code_review synthetic env). Bypasses
   * fetchEnvironments; the usual repo-detection → git source still runs so
   * the container gets the repo checked out (orchestrator reads --repo-dir
   * from pwd, it doesn't clone).
   */
  environmentId?: string;
  /**
   * Per-session env vars merged into session_context.environment_variables.
   * Write-only at the API layer (stripped from Get/List responses). When
   * environmentId is set, CLAUDE_CODE_OAUTH_TOKEN is auto-injected from the
   * caller's accessToken so the container's hook can hit inference (the
   * server only passes through what the caller sends; bughunter.go mints
   * its own, user sessions don't get one automatically).
   */
  environmentVariables?: Record<string, string>;
  /**
   * When set with environmentId, creates and uploads a git bundle of the
   * local working tree (createAndUploadGitBundle handles the stash-create
   * for uncommitted changes) and passes it as seed_bundle_file_id. Backend
   * clones from the bundle instead of GitHub — container gets the caller's
   * exact local state. Needs .git/ only, not a GitHub remote.
   */
  useBundle?: boolean;
  /**
   * Called with a user-facing message when the bundle path is attempted but
   * fails. The wrapper stderr.writes it (pre-REPL). Remote-agent callers
   * capture it to include in their throw (in-REPL, Ink-rendered).
   */
  onBundleFail?: (message: string) => void;
  /**
   * When true, disables the git-bundle fallback entirely. Use for flows like
   * autofix where CCR must push to GitHub — a bundle can't do that.
   */
  skipBundle?: boolean;
  /**
   * When set, reuses this branch as the outcome branch instead of generating
   * a new claude/ branch. Sets allow_unrestricted_git_push on the source and
   * reuse_outcome_branches on the session context so the remote pushes to the
   * caller's branch directly.
   */
  reuseOutcomeBranch?: string;
  /**
   * GitHub PR to attach to the session context. Backend uses this to
   * identify the PR associated with this session.
   */
  githubPr?: {
    owner: string;
    repo: string;
    number: number;
  };
}): Promise<TeleportToRemoteResponse | null> {
  const {
    initialMessage,
    signal
  } = options;
  try {
    // Check authentication
    await checkAndRefreshOAuthTokenIfNeeded();
    const accessToken = getClaudeAIOAuthTokens()?.accessToken;
    if (!accessToken) {
      logError(new Error('No access token found for remote session creation'));
      return null;
    }

    // Get organization UUID
    const orgUUID = await getOrganizationUUID();
    if (!orgUUID) {
      logError(new Error('Unable to get organization UUID for remote session creation'));
      return null;
    }

    // Explicit environmentId short-circuits Haiku title-gen + env selection.
    // Still runs repo detection so the container gets a working directory —
    // the code_review orchestrator reads --repo-dir $(pwd), it doesn't clone
    // (bughunter.go:520 sets a git source too; env-manager does the checkout
    // before the SessionStart hook fires).
    if (options.environmentId) {
      const url = `${getOauthConfig().BASE_API_URL}/v1/sessions`;
      const headers = {
        ...getOAuthHeaders(accessToken),
        'anthropic-beta': 'ccr-byoc-2025-07-29',
        'x-organization-uuid': orgUUID
      };
      const envVars = {
        CLAUDE_CODE_OAUTH_TOKEN: accessToken,
        ...(options.environmentVariables ?? {})
      };

      // Bundle mode: upload local working tree (uncommitted changes via
      // refs/seed/stash), container clones from the bundle. No GitHub.
      // Otherwise: github.com source — caller checked eligibility.
      let gitSource: GitSource | null = null;
      let seedBundleFileId: string | null = null;
      if (options.useBundle) {
        const bundle = await createAndUploadGitBundle({
          oauthToken: accessToken,
          sessionId: getSessionId(),
          baseUrl: getOauthConfig().BASE_API_URL
        }, {
          signal
        });
        if (!bundle.success) {
          logError(new Error(`Bundle upload failed: ${bundle.error}`));
          return null;
        }
        seedBundleFileId = bundle.fileId;
        logEvent('tengu_teleport_bundle_mode', {
          size_bytes: bundle.bundleSizeBytes,
          scope: bundle.scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          has_wip: bundle.hasWip,
          reason: 'explicit_env_bundle' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      } else {
        const repoInfo = await detectCurrentRepositoryWithHost();
        if (repoInfo) {
          gitSource = {
            type: 'git_repository',
            url: `https://${repoInfo.host}/${repoInfo.owner}/${repoInfo.name}`,
            revision: options.branchName
          };
        }
      }
      const requestBody = {
        title: options.title || options.description || 'Remote task',
        events: [],
        session_context: {
          sources: gitSource ? [gitSource] : [],
          ...(seedBundleFileId && {
            seed_bundle_file_id: seedBundleFileId
          }),
          outcomes: [],
          environment_variables: envVars
        },
        environment_id: options.environmentId
      };
      logForDebugging(`[teleportToRemote] explicit env ${options.environmentId}, ${Object.keys(envVars).length} env vars, ${seedBundleFileId ? `bundle=${seedBundleFileId}` : `source=${gitSource?.url ?? 'none'}@${options.branchName ?? 'default'}`}`);
      const response = await axios.post(url, requestBody, {
        headers,
        signal
      });
      if (response.status !== 200 && response.status !== 201) {
        logError(new Error(`CreateSession ${response.status}: ${jsonStringify(response.data)}`));
        return null;
      }
      const sessionData = response.data as SessionResource;
      if (!sessionData || typeof sessionData.id !== 'string') {
        logError(new Error(`No session id in response: ${jsonStringify(response.data)}`));
        return null;
      }
      return {
        id: sessionData.id,
        title: sessionData.title || requestBody.title
      };
    }
    let gitSource: GitSource | null = null;
    let gitOutcome: GitRepositoryOutcome | null = null;
    let seedBundleFileId: string | null = null;

    // Source selection ladder: GitHub clone (if CCR can actually pull it) →
    // bundle fallback (if .git exists) → empty sandbox.
    //
    // The preflight is the same code path the container's git-proxy clone
    // will hit (get_github_client_with_user_auth → no_sync_user_token_found).
    // 50% of users who reach the "install GitHub App" step never finish it;
    // without the preflight, every one of them gets a container that 401s
    // on clone. With it, they silently fall back to bundle.
    //
    // CCR_FORCE_BUNDLE=1 skips the preflight entirely — useful for testing
    // or when you know your GitHub auth is busted. Read here (not in the
    // caller) so it works for remote-agent too, not just --remote.

    const repoInfo = await detectCurrentRepositoryWithHost();

    // Generate title and branch name for the session. Skip the Haiku call
    // when both title and outcome branch are explicitly provided.
    let sessionTitle: string;
    let sessionBranch: string;
    if (options.title && options.reuseOutcomeBranch) {
      sessionTitle = options.title;
      sessionBranch = options.reuseOutcomeBranch;
    } else {
      const generated = await generateTitleAndBranch(options.description || initialMessage || 'Background task', signal);
      sessionTitle = options.title || generated.title;
      sessionBranch = options.reuseOutcomeBranch || generated.branchName;
    }

    // Preflight: does CCR have a token that can clone this repo?
    // Only checked for github.com — GHES needs ghe_configuration_id which
    // we don't have, and GHES users are power users who probably finished
    // setup. For them (and for non-GitHub hosts that parseGitRemote
    // somehow accepted), fall through optimistically; if the backend
    // rejects the host, bundle next time.
    let ghViable = false;
    let sourceReason: 'github_preflight_ok' | 'ghes_optimistic' | 'github_preflight_failed' | 'no_github_remote' | 'forced_bundle' | 'no_git_at_all' = 'no_git_at_all';

    // gitRoot gates both bundle creation and the gate check itself — no
    // point awaiting GrowthBook when there's nothing to bundle.
    const gitRoot = findGitRoot(getCwd());
    const forceBundle = !options.skipBundle && isEnvTruthy(process.env.CCR_FORCE_BUNDLE);
    const bundleSeedGateOn = !options.skipBundle && gitRoot !== null && (isEnvTruthy(process.env.CCR_ENABLE_BUNDLE) || (await checkGate_CACHED_OR_BLOCKING('tengu_ccr_bundle_seed_enabled')));
    if (repoInfo && !forceBundle) {
      if (repoInfo.host === 'github.com') {
        ghViable = await checkGithubAppInstalled(repoInfo.owner, repoInfo.name, signal);
        sourceReason = ghViable ? 'github_preflight_ok' : 'github_preflight_failed';
      } else {
        ghViable = true;
        sourceReason = 'ghes_optimistic';
      }
    } else if (forceBundle) {
      sourceReason = 'forced_bundle';
    } else if (gitRoot) {
      sourceReason = 'no_github_remote';
    }

    // Preflight failed but bundle is off — fall through optimistically like
    // pre-preflight behavior. Backend reports the real auth error.
    if (!ghViable && !bundleSeedGateOn && repoInfo) {
      ghViable = true;
    }
    if (ghViable && repoInfo) {
      const {
        host,
        owner,
        name
      } = repoInfo;
      // Resolve the base branch: prefer explicit branchName, fall back to default branch
      const revision = options.branchName ?? (await getDefaultBranch()) ?? undefined;
      logForDebugging(`[teleportToRemote] Git source: ${host}/${owner}/${name}, revision: ${revision ?? 'none'}`);
      gitSource = {
        type: 'git_repository',
        url: `https://${host}/${owner}/${name}`,
        // The revision specifies which ref to checkout as the base branch
        revision,
        ...(options.reuseOutcomeBranch && {
          allow_unrestricted_git_push: true
        })
      };
      // type: 'github' is used for all GitHub-compatible hosts (github.com and GHE).
      // The CLI can't distinguish GHE from non-GitHub hosts (GitLab, Bitbucket)
      // client-side — the backend validates the URL against configured GHE instances
      // and ignores git_info for unrecognized hosts.
      gitOutcome = {
        type: 'git_repository',
        git_info: {
          type: 'github',
          repo: `${owner}/${name}`,
          branches: [sessionBranch]
        }
      };
    }

    // Bundle fallback. Only try bundle if GitHub wasn't viable, the gate is
    // on, and there's a .git/ to bundle from. Reaching here with
    // ghViable=false and repoInfo non-null means the preflight failed —
    // .git definitely exists (detectCurrentRepositoryWithHost read the
    // remote from it).
    if (!gitSource && bundleSeedGateOn) {
      logForDebugging(`[teleportToRemote] Bundling (reason: ${sourceReason})`);
      const bundle = await createAndUploadGitBundle({
        oauthToken: accessToken,
        sessionId: getSessionId(),
        baseUrl: getOauthConfig().BASE_API_URL
      }, {
        signal
      });
      if (!bundle.success) {
        logError(new Error(`Bundle upload failed: ${bundle.error}`));
        // Only steer users to GitHub setup when there's a remote to clone from.
        const setup = repoInfo ? '. Please setup GitHub on https://claude.ai/code' : '';
        let msg: string;
        switch (bundle.failReason) {
          case 'empty_repo':
            msg = 'Repository has no commits — run `git add . && git commit -m "initial"` then retry';
            break;
          case 'too_large':
            msg = `Repo is too large to teleport${setup}`;
            break;
          case 'git_error':
            msg = `Failed to create git bundle (${bundle.error})${setup}`;
            break;
          case undefined:
            msg = `Bundle upload failed: ${bundle.error}${setup}`;
            break;
          default:
            {
              const _exhaustive: never = bundle.failReason;
              void _exhaustive;
              msg = `Bundle upload failed: ${bundle.error}`;
            }
        }
        options.onBundleFail?.(msg);
        return null;
      }
      seedBundleFileId = bundle.fileId;
      logEvent('tengu_teleport_bundle_mode', {
        size_bytes: bundle.bundleSizeBytes,
        scope: bundle.scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        has_wip: bundle.hasWip,
        reason: sourceReason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
    logEvent('tengu_teleport_source_decision', {
      reason: sourceReason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      path: (gitSource ? 'github' : seedBundleFileId ? 'bundle' : 'empty') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    if (!gitSource && !seedBundleFileId) {
      logForDebugging('[teleportToRemote] No repository detected — session will have an empty sandbox');
    }

    // Fetch available environments
    let environments = await fetchEnvironments();
    if (!environments || environments.length === 0) {
      logError(new Error('No environments available for session creation'));
      return null;
    }
    logForDebugging(`Available environments: ${environments.map(e => `${e.environment_id} (${e.name}, ${e.kind})`).join(', ')}`);

    // Select environment based on settings, then anthropic_cloud preference, then first available.
    // Prefer anthropic_cloud environments over byoc: anthropic_cloud environments (e.g. "Default")
    // are the standard compute environments with full repo access, whereas byoc environments
    // (e.g. "monorepo") are user-owned compute that may not support the current repository.
    const settings = getSettings_DEPRECATED();
    const defaultEnvironmentId = options.useDefaultEnvironment ? undefined : settings?.remote?.defaultEnvironmentId;
    let cloudEnv = environments.find(env => env.kind === 'anthropic_cloud');
    // When the caller opts out of their configured default, do not fall
    // through to a BYOC env that may not support the current repo or the
    // requested permission mode. Retry once for eventual consistency,
    // then fail loudly.
    if (options.useDefaultEnvironment && !cloudEnv) {
      logForDebugging(`No anthropic_cloud in env list (${environments.length} envs); retrying fetchEnvironments`);
      const retried = await fetchEnvironments();
      cloudEnv = retried?.find(env => env.kind === 'anthropic_cloud');
      if (!cloudEnv) {
        logError(new Error(`No anthropic_cloud environment available after retry (got: ${(retried ?? environments).map(e => `${e.name} (${e.kind})`).join(', ')}). Silent byoc fallthrough would launch into a dead env — fail fast instead.`));
        return null;
      }
      if (retried) environments = retried;
    }
    const selectedEnvironment = defaultEnvironmentId && environments.find(env => env.environment_id === defaultEnvironmentId) || cloudEnv || environments.find(env => env.kind !== 'bridge') || environments[0];
    if (!selectedEnvironment) {
      logError(new Error('No environments available for session creation'));
      return null;
    }
    if (defaultEnvironmentId) {
      const matchedDefault = selectedEnvironment.environment_id === defaultEnvironmentId;
      logForDebugging(matchedDefault ? `Using configured default environment: ${defaultEnvironmentId}` : `Configured default environment ${defaultEnvironmentId} not found, using first available`);
    }
    const environmentId = selectedEnvironment.environment_id;
    logForDebugging(`Selected environment: ${environmentId} (${selectedEnvironment.name}, ${selectedEnvironment.kind})`);

    // Prepare API request for Sessions API
    const url = `${getOauthConfig().BASE_API_URL}/v1/sessions`;
    const headers = {
      ...getOAuthHeaders(accessToken),
      'anthropic-beta': 'ccr-byoc-2025-07-29',
      'x-organization-uuid': orgUUID
    };
    const sessionContext = {
      sources: gitSource ? [gitSource] : [],
      ...(seedBundleFileId && {
        seed_bundle_file_id: seedBundleFileId
      }),
      outcomes: gitOutcome ? [gitOutcome] : [],
      model: options.model ?? getMainLoopModel(),
      ...(options.reuseOutcomeBranch && {
        reuse_outcome_branches: true
      }),
      ...(options.githubPr && {
        github_pr: options.githubPr
      })
    };

    // CreateCCRSessionPayload has no permission_mode field — a top-level
    // body entry is silently dropped by the proto parser server-side.
    // Instead prepend a set_permission_mode control_request event. Initial
    // events are written to threadstore before the container connects, so
    // the CLI applies the mode before the first user turn — no readiness race.
    const events: Array<{
      type: 'event';
      data: Record<string, unknown>;
    }> = [];
    if (options.permissionMode) {
      events.push({
        type: 'event',
        data: {
          type: 'control_request',
          request_id: `set-mode-${randomUUID()}`,
          request: {
            subtype: 'set_permission_mode',
            mode: options.permissionMode,
            ultraplan: options.ultraplan
          }
        }
      });
    }
    if (initialMessage) {
      events.push({
        type: 'event',
        data: {
          uuid: randomUUID(),
          session_id: '',
          type: 'user',
          parent_tool_use_id: null,
          message: {
            role: 'user',
            content: initialMessage
          }
        }
      });
    }
    const requestBody = {
      title: options.ultraplan ? `ultraplan: ${sessionTitle}` : sessionTitle,
      events,
      session_context: sessionContext,
      environment_id: environmentId
    };
    logForDebugging(`Creating session with payload: ${jsonStringify(requestBody, null, 2)}`);

    // Make API call
    const response = await axios.post(url, requestBody, {
      headers,
      signal
    });
    const isSuccess = response.status === 200 || response.status === 201;
    if (!isSuccess) {
      logError(new Error(`API request failed with status ${response.status}: ${response.statusText}\n\nResponse data: ${jsonStringify(response.data, null, 2)}`));
      return null;
    }

    // Parse response as SessionResource
    const sessionData = response.data as SessionResource;
    if (!sessionData || typeof sessionData.id !== 'string') {
      logError(new Error(`Cannot determine session ID from API response: ${jsonStringify(response.data)}`));
      return null;
    }
    logForDebugging(`Successfully created remote session: ${sessionData.id}`);
    return {
      id: sessionData.id,
      title: sessionData.title || requestBody.title
    };
  } catch (error) {
    const err = toError(error);
    logError(err);
    return null;
  }
}

/**
 * Best-effort session archive. POST /v1/sessions/{id}/archive has no
 * running-status check (unlike DELETE which 409s on RUNNING), so it works
 * mid-implementation. Archived sessions reject new events (send_events.go),
 * so the remote stops on its next write. 409 (already archived) treated as
 * success. Fire-and-forget; failure leaks a visible session until the
 * reaper collects it.
 */
export async function archiveRemoteSession(sessionId: string): Promise<void> {
  const accessToken = getClaudeAIOAuthTokens()?.accessToken;
  if (!accessToken) return;
  const orgUUID = await getOrganizationUUID();
  if (!orgUUID) return;
  const headers = {
    ...getOAuthHeaders(accessToken),
    'anthropic-beta': 'ccr-byoc-2025-07-29',
    'x-organization-uuid': orgUUID
  };
  const url = `${getOauthConfig().BASE_API_URL}/v1/sessions/${sessionId}/archive`;
  try {
    const resp = await axios.post(url, {}, {
      headers,
      timeout: 10000,
      validateStatus: s => s < 500
    });
    if (resp.status === 200 || resp.status === 409) {
      logForDebugging(`[archiveRemoteSession] archived ${sessionId}`);
    } else {
      logForDebugging(`[archiveRemoteSession] ${sessionId} failed ${resp.status}: ${jsonStringify(resp.data)}`);
    }
  } catch (err) {
    logError(err);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJheGlvcyIsImNoYWxrIiwicmFuZG9tVVVJRCIsIlJlYWN0IiwiZ2V0T3JpZ2luYWxDd2QiLCJnZXRTZXNzaW9uSWQiLCJjaGVja0dhdGVfQ0FDSEVEX09SX0JMT0NLSU5HIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwiaXNQb2xpY3lBbGxvd2VkIiwieiIsImdldFRlbGVwb3J0RXJyb3JzIiwiVGVsZXBvcnRFcnJvciIsIlRlbGVwb3J0TG9jYWxFcnJvclR5cGUiLCJnZXRPYXV0aENvbmZpZyIsIlNES01lc3NhZ2UiLCJSb290IiwiS2V5YmluZGluZ1NldHVwIiwicXVlcnlIYWlrdSIsImdldFNlc3Npb25Mb2dzVmlhT0F1dGgiLCJnZXRUZWxlcG9ydEV2ZW50cyIsImdldE9yZ2FuaXphdGlvblVVSUQiLCJBcHBTdGF0ZVByb3ZpZGVyIiwiTWVzc2FnZSIsIlN5c3RlbU1lc3NhZ2UiLCJQZXJtaXNzaW9uTW9kZSIsImNoZWNrQW5kUmVmcmVzaE9BdXRoVG9rZW5JZk5lZWRlZCIsImdldENsYXVkZUFJT0F1dGhUb2tlbnMiLCJjaGVja0dpdGh1YkFwcEluc3RhbGxlZCIsImRlc2VyaWFsaXplTWVzc2FnZXMiLCJUZWxlcG9ydFJlbW90ZVJlc3BvbnNlIiwiZ2V0Q3dkIiwibG9nRm9yRGVidWdnaW5nIiwiZGV0ZWN0Q3VycmVudFJlcG9zaXRvcnlXaXRoSG9zdCIsInBhcnNlR2l0SHViUmVwb3NpdG9yeSIsInBhcnNlR2l0UmVtb3RlIiwiaXNFbnZUcnV0aHkiLCJUZWxlcG9ydE9wZXJhdGlvbkVycm9yIiwidG9FcnJvciIsImV4ZWNGaWxlTm9UaHJvdyIsInRydW5jYXRlVG9XaWR0aCIsImZpbmRHaXRSb290IiwiZ2V0RGVmYXVsdEJyYW5jaCIsImdldElzQ2xlYW4iLCJnaXRFeGUiLCJzYWZlUGFyc2VKU09OIiwibG9nRXJyb3IiLCJjcmVhdGVTeXN0ZW1NZXNzYWdlIiwiY3JlYXRlVXNlck1lc3NhZ2UiLCJnZXRNYWluTG9vcE1vZGVsIiwiaXNUcmFuc2NyaXB0TWVzc2FnZSIsImdldFNldHRpbmdzX0RFUFJFQ0FURUQiLCJqc29uU3RyaW5naWZ5IiwiYXNTeXN0ZW1Qcm9tcHQiLCJmZXRjaFNlc3Npb24iLCJHaXRSZXBvc2l0b3J5T3V0Y29tZSIsIkdpdFNvdXJjZSIsImdldEJyYW5jaEZyb21TZXNzaW9uIiwiZ2V0T0F1dGhIZWFkZXJzIiwiU2Vzc2lvblJlc291cmNlIiwiZmV0Y2hFbnZpcm9ubWVudHMiLCJjcmVhdGVBbmRVcGxvYWRHaXRCdW5kbGUiLCJUZWxlcG9ydFJlc3VsdCIsIm1lc3NhZ2VzIiwiYnJhbmNoTmFtZSIsIlRlbGVwb3J0UHJvZ3Jlc3NTdGVwIiwiVGVsZXBvcnRQcm9ncmVzc0NhbGxiYWNrIiwic3RlcCIsImNyZWF0ZVRlbGVwb3J0UmVzdW1lU3lzdGVtTWVzc2FnZSIsImJyYW5jaEVycm9yIiwiRXJyb3IiLCJmb3JtYXR0ZWRFcnJvciIsImZvcm1hdHRlZE1lc3NhZ2UiLCJtZXNzYWdlIiwiY3JlYXRlVGVsZXBvcnRSZXN1bWVVc2VyTWVzc2FnZSIsImNvbnRlbnQiLCJpc01ldGEiLCJUZWxlcG9ydFRvUmVtb3RlUmVzcG9uc2UiLCJpZCIsInRpdGxlIiwiU0VTU0lPTl9USVRMRV9BTkRfQlJBTkNIX1BST01QVCIsIlRpdGxlQW5kQnJhbmNoIiwiZ2VuZXJhdGVUaXRsZUFuZEJyYW5jaCIsImRlc2NyaXB0aW9uIiwic2lnbmFsIiwiQWJvcnRTaWduYWwiLCJQcm9taXNlIiwiZmFsbGJhY2tUaXRsZSIsImZhbGxiYWNrQnJhbmNoIiwidXNlclByb21wdCIsInJlcGxhY2UiLCJyZXNwb25zZSIsInN5c3RlbVByb21wdCIsIm91dHB1dEZvcm1hdCIsInR5cGUiLCJzY2hlbWEiLCJwcm9wZXJ0aWVzIiwiYnJhbmNoIiwicmVxdWlyZWQiLCJhZGRpdGlvbmFsUHJvcGVydGllcyIsIm9wdGlvbnMiLCJxdWVyeVNvdXJjZSIsImFnZW50cyIsImlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uIiwiaGFzQXBwZW5kU3lzdGVtUHJvbXB0IiwibWNwVG9vbHMiLCJmaXJzdEJsb2NrIiwicGFyc2VkIiwidGV4dCIsInRyaW0iLCJwYXJzZVJlc3VsdCIsIm9iamVjdCIsInN0cmluZyIsInNhZmVQYXJzZSIsInN1Y2Nlc3MiLCJkYXRhIiwiZXJyb3IiLCJ2YWxpZGF0ZUdpdFN0YXRlIiwiaXNDbGVhbiIsImlnbm9yZVVudHJhY2tlZCIsInJlZCIsImZldGNoRnJvbU9yaWdpbiIsImZldGNoQXJncyIsImNvZGUiLCJmZXRjaENvZGUiLCJzdGRlcnIiLCJmZXRjaFN0ZGVyciIsImluY2x1ZGVzIiwicmVmRmV0Y2hDb2RlIiwicmVmRmV0Y2hTdGRlcnIiLCJlbnN1cmVVcHN0cmVhbUlzU2V0IiwidXBzdHJlYW1DaGVja0NvZGUiLCJyZW1vdGVDaGVja0NvZGUiLCJzZXRVcHN0cmVhbUNvZGUiLCJzZXRVcHN0cmVhbVN0ZGVyciIsImNoZWNrb3V0QnJhbmNoIiwiY2hlY2tvdXRDb2RlIiwiY2hlY2tvdXRTdGRlcnIiLCJyZXN1bHQiLCJmaW5hbFJlc3VsdCIsImdldEN1cnJlbnRCcmFuY2giLCJzdGRvdXQiLCJjdXJyZW50QnJhbmNoIiwicHJvY2Vzc01lc3NhZ2VzRm9yVGVsZXBvcnRSZXN1bWUiLCJkZXNlcmlhbGl6ZWRNZXNzYWdlcyIsIm1lc3NhZ2VzV2l0aFRlbGVwb3J0Tm90aWNlIiwiY2hlY2tPdXRUZWxlcG9ydGVkU2Vzc2lvbkJyYW5jaCIsIm5ld0JyYW5jaCIsIlJlcG9WYWxpZGF0aW9uUmVzdWx0Iiwic3RhdHVzIiwic2Vzc2lvblJlcG8iLCJjdXJyZW50UmVwbyIsInNlc3Npb25Ib3N0IiwiY3VycmVudEhvc3QiLCJlcnJvck1lc3NhZ2UiLCJ2YWxpZGF0ZVNlc3Npb25SZXBvc2l0b3J5Iiwic2Vzc2lvbkRhdGEiLCJjdXJyZW50UGFyc2VkIiwib3duZXIiLCJuYW1lIiwiZ2l0U291cmNlIiwic2Vzc2lvbl9jb250ZXh0Iiwic291cmNlcyIsImZpbmQiLCJzb3VyY2UiLCJ1cmwiLCJzZXNzaW9uUGFyc2VkIiwiaG9zdCIsInN0cmlwUG9ydCIsInJlcG9NYXRjaCIsInRvTG93ZXJDYXNlIiwiaG9zdE1hdGNoIiwidGVsZXBvcnRSZXN1bWVDb2RlU2Vzc2lvbiIsInNlc3Npb25JZCIsIm9uUHJvZ3Jlc3MiLCJhY2Nlc3NUb2tlbiIsImVycm9yX3R5cGUiLCJvcmdVVUlEIiwicmVwb1ZhbGlkYXRpb24iLCJub3RJblJlcG9EaXNwbGF5IiwiYm9sZCIsImhvc3RzRGlmZmVyIiwic2Vzc2lvbkRpc3BsYXkiLCJjdXJyZW50RGlzcGxheSIsIl9leGhhdXN0aXZlIiwidGVsZXBvcnRGcm9tU2Vzc2lvbnNBUEkiLCJlcnIiLCJoYW5kbGVUZWxlcG9ydFByZXJlcXVpc2l0ZXMiLCJyb290IiwiZXJyb3JzVG9JZ25vcmUiLCJTZXQiLCJlcnJvcnMiLCJzaXplIiwiZXJyb3JfdHlwZXMiLCJBcnJheSIsImZyb20iLCJqb2luIiwiZXJyb3JzX2lnbm9yZWQiLCJyZXNvbHZlIiwicmVuZGVyIiwidGVsZXBvcnRUb1JlbW90ZVdpdGhFcnJvckhhbmRsaW5nIiwidGVsZXBvcnRUb1JlbW90ZSIsImluaXRpYWxNZXNzYWdlIiwib25CdW5kbGVGYWlsIiwibXNnIiwicHJvY2VzcyIsIndyaXRlIiwic3RhcnRUaW1lIiwiRGF0ZSIsIm5vdyIsImxvZ3NTdGFydFRpbWUiLCJsb2dzIiwiZmlsdGVyU3RhcnRUaW1lIiwiZmlsdGVyIiwiZW50cnkiLCJpc1NpZGVjaGFpbiIsImxlbmd0aCIsInVuZGVmaW5lZCIsImxvZyIsImlzQXhpb3NFcnJvciIsImRpbSIsIlBvbGxSZW1vdGVTZXNzaW9uUmVzcG9uc2UiLCJuZXdFdmVudHMiLCJsYXN0RXZlbnRJZCIsInNlc3Npb25TdGF0dXMiLCJwb2xsUmVtb3RlU2Vzc2lvbkV2ZW50cyIsImFmdGVySWQiLCJvcHRzIiwic2tpcE1ldGFkYXRhIiwiaGVhZGVycyIsImV2ZW50c1VybCIsIkJBU0VfQVBJX1VSTCIsIkV2ZW50c1Jlc3BvbnNlIiwiaGFzX21vcmUiLCJmaXJzdF9pZCIsImxhc3RfaWQiLCJNQVhfRVZFTlRfUEFHRVMiLCJzZGtNZXNzYWdlcyIsImN1cnNvciIsInBhZ2UiLCJldmVudHNSZXNwb25zZSIsImdldCIsInBhcmFtcyIsImFmdGVyX2lkIiwidGltZW91dCIsInN0YXR1c1RleHQiLCJldmVudHNEYXRhIiwiaXNBcnJheSIsImV2ZW50IiwicHVzaCIsInNlc3Npb25fc3RhdHVzIiwiZSIsImxldmVsIiwibW9kZWwiLCJwZXJtaXNzaW9uTW9kZSIsInVsdHJhcGxhbiIsInVzZURlZmF1bHRFbnZpcm9ubWVudCIsImVudmlyb25tZW50SWQiLCJlbnZpcm9ubWVudFZhcmlhYmxlcyIsIlJlY29yZCIsInVzZUJ1bmRsZSIsInNraXBCdW5kbGUiLCJyZXVzZU91dGNvbWVCcmFuY2giLCJnaXRodWJQciIsInJlcG8iLCJudW1iZXIiLCJlbnZWYXJzIiwiQ0xBVURFX0NPREVfT0FVVEhfVE9LRU4iLCJzZWVkQnVuZGxlRmlsZUlkIiwiYnVuZGxlIiwib2F1dGhUb2tlbiIsImJhc2VVcmwiLCJmaWxlSWQiLCJzaXplX2J5dGVzIiwiYnVuZGxlU2l6ZUJ5dGVzIiwic2NvcGUiLCJoYXNfd2lwIiwiaGFzV2lwIiwicmVhc29uIiwicmVwb0luZm8iLCJyZXZpc2lvbiIsInJlcXVlc3RCb2R5IiwiZXZlbnRzIiwic2VlZF9idW5kbGVfZmlsZV9pZCIsIm91dGNvbWVzIiwiZW52aXJvbm1lbnRfdmFyaWFibGVzIiwiZW52aXJvbm1lbnRfaWQiLCJPYmplY3QiLCJrZXlzIiwicG9zdCIsImdpdE91dGNvbWUiLCJzZXNzaW9uVGl0bGUiLCJzZXNzaW9uQnJhbmNoIiwiZ2VuZXJhdGVkIiwiZ2hWaWFibGUiLCJzb3VyY2VSZWFzb24iLCJnaXRSb290IiwiZm9yY2VCdW5kbGUiLCJlbnYiLCJDQ1JfRk9SQ0VfQlVORExFIiwiYnVuZGxlU2VlZEdhdGVPbiIsIkNDUl9FTkFCTEVfQlVORExFIiwiYWxsb3dfdW5yZXN0cmljdGVkX2dpdF9wdXNoIiwiZ2l0X2luZm8iLCJicmFuY2hlcyIsInNldHVwIiwiZmFpbFJlYXNvbiIsInBhdGgiLCJlbnZpcm9ubWVudHMiLCJtYXAiLCJraW5kIiwic2V0dGluZ3MiLCJkZWZhdWx0RW52aXJvbm1lbnRJZCIsInJlbW90ZSIsImNsb3VkRW52IiwicmV0cmllZCIsInNlbGVjdGVkRW52aXJvbm1lbnQiLCJtYXRjaGVkRGVmYXVsdCIsInNlc3Npb25Db250ZXh0IiwicmV1c2Vfb3V0Y29tZV9icmFuY2hlcyIsImdpdGh1Yl9wciIsInJlcXVlc3RfaWQiLCJyZXF1ZXN0Iiwic3VidHlwZSIsIm1vZGUiLCJ1dWlkIiwic2Vzc2lvbl9pZCIsInBhcmVudF90b29sX3VzZV9pZCIsInJvbGUiLCJpc1N1Y2Nlc3MiLCJhcmNoaXZlUmVtb3RlU2Vzc2lvbiIsInJlc3AiLCJ2YWxpZGF0ZVN0YXR1cyIsInMiXSwic291cmNlcyI6WyJ0ZWxlcG9ydC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zIGZyb20gJ2F4aW9zJ1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJ1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gJ2NyeXB0bydcbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IGdldE9yaWdpbmFsQ3dkLCBnZXRTZXNzaW9uSWQgfSBmcm9tICdzcmMvYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgY2hlY2tHYXRlX0NBQ0hFRF9PUl9CTE9DS0lORyB9IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvZ3Jvd3RoYm9vay5qcydcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgeyBpc1BvbGljeUFsbG93ZWQgfSBmcm9tICdzcmMvc2VydmljZXMvcG9saWN5TGltaXRzL2luZGV4LmpzJ1xuaW1wb3J0IHsgeiB9IGZyb20gJ3pvZC92NCdcbmltcG9ydCB7XG4gIGdldFRlbGVwb3J0RXJyb3JzLFxuICBUZWxlcG9ydEVycm9yLFxuICB0eXBlIFRlbGVwb3J0TG9jYWxFcnJvclR5cGUsXG59IGZyb20gJy4uL2NvbXBvbmVudHMvVGVsZXBvcnRFcnJvci5qcydcbmltcG9ydCB7IGdldE9hdXRoQ29uZmlnIH0gZnJvbSAnLi4vY29uc3RhbnRzL29hdXRoLmpzJ1xuaW1wb3J0IHR5cGUgeyBTREtNZXNzYWdlIH0gZnJvbSAnLi4vZW50cnlwb2ludHMvYWdlbnRTZGtUeXBlcy5qcydcbmltcG9ydCB0eXBlIHsgUm9vdCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IEtleWJpbmRpbmdTZXR1cCB9IGZyb20gJy4uL2tleWJpbmRpbmdzL0tleWJpbmRpbmdQcm92aWRlclNldHVwLmpzJ1xuaW1wb3J0IHsgcXVlcnlIYWlrdSB9IGZyb20gJy4uL3NlcnZpY2VzL2FwaS9jbGF1ZGUuanMnXG5pbXBvcnQge1xuICBnZXRTZXNzaW9uTG9nc1ZpYU9BdXRoLFxuICBnZXRUZWxlcG9ydEV2ZW50cyxcbn0gZnJvbSAnLi4vc2VydmljZXMvYXBpL3Nlc3Npb25JbmdyZXNzLmpzJ1xuaW1wb3J0IHsgZ2V0T3JnYW5pemF0aW9uVVVJRCB9IGZyb20gJy4uL3NlcnZpY2VzL29hdXRoL2NsaWVudC5qcydcbmltcG9ydCB7IEFwcFN0YXRlUHJvdmlkZXIgfSBmcm9tICcuLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSwgU3lzdGVtTWVzc2FnZSB9IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgdHlwZSB7IFBlcm1pc3Npb25Nb2RlIH0gZnJvbSAnLi4vdHlwZXMvcGVybWlzc2lvbnMuanMnXG5pbXBvcnQge1xuICBjaGVja0FuZFJlZnJlc2hPQXV0aFRva2VuSWZOZWVkZWQsXG4gIGdldENsYXVkZUFJT0F1dGhUb2tlbnMsXG59IGZyb20gJy4vYXV0aC5qcydcbmltcG9ydCB7IGNoZWNrR2l0aHViQXBwSW5zdGFsbGVkIH0gZnJvbSAnLi9iYWNrZ3JvdW5kL3JlbW90ZS9wcmVjb25kaXRpb25zLmpzJ1xuaW1wb3J0IHtcbiAgZGVzZXJpYWxpemVNZXNzYWdlcyxcbiAgdHlwZSBUZWxlcG9ydFJlbW90ZVJlc3BvbnNlLFxufSBmcm9tICcuL2NvbnZlcnNhdGlvblJlY292ZXJ5LmpzJ1xuaW1wb3J0IHsgZ2V0Q3dkIH0gZnJvbSAnLi9jd2QuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuL2RlYnVnLmpzJ1xuaW1wb3J0IHtcbiAgZGV0ZWN0Q3VycmVudFJlcG9zaXRvcnlXaXRoSG9zdCxcbiAgcGFyc2VHaXRIdWJSZXBvc2l0b3J5LFxuICBwYXJzZUdpdFJlbW90ZSxcbn0gZnJvbSAnLi9kZXRlY3RSZXBvc2l0b3J5LmpzJ1xuaW1wb3J0IHsgaXNFbnZUcnV0aHkgfSBmcm9tICcuL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgVGVsZXBvcnRPcGVyYXRpb25FcnJvciwgdG9FcnJvciB9IGZyb20gJy4vZXJyb3JzLmpzJ1xuaW1wb3J0IHsgZXhlY0ZpbGVOb1Rocm93IH0gZnJvbSAnLi9leGVjRmlsZU5vVGhyb3cuanMnXG5pbXBvcnQgeyB0cnVuY2F0ZVRvV2lkdGggfSBmcm9tICcuL2Zvcm1hdC5qcydcbmltcG9ydCB7IGZpbmRHaXRSb290LCBnZXREZWZhdWx0QnJhbmNoLCBnZXRJc0NsZWFuLCBnaXRFeGUgfSBmcm9tICcuL2dpdC5qcydcbmltcG9ydCB7IHNhZmVQYXJzZUpTT04gfSBmcm9tICcuL2pzb24uanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4vbG9nLmpzJ1xuaW1wb3J0IHsgY3JlYXRlU3lzdGVtTWVzc2FnZSwgY3JlYXRlVXNlck1lc3NhZ2UgfSBmcm9tICcuL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgZ2V0TWFpbkxvb3BNb2RlbCB9IGZyb20gJy4vbW9kZWwvbW9kZWwuanMnXG5pbXBvcnQgeyBpc1RyYW5zY3JpcHRNZXNzYWdlIH0gZnJvbSAnLi9zZXNzaW9uU3RvcmFnZS5qcydcbmltcG9ydCB7IGdldFNldHRpbmdzX0RFUFJFQ0FURUQgfSBmcm9tICcuL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsganNvblN0cmluZ2lmeSB9IGZyb20gJy4vc2xvd09wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBhc1N5c3RlbVByb21wdCB9IGZyb20gJy4vc3lzdGVtUHJvbXB0VHlwZS5qcydcbmltcG9ydCB7XG4gIGZldGNoU2Vzc2lvbixcbiAgdHlwZSBHaXRSZXBvc2l0b3J5T3V0Y29tZSxcbiAgdHlwZSBHaXRTb3VyY2UsXG4gIGdldEJyYW5jaEZyb21TZXNzaW9uLFxuICBnZXRPQXV0aEhlYWRlcnMsXG4gIHR5cGUgU2Vzc2lvblJlc291cmNlLFxufSBmcm9tICcuL3RlbGVwb3J0L2FwaS5qcydcbmltcG9ydCB7IGZldGNoRW52aXJvbm1lbnRzIH0gZnJvbSAnLi90ZWxlcG9ydC9lbnZpcm9ubWVudHMuanMnXG5pbXBvcnQgeyBjcmVhdGVBbmRVcGxvYWRHaXRCdW5kbGUgfSBmcm9tICcuL3RlbGVwb3J0L2dpdEJ1bmRsZS5qcydcblxuZXhwb3J0IHR5cGUgVGVsZXBvcnRSZXN1bHQgPSB7XG4gIG1lc3NhZ2VzOiBNZXNzYWdlW11cbiAgYnJhbmNoTmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIFRlbGVwb3J0UHJvZ3Jlc3NTdGVwID1cbiAgfCAndmFsaWRhdGluZydcbiAgfCAnZmV0Y2hpbmdfbG9ncydcbiAgfCAnZmV0Y2hpbmdfYnJhbmNoJ1xuICB8ICdjaGVja2luZ19vdXQnXG4gIHwgJ2RvbmUnXG5cbmV4cG9ydCB0eXBlIFRlbGVwb3J0UHJvZ3Jlc3NDYWxsYmFjayA9IChzdGVwOiBUZWxlcG9ydFByb2dyZXNzU3RlcCkgPT4gdm9pZFxuXG4vKipcbiAqIENyZWF0ZXMgYSBzeXN0ZW0gbWVzc2FnZSB0byBpbmZvcm0gYWJvdXQgdGVsZXBvcnQgc2Vzc2lvbiByZXN1bWVcbiAqIEByZXR1cm5zIFN5c3RlbU1lc3NhZ2UgaW5kaWNhdGluZyBzZXNzaW9uIHdhcyByZXN1bWVkIGZyb20gYW5vdGhlciBtYWNoaW5lXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRlbGVwb3J0UmVzdW1lU3lzdGVtTWVzc2FnZShcbiAgYnJhbmNoRXJyb3I6IEVycm9yIHwgbnVsbCxcbik6IFN5c3RlbU1lc3NhZ2Uge1xuICBpZiAoYnJhbmNoRXJyb3IgPT09IG51bGwpIHtcbiAgICByZXR1cm4gY3JlYXRlU3lzdGVtTWVzc2FnZSgnU2Vzc2lvbiByZXN1bWVkJywgJ3N1Z2dlc3Rpb24nKVxuICB9XG4gIGNvbnN0IGZvcm1hdHRlZEVycm9yID1cbiAgICBicmFuY2hFcnJvciBpbnN0YW5jZW9mIFRlbGVwb3J0T3BlcmF0aW9uRXJyb3JcbiAgICAgID8gYnJhbmNoRXJyb3IuZm9ybWF0dGVkTWVzc2FnZVxuICAgICAgOiBicmFuY2hFcnJvci5tZXNzYWdlXG4gIHJldHVybiBjcmVhdGVTeXN0ZW1NZXNzYWdlKFxuICAgIGBTZXNzaW9uIHJlc3VtZWQgd2l0aG91dCBicmFuY2g6ICR7Zm9ybWF0dGVkRXJyb3J9YCxcbiAgICAnd2FybmluZycsXG4gIClcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgdXNlciBtZXNzYWdlIHRvIGluZm9ybSB0aGUgbW9kZWwgYWJvdXQgdGVsZXBvcnQgc2Vzc2lvbiByZXN1bWVcbiAqIEByZXR1cm5zIFVzZXIgbWVzc2FnZSBpbmRpY2F0aW5nIHNlc3Npb24gd2FzIHJlc3VtZWQgZnJvbSBhbm90aGVyIG1hY2hpbmVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVGVsZXBvcnRSZXN1bWVVc2VyTWVzc2FnZSgpIHtcbiAgcmV0dXJuIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICBjb250ZW50OiBgVGhpcyBzZXNzaW9uIGlzIGJlaW5nIGNvbnRpbnVlZCBmcm9tIGFub3RoZXIgbWFjaGluZS4gQXBwbGljYXRpb24gc3RhdGUgbWF5IGhhdmUgY2hhbmdlZC4gVGhlIHVwZGF0ZWQgd29ya2luZyBkaXJlY3RvcnkgaXMgJHtnZXRPcmlnaW5hbEN3ZCgpfWAsXG4gICAgaXNNZXRhOiB0cnVlLFxuICB9KVxufVxuXG50eXBlIFRlbGVwb3J0VG9SZW1vdGVSZXNwb25zZSA9IHtcbiAgaWQ6IHN0cmluZ1xuICB0aXRsZTogc3RyaW5nXG59XG5cbmNvbnN0IFNFU1NJT05fVElUTEVfQU5EX0JSQU5DSF9QUk9NUFQgPSBgWW91IGFyZSBjb21pbmcgdXAgd2l0aCBhIHN1Y2NpbmN0IHRpdGxlIGFuZCBnaXQgYnJhbmNoIG5hbWUgZm9yIGEgY29kaW5nIHNlc3Npb24gYmFzZWQgb24gdGhlIHByb3ZpZGVkIGRlc2NyaXB0aW9uLiBUaGUgdGl0bGUgc2hvdWxkIGJlIGNsZWFyLCBjb25jaXNlLCBhbmQgYWNjdXJhdGVseSByZWZsZWN0IHRoZSBjb250ZW50IG9mIHRoZSBjb2RpbmcgdGFzay5cbllvdSBzaG91bGQga2VlcCBpdCBzaG9ydCBhbmQgc2ltcGxlLCBpZGVhbGx5IG5vIG1vcmUgdGhhbiA2IHdvcmRzLiBBdm9pZCB1c2luZyBqYXJnb24gb3Igb3Zlcmx5IHRlY2huaWNhbCB0ZXJtcyB1bmxlc3MgYWJzb2x1dGVseSBuZWNlc3NhcnkuIFRoZSB0aXRsZSBzaG91bGQgYmUgZWFzeSB0byB1bmRlcnN0YW5kIGZvciBhbnlvbmUgcmVhZGluZyBpdC5cblVzZSBzZW50ZW5jZSBjYXNlIGZvciB0aGUgdGl0bGUgKGNhcGl0YWxpemUgb25seSB0aGUgZmlyc3Qgd29yZCBhbmQgcHJvcGVyIG5vdW5zKSwgbm90IFRpdGxlIENhc2UuXG5cblRoZSBicmFuY2ggbmFtZSBzaG91bGQgYmUgY2xlYXIsIGNvbmNpc2UsIGFuZCBhY2N1cmF0ZWx5IHJlZmxlY3QgdGhlIGNvbnRlbnQgb2YgdGhlIGNvZGluZyB0YXNrLlxuWW91IHNob3VsZCBrZWVwIGl0IHNob3J0IGFuZCBzaW1wbGUsIGlkZWFsbHkgbm8gbW9yZSB0aGFuIDQgd29yZHMuIFRoZSBicmFuY2ggc2hvdWxkIGFsd2F5cyBzdGFydCB3aXRoIFwiY2xhdWRlL1wiIGFuZCBzaG91bGQgYmUgYWxsIGxvd2VyIGNhc2UsIHdpdGggd29yZHMgc2VwYXJhdGVkIGJ5IGRhc2hlcy5cblxuUmV0dXJuIGEgSlNPTiBvYmplY3Qgd2l0aCBcInRpdGxlXCIgYW5kIFwiYnJhbmNoXCIgZmllbGRzLlxuXG5FeGFtcGxlIDE6IHtcInRpdGxlXCI6IFwiRml4IGxvZ2luIGJ1dHRvbiBub3Qgd29ya2luZyBvbiBtb2JpbGVcIiwgXCJicmFuY2hcIjogXCJjbGF1ZGUvZml4LW1vYmlsZS1sb2dpbi1idXR0b25cIn1cbkV4YW1wbGUgMjoge1widGl0bGVcIjogXCJVcGRhdGUgUkVBRE1FIHdpdGggaW5zdGFsbGF0aW9uIGluc3RydWN0aW9uc1wiLCBcImJyYW5jaFwiOiBcImNsYXVkZS91cGRhdGUtcmVhZG1lXCJ9XG5FeGFtcGxlIDM6IHtcInRpdGxlXCI6IFwiSW1wcm92ZSBwZXJmb3JtYW5jZSBvZiBkYXRhIHByb2Nlc3Npbmcgc2NyaXB0XCIsIFwiYnJhbmNoXCI6IFwiY2xhdWRlL2ltcHJvdmUtZGF0YS1wcm9jZXNzaW5nXCJ9XG5cbkhlcmUgaXMgdGhlIHNlc3Npb24gZGVzY3JpcHRpb246XG48ZGVzY3JpcHRpb24+e2Rlc2NyaXB0aW9ufTwvZGVzY3JpcHRpb24+XG5QbGVhc2UgZ2VuZXJhdGUgYSB0aXRsZSBhbmQgYnJhbmNoIG5hbWUgZm9yIHRoaXMgc2Vzc2lvbi5gXG5cbnR5cGUgVGl0bGVBbmRCcmFuY2ggPSB7XG4gIHRpdGxlOiBzdHJpbmdcbiAgYnJhbmNoTmFtZTogc3RyaW5nXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgdGl0bGUgYW5kIGJyYW5jaCBuYW1lIGZvciBhIGNvZGluZyBzZXNzaW9uIHVzaW5nIENsYXVkZSBIYWlrdVxuICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvbi9wcm9tcHQgZm9yIHRoZSBzZXNzaW9uXG4gKiBAcmV0dXJucyBQcm9taXNlPFRpdGxlQW5kQnJhbmNoPiBUaGUgZ2VuZXJhdGVkIHRpdGxlIGFuZCBicmFuY2ggbmFtZVxuICovXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVRpdGxlQW5kQnJhbmNoKFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBzaWduYWw6IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTxUaXRsZUFuZEJyYW5jaD4ge1xuICBjb25zdCBmYWxsYmFja1RpdGxlID0gdHJ1bmNhdGVUb1dpZHRoKGRlc2NyaXB0aW9uLCA3NSlcbiAgY29uc3QgZmFsbGJhY2tCcmFuY2ggPSAnY2xhdWRlL3Rhc2snXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB1c2VyUHJvbXB0ID0gU0VTU0lPTl9USVRMRV9BTkRfQlJBTkNIX1BST01QVC5yZXBsYWNlKFxuICAgICAgJ3tkZXNjcmlwdGlvbn0nLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgKVxuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBxdWVyeUhhaWt1KHtcbiAgICAgIHN5c3RlbVByb21wdDogYXNTeXN0ZW1Qcm9tcHQoW10pLFxuICAgICAgdXNlclByb21wdCxcbiAgICAgIG91dHB1dEZvcm1hdDoge1xuICAgICAgICB0eXBlOiAnanNvbl9zY2hlbWEnLFxuICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICB0aXRsZTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgYnJhbmNoOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZXF1aXJlZDogWyd0aXRsZScsICdicmFuY2gnXSxcbiAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc2lnbmFsLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBxdWVyeVNvdXJjZTogJ3RlbGVwb3J0X2dlbmVyYXRlX3RpdGxlJyxcbiAgICAgICAgYWdlbnRzOiBbXSxcbiAgICAgICAgaXNOb25JbnRlcmFjdGl2ZVNlc3Npb246IGZhbHNlLFxuICAgICAgICBoYXNBcHBlbmRTeXN0ZW1Qcm9tcHQ6IGZhbHNlLFxuICAgICAgICBtY3BUb29sczogW10sXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBFeHRyYWN0IHRleHQgZnJvbSB0aGUgcmVzcG9uc2VcbiAgICBjb25zdCBmaXJzdEJsb2NrID0gcmVzcG9uc2UubWVzc2FnZS5jb250ZW50WzBdXG4gICAgaWYgKGZpcnN0QmxvY2s/LnR5cGUgIT09ICd0ZXh0Jykge1xuICAgICAgcmV0dXJuIHsgdGl0bGU6IGZhbGxiYWNrVGl0bGUsIGJyYW5jaE5hbWU6IGZhbGxiYWNrQnJhbmNoIH1cbiAgICB9XG5cbiAgICBjb25zdCBwYXJzZWQgPSBzYWZlUGFyc2VKU09OKGZpcnN0QmxvY2sudGV4dC50cmltKCkpXG4gICAgY29uc3QgcGFyc2VSZXN1bHQgPSB6XG4gICAgICAub2JqZWN0KHsgdGl0bGU6IHouc3RyaW5nKCksIGJyYW5jaDogei5zdHJpbmcoKSB9KVxuICAgICAgLnNhZmVQYXJzZShwYXJzZWQpXG4gICAgaWYgKHBhcnNlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRpdGxlOiBwYXJzZVJlc3VsdC5kYXRhLnRpdGxlIHx8IGZhbGxiYWNrVGl0bGUsXG4gICAgICAgIGJyYW5jaE5hbWU6IHBhcnNlUmVzdWx0LmRhdGEuYnJhbmNoIHx8IGZhbGxiYWNrQnJhbmNoLFxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IHRpdGxlOiBmYWxsYmFja1RpdGxlLCBicmFuY2hOYW1lOiBmYWxsYmFja0JyYW5jaCB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nRXJyb3IobmV3IEVycm9yKGBFcnJvciBnZW5lcmF0aW5nIHRpdGxlIGFuZCBicmFuY2g6ICR7ZXJyb3J9YCkpXG4gICAgcmV0dXJuIHsgdGl0bGU6IGZhbGxiYWNrVGl0bGUsIGJyYW5jaE5hbWU6IGZhbGxiYWNrQnJhbmNoIH1cbiAgfVxufVxuXG4vKipcbiAqIFZhbGlkYXRlcyB0aGF0IHRoZSBnaXQgd29ya2luZyBkaXJlY3RvcnkgaXMgY2xlYW4gKGlnbm9yaW5nIHVudHJhY2tlZCBmaWxlcylcbiAqIFVudHJhY2tlZCBmaWxlcyBhcmUgaWdub3JlZCBiZWNhdXNlIHRoZXkgd29uJ3QgYmUgbG9zdCBkdXJpbmcgYnJhbmNoIHN3aXRjaGluZ1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVHaXRTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgaXNDbGVhbiA9IGF3YWl0IGdldElzQ2xlYW4oeyBpZ25vcmVVbnRyYWNrZWQ6IHRydWUgfSlcbiAgaWYgKCFpc0NsZWFuKSB7XG4gICAgbG9nRXZlbnQoJ3Rlbmd1X3RlbGVwb3J0X2Vycm9yX2dpdF9ub3RfY2xlYW4nLCB7fSlcbiAgICBjb25zdCBlcnJvciA9IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgJ0dpdCB3b3JraW5nIGRpcmVjdG9yeSBpcyBub3QgY2xlYW4uIFBsZWFzZSBjb21taXQgb3Igc3Rhc2ggeW91ciBjaGFuZ2VzIGJlZm9yZSB1c2luZyAtLXRlbGVwb3J0LicsXG4gICAgICBjaGFsay5yZWQoXG4gICAgICAgICdFcnJvcjogR2l0IHdvcmtpbmcgZGlyZWN0b3J5IGlzIG5vdCBjbGVhbi4gUGxlYXNlIGNvbW1pdCBvciBzdGFzaCB5b3VyIGNoYW5nZXMgYmVmb3JlIHVzaW5nIC0tdGVsZXBvcnQuXFxuJyxcbiAgICAgICksXG4gICAgKVxuICAgIHRocm93IGVycm9yXG4gIH1cbn1cblxuLyoqXG4gKiBGZXRjaGVzIGEgc3BlY2lmaWMgYnJhbmNoIGZyb20gcmVtb3RlIG9yaWdpblxuICogQHBhcmFtIGJyYW5jaCBUaGUgYnJhbmNoIHRvIGZldGNoLiBJZiBub3Qgc3BlY2lmaWVkLCBmZXRjaGVzIGFsbCBicmFuY2hlcy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmV0Y2hGcm9tT3JpZ2luKGJyYW5jaD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBmZXRjaEFyZ3MgPSBicmFuY2hcbiAgICA/IFsnZmV0Y2gnLCAnb3JpZ2luJywgYCR7YnJhbmNofToke2JyYW5jaH1gXVxuICAgIDogWydmZXRjaCcsICdvcmlnaW4nXVxuXG4gIGNvbnN0IHsgY29kZTogZmV0Y2hDb2RlLCBzdGRlcnI6IGZldGNoU3RkZXJyIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coXG4gICAgZ2l0RXhlKCksXG4gICAgZmV0Y2hBcmdzLFxuICApXG4gIGlmIChmZXRjaENvZGUgIT09IDApIHtcbiAgICAvLyBJZiBmZXRjaGluZyBhIHNwZWNpZmljIGJyYW5jaCBmYWlscywgaXQgbWlnaHQgbm90IGV4aXN0IGxvY2FsbHkgeWV0XG4gICAgLy8gVHJ5IGZldGNoaW5nIGp1c3QgdGhlIHJlZiB3aXRob3V0IG1hcHBpbmcgdG8gbG9jYWwgYnJhbmNoXG4gICAgaWYgKGJyYW5jaCAmJiBmZXRjaFN0ZGVyci5pbmNsdWRlcygncmVmc3BlYycpKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBTcGVjaWZpYyBicmFuY2ggZmV0Y2ggZmFpbGVkLCB0cnlpbmcgdG8gZmV0Y2ggcmVmOiAke2JyYW5jaH1gLFxuICAgICAgKVxuICAgICAgY29uc3QgeyBjb2RlOiByZWZGZXRjaENvZGUsIHN0ZGVycjogcmVmRmV0Y2hTdGRlcnIgfSA9XG4gICAgICAgIGF3YWl0IGV4ZWNGaWxlTm9UaHJvdyhnaXRFeGUoKSwgWydmZXRjaCcsICdvcmlnaW4nLCBicmFuY2hdKVxuICAgICAgaWYgKHJlZkZldGNoQ29kZSAhPT0gMCkge1xuICAgICAgICBsb2dFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoYEZhaWxlZCB0byBmZXRjaCBmcm9tIHJlbW90ZSBvcmlnaW46ICR7cmVmRmV0Y2hTdGRlcnJ9YCksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nRXJyb3IobmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggZnJvbSByZW1vdGUgb3JpZ2luOiAke2ZldGNoU3RkZXJyfWApKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEVuc3VyZXMgdGhhdCB0aGUgY3VycmVudCBicmFuY2ggaGFzIGFuIHVwc3RyZWFtIHNldFxuICogSWYgbm90LCBzZXRzIGl0IHRvIG9yaWdpbi88YnJhbmNoTmFtZT4gaWYgdGhhdCByZW1vdGUgYnJhbmNoIGV4aXN0c1xuICovXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVcHN0cmVhbUlzU2V0KGJyYW5jaE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAvLyBDaGVjayBpZiB1cHN0cmVhbSBpcyBhbHJlYWR5IHNldFxuICBjb25zdCB7IGNvZGU6IHVwc3RyZWFtQ2hlY2tDb2RlIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coZ2l0RXhlKCksIFtcbiAgICAncmV2LXBhcnNlJyxcbiAgICAnLS1hYmJyZXYtcmVmJyxcbiAgICBgJHticmFuY2hOYW1lfUB7dXBzdHJlYW19YCxcbiAgXSlcblxuICBpZiAodXBzdHJlYW1DaGVja0NvZGUgPT09IDApIHtcbiAgICAvLyBVcHN0cmVhbSBpcyBhbHJlYWR5IHNldFxuICAgIGxvZ0ZvckRlYnVnZ2luZyhgQnJhbmNoICcke2JyYW5jaE5hbWV9JyBhbHJlYWR5IGhhcyB1cHN0cmVhbSBzZXRgKVxuICAgIHJldHVyblxuICB9XG5cbiAgLy8gQ2hlY2sgaWYgb3JpZ2luLzxicmFuY2hOYW1lPiBleGlzdHNcbiAgY29uc3QgeyBjb2RlOiByZW1vdGVDaGVja0NvZGUgfSA9IGF3YWl0IGV4ZWNGaWxlTm9UaHJvdyhnaXRFeGUoKSwgW1xuICAgICdyZXYtcGFyc2UnLFxuICAgICctLXZlcmlmeScsXG4gICAgYG9yaWdpbi8ke2JyYW5jaE5hbWV9YCxcbiAgXSlcblxuICBpZiAocmVtb3RlQ2hlY2tDb2RlID09PSAwKSB7XG4gICAgLy8gUmVtb3RlIGJyYW5jaCBleGlzdHMsIHNldCB1cHN0cmVhbVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBTZXR0aW5nIHVwc3RyZWFtIGZvciAnJHticmFuY2hOYW1lfScgdG8gJ29yaWdpbi8ke2JyYW5jaE5hbWV9J2AsXG4gICAgKVxuICAgIGNvbnN0IHsgY29kZTogc2V0VXBzdHJlYW1Db2RlLCBzdGRlcnI6IHNldFVwc3RyZWFtU3RkZXJyIH0gPVxuICAgICAgYXdhaXQgZXhlY0ZpbGVOb1Rocm93KGdpdEV4ZSgpLCBbXG4gICAgICAgICdicmFuY2gnLFxuICAgICAgICAnLS1zZXQtdXBzdHJlYW0tdG8nLFxuICAgICAgICBgb3JpZ2luLyR7YnJhbmNoTmFtZX1gLFxuICAgICAgICBicmFuY2hOYW1lLFxuICAgICAgXSlcblxuICAgIGlmIChzZXRVcHN0cmVhbUNvZGUgIT09IDApIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYEZhaWxlZCB0byBzZXQgdXBzdHJlYW0gZm9yICcke2JyYW5jaE5hbWV9JzogJHtzZXRVcHN0cmVhbVN0ZGVycn1gLFxuICAgICAgKVxuICAgICAgLy8gRG9uJ3QgdGhyb3csIGp1c3QgbG9nIC0gdGhpcyBpcyBub3QgY3JpdGljYWxcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nRm9yRGVidWdnaW5nKGBTdWNjZXNzZnVsbHkgc2V0IHVwc3RyZWFtIGZvciAnJHticmFuY2hOYW1lfSdgKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICBgUmVtb3RlIGJyYW5jaCAnb3JpZ2luLyR7YnJhbmNoTmFtZX0nIGRvZXMgbm90IGV4aXN0LCBza2lwcGluZyB1cHN0cmVhbSBzZXR1cGAsXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIG91dCBhIHNwZWNpZmljIGJyYW5jaFxuICovXG5hc3luYyBmdW5jdGlvbiBjaGVja291dEJyYW5jaChicmFuY2hOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gRmlyc3QgdHJ5IHRvIGNoZWNrb3V0IHRoZSBicmFuY2ggYXMtaXMgKG1pZ2h0IGJlIGxvY2FsKVxuICBsZXQgeyBjb2RlOiBjaGVja291dENvZGUsIHN0ZGVycjogY2hlY2tvdXRTdGRlcnIgfSA9IGF3YWl0IGV4ZWNGaWxlTm9UaHJvdyhcbiAgICBnaXRFeGUoKSxcbiAgICBbJ2NoZWNrb3V0JywgYnJhbmNoTmFtZV0sXG4gIClcblxuICAvLyBJZiB0aGF0IGZhaWxzLCB0cnkgdG8gY2hlY2tvdXQgZnJvbSBvcmlnaW5cbiAgaWYgKGNoZWNrb3V0Q29kZSAhPT0gMCkge1xuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBMb2NhbCBjaGVja291dCBmYWlsZWQsIHRyeWluZyB0byBjaGVja291dCBmcm9tIG9yaWdpbjogJHtjaGVja291dFN0ZGVycn1gLFxuICAgIClcblxuICAgIC8vIFRyeSB0byBjaGVja291dCB0aGUgcmVtb3RlIGJyYW5jaCBhbmQgY3JlYXRlIGEgbG9jYWwgdHJhY2tpbmcgYnJhbmNoXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KGdpdEV4ZSgpLCBbXG4gICAgICAnY2hlY2tvdXQnLFxuICAgICAgJy1iJyxcbiAgICAgIGJyYW5jaE5hbWUsXG4gICAgICAnLS10cmFjaycsXG4gICAgICBgb3JpZ2luLyR7YnJhbmNoTmFtZX1gLFxuICAgIF0pXG5cbiAgICBjaGVja291dENvZGUgPSByZXN1bHQuY29kZVxuICAgIGNoZWNrb3V0U3RkZXJyID0gcmVzdWx0LnN0ZGVyclxuXG4gICAgLy8gSWYgdGhhdCBhbHNvIGZhaWxzLCB0cnkgd2l0aG91dCAtYiBpbiBjYXNlIHRoZSBicmFuY2ggZXhpc3RzIGJ1dCBpc24ndCBjaGVja2VkIG91dFxuICAgIGlmIChjaGVja291dENvZGUgIT09IDApIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFJlbW90ZSBjaGVja291dCB3aXRoIC1iIGZhaWxlZCwgdHJ5aW5nIHdpdGhvdXQgLWI6ICR7Y2hlY2tvdXRTdGRlcnJ9YCxcbiAgICAgIClcbiAgICAgIGNvbnN0IGZpbmFsUmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KGdpdEV4ZSgpLCBbXG4gICAgICAgICdjaGVja291dCcsXG4gICAgICAgICctLXRyYWNrJyxcbiAgICAgICAgYG9yaWdpbi8ke2JyYW5jaE5hbWV9YCxcbiAgICAgIF0pXG4gICAgICBjaGVja291dENvZGUgPSBmaW5hbFJlc3VsdC5jb2RlXG4gICAgICBjaGVja291dFN0ZGVyciA9IGZpbmFsUmVzdWx0LnN0ZGVyclxuICAgIH1cbiAgfVxuXG4gIGlmIChjaGVja291dENvZGUgIT09IDApIHtcbiAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfZXJyb3JfYnJhbmNoX2NoZWNrb3V0X2ZhaWxlZCcsIHt9KVxuICAgIHRocm93IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgYEZhaWxlZCB0byBjaGVja291dCBicmFuY2ggJyR7YnJhbmNoTmFtZX0nOiAke2NoZWNrb3V0U3RkZXJyfWAsXG4gICAgICBjaGFsay5yZWQoYEZhaWxlZCB0byBjaGVja291dCBicmFuY2ggJyR7YnJhbmNoTmFtZX0nXFxuYCksXG4gICAgKVxuICB9XG5cbiAgLy8gQWZ0ZXIgc3VjY2Vzc2Z1bCBjaGVja291dCwgZW5zdXJlIHVwc3RyZWFtIGlzIHNldFxuICBhd2FpdCBlbnN1cmVVcHN0cmVhbUlzU2V0KGJyYW5jaE5hbWUpXG59XG5cbi8qKlxuICogR2V0cyB0aGUgY3VycmVudCBicmFuY2ggbmFtZVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRDdXJyZW50QnJhbmNoKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHsgc3Rkb3V0OiBjdXJyZW50QnJhbmNoIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coZ2l0RXhlKCksIFtcbiAgICAnYnJhbmNoJyxcbiAgICAnLS1zaG93LWN1cnJlbnQnLFxuICBdKVxuICByZXR1cm4gY3VycmVudEJyYW5jaC50cmltKClcbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgbWVzc2FnZXMgZm9yIHRlbGVwb3J0IHJlc3VtZSwgcmVtb3ZpbmcgaW5jb21wbGV0ZSB0b29sX3VzZSBibG9ja3NcbiAqIGFuZCBhZGRpbmcgdGVsZXBvcnQgbm90aWNlIG1lc3NhZ2VzXG4gKiBAcGFyYW0gbWVzc2FnZXMgVGhlIGNvbnZlcnNhdGlvbiBtZXNzYWdlc1xuICogQHBhcmFtIGVycm9yIE9wdGlvbmFsIGVycm9yIGZyb20gYnJhbmNoIGNoZWNrb3V0XG4gKiBAcmV0dXJucyBQcm9jZXNzZWQgbWVzc2FnZXMgcmVhZHkgZm9yIHJlc3VtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc01lc3NhZ2VzRm9yVGVsZXBvcnRSZXN1bWUoXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10sXG4gIGVycm9yOiBFcnJvciB8IG51bGwsXG4pOiBNZXNzYWdlW10ge1xuICAvLyBTaGFyZWQgbG9naWMgd2l0aCByZXN1bWUgZm9yIGhhbmRsaW5nIGludGVycnVwZWQgc2Vzc2lvbiB0cmFuc2NyaXB0c1xuICBjb25zdCBkZXNlcmlhbGl6ZWRNZXNzYWdlcyA9IGRlc2VyaWFsaXplTWVzc2FnZXMobWVzc2FnZXMpXG5cbiAgLy8gQWRkIHVzZXIgbWVzc2FnZSBhYm91dCB0ZWxlcG9ydCByZXN1bWUgKHZpc2libGUgdG8gbW9kZWwpXG4gIGNvbnN0IG1lc3NhZ2VzV2l0aFRlbGVwb3J0Tm90aWNlID0gW1xuICAgIC4uLmRlc2VyaWFsaXplZE1lc3NhZ2VzLFxuICAgIGNyZWF0ZVRlbGVwb3J0UmVzdW1lVXNlck1lc3NhZ2UoKSxcbiAgICBjcmVhdGVUZWxlcG9ydFJlc3VtZVN5c3RlbU1lc3NhZ2UoZXJyb3IpLFxuICBdXG5cbiAgcmV0dXJuIG1lc3NhZ2VzV2l0aFRlbGVwb3J0Tm90aWNlXG59XG5cbi8qKlxuICogQ2hlY2tzIG91dCB0aGUgc3BlY2lmaWVkIGJyYW5jaCBmb3IgYSB0ZWxlcG9ydGVkIHNlc3Npb25cbiAqIEBwYXJhbSBicmFuY2ggT3B0aW9uYWwgYnJhbmNoIHRvIGNoZWNrb3V0XG4gKiBAcmV0dXJucyBUaGUgY3VycmVudCBicmFuY2ggbmFtZSBhbmQgYW55IGVycm9yIHRoYXQgb2NjdXJyZWRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrT3V0VGVsZXBvcnRlZFNlc3Npb25CcmFuY2goXG4gIGJyYW5jaD86IHN0cmluZyxcbik6IFByb21pc2U8eyBicmFuY2hOYW1lOiBzdHJpbmc7IGJyYW5jaEVycm9yOiBFcnJvciB8IG51bGwgfT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGN1cnJlbnRCcmFuY2ggPSBhd2FpdCBnZXRDdXJyZW50QnJhbmNoKClcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoYEN1cnJlbnQgYnJhbmNoIGJlZm9yZSB0ZWxlcG9ydDogJyR7Y3VycmVudEJyYW5jaH0nYClcblxuICAgIGlmIChicmFuY2gpIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgU3dpdGNoaW5nIHRvIGJyYW5jaCAnJHticmFuY2h9Jy4uLmApXG4gICAgICBhd2FpdCBmZXRjaEZyb21PcmlnaW4oYnJhbmNoKVxuICAgICAgYXdhaXQgY2hlY2tvdXRCcmFuY2goYnJhbmNoKVxuICAgICAgY29uc3QgbmV3QnJhbmNoID0gYXdhaXQgZ2V0Q3VycmVudEJyYW5jaCgpXG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoYEJyYW5jaCBhZnRlciBjaGVja291dDogJyR7bmV3QnJhbmNofSdgKVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoJ05vIGJyYW5jaCBzcGVjaWZpZWQsIHN0YXlpbmcgb24gY3VycmVudCBicmFuY2gnKVxuICAgIH1cblxuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBhd2FpdCBnZXRDdXJyZW50QnJhbmNoKClcbiAgICByZXR1cm4geyBicmFuY2hOYW1lLCBicmFuY2hFcnJvcjogbnVsbCB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IGF3YWl0IGdldEN1cnJlbnRCcmFuY2goKVxuICAgIGNvbnN0IGJyYW5jaEVycm9yID0gdG9FcnJvcihlcnJvcilcbiAgICByZXR1cm4geyBicmFuY2hOYW1lLCBicmFuY2hFcnJvciB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZXN1bHQgb2YgcmVwb3NpdG9yeSB2YWxpZGF0aW9uIGZvciB0ZWxlcG9ydFxuICovXG5leHBvcnQgdHlwZSBSZXBvVmFsaWRhdGlvblJlc3VsdCA9IHtcbiAgc3RhdHVzOiAnbWF0Y2gnIHwgJ21pc21hdGNoJyB8ICdub3RfaW5fcmVwbycgfCAnbm9fcmVwb19yZXF1aXJlZCcgfCAnZXJyb3InXG4gIHNlc3Npb25SZXBvPzogc3RyaW5nXG4gIGN1cnJlbnRSZXBvPzogc3RyaW5nIHwgbnVsbFxuICAvKiogSG9zdCBvZiB0aGUgc2Vzc2lvbiByZXBvIChlLmcuIFwiZ2l0aHViLmNvbVwiIG9yIFwiZ2hlLmNvcnAuY29tXCIpIOKAlCBmb3IgZGlzcGxheSBvbmx5ICovXG4gIHNlc3Npb25Ib3N0Pzogc3RyaW5nXG4gIC8qKiBIb3N0IG9mIHRoZSBjdXJyZW50IHJlcG8gKGUuZy4gXCJnaXRodWIuY29tXCIgb3IgXCJnaGUuY29ycC5jb21cIikg4oCUIGZvciBkaXNwbGF5IG9ubHkgKi9cbiAgY3VycmVudEhvc3Q/OiBzdHJpbmdcbiAgZXJyb3JNZXNzYWdlPzogc3RyaW5nXG59XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgdGhlIGN1cnJlbnQgcmVwb3NpdG9yeSBtYXRjaGVzIHRoZSBzZXNzaW9uJ3MgcmVwb3NpdG9yeS5cbiAqIFJldHVybnMgYSByZXN1bHQgb2JqZWN0IGluc3RlYWQgb2YgdGhyb3dpbmcsIGFsbG93aW5nIHRoZSBjYWxsZXIgdG8gaGFuZGxlIG1pc21hdGNoZXMuXG4gKlxuICogQHBhcmFtIHNlc3Npb25EYXRhIFRoZSBzZXNzaW9uIHJlc291cmNlIHRvIHZhbGlkYXRlIGFnYWluc3RcbiAqIEByZXR1cm5zIFZhbGlkYXRpb24gcmVzdWx0IHdpdGggc3RhdHVzIGFuZCByZXBvIGluZm9ybWF0aW9uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2YWxpZGF0ZVNlc3Npb25SZXBvc2l0b3J5KFxuICBzZXNzaW9uRGF0YTogU2Vzc2lvblJlc291cmNlLFxuKTogUHJvbWlzZTxSZXBvVmFsaWRhdGlvblJlc3VsdD4ge1xuICBjb25zdCBjdXJyZW50UGFyc2VkID0gYXdhaXQgZGV0ZWN0Q3VycmVudFJlcG9zaXRvcnlXaXRoSG9zdCgpXG4gIGNvbnN0IGN1cnJlbnRSZXBvID0gY3VycmVudFBhcnNlZFxuICAgID8gYCR7Y3VycmVudFBhcnNlZC5vd25lcn0vJHtjdXJyZW50UGFyc2VkLm5hbWV9YFxuICAgIDogbnVsbFxuXG4gIGNvbnN0IGdpdFNvdXJjZSA9IHNlc3Npb25EYXRhLnNlc3Npb25fY29udGV4dC5zb3VyY2VzLmZpbmQoXG4gICAgKHNvdXJjZSk6IHNvdXJjZSBpcyBHaXRTb3VyY2UgPT4gc291cmNlLnR5cGUgPT09ICdnaXRfcmVwb3NpdG9yeScsXG4gIClcblxuICBpZiAoIWdpdFNvdXJjZT8udXJsKSB7XG4gICAgLy8gU2Vzc2lvbiBoYXMgbm8gcmVwbyByZXF1aXJlbWVudFxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGN1cnJlbnRSZXBvXG4gICAgICAgID8gJ1Nlc3Npb24gaGFzIG5vIGFzc29jaWF0ZWQgcmVwb3NpdG9yeSwgcHJvY2VlZGluZyB3aXRob3V0IHZhbGlkYXRpb24nXG4gICAgICAgIDogJ1Nlc3Npb24gaGFzIG5vIHJlcG8gcmVxdWlyZW1lbnQgYW5kIG5vdCBpbiBnaXQgZGlyZWN0b3J5LCBwcm9jZWVkaW5nJyxcbiAgICApXG4gICAgcmV0dXJuIHsgc3RhdHVzOiAnbm9fcmVwb19yZXF1aXJlZCcgfVxuICB9XG5cbiAgY29uc3Qgc2Vzc2lvblBhcnNlZCA9IHBhcnNlR2l0UmVtb3RlKGdpdFNvdXJjZS51cmwpXG4gIGNvbnN0IHNlc3Npb25SZXBvID0gc2Vzc2lvblBhcnNlZFxuICAgID8gYCR7c2Vzc2lvblBhcnNlZC5vd25lcn0vJHtzZXNzaW9uUGFyc2VkLm5hbWV9YFxuICAgIDogcGFyc2VHaXRIdWJSZXBvc2l0b3J5KGdpdFNvdXJjZS51cmwpXG4gIGlmICghc2Vzc2lvblJlcG8pIHtcbiAgICByZXR1cm4geyBzdGF0dXM6ICdub19yZXBvX3JlcXVpcmVkJyB9XG4gIH1cblxuICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgYFNlc3Npb24gaXMgZm9yIHJlcG9zaXRvcnk6ICR7c2Vzc2lvblJlcG99LCBjdXJyZW50IHJlcG86ICR7Y3VycmVudFJlcG8gPz8gJ25vbmUnfWAsXG4gIClcblxuICBpZiAoIWN1cnJlbnRSZXBvKSB7XG4gICAgLy8gTm90IGluIGEgZ2l0IHJlcG8sIGJ1dCBzZXNzaW9uIHJlcXVpcmVzIG9uZVxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6ICdub3RfaW5fcmVwbycsXG4gICAgICBzZXNzaW9uUmVwbyxcbiAgICAgIHNlc3Npb25Ib3N0OiBzZXNzaW9uUGFyc2VkPy5ob3N0LFxuICAgICAgY3VycmVudFJlcG86IG51bGwsXG4gICAgfVxuICB9XG5cbiAgLy8gQ29tcGFyZSBib3RoIG93bmVyL3JlcG8gYW5kIGhvc3QgdG8gYXZvaWQgY3Jvc3MtaW5zdGFuY2UgbWlzbWF0Y2hlcy5cbiAgLy8gU3RyaXAgcG9ydHMgYmVmb3JlIGNvbXBhcmluZyBob3N0cyDigJQgU1NIIHJlbW90ZXMgb21pdCB0aGUgcG9ydCB3aGlsZVxuICAvLyBIVFRQUyByZW1vdGVzIG1heSBpbmNsdWRlIGEgbm9uLXN0YW5kYXJkIHBvcnQgKGUuZy4gZ2hlLmNvcnAuY29tOjg0NDMpLFxuICAvLyB3aGljaCB3b3VsZCBjYXVzZSBhIGZhbHNlIG1pc21hdGNoLlxuICBjb25zdCBzdHJpcFBvcnQgPSAoaG9zdDogc3RyaW5nKTogc3RyaW5nID0+IGhvc3QucmVwbGFjZSgvOlxcZCskLywgJycpXG4gIGNvbnN0IHJlcG9NYXRjaCA9IGN1cnJlbnRSZXBvLnRvTG93ZXJDYXNlKCkgPT09IHNlc3Npb25SZXBvLnRvTG93ZXJDYXNlKClcbiAgY29uc3QgaG9zdE1hdGNoID1cbiAgICAhY3VycmVudFBhcnNlZCB8fFxuICAgICFzZXNzaW9uUGFyc2VkIHx8XG4gICAgc3RyaXBQb3J0KGN1cnJlbnRQYXJzZWQuaG9zdC50b0xvd2VyQ2FzZSgpKSA9PT1cbiAgICAgIHN0cmlwUG9ydChzZXNzaW9uUGFyc2VkLmhvc3QudG9Mb3dlckNhc2UoKSlcblxuICBpZiAocmVwb01hdGNoICYmIGhvc3RNYXRjaCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6ICdtYXRjaCcsXG4gICAgICBzZXNzaW9uUmVwbyxcbiAgICAgIGN1cnJlbnRSZXBvLFxuICAgIH1cbiAgfVxuXG4gIC8vIFJlcG8gbWlzbWF0Y2gg4oCUIGtlZXAgc2Vzc2lvblJlcG8vY3VycmVudFJlcG8gYXMgcGxhaW4gXCJvd25lci9yZXBvXCIgc29cbiAgLy8gZG93bnN0cmVhbSBjb25zdW1lcnMgKGUuZy4gZ2V0S25vd25QYXRoc0ZvclJlcG8pIGNhbiB1c2UgdGhlbSBhcyBsb29rdXAga2V5cy5cbiAgLy8gSW5jbHVkZSBob3N0IGluZm9ybWF0aW9uIGluIHNlcGFyYXRlIGZpZWxkcyBmb3IgZGlzcGxheSBwdXJwb3Nlcy5cbiAgcmV0dXJuIHtcbiAgICBzdGF0dXM6ICdtaXNtYXRjaCcsXG4gICAgc2Vzc2lvblJlcG8sXG4gICAgY3VycmVudFJlcG8sXG4gICAgc2Vzc2lvbkhvc3Q6IHNlc3Npb25QYXJzZWQ/Lmhvc3QsXG4gICAgY3VycmVudEhvc3Q6IGN1cnJlbnRQYXJzZWQ/Lmhvc3QsXG4gIH1cbn1cblxuLyoqXG4gKiBIYW5kbGVzIHRlbGVwb3J0aW5nIGZyb20gYSBjb2RlIHNlc3Npb24gSUQuXG4gKiBGZXRjaGVzIHNlc3Npb24gbG9ncyBhbmQgdmFsaWRhdGVzIHJlcG8uXG4gKiBAcGFyYW0gc2Vzc2lvbklkIFRoZSBzZXNzaW9uIElEIHRvIHJlc3VtZVxuICogQHBhcmFtIG9uUHJvZ3Jlc3MgT3B0aW9uYWwgY2FsbGJhY2sgZm9yIHByb2dyZXNzIHVwZGF0ZXNcbiAqIEByZXR1cm5zIFRoZSByYXcgc2Vzc2lvbiBsb2cgYW5kIGJyYW5jaCBuYW1lXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZWxlcG9ydFJlc3VtZUNvZGVTZXNzaW9uKFxuICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgb25Qcm9ncmVzcz86IFRlbGVwb3J0UHJvZ3Jlc3NDYWxsYmFjayxcbik6IFByb21pc2U8VGVsZXBvcnRSZW1vdGVSZXNwb25zZT4ge1xuICBpZiAoIWlzUG9saWN5QWxsb3dlZCgnYWxsb3dfcmVtb3RlX3Nlc3Npb25zJykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIlJlbW90ZSBzZXNzaW9ucyBhcmUgZGlzYWJsZWQgYnkgeW91ciBvcmdhbml6YXRpb24ncyBwb2xpY3kuXCIsXG4gICAgKVxuICB9XG5cbiAgbG9nRm9yRGVidWdnaW5nKGBSZXN1bWluZyBjb2RlIHNlc3Npb24gSUQ6ICR7c2Vzc2lvbklkfWApXG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhY2Nlc3NUb2tlbiA9IGdldENsYXVkZUFJT0F1dGhUb2tlbnMoKT8uYWNjZXNzVG9rZW5cbiAgICBpZiAoIWFjY2Vzc1Rva2VuKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfcmVzdW1lX2Vycm9yJywge1xuICAgICAgICBlcnJvcl90eXBlOlxuICAgICAgICAgICdub19hY2Nlc3NfdG9rZW4nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQ2xhdWRlIENvZGUgd2ViIHNlc3Npb25zIHJlcXVpcmUgYXV0aGVudGljYXRpb24gd2l0aCBhIENsYXVkZS5haSBhY2NvdW50LiBBUEkga2V5IGF1dGhlbnRpY2F0aW9uIGlzIG5vdCBzdWZmaWNpZW50LiBQbGVhc2UgcnVuIC9sb2dpbiB0byBhdXRoZW50aWNhdGUsIG9yIGNoZWNrIHlvdXIgYXV0aGVudGljYXRpb24gc3RhdHVzIHdpdGggL3N0YXR1cy4nLFxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIEdldCBvcmdhbml6YXRpb24gVVVJRFxuICAgIGNvbnN0IG9yZ1VVSUQgPSBhd2FpdCBnZXRPcmdhbml6YXRpb25VVUlEKClcbiAgICBpZiAoIW9yZ1VVSUQpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZWxlcG9ydF9yZXN1bWVfZXJyb3InLCB7XG4gICAgICAgIGVycm9yX3R5cGU6XG4gICAgICAgICAgJ25vX29yZ191dWlkJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1VuYWJsZSB0byBnZXQgb3JnYW5pemF0aW9uIFVVSUQgZm9yIGNvbnN0cnVjdGluZyBzZXNzaW9uIFVSTCcsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gRmV0Y2ggYW5kIHZhbGlkYXRlIHJlcG9zaXRvcnkgbWF0Y2hlcyBiZWZvcmUgcmVzdW1pbmdcbiAgICBvblByb2dyZXNzPy4oJ3ZhbGlkYXRpbmcnKVxuICAgIGNvbnN0IHNlc3Npb25EYXRhID0gYXdhaXQgZmV0Y2hTZXNzaW9uKHNlc3Npb25JZClcbiAgICBjb25zdCByZXBvVmFsaWRhdGlvbiA9IGF3YWl0IHZhbGlkYXRlU2Vzc2lvblJlcG9zaXRvcnkoc2Vzc2lvbkRhdGEpXG5cbiAgICBzd2l0Y2ggKHJlcG9WYWxpZGF0aW9uLnN0YXR1cykge1xuICAgICAgY2FzZSAnbWF0Y2gnOlxuICAgICAgY2FzZSAnbm9fcmVwb19yZXF1aXJlZCc6XG4gICAgICAgIC8vIFByb2NlZWQgd2l0aCB0ZWxlcG9ydFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnbm90X2luX3JlcG8nOiB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZWxlcG9ydF9lcnJvcl9yZXBvX25vdF9pbl9naXRfZGlyX3Nlc3Npb25zX2FwaScsIHtcbiAgICAgICAgICBzZXNzaW9uSWQ6XG4gICAgICAgICAgICBzZXNzaW9uSWQgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgLy8gSW5jbHVkZSBob3N0IGZvciBHSEUgdXNlcnMgc28gdGhleSBrbm93IHdoaWNoIGluc3RhbmNlIHRoZSByZXBvIGlzIG9uXG4gICAgICAgIGNvbnN0IG5vdEluUmVwb0Rpc3BsYXkgPVxuICAgICAgICAgIHJlcG9WYWxpZGF0aW9uLnNlc3Npb25Ib3N0ICYmXG4gICAgICAgICAgcmVwb1ZhbGlkYXRpb24uc2Vzc2lvbkhvc3QudG9Mb3dlckNhc2UoKSAhPT0gJ2dpdGh1Yi5jb20nXG4gICAgICAgICAgICA/IGAke3JlcG9WYWxpZGF0aW9uLnNlc3Npb25Ib3N0fS8ke3JlcG9WYWxpZGF0aW9uLnNlc3Npb25SZXBvfWBcbiAgICAgICAgICAgIDogcmVwb1ZhbGlkYXRpb24uc2Vzc2lvblJlcG9cbiAgICAgICAgdGhyb3cgbmV3IFRlbGVwb3J0T3BlcmF0aW9uRXJyb3IoXG4gICAgICAgICAgYFlvdSBtdXN0IHJ1biBjbGF1ZGUgLS10ZWxlcG9ydCAke3Nlc3Npb25JZH0gZnJvbSBhIGNoZWNrb3V0IG9mICR7bm90SW5SZXBvRGlzcGxheX0uYCxcbiAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICBgWW91IG11c3QgcnVuIGNsYXVkZSAtLXRlbGVwb3J0ICR7c2Vzc2lvbklkfSBmcm9tIGEgY2hlY2tvdXQgb2YgJHtjaGFsay5ib2xkKG5vdEluUmVwb0Rpc3BsYXkpfS5cXG5gLFxuICAgICAgICAgICksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGNhc2UgJ21pc21hdGNoJzoge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfZXJyb3JfcmVwb19taXNtYXRjaF9zZXNzaW9uc19hcGknLCB7XG4gICAgICAgICAgc2Vzc2lvbklkOlxuICAgICAgICAgICAgc2Vzc2lvbklkIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICAgIC8vIE9ubHkgaW5jbHVkZSBob3N0IHByZWZpeCB3aGVuIGhvc3RzIGFjdHVhbGx5IGRpZmZlciB0byBkaXNhbWJpZ3VhdGVcbiAgICAgICAgLy8gY3Jvc3MtaW5zdGFuY2UgbWlzbWF0Y2hlczsgZm9yIHNhbWUtaG9zdCBtaXNtYXRjaGVzIHRoZSBob3N0IGlzIG5vaXNlLlxuICAgICAgICBjb25zdCBob3N0c0RpZmZlciA9XG4gICAgICAgICAgcmVwb1ZhbGlkYXRpb24uc2Vzc2lvbkhvc3QgJiZcbiAgICAgICAgICByZXBvVmFsaWRhdGlvbi5jdXJyZW50SG9zdCAmJlxuICAgICAgICAgIHJlcG9WYWxpZGF0aW9uLnNlc3Npb25Ib3N0LnJlcGxhY2UoLzpcXGQrJC8sICcnKS50b0xvd2VyQ2FzZSgpICE9PVxuICAgICAgICAgICAgcmVwb1ZhbGlkYXRpb24uY3VycmVudEhvc3QucmVwbGFjZSgvOlxcZCskLywgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgY29uc3Qgc2Vzc2lvbkRpc3BsYXkgPSBob3N0c0RpZmZlclxuICAgICAgICAgID8gYCR7cmVwb1ZhbGlkYXRpb24uc2Vzc2lvbkhvc3R9LyR7cmVwb1ZhbGlkYXRpb24uc2Vzc2lvblJlcG99YFxuICAgICAgICAgIDogcmVwb1ZhbGlkYXRpb24uc2Vzc2lvblJlcG9cbiAgICAgICAgY29uc3QgY3VycmVudERpc3BsYXkgPSBob3N0c0RpZmZlclxuICAgICAgICAgID8gYCR7cmVwb1ZhbGlkYXRpb24uY3VycmVudEhvc3R9LyR7cmVwb1ZhbGlkYXRpb24uY3VycmVudFJlcG99YFxuICAgICAgICAgIDogcmVwb1ZhbGlkYXRpb24uY3VycmVudFJlcG9cbiAgICAgICAgdGhyb3cgbmV3IFRlbGVwb3J0T3BlcmF0aW9uRXJyb3IoXG4gICAgICAgICAgYFlvdSBtdXN0IHJ1biBjbGF1ZGUgLS10ZWxlcG9ydCAke3Nlc3Npb25JZH0gZnJvbSBhIGNoZWNrb3V0IG9mICR7c2Vzc2lvbkRpc3BsYXl9LlxcblRoaXMgcmVwbyBpcyAke2N1cnJlbnREaXNwbGF5fS5gLFxuICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgIGBZb3UgbXVzdCBydW4gY2xhdWRlIC0tdGVsZXBvcnQgJHtzZXNzaW9uSWR9IGZyb20gYSBjaGVja291dCBvZiAke2NoYWxrLmJvbGQoc2Vzc2lvbkRpc3BsYXkpfS5cXG5UaGlzIHJlcG8gaXMgJHtjaGFsay5ib2xkKGN1cnJlbnREaXNwbGF5KX0uXFxuYCxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIHRocm93IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgICAgIHJlcG9WYWxpZGF0aW9uLmVycm9yTWVzc2FnZSB8fFxuICAgICAgICAgICAgJ0ZhaWxlZCB0byB2YWxpZGF0ZSBzZXNzaW9uIHJlcG9zaXRvcnknLFxuICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgIGBFcnJvcjogJHtyZXBvVmFsaWRhdGlvbi5lcnJvck1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byB2YWxpZGF0ZSBzZXNzaW9uIHJlcG9zaXRvcnknfVxcbmAsXG4gICAgICAgICAgKSxcbiAgICAgICAgKVxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBjb25zdCBfZXhoYXVzdGl2ZTogbmV2ZXIgPSByZXBvVmFsaWRhdGlvbi5zdGF0dXNcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmhhbmRsZWQgcmVwbyB2YWxpZGF0aW9uIHN0YXR1czogJHtfZXhoYXVzdGl2ZX1gKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhd2FpdCB0ZWxlcG9ydEZyb21TZXNzaW9uc0FQSShcbiAgICAgIHNlc3Npb25JZCxcbiAgICAgIG9yZ1VVSUQsXG4gICAgICBhY2Nlc3NUb2tlbixcbiAgICAgIG9uUHJvZ3Jlc3MsXG4gICAgICBzZXNzaW9uRGF0YSxcbiAgICApXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgVGVsZXBvcnRPcGVyYXRpb25FcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3JcbiAgICB9XG5cbiAgICBjb25zdCBlcnIgPSB0b0Vycm9yKGVycm9yKVxuICAgIGxvZ0Vycm9yKGVycilcbiAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfcmVzdW1lX2Vycm9yJywge1xuICAgICAgZXJyb3JfdHlwZTpcbiAgICAgICAgJ3Jlc3VtZV9zZXNzaW9uX2lkX2NhdGNoJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG5cbiAgICB0aHJvdyBuZXcgVGVsZXBvcnRPcGVyYXRpb25FcnJvcihcbiAgICAgIGVyci5tZXNzYWdlLFxuICAgICAgY2hhbGsucmVkKGBFcnJvcjogJHtlcnIubWVzc2FnZX1cXG5gKSxcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gaGFuZGxlIHRlbGVwb3J0IHByZXJlcXVpc2l0ZXMgKGF1dGhlbnRpY2F0aW9uIGFuZCBnaXQgc3RhdGUpXG4gKiBTaG93cyBUZWxlcG9ydEVycm9yIGRpYWxvZyByZW5kZXJlZCBpbnRvIHRoZSBleGlzdGluZyByb290IGlmIG5lZWRlZFxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVUZWxlcG9ydFByZXJlcXVpc2l0ZXMoXG4gIHJvb3Q6IFJvb3QsXG4gIGVycm9yc1RvSWdub3JlPzogU2V0PFRlbGVwb3J0TG9jYWxFcnJvclR5cGU+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGVycm9ycyA9IGF3YWl0IGdldFRlbGVwb3J0RXJyb3JzKClcbiAgaWYgKGVycm9ycy5zaXplID4gMCkge1xuICAgIC8vIExvZyB0ZWxlcG9ydCBlcnJvcnMgZGV0ZWN0ZWRcbiAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfZXJyb3JzX2RldGVjdGVkJywge1xuICAgICAgZXJyb3JfdHlwZXM6IEFycmF5LmZyb20oZXJyb3JzKS5qb2luKFxuICAgICAgICAnLCcsXG4gICAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBlcnJvcnNfaWdub3JlZDogQXJyYXkuZnJvbShlcnJvcnNUb0lnbm9yZSB8fCBbXSkuam9pbihcbiAgICAgICAgJywnLFxuICAgICAgKSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG5cbiAgICAvLyBTaG93IFRlbGVwb3J0RXJyb3IgZGlhbG9nIGZvciB1c2VyIGludGVyYWN0aW9uXG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG4gICAgICByb290LnJlbmRlcihcbiAgICAgICAgPEFwcFN0YXRlUHJvdmlkZXI+XG4gICAgICAgICAgPEtleWJpbmRpbmdTZXR1cD5cbiAgICAgICAgICAgIDxUZWxlcG9ydEVycm9yXG4gICAgICAgICAgICAgIGVycm9yc1RvSWdub3JlPXtlcnJvcnNUb0lnbm9yZX1cbiAgICAgICAgICAgICAgb25Db21wbGV0ZT17KCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIExvZyB3aGVuIGVycm9ycyBhcmUgcmVzb2x2ZWRcbiAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfZXJyb3JzX3Jlc29sdmVkJywge1xuICAgICAgICAgICAgICAgICAgZXJyb3JfdHlwZXM6IEFycmF5LmZyb20oZXJyb3JzKS5qb2luKFxuICAgICAgICAgICAgICAgICAgICAnLCcsXG4gICAgICAgICAgICAgICAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB2b2lkIHJlc29sdmUoKVxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0tleWJpbmRpbmdTZXR1cD5cbiAgICAgICAgPC9BcHBTdGF0ZVByb3ZpZGVyPixcbiAgICAgIClcbiAgICB9KVxuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHJlbW90ZSBDbGF1ZGUuYWkgc2Vzc2lvbiB3aXRoIGVycm9yIGhhbmRsaW5nIGFuZCBVSSBmZWVkYmFjay5cbiAqIFNob3dzIHByZXJlcXVpc2l0ZSBlcnJvciBkaWFsb2cgaW4gdGhlIGV4aXN0aW5nIHJvb3QgaWYgbmVlZGVkLlxuICogQHBhcmFtIHJvb3QgVGhlIGV4aXN0aW5nIEluayByb290IHRvIHJlbmRlciBkaWFsb2dzIGludG9cbiAqIEBwYXJhbSBkZXNjcmlwdGlvbiBUaGUgZGVzY3JpcHRpb24vcHJvbXB0IGZvciB0aGUgbmV3IHNlc3Npb24gKG51bGwgZm9yIG5vIGluaXRpYWwgcHJvbXB0KVxuICogQHBhcmFtIHNpZ25hbCBBYm9ydFNpZ25hbCBmb3IgY2FuY2VsbGF0aW9uXG4gKiBAcGFyYW0gYnJhbmNoTmFtZSBPcHRpb25hbCBicmFuY2ggbmFtZSBmb3IgdGhlIHJlbW90ZSBzZXNzaW9uIHRvIHVzZVxuICogQHJldHVybnMgUHJvbWlzZTxUZWxlcG9ydFRvUmVtb3RlUmVzcG9uc2UgfCBudWxsPiBUaGUgY3JlYXRlZCBzZXNzaW9uIG9yIG51bGwgaWYgY3JlYXRpb24gZmFpbHNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRlbGVwb3J0VG9SZW1vdGVXaXRoRXJyb3JIYW5kbGluZyhcbiAgcm9vdDogUm9vdCxcbiAgZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGwsXG4gIHNpZ25hbDogQWJvcnRTaWduYWwsXG4gIGJyYW5jaE5hbWU/OiBzdHJpbmcsXG4pOiBQcm9taXNlPFRlbGVwb3J0VG9SZW1vdGVSZXNwb25zZSB8IG51bGw+IHtcbiAgY29uc3QgZXJyb3JzVG9JZ25vcmUgPSBuZXcgU2V0PFRlbGVwb3J0TG9jYWxFcnJvclR5cGU+KFsnbmVlZHNHaXRTdGFzaCddKVxuICBhd2FpdCBoYW5kbGVUZWxlcG9ydFByZXJlcXVpc2l0ZXMocm9vdCwgZXJyb3JzVG9JZ25vcmUpXG4gIHJldHVybiB0ZWxlcG9ydFRvUmVtb3RlKHtcbiAgICBpbml0aWFsTWVzc2FnZTogZGVzY3JpcHRpb24sXG4gICAgc2lnbmFsLFxuICAgIGJyYW5jaE5hbWUsXG4gICAgb25CdW5kbGVGYWlsOiBtc2cgPT4gcHJvY2Vzcy5zdGRlcnIud3JpdGUoYFxcbiR7bXNnfVxcbmApLFxuICB9KVxufVxuXG4vKipcbiAqIEZldGNoZXMgc2Vzc2lvbiBkYXRhIGZyb20gdGhlIHNlc3Npb24gaW5ncmVzcyBBUEkgKC92MS9zZXNzaW9uX2luZ3Jlc3MvKVxuICogVXNlcyBzZXNzaW9uIGxvZ3MgaW5zdGVhZCBvZiBTREsgZXZlbnRzIHRvIGdldCB0aGUgY29ycmVjdCBtZXNzYWdlIHN0cnVjdHVyZVxuICogQHBhcmFtIHNlc3Npb25JZCBUaGUgc2Vzc2lvbiBJRCB0byBmZXRjaFxuICogQHBhcmFtIG9yZ1VVSUQgVGhlIG9yZ2FuaXphdGlvbiBVVUlEXG4gKiBAcGFyYW0gYWNjZXNzVG9rZW4gVGhlIE9BdXRoIGFjY2VzcyB0b2tlblxuICogQHBhcmFtIG9uUHJvZ3Jlc3MgT3B0aW9uYWwgY2FsbGJhY2sgZm9yIHByb2dyZXNzIHVwZGF0ZXNcbiAqIEBwYXJhbSBzZXNzaW9uRGF0YSBPcHRpb25hbCBzZXNzaW9uIGRhdGEgKHVzZWQgdG8gZXh0cmFjdCBicmFuY2ggaW5mbylcbiAqIEByZXR1cm5zIFRlbGVwb3J0UmVtb3RlUmVzcG9uc2Ugd2l0aCBzZXNzaW9uIGxvZ3MgYXMgTWVzc2FnZVtdXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZWxlcG9ydEZyb21TZXNzaW9uc0FQSShcbiAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gIG9yZ1VVSUQ6IHN0cmluZyxcbiAgYWNjZXNzVG9rZW46IHN0cmluZyxcbiAgb25Qcm9ncmVzcz86IFRlbGVwb3J0UHJvZ3Jlc3NDYWxsYmFjayxcbiAgc2Vzc2lvbkRhdGE/OiBTZXNzaW9uUmVzb3VyY2UsXG4pOiBQcm9taXNlPFRlbGVwb3J0UmVtb3RlUmVzcG9uc2U+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKVxuXG4gIHRyeSB7XG4gICAgLy8gRmV0Y2ggc2Vzc2lvbiBsb2dzIHZpYSBzZXNzaW9uIGluZ3Jlc3NcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoYFt0ZWxlcG9ydF0gU3RhcnRpbmcgZmV0Y2ggZm9yIHNlc3Npb246ICR7c2Vzc2lvbklkfWApXG4gICAgb25Qcm9ncmVzcz8uKCdmZXRjaGluZ19sb2dzJylcblxuICAgIGNvbnN0IGxvZ3NTdGFydFRpbWUgPSBEYXRlLm5vdygpXG4gICAgLy8gVHJ5IENDUiB2MiBmaXJzdCAoR2V0VGVsZXBvcnRFdmVudHMg4oCUIHNlcnZlciBkaXNwYXRjaGVzIFNwYW5uZXIvXG4gICAgLy8gdGhyZWFkc3RvcmUpLiBGYWxsIGJhY2sgdG8gc2Vzc2lvbi1pbmdyZXNzIGlmIGl0IHJldHVybnMgbnVsbFxuICAgIC8vIChlbmRwb2ludCBub3QgeWV0IGRlcGxveWVkLCBvciB0cmFuc2llbnQgZXJyb3IpLiBPbmNlIHNlc3Npb24taW5ncmVzc1xuICAgIC8vIGlzIGdvbmUsIHRoZSBmYWxsYmFjayBiZWNvbWVzIGEgbm8tb3Ag4oCUIGdldFNlc3Npb25Mb2dzVmlhT0F1dGggd2lsbFxuICAgIC8vIHJldHVybiBudWxsIHRvbyBhbmQgd2UgZmFpbCB3aXRoIFwiRmFpbGVkIHRvIGZldGNoIHNlc3Npb24gbG9nc1wiLlxuICAgIGxldCBsb2dzID0gYXdhaXQgZ2V0VGVsZXBvcnRFdmVudHMoc2Vzc2lvbklkLCBhY2Nlc3NUb2tlbiwgb3JnVVVJRClcbiAgICBpZiAobG9ncyA9PT0gbnVsbCkge1xuICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAnW3RlbGVwb3J0XSB2MiBlbmRwb2ludCByZXR1cm5lZCBudWxsLCB0cnlpbmcgc2Vzc2lvbi1pbmdyZXNzJyxcbiAgICAgIClcbiAgICAgIGxvZ3MgPSBhd2FpdCBnZXRTZXNzaW9uTG9nc1ZpYU9BdXRoKHNlc3Npb25JZCwgYWNjZXNzVG9rZW4sIG9yZ1VVSUQpXG4gICAgfVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBbdGVsZXBvcnRdIFNlc3Npb24gbG9ncyBmZXRjaGVkIGluICR7RGF0ZS5ub3coKSAtIGxvZ3NTdGFydFRpbWV9bXNgLFxuICAgIClcblxuICAgIGlmIChsb2dzID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBmZXRjaCBzZXNzaW9uIGxvZ3MnKVxuICAgIH1cblxuICAgIC8vIEZpbHRlciB0byBnZXQgb25seSB0cmFuc2NyaXB0IG1lc3NhZ2VzLCBleGNsdWRpbmcgc2lkZWNoYWluIG1lc3NhZ2VzXG4gICAgY29uc3QgZmlsdGVyU3RhcnRUaW1lID0gRGF0ZS5ub3coKVxuICAgIGNvbnN0IG1lc3NhZ2VzID0gbG9ncy5maWx0ZXIoXG4gICAgICBlbnRyeSA9PiBpc1RyYW5zY3JpcHRNZXNzYWdlKGVudHJ5KSAmJiAhZW50cnkuaXNTaWRlY2hhaW4sXG4gICAgKSBhcyBNZXNzYWdlW11cbiAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICBgW3RlbGVwb3J0XSBGaWx0ZXJlZCAke2xvZ3MubGVuZ3RofSBlbnRyaWVzIHRvICR7bWVzc2FnZXMubGVuZ3RofSBtZXNzYWdlcyBpbiAke0RhdGUubm93KCkgLSBmaWx0ZXJTdGFydFRpbWV9bXNgLFxuICAgIClcblxuICAgIC8vIEV4dHJhY3QgYnJhbmNoIGluZm8gZnJvbSBzZXNzaW9uIGRhdGFcbiAgICBvblByb2dyZXNzPy4oJ2ZldGNoaW5nX2JyYW5jaCcpXG4gICAgY29uc3QgYnJhbmNoID0gc2Vzc2lvbkRhdGEgPyBnZXRCcmFuY2hGcm9tU2Vzc2lvbihzZXNzaW9uRGF0YSkgOiB1bmRlZmluZWRcbiAgICBpZiAoYnJhbmNoKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoYFt0ZWxlcG9ydF0gRm91bmQgYnJhbmNoOiAke2JyYW5jaH1gKVxuICAgIH1cblxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBbdGVsZXBvcnRdIFRvdGFsIHRlbGVwb3J0RnJvbVNlc3Npb25zQVBJIHRpbWU6ICR7RGF0ZS5ub3coKSAtIHN0YXJ0VGltZX1tc2AsXG4gICAgKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxvZzogbWVzc2FnZXMsXG4gICAgICBicmFuY2gsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGVyciA9IHRvRXJyb3IoZXJyb3IpXG5cbiAgICAvLyBIYW5kbGUgNDA0IHNwZWNpZmljYWxseVxuICAgIGlmIChheGlvcy5pc0F4aW9zRXJyb3IoZXJyb3IpICYmIGVycm9yLnJlc3BvbnNlPy5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3RlbGVwb3J0X2Vycm9yX3Nlc3Npb25fbm90X2ZvdW5kXzQwNCcsIHtcbiAgICAgICAgc2Vzc2lvbklkOlxuICAgICAgICAgIHNlc3Npb25JZCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICAgIHRocm93IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgICBgJHtzZXNzaW9uSWR9IG5vdCBmb3VuZC5gLFxuICAgICAgICBgJHtzZXNzaW9uSWR9IG5vdCBmb3VuZC5cXG4ke2NoYWxrLmRpbSgnUnVuIC9zdGF0dXMgaW4gQ2xhdWRlIENvZGUgdG8gY2hlY2sgeW91ciBhY2NvdW50LicpfWAsXG4gICAgICApXG4gICAgfVxuXG4gICAgbG9nRXJyb3IoZXJyKVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggc2Vzc2lvbiBmcm9tIFNlc3Npb25zIEFQSTogJHtlcnIubWVzc2FnZX1gKVxuICB9XG59XG5cbi8qKlxuICogUmVzcG9uc2UgdHlwZSBmb3IgcG9sbGluZyByZW1vdGUgc2Vzc2lvbiBldmVudHMgKHVzZXMgU0RLIGV2ZW50cyBmb3JtYXQpXG4gKi9cbmV4cG9ydCB0eXBlIFBvbGxSZW1vdGVTZXNzaW9uUmVzcG9uc2UgPSB7XG4gIG5ld0V2ZW50czogU0RLTWVzc2FnZVtdXG4gIGxhc3RFdmVudElkOiBzdHJpbmcgfCBudWxsXG4gIGJyYW5jaD86IHN0cmluZ1xuICBzZXNzaW9uU3RhdHVzPzogJ2lkbGUnIHwgJ3J1bm5pbmcnIHwgJ3JlcXVpcmVzX2FjdGlvbicgfCAnYXJjaGl2ZWQnXG59XG5cbi8qKlxuICogUG9sbHMgcmVtb3RlIHNlc3Npb24gZXZlbnRzLiBQYXNzIHRoZSBwcmV2aW91cyByZXNwb25zZSdzIGBsYXN0RXZlbnRJZGBcbiAqIGFzIGBhZnRlcklkYCB0byBmZXRjaCBvbmx5IHRoZSBkZWx0YS4gU2V0IGBza2lwTWV0YWRhdGFgIHRvIGF2b2lkIHRoZVxuICogcGVyLWNhbGwgR0VUIC92MS9zZXNzaW9ucy97aWR9IHdoZW4gYnJhbmNoL3N0YXR1cyBhcmVuJ3QgbmVlZGVkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcG9sbFJlbW90ZVNlc3Npb25FdmVudHMoXG4gIHNlc3Npb25JZDogc3RyaW5nLFxuICBhZnRlcklkOiBzdHJpbmcgfCBudWxsID0gbnVsbCxcbiAgb3B0cz86IHsgc2tpcE1ldGFkYXRhPzogYm9vbGVhbiB9LFxuKTogUHJvbWlzZTxQb2xsUmVtb3RlU2Vzc2lvblJlc3BvbnNlPiB7XG4gIGNvbnN0IGFjY2Vzc1Rva2VuID0gZ2V0Q2xhdWRlQUlPQXV0aFRva2VucygpPy5hY2Nlc3NUb2tlblxuICBpZiAoIWFjY2Vzc1Rva2VuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdObyBhY2Nlc3MgdG9rZW4gZm9yIHBvbGxpbmcnKVxuICB9XG5cbiAgY29uc3Qgb3JnVVVJRCA9IGF3YWl0IGdldE9yZ2FuaXphdGlvblVVSUQoKVxuICBpZiAoIW9yZ1VVSUQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9yZyBVVUlEIGZvciBwb2xsaW5nJylcbiAgfVxuXG4gIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgLi4uZ2V0T0F1dGhIZWFkZXJzKGFjY2Vzc1Rva2VuKSxcbiAgICAnYW50aHJvcGljLWJldGEnOiAnY2NyLWJ5b2MtMjAyNS0wNy0yOScsXG4gICAgJ3gtb3JnYW5pemF0aW9uLXV1aWQnOiBvcmdVVUlELFxuICB9XG4gIGNvbnN0IGV2ZW50c1VybCA9IGAke2dldE9hdXRoQ29uZmlnKCkuQkFTRV9BUElfVVJMfS92MS9zZXNzaW9ucy8ke3Nlc3Npb25JZH0vZXZlbnRzYFxuXG4gIHR5cGUgRXZlbnRzUmVzcG9uc2UgPSB7XG4gICAgZGF0YTogdW5rbm93bltdXG4gICAgaGFzX21vcmU6IGJvb2xlYW5cbiAgICBmaXJzdF9pZDogc3RyaW5nIHwgbnVsbFxuICAgIGxhc3RfaWQ6IHN0cmluZyB8IG51bGxcbiAgfVxuXG4gIC8vIENhcCBpcyBhIHNhZmV0eSB2YWx2ZSBhZ2FpbnN0IHN0dWNrIGN1cnNvcnM7IHN0ZWFkeS1zdGF0ZSBpcyAw4oCTMSBwYWdlcy5cbiAgY29uc3QgTUFYX0VWRU5UX1BBR0VTID0gNTBcbiAgY29uc3Qgc2RrTWVzc2FnZXM6IFNES01lc3NhZ2VbXSA9IFtdXG4gIGxldCBjdXJzb3IgPSBhZnRlcklkXG4gIGZvciAobGV0IHBhZ2UgPSAwOyBwYWdlIDwgTUFYX0VWRU5UX1BBR0VTOyBwYWdlKyspIHtcbiAgICBjb25zdCBldmVudHNSZXNwb25zZSA9IGF3YWl0IGF4aW9zLmdldChldmVudHNVcmwsIHtcbiAgICAgIGhlYWRlcnMsXG4gICAgICBwYXJhbXM6IGN1cnNvciA/IHsgYWZ0ZXJfaWQ6IGN1cnNvciB9IDogdW5kZWZpbmVkLFxuICAgICAgdGltZW91dDogMzAwMDAsXG4gICAgfSlcblxuICAgIGlmIChldmVudHNSZXNwb25zZS5zdGF0dXMgIT09IDIwMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRmFpbGVkIHRvIGZldGNoIHNlc3Npb24gZXZlbnRzOiAke2V2ZW50c1Jlc3BvbnNlLnN0YXR1c1RleHR9YCxcbiAgICAgIClcbiAgICB9XG5cbiAgICBjb25zdCBldmVudHNEYXRhOiBFdmVudHNSZXNwb25zZSA9IGV2ZW50c1Jlc3BvbnNlLmRhdGFcbiAgICBpZiAoIWV2ZW50c0RhdGE/LmRhdGEgfHwgIUFycmF5LmlzQXJyYXkoZXZlbnRzRGF0YS5kYXRhKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGV2ZW50cyByZXNwb25zZScpXG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHNEYXRhLmRhdGEpIHtcbiAgICAgIGlmIChldmVudCAmJiB0eXBlb2YgZXZlbnQgPT09ICdvYmplY3QnICYmICd0eXBlJyBpbiBldmVudCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgZXZlbnQudHlwZSA9PT0gJ2Vudl9tYW5hZ2VyX2xvZycgfHxcbiAgICAgICAgICBldmVudC50eXBlID09PSAnY29udHJvbF9yZXNwb25zZSdcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoJ3Nlc3Npb25faWQnIGluIGV2ZW50KSB7XG4gICAgICAgICAgc2RrTWVzc2FnZXMucHVzaChldmVudCBhcyBTREtNZXNzYWdlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFldmVudHNEYXRhLmxhc3RfaWQpIGJyZWFrXG4gICAgY3Vyc29yID0gZXZlbnRzRGF0YS5sYXN0X2lkXG4gICAgaWYgKCFldmVudHNEYXRhLmhhc19tb3JlKSBicmVha1xuICB9XG5cbiAgaWYgKG9wdHM/LnNraXBNZXRhZGF0YSkge1xuICAgIHJldHVybiB7IG5ld0V2ZW50czogc2RrTWVzc2FnZXMsIGxhc3RFdmVudElkOiBjdXJzb3IgfVxuICB9XG5cbiAgLy8gRmV0Y2ggc2Vzc2lvbiBtZXRhZGF0YSAoYnJhbmNoLCBzdGF0dXMpXG4gIGxldCBicmFuY2g6IHN0cmluZyB8IHVuZGVmaW5lZFxuICBsZXQgc2Vzc2lvblN0YXR1czogUG9sbFJlbW90ZVNlc3Npb25SZXNwb25zZVsnc2Vzc2lvblN0YXR1cyddXG4gIHRyeSB7XG4gICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBhd2FpdCBmZXRjaFNlc3Npb24oc2Vzc2lvbklkKVxuICAgIGJyYW5jaCA9IGdldEJyYW5jaEZyb21TZXNzaW9uKHNlc3Npb25EYXRhKVxuICAgIHNlc3Npb25TdGF0dXMgPVxuICAgICAgc2Vzc2lvbkRhdGEuc2Vzc2lvbl9zdGF0dXMgYXMgUG9sbFJlbW90ZVNlc3Npb25SZXNwb25zZVsnc2Vzc2lvblN0YXR1cyddXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICBgdGVsZXBvcnQ6IGZhaWxlZCB0byBmZXRjaCBzZXNzaW9uICR7c2Vzc2lvbklkfSBtZXRhZGF0YTogJHtlfWAsXG4gICAgICB7IGxldmVsOiAnZGVidWcnIH0sXG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIHsgbmV3RXZlbnRzOiBzZGtNZXNzYWdlcywgbGFzdEV2ZW50SWQ6IGN1cnNvciwgYnJhbmNoLCBzZXNzaW9uU3RhdHVzIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcmVtb3RlIENsYXVkZS5haSBzZXNzaW9uIHVzaW5nIHRoZSBTZXNzaW9ucyBBUEkuXG4gKlxuICogVHdvIHNvdXJjZSBtb2RlczpcbiAqIC0gR2l0SHViIChkZWZhdWx0KTogYmFja2VuZCBjbG9uZXMgZnJvbSB0aGUgcmVwbydzIG9yaWdpbiBVUkwuIFJlcXVpcmVzIGFcbiAqICAgR2l0SHViIHJlbW90ZSArIENDUi1zaWRlIEdpdEh1YiBjb25uZWN0aW9uLiA0MyUgb2YgQ0xJIHNlc3Npb25zIGhhdmUgYW5cbiAqICAgb3JpZ2luIHJlbW90ZTsgZmFyIGZld2VyIHBhc3MgdGhlIGZ1bGwgcHJlY29uZGl0aW9uIGNoYWluLlxuICogLSBCdW5kbGUgKENDUl9GT1JDRV9CVU5ETEU9MSk6IENMSSBjcmVhdGVzIGBnaXQgYnVuZGxlIC0tYWxsYCwgdXBsb2FkcyB2aWEgRmlsZXNcbiAqICAgQVBJLCBwYXNzZXMgZmlsZV9pZCBhcyBzZWVkX2J1bmRsZV9maWxlX2lkIG9uIHRoZSBzZXNzaW9uIGNvbnRleHQuIENDUlxuICogICBkb3dubG9hZHMgaXQgYW5kIGNsb25lcyBmcm9tIHRoZSBidW5kbGUuIE5vIEdpdEh1YiBkZXBlbmRlbmN5IOKAlCB3b3JrcyBmb3JcbiAqICAgbG9jYWwtb25seSByZXBvcy4gUmVhY2g6IDU0JSBvZiBDTEkgc2Vzc2lvbnMgKGFueXRoaW5nIHdpdGggLmdpdC8pLlxuICogICBCYWNrZW5kOiBhbnRocm9waWMjMzAzODU2LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGVsZXBvcnRUb1JlbW90ZShvcHRpb25zOiB7XG4gIGluaXRpYWxNZXNzYWdlOiBzdHJpbmcgfCBudWxsXG4gIGJyYW5jaE5hbWU/OiBzdHJpbmdcbiAgdGl0bGU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBkZXNjcmlwdGlvbiBvZiB0aGUgc2Vzc2lvbi4gVGhpcyBpcyB1c2VkIHRvIGdlbmVyYXRlIHRoZSB0aXRsZSBhbmRcbiAgICogc2Vzc2lvbiBicmFuY2ggbmFtZSAodW5sZXNzIHRoZXkgYXJlIGV4cGxpY2l0bHkgcHJvdmlkZWQpLlxuICAgKi9cbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgbW9kZWw/OiBzdHJpbmdcbiAgcGVybWlzc2lvbk1vZGU/OiBQZXJtaXNzaW9uTW9kZVxuICB1bHRyYXBsYW4/OiBib29sZWFuXG4gIHNpZ25hbDogQWJvcnRTaWduYWxcbiAgdXNlRGVmYXVsdEVudmlyb25tZW50PzogYm9vbGVhblxuICAvKipcbiAgICogRXhwbGljaXQgZW52aXJvbm1lbnRfaWQgKGUuZy4gdGhlIGNvZGVfcmV2aWV3IHN5bnRoZXRpYyBlbnYpLiBCeXBhc3Nlc1xuICAgKiBmZXRjaEVudmlyb25tZW50czsgdGhlIHVzdWFsIHJlcG8tZGV0ZWN0aW9uIOKGkiBnaXQgc291cmNlIHN0aWxsIHJ1bnMgc29cbiAgICogdGhlIGNvbnRhaW5lciBnZXRzIHRoZSByZXBvIGNoZWNrZWQgb3V0IChvcmNoZXN0cmF0b3IgcmVhZHMgLS1yZXBvLWRpclxuICAgKiBmcm9tIHB3ZCwgaXQgZG9lc24ndCBjbG9uZSkuXG4gICAqL1xuICBlbnZpcm9ubWVudElkPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQZXItc2Vzc2lvbiBlbnYgdmFycyBtZXJnZWQgaW50byBzZXNzaW9uX2NvbnRleHQuZW52aXJvbm1lbnRfdmFyaWFibGVzLlxuICAgKiBXcml0ZS1vbmx5IGF0IHRoZSBBUEkgbGF5ZXIgKHN0cmlwcGVkIGZyb20gR2V0L0xpc3QgcmVzcG9uc2VzKS4gV2hlblxuICAgKiBlbnZpcm9ubWVudElkIGlzIHNldCwgQ0xBVURFX0NPREVfT0FVVEhfVE9LRU4gaXMgYXV0by1pbmplY3RlZCBmcm9tIHRoZVxuICAgKiBjYWxsZXIncyBhY2Nlc3NUb2tlbiBzbyB0aGUgY29udGFpbmVyJ3MgaG9vayBjYW4gaGl0IGluZmVyZW5jZSAodGhlXG4gICAqIHNlcnZlciBvbmx5IHBhc3NlcyB0aHJvdWdoIHdoYXQgdGhlIGNhbGxlciBzZW5kczsgYnVnaHVudGVyLmdvIG1pbnRzXG4gICAqIGl0cyBvd24sIHVzZXIgc2Vzc2lvbnMgZG9uJ3QgZ2V0IG9uZSBhdXRvbWF0aWNhbGx5KS5cbiAgICovXG4gIGVudmlyb25tZW50VmFyaWFibGVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICAvKipcbiAgICogV2hlbiBzZXQgd2l0aCBlbnZpcm9ubWVudElkLCBjcmVhdGVzIGFuZCB1cGxvYWRzIGEgZ2l0IGJ1bmRsZSBvZiB0aGVcbiAgICogbG9jYWwgd29ya2luZyB0cmVlIChjcmVhdGVBbmRVcGxvYWRHaXRCdW5kbGUgaGFuZGxlcyB0aGUgc3Rhc2gtY3JlYXRlXG4gICAqIGZvciB1bmNvbW1pdHRlZCBjaGFuZ2VzKSBhbmQgcGFzc2VzIGl0IGFzIHNlZWRfYnVuZGxlX2ZpbGVfaWQuIEJhY2tlbmRcbiAgICogY2xvbmVzIGZyb20gdGhlIGJ1bmRsZSBpbnN0ZWFkIG9mIEdpdEh1YiDigJQgY29udGFpbmVyIGdldHMgdGhlIGNhbGxlcidzXG4gICAqIGV4YWN0IGxvY2FsIHN0YXRlLiBOZWVkcyAuZ2l0LyBvbmx5LCBub3QgYSBHaXRIdWIgcmVtb3RlLlxuICAgKi9cbiAgdXNlQnVuZGxlPzogYm9vbGVhblxuICAvKipcbiAgICogQ2FsbGVkIHdpdGggYSB1c2VyLWZhY2luZyBtZXNzYWdlIHdoZW4gdGhlIGJ1bmRsZSBwYXRoIGlzIGF0dGVtcHRlZCBidXRcbiAgICogZmFpbHMuIFRoZSB3cmFwcGVyIHN0ZGVyci53cml0ZXMgaXQgKHByZS1SRVBMKS4gUmVtb3RlLWFnZW50IGNhbGxlcnNcbiAgICogY2FwdHVyZSBpdCB0byBpbmNsdWRlIGluIHRoZWlyIHRocm93IChpbi1SRVBMLCBJbmstcmVuZGVyZWQpLlxuICAgKi9cbiAgb25CdW5kbGVGYWlsPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZFxuICAvKipcbiAgICogV2hlbiB0cnVlLCBkaXNhYmxlcyB0aGUgZ2l0LWJ1bmRsZSBmYWxsYmFjayBlbnRpcmVseS4gVXNlIGZvciBmbG93cyBsaWtlXG4gICAqIGF1dG9maXggd2hlcmUgQ0NSIG11c3QgcHVzaCB0byBHaXRIdWIg4oCUIGEgYnVuZGxlIGNhbid0IGRvIHRoYXQuXG4gICAqL1xuICBza2lwQnVuZGxlPzogYm9vbGVhblxuICAvKipcbiAgICogV2hlbiBzZXQsIHJldXNlcyB0aGlzIGJyYW5jaCBhcyB0aGUgb3V0Y29tZSBicmFuY2ggaW5zdGVhZCBvZiBnZW5lcmF0aW5nXG4gICAqIGEgbmV3IGNsYXVkZS8gYnJhbmNoLiBTZXRzIGFsbG93X3VucmVzdHJpY3RlZF9naXRfcHVzaCBvbiB0aGUgc291cmNlIGFuZFxuICAgKiByZXVzZV9vdXRjb21lX2JyYW5jaGVzIG9uIHRoZSBzZXNzaW9uIGNvbnRleHQgc28gdGhlIHJlbW90ZSBwdXNoZXMgdG8gdGhlXG4gICAqIGNhbGxlcidzIGJyYW5jaCBkaXJlY3RseS5cbiAgICovXG4gIHJldXNlT3V0Y29tZUJyYW5jaD86IHN0cmluZ1xuICAvKipcbiAgICogR2l0SHViIFBSIHRvIGF0dGFjaCB0byB0aGUgc2Vzc2lvbiBjb250ZXh0LiBCYWNrZW5kIHVzZXMgdGhpcyB0b1xuICAgKiBpZGVudGlmeSB0aGUgUFIgYXNzb2NpYXRlZCB3aXRoIHRoaXMgc2Vzc2lvbi5cbiAgICovXG4gIGdpdGh1YlByPzogeyBvd25lcjogc3RyaW5nOyByZXBvOiBzdHJpbmc7IG51bWJlcjogbnVtYmVyIH1cbn0pOiBQcm9taXNlPFRlbGVwb3J0VG9SZW1vdGVSZXNwb25zZSB8IG51bGw+IHtcbiAgY29uc3QgeyBpbml0aWFsTWVzc2FnZSwgc2lnbmFsIH0gPSBvcHRpb25zXG4gIHRyeSB7XG4gICAgLy8gQ2hlY2sgYXV0aGVudGljYXRpb25cbiAgICBhd2FpdCBjaGVja0FuZFJlZnJlc2hPQXV0aFRva2VuSWZOZWVkZWQoKVxuICAgIGNvbnN0IGFjY2Vzc1Rva2VuID0gZ2V0Q2xhdWRlQUlPQXV0aFRva2VucygpPy5hY2Nlc3NUb2tlblxuICAgIGlmICghYWNjZXNzVG9rZW4pIHtcbiAgICAgIGxvZ0Vycm9yKG5ldyBFcnJvcignTm8gYWNjZXNzIHRva2VuIGZvdW5kIGZvciByZW1vdGUgc2Vzc2lvbiBjcmVhdGlvbicpKVxuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICAvLyBHZXQgb3JnYW5pemF0aW9uIFVVSURcbiAgICBjb25zdCBvcmdVVUlEID0gYXdhaXQgZ2V0T3JnYW5pemF0aW9uVVVJRCgpXG4gICAgaWYgKCFvcmdVVUlEKSB7XG4gICAgICBsb2dFcnJvcihcbiAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICdVbmFibGUgdG8gZ2V0IG9yZ2FuaXphdGlvbiBVVUlEIGZvciByZW1vdGUgc2Vzc2lvbiBjcmVhdGlvbicsXG4gICAgICAgICksXG4gICAgICApXG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIC8vIEV4cGxpY2l0IGVudmlyb25tZW50SWQgc2hvcnQtY2lyY3VpdHMgSGFpa3UgdGl0bGUtZ2VuICsgZW52IHNlbGVjdGlvbi5cbiAgICAvLyBTdGlsbCBydW5zIHJlcG8gZGV0ZWN0aW9uIHNvIHRoZSBjb250YWluZXIgZ2V0cyBhIHdvcmtpbmcgZGlyZWN0b3J5IOKAlFxuICAgIC8vIHRoZSBjb2RlX3JldmlldyBvcmNoZXN0cmF0b3IgcmVhZHMgLS1yZXBvLWRpciAkKHB3ZCksIGl0IGRvZXNuJ3QgY2xvbmVcbiAgICAvLyAoYnVnaHVudGVyLmdvOjUyMCBzZXRzIGEgZ2l0IHNvdXJjZSB0b287IGVudi1tYW5hZ2VyIGRvZXMgdGhlIGNoZWNrb3V0XG4gICAgLy8gYmVmb3JlIHRoZSBTZXNzaW9uU3RhcnQgaG9vayBmaXJlcykuXG4gICAgaWYgKG9wdGlvbnMuZW52aXJvbm1lbnRJZCkge1xuICAgICAgY29uc3QgdXJsID0gYCR7Z2V0T2F1dGhDb25maWcoKS5CQVNFX0FQSV9VUkx9L3YxL3Nlc3Npb25zYFxuICAgICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgICAgLi4uZ2V0T0F1dGhIZWFkZXJzKGFjY2Vzc1Rva2VuKSxcbiAgICAgICAgJ2FudGhyb3BpYy1iZXRhJzogJ2Njci1ieW9jLTIwMjUtMDctMjknLFxuICAgICAgICAneC1vcmdhbml6YXRpb24tdXVpZCc6IG9yZ1VVSUQsXG4gICAgICB9XG4gICAgICBjb25zdCBlbnZWYXJzID0ge1xuICAgICAgICBDTEFVREVfQ09ERV9PQVVUSF9UT0tFTjogYWNjZXNzVG9rZW4sXG4gICAgICAgIC4uLihvcHRpb25zLmVudmlyb25tZW50VmFyaWFibGVzID8/IHt9KSxcbiAgICAgIH1cblxuICAgICAgLy8gQnVuZGxlIG1vZGU6IHVwbG9hZCBsb2NhbCB3b3JraW5nIHRyZWUgKHVuY29tbWl0dGVkIGNoYW5nZXMgdmlhXG4gICAgICAvLyByZWZzL3NlZWQvc3Rhc2gpLCBjb250YWluZXIgY2xvbmVzIGZyb20gdGhlIGJ1bmRsZS4gTm8gR2l0SHViLlxuICAgICAgLy8gT3RoZXJ3aXNlOiBnaXRodWIuY29tIHNvdXJjZSDigJQgY2FsbGVyIGNoZWNrZWQgZWxpZ2liaWxpdHkuXG4gICAgICBsZXQgZ2l0U291cmNlOiBHaXRTb3VyY2UgfCBudWxsID0gbnVsbFxuICAgICAgbGV0IHNlZWRCdW5kbGVGaWxlSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsXG4gICAgICBpZiAob3B0aW9ucy51c2VCdW5kbGUpIHtcbiAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgY3JlYXRlQW5kVXBsb2FkR2l0QnVuZGxlKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9hdXRoVG9rZW46IGFjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgc2Vzc2lvbklkOiBnZXRTZXNzaW9uSWQoKSxcbiAgICAgICAgICAgIGJhc2VVcmw6IGdldE9hdXRoQ29uZmlnKCkuQkFTRV9BUElfVVJMLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBzaWduYWwgfSxcbiAgICAgICAgKVxuICAgICAgICBpZiAoIWJ1bmRsZS5zdWNjZXNzKSB7XG4gICAgICAgICAgbG9nRXJyb3IobmV3IEVycm9yKGBCdW5kbGUgdXBsb2FkIGZhaWxlZDogJHtidW5kbGUuZXJyb3J9YCkpXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuICAgICAgICBzZWVkQnVuZGxlRmlsZUlkID0gYnVuZGxlLmZpbGVJZFxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfYnVuZGxlX21vZGUnLCB7XG4gICAgICAgICAgc2l6ZV9ieXRlczogYnVuZGxlLmJ1bmRsZVNpemVCeXRlcyxcbiAgICAgICAgICBzY29wZTpcbiAgICAgICAgICAgIGJ1bmRsZS5zY29wZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIGhhc193aXA6IGJ1bmRsZS5oYXNXaXAsXG4gICAgICAgICAgcmVhc29uOlxuICAgICAgICAgICAgJ2V4cGxpY2l0X2Vudl9idW5kbGUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXBvSW5mbyA9IGF3YWl0IGRldGVjdEN1cnJlbnRSZXBvc2l0b3J5V2l0aEhvc3QoKVxuICAgICAgICBpZiAocmVwb0luZm8pIHtcbiAgICAgICAgICBnaXRTb3VyY2UgPSB7XG4gICAgICAgICAgICB0eXBlOiAnZ2l0X3JlcG9zaXRvcnknLFxuICAgICAgICAgICAgdXJsOiBgaHR0cHM6Ly8ke3JlcG9JbmZvLmhvc3R9LyR7cmVwb0luZm8ub3duZXJ9LyR7cmVwb0luZm8ubmFtZX1gLFxuICAgICAgICAgICAgcmV2aXNpb246IG9wdGlvbnMuYnJhbmNoTmFtZSxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVxdWVzdEJvZHkgPSB7XG4gICAgICAgIHRpdGxlOiBvcHRpb25zLnRpdGxlIHx8IG9wdGlvbnMuZGVzY3JpcHRpb24gfHwgJ1JlbW90ZSB0YXNrJyxcbiAgICAgICAgZXZlbnRzOiBbXSxcbiAgICAgICAgc2Vzc2lvbl9jb250ZXh0OiB7XG4gICAgICAgICAgc291cmNlczogZ2l0U291cmNlID8gW2dpdFNvdXJjZV0gOiBbXSxcbiAgICAgICAgICAuLi4oc2VlZEJ1bmRsZUZpbGVJZCAmJiB7IHNlZWRfYnVuZGxlX2ZpbGVfaWQ6IHNlZWRCdW5kbGVGaWxlSWQgfSksXG4gICAgICAgICAgb3V0Y29tZXM6IFtdLFxuICAgICAgICAgIGVudmlyb25tZW50X3ZhcmlhYmxlczogZW52VmFycyxcbiAgICAgICAgfSxcbiAgICAgICAgZW52aXJvbm1lbnRfaWQ6IG9wdGlvbnMuZW52aXJvbm1lbnRJZCxcbiAgICAgIH1cbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFt0ZWxlcG9ydFRvUmVtb3RlXSBleHBsaWNpdCBlbnYgJHtvcHRpb25zLmVudmlyb25tZW50SWR9LCAke09iamVjdC5rZXlzKGVudlZhcnMpLmxlbmd0aH0gZW52IHZhcnMsICR7c2VlZEJ1bmRsZUZpbGVJZCA/IGBidW5kbGU9JHtzZWVkQnVuZGxlRmlsZUlkfWAgOiBgc291cmNlPSR7Z2l0U291cmNlPy51cmwgPz8gJ25vbmUnfUAke29wdGlvbnMuYnJhbmNoTmFtZSA/PyAnZGVmYXVsdCd9YH1gLFxuICAgICAgKVxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5wb3N0KHVybCwgcmVxdWVzdEJvZHksIHsgaGVhZGVycywgc2lnbmFsIH0pXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSAyMDAgJiYgcmVzcG9uc2Uuc3RhdHVzICE9PSAyMDEpIHtcbiAgICAgICAgbG9nRXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgYENyZWF0ZVNlc3Npb24gJHtyZXNwb25zZS5zdGF0dXN9OiAke2pzb25TdHJpbmdpZnkocmVzcG9uc2UuZGF0YSl9YCxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IHJlc3BvbnNlLmRhdGEgYXMgU2Vzc2lvblJlc291cmNlXG4gICAgICBpZiAoIXNlc3Npb25EYXRhIHx8IHR5cGVvZiBzZXNzaW9uRGF0YS5pZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbG9nRXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgYE5vIHNlc3Npb24gaWQgaW4gcmVzcG9uc2U6ICR7anNvblN0cmluZ2lmeShyZXNwb25zZS5kYXRhKX1gLFxuICAgICAgICAgICksXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiBzZXNzaW9uRGF0YS5pZCxcbiAgICAgICAgdGl0bGU6IHNlc3Npb25EYXRhLnRpdGxlIHx8IHJlcXVlc3RCb2R5LnRpdGxlLFxuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBnaXRTb3VyY2U6IEdpdFNvdXJjZSB8IG51bGwgPSBudWxsXG4gICAgbGV0IGdpdE91dGNvbWU6IEdpdFJlcG9zaXRvcnlPdXRjb21lIHwgbnVsbCA9IG51bGxcbiAgICBsZXQgc2VlZEJ1bmRsZUZpbGVJZDogc3RyaW5nIHwgbnVsbCA9IG51bGxcblxuICAgIC8vIFNvdXJjZSBzZWxlY3Rpb24gbGFkZGVyOiBHaXRIdWIgY2xvbmUgKGlmIENDUiBjYW4gYWN0dWFsbHkgcHVsbCBpdCkg4oaSXG4gICAgLy8gYnVuZGxlIGZhbGxiYWNrIChpZiAuZ2l0IGV4aXN0cykg4oaSIGVtcHR5IHNhbmRib3guXG4gICAgLy9cbiAgICAvLyBUaGUgcHJlZmxpZ2h0IGlzIHRoZSBzYW1lIGNvZGUgcGF0aCB0aGUgY29udGFpbmVyJ3MgZ2l0LXByb3h5IGNsb25lXG4gICAgLy8gd2lsbCBoaXQgKGdldF9naXRodWJfY2xpZW50X3dpdGhfdXNlcl9hdXRoIOKGkiBub19zeW5jX3VzZXJfdG9rZW5fZm91bmQpLlxuICAgIC8vIDUwJSBvZiB1c2VycyB3aG8gcmVhY2ggdGhlIFwiaW5zdGFsbCBHaXRIdWIgQXBwXCIgc3RlcCBuZXZlciBmaW5pc2ggaXQ7XG4gICAgLy8gd2l0aG91dCB0aGUgcHJlZmxpZ2h0LCBldmVyeSBvbmUgb2YgdGhlbSBnZXRzIGEgY29udGFpbmVyIHRoYXQgNDAxc1xuICAgIC8vIG9uIGNsb25lLiBXaXRoIGl0LCB0aGV5IHNpbGVudGx5IGZhbGwgYmFjayB0byBidW5kbGUuXG4gICAgLy9cbiAgICAvLyBDQ1JfRk9SQ0VfQlVORExFPTEgc2tpcHMgdGhlIHByZWZsaWdodCBlbnRpcmVseSDigJQgdXNlZnVsIGZvciB0ZXN0aW5nXG4gICAgLy8gb3Igd2hlbiB5b3Uga25vdyB5b3VyIEdpdEh1YiBhdXRoIGlzIGJ1c3RlZC4gUmVhZCBoZXJlIChub3QgaW4gdGhlXG4gICAgLy8gY2FsbGVyKSBzbyBpdCB3b3JrcyBmb3IgcmVtb3RlLWFnZW50IHRvbywgbm90IGp1c3QgLS1yZW1vdGUuXG5cbiAgICBjb25zdCByZXBvSW5mbyA9IGF3YWl0IGRldGVjdEN1cnJlbnRSZXBvc2l0b3J5V2l0aEhvc3QoKVxuXG4gICAgLy8gR2VuZXJhdGUgdGl0bGUgYW5kIGJyYW5jaCBuYW1lIGZvciB0aGUgc2Vzc2lvbi4gU2tpcCB0aGUgSGFpa3UgY2FsbFxuICAgIC8vIHdoZW4gYm90aCB0aXRsZSBhbmQgb3V0Y29tZSBicmFuY2ggYXJlIGV4cGxpY2l0bHkgcHJvdmlkZWQuXG4gICAgbGV0IHNlc3Npb25UaXRsZTogc3RyaW5nXG4gICAgbGV0IHNlc3Npb25CcmFuY2g6IHN0cmluZ1xuICAgIGlmIChvcHRpb25zLnRpdGxlICYmIG9wdGlvbnMucmV1c2VPdXRjb21lQnJhbmNoKSB7XG4gICAgICBzZXNzaW9uVGl0bGUgPSBvcHRpb25zLnRpdGxlXG4gICAgICBzZXNzaW9uQnJhbmNoID0gb3B0aW9ucy5yZXVzZU91dGNvbWVCcmFuY2hcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ2VuZXJhdGVkID0gYXdhaXQgZ2VuZXJhdGVUaXRsZUFuZEJyYW5jaChcbiAgICAgICAgb3B0aW9ucy5kZXNjcmlwdGlvbiB8fCBpbml0aWFsTWVzc2FnZSB8fCAnQmFja2dyb3VuZCB0YXNrJyxcbiAgICAgICAgc2lnbmFsLFxuICAgICAgKVxuICAgICAgc2Vzc2lvblRpdGxlID0gb3B0aW9ucy50aXRsZSB8fCBnZW5lcmF0ZWQudGl0bGVcbiAgICAgIHNlc3Npb25CcmFuY2ggPSBvcHRpb25zLnJldXNlT3V0Y29tZUJyYW5jaCB8fCBnZW5lcmF0ZWQuYnJhbmNoTmFtZVxuICAgIH1cblxuICAgIC8vIFByZWZsaWdodDogZG9lcyBDQ1IgaGF2ZSBhIHRva2VuIHRoYXQgY2FuIGNsb25lIHRoaXMgcmVwbz9cbiAgICAvLyBPbmx5IGNoZWNrZWQgZm9yIGdpdGh1Yi5jb20g4oCUIEdIRVMgbmVlZHMgZ2hlX2NvbmZpZ3VyYXRpb25faWQgd2hpY2hcbiAgICAvLyB3ZSBkb24ndCBoYXZlLCBhbmQgR0hFUyB1c2VycyBhcmUgcG93ZXIgdXNlcnMgd2hvIHByb2JhYmx5IGZpbmlzaGVkXG4gICAgLy8gc2V0dXAuIEZvciB0aGVtIChhbmQgZm9yIG5vbi1HaXRIdWIgaG9zdHMgdGhhdCBwYXJzZUdpdFJlbW90ZVxuICAgIC8vIHNvbWVob3cgYWNjZXB0ZWQpLCBmYWxsIHRocm91Z2ggb3B0aW1pc3RpY2FsbHk7IGlmIHRoZSBiYWNrZW5kXG4gICAgLy8gcmVqZWN0cyB0aGUgaG9zdCwgYnVuZGxlIG5leHQgdGltZS5cbiAgICBsZXQgZ2hWaWFibGUgPSBmYWxzZVxuICAgIGxldCBzb3VyY2VSZWFzb246XG4gICAgICB8ICdnaXRodWJfcHJlZmxpZ2h0X29rJ1xuICAgICAgfCAnZ2hlc19vcHRpbWlzdGljJ1xuICAgICAgfCAnZ2l0aHViX3ByZWZsaWdodF9mYWlsZWQnXG4gICAgICB8ICdub19naXRodWJfcmVtb3RlJ1xuICAgICAgfCAnZm9yY2VkX2J1bmRsZSdcbiAgICAgIHwgJ25vX2dpdF9hdF9hbGwnID0gJ25vX2dpdF9hdF9hbGwnXG5cbiAgICAvLyBnaXRSb290IGdhdGVzIGJvdGggYnVuZGxlIGNyZWF0aW9uIGFuZCB0aGUgZ2F0ZSBjaGVjayBpdHNlbGYg4oCUIG5vXG4gICAgLy8gcG9pbnQgYXdhaXRpbmcgR3Jvd3RoQm9vayB3aGVuIHRoZXJlJ3Mgbm90aGluZyB0byBidW5kbGUuXG4gICAgY29uc3QgZ2l0Um9vdCA9IGZpbmRHaXRSb290KGdldEN3ZCgpKVxuICAgIGNvbnN0IGZvcmNlQnVuZGxlID1cbiAgICAgICFvcHRpb25zLnNraXBCdW5kbGUgJiYgaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0NSX0ZPUkNFX0JVTkRMRSlcbiAgICBjb25zdCBidW5kbGVTZWVkR2F0ZU9uID1cbiAgICAgICFvcHRpb25zLnNraXBCdW5kbGUgJiZcbiAgICAgIGdpdFJvb3QgIT09IG51bGwgJiZcbiAgICAgIChpc0VudlRydXRoeShwcm9jZXNzLmVudi5DQ1JfRU5BQkxFX0JVTkRMRSkgfHxcbiAgICAgICAgKGF3YWl0IGNoZWNrR2F0ZV9DQUNIRURfT1JfQkxPQ0tJTkcoJ3Rlbmd1X2Njcl9idW5kbGVfc2VlZF9lbmFibGVkJykpKVxuXG4gICAgaWYgKHJlcG9JbmZvICYmICFmb3JjZUJ1bmRsZSkge1xuICAgICAgaWYgKHJlcG9JbmZvLmhvc3QgPT09ICdnaXRodWIuY29tJykge1xuICAgICAgICBnaFZpYWJsZSA9IGF3YWl0IGNoZWNrR2l0aHViQXBwSW5zdGFsbGVkKFxuICAgICAgICAgIHJlcG9JbmZvLm93bmVyLFxuICAgICAgICAgIHJlcG9JbmZvLm5hbWUsXG4gICAgICAgICAgc2lnbmFsLFxuICAgICAgICApXG4gICAgICAgIHNvdXJjZVJlYXNvbiA9IGdoVmlhYmxlXG4gICAgICAgICAgPyAnZ2l0aHViX3ByZWZsaWdodF9vaydcbiAgICAgICAgICA6ICdnaXRodWJfcHJlZmxpZ2h0X2ZhaWxlZCdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGdoVmlhYmxlID0gdHJ1ZVxuICAgICAgICBzb3VyY2VSZWFzb24gPSAnZ2hlc19vcHRpbWlzdGljJ1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZm9yY2VCdW5kbGUpIHtcbiAgICAgIHNvdXJjZVJlYXNvbiA9ICdmb3JjZWRfYnVuZGxlJ1xuICAgIH0gZWxzZSBpZiAoZ2l0Um9vdCkge1xuICAgICAgc291cmNlUmVhc29uID0gJ25vX2dpdGh1Yl9yZW1vdGUnXG4gICAgfVxuXG4gICAgLy8gUHJlZmxpZ2h0IGZhaWxlZCBidXQgYnVuZGxlIGlzIG9mZiDigJQgZmFsbCB0aHJvdWdoIG9wdGltaXN0aWNhbGx5IGxpa2VcbiAgICAvLyBwcmUtcHJlZmxpZ2h0IGJlaGF2aW9yLiBCYWNrZW5kIHJlcG9ydHMgdGhlIHJlYWwgYXV0aCBlcnJvci5cbiAgICBpZiAoIWdoVmlhYmxlICYmICFidW5kbGVTZWVkR2F0ZU9uICYmIHJlcG9JbmZvKSB7XG4gICAgICBnaFZpYWJsZSA9IHRydWVcbiAgICB9XG5cbiAgICBpZiAoZ2hWaWFibGUgJiYgcmVwb0luZm8pIHtcbiAgICAgIGNvbnN0IHsgaG9zdCwgb3duZXIsIG5hbWUgfSA9IHJlcG9JbmZvXG4gICAgICAvLyBSZXNvbHZlIHRoZSBiYXNlIGJyYW5jaDogcHJlZmVyIGV4cGxpY2l0IGJyYW5jaE5hbWUsIGZhbGwgYmFjayB0byBkZWZhdWx0IGJyYW5jaFxuICAgICAgY29uc3QgcmV2aXNpb24gPVxuICAgICAgICBvcHRpb25zLmJyYW5jaE5hbWUgPz8gKGF3YWl0IGdldERlZmF1bHRCcmFuY2goKSkgPz8gdW5kZWZpbmVkXG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbdGVsZXBvcnRUb1JlbW90ZV0gR2l0IHNvdXJjZTogJHtob3N0fS8ke293bmVyfS8ke25hbWV9LCByZXZpc2lvbjogJHtyZXZpc2lvbiA/PyAnbm9uZSd9YCxcbiAgICAgIClcbiAgICAgIGdpdFNvdXJjZSA9IHtcbiAgICAgICAgdHlwZTogJ2dpdF9yZXBvc2l0b3J5JyxcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly8ke2hvc3R9LyR7b3duZXJ9LyR7bmFtZX1gLFxuICAgICAgICAvLyBUaGUgcmV2aXNpb24gc3BlY2lmaWVzIHdoaWNoIHJlZiB0byBjaGVja291dCBhcyB0aGUgYmFzZSBicmFuY2hcbiAgICAgICAgcmV2aXNpb24sXG4gICAgICAgIC4uLihvcHRpb25zLnJldXNlT3V0Y29tZUJyYW5jaCAmJiB7XG4gICAgICAgICAgYWxsb3dfdW5yZXN0cmljdGVkX2dpdF9wdXNoOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH1cbiAgICAgIC8vIHR5cGU6ICdnaXRodWInIGlzIHVzZWQgZm9yIGFsbCBHaXRIdWItY29tcGF0aWJsZSBob3N0cyAoZ2l0aHViLmNvbSBhbmQgR0hFKS5cbiAgICAgIC8vIFRoZSBDTEkgY2FuJ3QgZGlzdGluZ3Vpc2ggR0hFIGZyb20gbm9uLUdpdEh1YiBob3N0cyAoR2l0TGFiLCBCaXRidWNrZXQpXG4gICAgICAvLyBjbGllbnQtc2lkZSDigJQgdGhlIGJhY2tlbmQgdmFsaWRhdGVzIHRoZSBVUkwgYWdhaW5zdCBjb25maWd1cmVkIEdIRSBpbnN0YW5jZXNcbiAgICAgIC8vIGFuZCBpZ25vcmVzIGdpdF9pbmZvIGZvciB1bnJlY29nbml6ZWQgaG9zdHMuXG4gICAgICBnaXRPdXRjb21lID0ge1xuICAgICAgICB0eXBlOiAnZ2l0X3JlcG9zaXRvcnknLFxuICAgICAgICBnaXRfaW5mbzoge1xuICAgICAgICAgIHR5cGU6ICdnaXRodWInLFxuICAgICAgICAgIHJlcG86IGAke293bmVyfS8ke25hbWV9YCxcbiAgICAgICAgICBicmFuY2hlczogW3Nlc3Npb25CcmFuY2hdLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEJ1bmRsZSBmYWxsYmFjay4gT25seSB0cnkgYnVuZGxlIGlmIEdpdEh1YiB3YXNuJ3QgdmlhYmxlLCB0aGUgZ2F0ZSBpc1xuICAgIC8vIG9uLCBhbmQgdGhlcmUncyBhIC5naXQvIHRvIGJ1bmRsZSBmcm9tLiBSZWFjaGluZyBoZXJlIHdpdGhcbiAgICAvLyBnaFZpYWJsZT1mYWxzZSBhbmQgcmVwb0luZm8gbm9uLW51bGwgbWVhbnMgdGhlIHByZWZsaWdodCBmYWlsZWQg4oCUXG4gICAgLy8gLmdpdCBkZWZpbml0ZWx5IGV4aXN0cyAoZGV0ZWN0Q3VycmVudFJlcG9zaXRvcnlXaXRoSG9zdCByZWFkIHRoZVxuICAgIC8vIHJlbW90ZSBmcm9tIGl0KS5cbiAgICBpZiAoIWdpdFNvdXJjZSAmJiBidW5kbGVTZWVkR2F0ZU9uKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoYFt0ZWxlcG9ydFRvUmVtb3RlXSBCdW5kbGluZyAocmVhc29uOiAke3NvdXJjZVJlYXNvbn0pYClcbiAgICAgIGNvbnN0IGJ1bmRsZSA9IGF3YWl0IGNyZWF0ZUFuZFVwbG9hZEdpdEJ1bmRsZShcbiAgICAgICAge1xuICAgICAgICAgIG9hdXRoVG9rZW46IGFjY2Vzc1Rva2VuLFxuICAgICAgICAgIHNlc3Npb25JZDogZ2V0U2Vzc2lvbklkKCksXG4gICAgICAgICAgYmFzZVVybDogZ2V0T2F1dGhDb25maWcoKS5CQVNFX0FQSV9VUkwsXG4gICAgICAgIH0sXG4gICAgICAgIHsgc2lnbmFsIH0sXG4gICAgICApXG4gICAgICBpZiAoIWJ1bmRsZS5zdWNjZXNzKSB7XG4gICAgICAgIGxvZ0Vycm9yKG5ldyBFcnJvcihgQnVuZGxlIHVwbG9hZCBmYWlsZWQ6ICR7YnVuZGxlLmVycm9yfWApKVxuICAgICAgICAvLyBPbmx5IHN0ZWVyIHVzZXJzIHRvIEdpdEh1YiBzZXR1cCB3aGVuIHRoZXJlJ3MgYSByZW1vdGUgdG8gY2xvbmUgZnJvbS5cbiAgICAgICAgY29uc3Qgc2V0dXAgPSByZXBvSW5mb1xuICAgICAgICAgID8gJy4gUGxlYXNlIHNldHVwIEdpdEh1YiBvbiBodHRwczovL2NsYXVkZS5haS9jb2RlJ1xuICAgICAgICAgIDogJydcbiAgICAgICAgbGV0IG1zZzogc3RyaW5nXG4gICAgICAgIHN3aXRjaCAoYnVuZGxlLmZhaWxSZWFzb24pIHtcbiAgICAgICAgICBjYXNlICdlbXB0eV9yZXBvJzpcbiAgICAgICAgICAgIG1zZyA9XG4gICAgICAgICAgICAgICdSZXBvc2l0b3J5IGhhcyBubyBjb21taXRzIOKAlCBydW4gYGdpdCBhZGQgLiAmJiBnaXQgY29tbWl0IC1tIFwiaW5pdGlhbFwiYCB0aGVuIHJldHJ5J1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBjYXNlICd0b29fbGFyZ2UnOlxuICAgICAgICAgICAgbXNnID0gYFJlcG8gaXMgdG9vIGxhcmdlIHRvIHRlbGVwb3J0JHtzZXR1cH1gXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ2dpdF9lcnJvcic6XG4gICAgICAgICAgICBtc2cgPSBgRmFpbGVkIHRvIGNyZWF0ZSBnaXQgYnVuZGxlICgke2J1bmRsZS5lcnJvcn0pJHtzZXR1cH1gXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgICAgbXNnID0gYEJ1bmRsZSB1cGxvYWQgZmFpbGVkOiAke2J1bmRsZS5lcnJvcn0ke3NldHVwfWBcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY29uc3QgX2V4aGF1c3RpdmU6IG5ldmVyID0gYnVuZGxlLmZhaWxSZWFzb25cbiAgICAgICAgICAgIHZvaWQgX2V4aGF1c3RpdmVcbiAgICAgICAgICAgIG1zZyA9IGBCdW5kbGUgdXBsb2FkIGZhaWxlZDogJHtidW5kbGUuZXJyb3J9YFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zLm9uQnVuZGxlRmFpbD8uKG1zZylcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIHNlZWRCdW5kbGVGaWxlSWQgPSBidW5kbGUuZmlsZUlkXG4gICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfYnVuZGxlX21vZGUnLCB7XG4gICAgICAgIHNpemVfYnl0ZXM6IGJ1bmRsZS5idW5kbGVTaXplQnl0ZXMsXG4gICAgICAgIHNjb3BlOlxuICAgICAgICAgIGJ1bmRsZS5zY29wZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICBoYXNfd2lwOiBidW5kbGUuaGFzV2lwLFxuICAgICAgICByZWFzb246XG4gICAgICAgICAgc291cmNlUmVhc29uIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgIH1cblxuICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZWxlcG9ydF9zb3VyY2VfZGVjaXNpb24nLCB7XG4gICAgICByZWFzb246XG4gICAgICAgIHNvdXJjZVJlYXNvbiBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgcGF0aDogKGdpdFNvdXJjZVxuICAgICAgICA/ICdnaXRodWInXG4gICAgICAgIDogc2VlZEJ1bmRsZUZpbGVJZFxuICAgICAgICAgID8gJ2J1bmRsZSdcbiAgICAgICAgICA6ICdlbXB0eScpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgfSlcblxuICAgIGlmICghZ2l0U291cmNlICYmICFzZWVkQnVuZGxlRmlsZUlkKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICdbdGVsZXBvcnRUb1JlbW90ZV0gTm8gcmVwb3NpdG9yeSBkZXRlY3RlZCDigJQgc2Vzc2lvbiB3aWxsIGhhdmUgYW4gZW1wdHkgc2FuZGJveCcsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gRmV0Y2ggYXZhaWxhYmxlIGVudmlyb25tZW50c1xuICAgIGxldCBlbnZpcm9ubWVudHMgPSBhd2FpdCBmZXRjaEVudmlyb25tZW50cygpXG4gICAgaWYgKCFlbnZpcm9ubWVudHMgfHwgZW52aXJvbm1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbG9nRXJyb3IobmV3IEVycm9yKCdObyBlbnZpcm9ubWVudHMgYXZhaWxhYmxlIGZvciBzZXNzaW9uIGNyZWF0aW9uJykpXG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBBdmFpbGFibGUgZW52aXJvbm1lbnRzOiAke2Vudmlyb25tZW50cy5tYXAoZSA9PiBgJHtlLmVudmlyb25tZW50X2lkfSAoJHtlLm5hbWV9LCAke2Uua2luZH0pYCkuam9pbignLCAnKX1gLFxuICAgIClcblxuICAgIC8vIFNlbGVjdCBlbnZpcm9ubWVudCBiYXNlZCBvbiBzZXR0aW5ncywgdGhlbiBhbnRocm9waWNfY2xvdWQgcHJlZmVyZW5jZSwgdGhlbiBmaXJzdCBhdmFpbGFibGUuXG4gICAgLy8gUHJlZmVyIGFudGhyb3BpY19jbG91ZCBlbnZpcm9ubWVudHMgb3ZlciBieW9jOiBhbnRocm9waWNfY2xvdWQgZW52aXJvbm1lbnRzIChlLmcuIFwiRGVmYXVsdFwiKVxuICAgIC8vIGFyZSB0aGUgc3RhbmRhcmQgY29tcHV0ZSBlbnZpcm9ubWVudHMgd2l0aCBmdWxsIHJlcG8gYWNjZXNzLCB3aGVyZWFzIGJ5b2MgZW52aXJvbm1lbnRzXG4gICAgLy8gKGUuZy4gXCJtb25vcmVwb1wiKSBhcmUgdXNlci1vd25lZCBjb21wdXRlIHRoYXQgbWF5IG5vdCBzdXBwb3J0IHRoZSBjdXJyZW50IHJlcG9zaXRvcnkuXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBnZXRTZXR0aW5nc19ERVBSRUNBVEVEKClcbiAgICBjb25zdCBkZWZhdWx0RW52aXJvbm1lbnRJZCA9IG9wdGlvbnMudXNlRGVmYXVsdEVudmlyb25tZW50XG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiBzZXR0aW5ncz8ucmVtb3RlPy5kZWZhdWx0RW52aXJvbm1lbnRJZFxuICAgIGxldCBjbG91ZEVudiA9IGVudmlyb25tZW50cy5maW5kKGVudiA9PiBlbnYua2luZCA9PT0gJ2FudGhyb3BpY19jbG91ZCcpXG4gICAgLy8gV2hlbiB0aGUgY2FsbGVyIG9wdHMgb3V0IG9mIHRoZWlyIGNvbmZpZ3VyZWQgZGVmYXVsdCwgZG8gbm90IGZhbGxcbiAgICAvLyB0aHJvdWdoIHRvIGEgQllPQyBlbnYgdGhhdCBtYXkgbm90IHN1cHBvcnQgdGhlIGN1cnJlbnQgcmVwbyBvciB0aGVcbiAgICAvLyByZXF1ZXN0ZWQgcGVybWlzc2lvbiBtb2RlLiBSZXRyeSBvbmNlIGZvciBldmVudHVhbCBjb25zaXN0ZW5jeSxcbiAgICAvLyB0aGVuIGZhaWwgbG91ZGx5LlxuICAgIGlmIChvcHRpb25zLnVzZURlZmF1bHRFbnZpcm9ubWVudCAmJiAhY2xvdWRFbnYpIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYE5vIGFudGhyb3BpY19jbG91ZCBpbiBlbnYgbGlzdCAoJHtlbnZpcm9ubWVudHMubGVuZ3RofSBlbnZzKTsgcmV0cnlpbmcgZmV0Y2hFbnZpcm9ubWVudHNgLFxuICAgICAgKVxuICAgICAgY29uc3QgcmV0cmllZCA9IGF3YWl0IGZldGNoRW52aXJvbm1lbnRzKClcbiAgICAgIGNsb3VkRW52ID0gcmV0cmllZD8uZmluZChlbnYgPT4gZW52LmtpbmQgPT09ICdhbnRocm9waWNfY2xvdWQnKVxuICAgICAgaWYgKCFjbG91ZEVudikge1xuICAgICAgICBsb2dFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgTm8gYW50aHJvcGljX2Nsb3VkIGVudmlyb25tZW50IGF2YWlsYWJsZSBhZnRlciByZXRyeSAoZ290OiAkeyhyZXRyaWVkID8/IGVudmlyb25tZW50cykubWFwKGUgPT4gYCR7ZS5uYW1lfSAoJHtlLmtpbmR9KWApLmpvaW4oJywgJyl9KS4gU2lsZW50IGJ5b2MgZmFsbHRocm91Z2ggd291bGQgbGF1bmNoIGludG8gYSBkZWFkIGVudiDigJQgZmFpbCBmYXN0IGluc3RlYWQuYCxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICBpZiAocmV0cmllZCkgZW52aXJvbm1lbnRzID0gcmV0cmllZFxuICAgIH1cbiAgICBjb25zdCBzZWxlY3RlZEVudmlyb25tZW50ID1cbiAgICAgIChkZWZhdWx0RW52aXJvbm1lbnRJZCAmJlxuICAgICAgICBlbnZpcm9ubWVudHMuZmluZChcbiAgICAgICAgICBlbnYgPT4gZW52LmVudmlyb25tZW50X2lkID09PSBkZWZhdWx0RW52aXJvbm1lbnRJZCxcbiAgICAgICAgKSkgfHxcbiAgICAgIGNsb3VkRW52IHx8XG4gICAgICBlbnZpcm9ubWVudHMuZmluZChlbnYgPT4gZW52LmtpbmQgIT09ICdicmlkZ2UnKSB8fFxuICAgICAgZW52aXJvbm1lbnRzWzBdXG5cbiAgICBpZiAoIXNlbGVjdGVkRW52aXJvbm1lbnQpIHtcbiAgICAgIGxvZ0Vycm9yKG5ldyBFcnJvcignTm8gZW52aXJvbm1lbnRzIGF2YWlsYWJsZSBmb3Igc2Vzc2lvbiBjcmVhdGlvbicpKVxuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICBpZiAoZGVmYXVsdEVudmlyb25tZW50SWQpIHtcbiAgICAgIGNvbnN0IG1hdGNoZWREZWZhdWx0ID1cbiAgICAgICAgc2VsZWN0ZWRFbnZpcm9ubWVudC5lbnZpcm9ubWVudF9pZCA9PT0gZGVmYXVsdEVudmlyb25tZW50SWRcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgbWF0Y2hlZERlZmF1bHRcbiAgICAgICAgICA/IGBVc2luZyBjb25maWd1cmVkIGRlZmF1bHQgZW52aXJvbm1lbnQ6ICR7ZGVmYXVsdEVudmlyb25tZW50SWR9YFxuICAgICAgICAgIDogYENvbmZpZ3VyZWQgZGVmYXVsdCBlbnZpcm9ubWVudCAke2RlZmF1bHRFbnZpcm9ubWVudElkfSBub3QgZm91bmQsIHVzaW5nIGZpcnN0IGF2YWlsYWJsZWAsXG4gICAgICApXG4gICAgfVxuXG4gICAgY29uc3QgZW52aXJvbm1lbnRJZCA9IHNlbGVjdGVkRW52aXJvbm1lbnQuZW52aXJvbm1lbnRfaWRcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICBgU2VsZWN0ZWQgZW52aXJvbm1lbnQ6ICR7ZW52aXJvbm1lbnRJZH0gKCR7c2VsZWN0ZWRFbnZpcm9ubWVudC5uYW1lfSwgJHtzZWxlY3RlZEVudmlyb25tZW50LmtpbmR9KWAsXG4gICAgKVxuXG4gICAgLy8gUHJlcGFyZSBBUEkgcmVxdWVzdCBmb3IgU2Vzc2lvbnMgQVBJXG4gICAgY29uc3QgdXJsID0gYCR7Z2V0T2F1dGhDb25maWcoKS5CQVNFX0FQSV9VUkx9L3YxL3Nlc3Npb25zYFxuXG4gICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgIC4uLmdldE9BdXRoSGVhZGVycyhhY2Nlc3NUb2tlbiksXG4gICAgICAnYW50aHJvcGljLWJldGEnOiAnY2NyLWJ5b2MtMjAyNS0wNy0yOScsXG4gICAgICAneC1vcmdhbml6YXRpb24tdXVpZCc6IG9yZ1VVSUQsXG4gICAgfVxuXG4gICAgY29uc3Qgc2Vzc2lvbkNvbnRleHQgPSB7XG4gICAgICBzb3VyY2VzOiBnaXRTb3VyY2UgPyBbZ2l0U291cmNlXSA6IFtdLFxuICAgICAgLi4uKHNlZWRCdW5kbGVGaWxlSWQgJiYgeyBzZWVkX2J1bmRsZV9maWxlX2lkOiBzZWVkQnVuZGxlRmlsZUlkIH0pLFxuICAgICAgb3V0Y29tZXM6IGdpdE91dGNvbWUgPyBbZ2l0T3V0Y29tZV0gOiBbXSxcbiAgICAgIG1vZGVsOiBvcHRpb25zLm1vZGVsID8/IGdldE1haW5Mb29wTW9kZWwoKSxcbiAgICAgIC4uLihvcHRpb25zLnJldXNlT3V0Y29tZUJyYW5jaCAmJiB7IHJldXNlX291dGNvbWVfYnJhbmNoZXM6IHRydWUgfSksXG4gICAgICAuLi4ob3B0aW9ucy5naXRodWJQciAmJiB7IGdpdGh1Yl9wcjogb3B0aW9ucy5naXRodWJQciB9KSxcbiAgICB9XG5cbiAgICAvLyBDcmVhdGVDQ1JTZXNzaW9uUGF5bG9hZCBoYXMgbm8gcGVybWlzc2lvbl9tb2RlIGZpZWxkIOKAlCBhIHRvcC1sZXZlbFxuICAgIC8vIGJvZHkgZW50cnkgaXMgc2lsZW50bHkgZHJvcHBlZCBieSB0aGUgcHJvdG8gcGFyc2VyIHNlcnZlci1zaWRlLlxuICAgIC8vIEluc3RlYWQgcHJlcGVuZCBhIHNldF9wZXJtaXNzaW9uX21vZGUgY29udHJvbF9yZXF1ZXN0IGV2ZW50LiBJbml0aWFsXG4gICAgLy8gZXZlbnRzIGFyZSB3cml0dGVuIHRvIHRocmVhZHN0b3JlIGJlZm9yZSB0aGUgY29udGFpbmVyIGNvbm5lY3RzLCBzb1xuICAgIC8vIHRoZSBDTEkgYXBwbGllcyB0aGUgbW9kZSBiZWZvcmUgdGhlIGZpcnN0IHVzZXIgdHVybiDigJQgbm8gcmVhZGluZXNzIHJhY2UuXG4gICAgY29uc3QgZXZlbnRzOiBBcnJheTx7IHR5cGU6ICdldmVudCc7IGRhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0+ID0gW11cbiAgICBpZiAob3B0aW9ucy5wZXJtaXNzaW9uTW9kZSkge1xuICAgICAgZXZlbnRzLnB1c2goe1xuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdHlwZTogJ2NvbnRyb2xfcmVxdWVzdCcsXG4gICAgICAgICAgcmVxdWVzdF9pZDogYHNldC1tb2RlLSR7cmFuZG9tVVVJRCgpfWAsXG4gICAgICAgICAgcmVxdWVzdDoge1xuICAgICAgICAgICAgc3VidHlwZTogJ3NldF9wZXJtaXNzaW9uX21vZGUnLFxuICAgICAgICAgICAgbW9kZTogb3B0aW9ucy5wZXJtaXNzaW9uTW9kZSxcbiAgICAgICAgICAgIHVsdHJhcGxhbjogb3B0aW9ucy51bHRyYXBsYW4sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgfVxuICAgIGlmIChpbml0aWFsTWVzc2FnZSkge1xuICAgICAgZXZlbnRzLnB1c2goe1xuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdXVpZDogcmFuZG9tVVVJRCgpLFxuICAgICAgICAgIHNlc3Npb25faWQ6ICcnLFxuICAgICAgICAgIHR5cGU6ICd1c2VyJyxcbiAgICAgICAgICBwYXJlbnRfdG9vbF91c2VfaWQ6IG51bGwsXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgICAgY29udGVudDogaW5pdGlhbE1lc3NhZ2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgY29uc3QgcmVxdWVzdEJvZHkgPSB7XG4gICAgICB0aXRsZTogb3B0aW9ucy51bHRyYXBsYW4gPyBgdWx0cmFwbGFuOiAke3Nlc3Npb25UaXRsZX1gIDogc2Vzc2lvblRpdGxlLFxuICAgICAgZXZlbnRzLFxuICAgICAgc2Vzc2lvbl9jb250ZXh0OiBzZXNzaW9uQ29udGV4dCxcbiAgICAgIGVudmlyb25tZW50X2lkOiBlbnZpcm9ubWVudElkLFxuICAgIH1cblxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBDcmVhdGluZyBzZXNzaW9uIHdpdGggcGF5bG9hZDogJHtqc29uU3RyaW5naWZ5KHJlcXVlc3RCb2R5LCBudWxsLCAyKX1gLFxuICAgIClcblxuICAgIC8vIE1ha2UgQVBJIGNhbGxcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLnBvc3QodXJsLCByZXF1ZXN0Qm9keSwgeyBoZWFkZXJzLCBzaWduYWwgfSlcbiAgICBjb25zdCBpc1N1Y2Nlc3MgPSByZXNwb25zZS5zdGF0dXMgPT09IDIwMCB8fCByZXNwb25zZS5zdGF0dXMgPT09IDIwMVxuXG4gICAgaWYgKCFpc1N1Y2Nlc3MpIHtcbiAgICAgIGxvZ0Vycm9yKFxuICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFQSSByZXF1ZXN0IGZhaWxlZCB3aXRoIHN0YXR1cyAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1cXG5cXG5SZXNwb25zZSBkYXRhOiAke2pzb25TdHJpbmdpZnkocmVzcG9uc2UuZGF0YSwgbnVsbCwgMil9YCxcbiAgICAgICAgKSxcbiAgICAgIClcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgLy8gUGFyc2UgcmVzcG9uc2UgYXMgU2Vzc2lvblJlc291cmNlXG4gICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSByZXNwb25zZS5kYXRhIGFzIFNlc3Npb25SZXNvdXJjZVxuICAgIGlmICghc2Vzc2lvbkRhdGEgfHwgdHlwZW9mIHNlc3Npb25EYXRhLmlkICE9PSAnc3RyaW5nJykge1xuICAgICAgbG9nRXJyb3IoXG4gICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICBgQ2Fubm90IGRldGVybWluZSBzZXNzaW9uIElEIGZyb20gQVBJIHJlc3BvbnNlOiAke2pzb25TdHJpbmdpZnkocmVzcG9uc2UuZGF0YSl9YCxcbiAgICAgICAgKSxcbiAgICAgIClcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgbG9nRm9yRGVidWdnaW5nKGBTdWNjZXNzZnVsbHkgY3JlYXRlZCByZW1vdGUgc2Vzc2lvbjogJHtzZXNzaW9uRGF0YS5pZH1gKVxuICAgIHJldHVybiB7XG4gICAgICBpZDogc2Vzc2lvbkRhdGEuaWQsXG4gICAgICB0aXRsZTogc2Vzc2lvbkRhdGEudGl0bGUgfHwgcmVxdWVzdEJvZHkudGl0bGUsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGVyciA9IHRvRXJyb3IoZXJyb3IpXG4gICAgbG9nRXJyb3IoZXJyKVxuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBzZXNzaW9uIGFyY2hpdmUuIFBPU1QgL3YxL3Nlc3Npb25zL3tpZH0vYXJjaGl2ZSBoYXMgbm9cbiAqIHJ1bm5pbmctc3RhdHVzIGNoZWNrICh1bmxpa2UgREVMRVRFIHdoaWNoIDQwOXMgb24gUlVOTklORyksIHNvIGl0IHdvcmtzXG4gKiBtaWQtaW1wbGVtZW50YXRpb24uIEFyY2hpdmVkIHNlc3Npb25zIHJlamVjdCBuZXcgZXZlbnRzIChzZW5kX2V2ZW50cy5nbyksXG4gKiBzbyB0aGUgcmVtb3RlIHN0b3BzIG9uIGl0cyBuZXh0IHdyaXRlLiA0MDkgKGFscmVhZHkgYXJjaGl2ZWQpIHRyZWF0ZWQgYXNcbiAqIHN1Y2Nlc3MuIEZpcmUtYW5kLWZvcmdldDsgZmFpbHVyZSBsZWFrcyBhIHZpc2libGUgc2Vzc2lvbiB1bnRpbCB0aGVcbiAqIHJlYXBlciBjb2xsZWN0cyBpdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFyY2hpdmVSZW1vdGVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGFjY2Vzc1Rva2VuID0gZ2V0Q2xhdWRlQUlPQXV0aFRva2VucygpPy5hY2Nlc3NUb2tlblxuICBpZiAoIWFjY2Vzc1Rva2VuKSByZXR1cm5cbiAgY29uc3Qgb3JnVVVJRCA9IGF3YWl0IGdldE9yZ2FuaXphdGlvblVVSUQoKVxuICBpZiAoIW9yZ1VVSUQpIHJldHVyblxuICBjb25zdCBoZWFkZXJzID0ge1xuICAgIC4uLmdldE9BdXRoSGVhZGVycyhhY2Nlc3NUb2tlbiksXG4gICAgJ2FudGhyb3BpYy1iZXRhJzogJ2Njci1ieW9jLTIwMjUtMDctMjknLFxuICAgICd4LW9yZ2FuaXphdGlvbi11dWlkJzogb3JnVVVJRCxcbiAgfVxuICBjb25zdCB1cmwgPSBgJHtnZXRPYXV0aENvbmZpZygpLkJBU0VfQVBJX1VSTH0vdjEvc2Vzc2lvbnMvJHtzZXNzaW9uSWR9L2FyY2hpdmVgXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IGF4aW9zLnBvc3QoXG4gICAgICB1cmwsXG4gICAgICB7fSxcbiAgICAgIHsgaGVhZGVycywgdGltZW91dDogMTAwMDAsIHZhbGlkYXRlU3RhdHVzOiBzID0+IHMgPCA1MDAgfSxcbiAgICApXG4gICAgaWYgKHJlc3Auc3RhdHVzID09PSAyMDAgfHwgcmVzcC5zdGF0dXMgPT09IDQwOSkge1xuICAgICAgbG9nRm9yRGVidWdnaW5nKGBbYXJjaGl2ZVJlbW90ZVNlc3Npb25dIGFyY2hpdmVkICR7c2Vzc2lvbklkfWApXG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFthcmNoaXZlUmVtb3RlU2Vzc2lvbl0gJHtzZXNzaW9uSWR9IGZhaWxlZCAke3Jlc3Auc3RhdHVzfTogJHtqc29uU3RyaW5naWZ5KHJlc3AuZGF0YSl9YCxcbiAgICAgIClcbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZ0Vycm9yKGVycilcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPQSxLQUFLLE1BQU0sT0FBTztBQUN6QixPQUFPQyxLQUFLLE1BQU0sT0FBTztBQUN6QixTQUFTQyxVQUFVLFFBQVEsUUFBUTtBQUNuQyxPQUFPQyxLQUFLLE1BQU0sT0FBTztBQUN6QixTQUFTQyxjQUFjLEVBQUVDLFlBQVksUUFBUSx3QkFBd0I7QUFDckUsU0FBU0MsNEJBQTRCLFFBQVEsc0NBQXNDO0FBQ25GLFNBQ0UsS0FBS0MsMERBQTBELEVBQy9EQyxRQUFRLFFBQ0gsaUNB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