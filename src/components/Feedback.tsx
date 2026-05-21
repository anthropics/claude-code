import axios from 'axios';
import { readFile, stat } from 'fs/promises';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getLastAPIRequest } from 'src/bootstrap/state.js';
import { logEventTo1P } from 'src/services/analytics/firstPartyEventLogger.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { getLastAssistantMessage, normalizeMessagesForAPI } from 'src/utils/messages.js';
import type { CommandResultDisplay } from '../commands.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Box, Text, useInput } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { queryHaiku } from '../services/api/claude.js';
import { startsWithApiErrorPrefix } from '../services/api/errors.js';
import type { Message } from '../types/message.js';
import { checkAndRefreshOAuthTokenIfNeeded } from '../utils/auth.js';
import { openBrowser } from '../utils/browser.js';
import { logForDebugging } from '../utils/debug.js';
import { env } from '../utils/env.js';
import { type GitRepoState, getGitState, getIsGit } from '../utils/git.js';
import { getAuthHeaders, getUserAgent } from '../utils/http.js';
import { getInMemoryErrors, logError } from '../utils/log.js';
import { isEssentialTrafficOnly } from '../utils/privacyLevel.js';
import { extractTeammateTranscriptsFromTasks, getTranscriptPath, loadAllSubagentTranscriptsFromDisk, MAX_TRANSCRIPT_READ_BYTES } from '../utils/sessionStorage.js';
import { jsonStringify } from '../utils/slowOperations.js';
import { asSystemPrompt } from '../utils/systemPromptType.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Byline } from './design-system/Byline.js';
import { Dialog } from './design-system/Dialog.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import TextInput from './TextInput.js';

// This value was determined experimentally by testing the URL length limit
const GITHUB_URL_LIMIT = 7250;
const GITHUB_ISSUES_REPO_URL = "external" === 'ant' ? 'https://github.com/anthropics/claude-cli-internal/issues' : 'https://github.com/anthropics/claude-code/issues';
type Props = {
  abortSignal: AbortSignal;
  messages: Message[];
  initialDescription?: string;
  onDone(result: string, options?: {
    display?: CommandResultDisplay;
  }): void;
  backgroundTasks?: {
    [taskId: string]: {
      type: string;
      identity?: {
        agentId: string;
      };
      messages?: Message[];
    };
  };
};
type Step = 'userInput' | 'consent' | 'submitting' | 'done';
type FeedbackData = {
  // latestAssistantMessageId is the message ID from the latest main model call
  latestAssistantMessageId: string | null;
  message_count: number;
  datetime: string;
  description: string;
  platform: string;
  gitRepo: boolean;
  version: string | null;
  transcript: Message[];
  subagentTranscripts?: {
    [agentId: string]: Message[];
  };
  rawTranscriptJsonl?: string;
};

// Utility function to redact sensitive information from strings
export function redactSensitiveInfo(text: string): string {
  let redacted = text;

  // Anthropic API keys (sk-ant...) with or without quotes
  // First handle the case with quotes
  redacted = redacted.replace(/"(sk-ant[^\s"']{24,})"/g, '"[REDACTED_API_KEY]"');
  // Then handle the cases without quotes - more general pattern
  redacted = redacted.replace(
  // eslint-disable-next-line custom-rules/no-lookbehind-regex -- .replace(re, string) on /bug path: no-match returns same string (Object.is)
  /(?<![A-Za-z0-9"'])(sk-ant-?[A-Za-z0-9_-]{10,})(?![A-Za-z0-9"'])/g, '[REDACTED_API_KEY]');

  // AWS keys - AWSXXXX format - add the pattern we need for the test
  redacted = redacted.replace(/AWS key: "(AWS[A-Z0-9]{20,})"/g, 'AWS key: "[REDACTED_AWS_KEY]"');

  // AWS AKIAXXX keys
  redacted = redacted.replace(/(AKIA[A-Z0-9]{16})/g, '[REDACTED_AWS_KEY]');

  // Google Cloud keys
  redacted = redacted.replace(
  // eslint-disable-next-line custom-rules/no-lookbehind-regex -- same as above
  /(?<![A-Za-z0-9])(AIza[A-Za-z0-9_-]{35})(?![A-Za-z0-9])/g, '[REDACTED_GCP_KEY]');

  // Vertex AI service account keys
  redacted = redacted.replace(
  // eslint-disable-next-line custom-rules/no-lookbehind-regex -- same as above
  /(?<![A-Za-z0-9])([a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com)(?![A-Za-z0-9])/g, '[REDACTED_GCP_SERVICE_ACCOUNT]');

  // Generic API keys in headers
  redacted = redacted.replace(/(["']?x-api-key["']?\s*[:=]\s*["']?)[^"',\s)}\]]+/gi, '$1[REDACTED_API_KEY]');

  // Authorization headers and Bearer tokens
  redacted = redacted.replace(/(["']?authorization["']?\s*[:=]\s*["']?(bearer\s+)?)[^"',\s)}\]]+/gi, '$1[REDACTED_TOKEN]');

  // AWS environment variables
  redacted = redacted.replace(/(AWS[_-][A-Za-z0-9_]+\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, '$1[REDACTED_AWS_VALUE]');

  // GCP environment variables
  redacted = redacted.replace(/(GOOGLE[_-][A-Za-z0-9_]+\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, '$1[REDACTED_GCP_VALUE]');

  // Environment variables with keys
  redacted = redacted.replace(/((API[-_]?KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, '$1[REDACTED]');
  return redacted;
}

// Get sanitized error logs with sensitive information redacted
function getSanitizedErrorLogs(): Array<{
  error?: string;
  timestamp?: string;
}> {
  // Sanitize error logs to remove any API keys
  return getInMemoryErrors().map(errorInfo => {
    // Create a copy of the error info to avoid modifying the original
    const errorCopy = {
      ...errorInfo
    } as {
      error?: string;
      timestamp?: string;
    };

    // Sanitize error if present and is a string
    if (errorCopy && typeof errorCopy.error === 'string') {
      errorCopy.error = redactSensitiveInfo(errorCopy.error);
    }
    return errorCopy;
  });
}
async function loadRawTranscriptJsonl(): Promise<string | null> {
  try {
    const transcriptPath = getTranscriptPath();
    const {
      size
    } = await stat(transcriptPath);
    if (size > MAX_TRANSCRIPT_READ_BYTES) {
      logForDebugging(`Skipping raw transcript read: file too large (${size} bytes)`, {
        level: 'warn'
      });
      return null;
    }
    return await readFile(transcriptPath, 'utf-8');
  } catch {
    return null;
  }
}
export function Feedback({
  abortSignal,
  messages,
  initialDescription,
  onDone,
  backgroundTasks = {}
}: Props): React.ReactNode {
  const [step, setStep] = useState<Step>('userInput');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<{
    isGit: boolean;
    gitState: GitRepoState | null;
  }>({
    isGit: false,
    gitState: null
  });
  const [title, setTitle] = useState<string | null>(null);
  const textInputColumns = useTerminalSize().columns - 4;
  useEffect(() => {
    async function loadEnvInfo() {
      const isGit = await getIsGit();
      let gitState: GitRepoState | null = null;
      if (isGit) {
        gitState = await getGitState();
      }
      setEnvInfo({
        isGit,
        gitState
      });
    }
    void loadEnvInfo();
  }, []);
  const submitReport = useCallback(async () => {
    setStep('submitting');
    setError(null);
    setFeedbackId(null);

    // Get sanitized errors for the report
    const sanitizedErrors = getSanitizedErrorLogs();

    // Extract last assistant message ID from messages array
    const lastAssistantMessage = getLastAssistantMessage(messages);
    const lastAssistantMessageId = lastAssistantMessage?.requestId ?? null;
    const [diskTranscripts, rawTranscriptJsonl] = await Promise.all([loadAllSubagentTranscriptsFromDisk(), loadRawTranscriptJsonl()]);
    const teammateTranscripts = extractTeammateTranscriptsFromTasks(backgroundTasks);
    const subagentTranscripts = {
      ...diskTranscripts,
      ...teammateTranscripts
    };
    const reportData = {
      latestAssistantMessageId: lastAssistantMessageId,
      message_count: messages.length,
      datetime: new Date().toISOString(),
      description,
      platform: env.platform,
      gitRepo: envInfo.isGit,
      terminal: env.terminal,
      version: MACRO.VERSION,
      transcript: normalizeMessagesForAPI(messages),
      errors: sanitizedErrors,
      lastApiRequest: getLastAPIRequest(),
      ...(Object.keys(subagentTranscripts).length > 0 && {
        subagentTranscripts
      }),
      ...(rawTranscriptJsonl && {
        rawTranscriptJsonl
      })
    };
    const [result, t] = await Promise.all([submitFeedback(reportData, abortSignal), generateTitle(description, abortSignal)]);
    setTitle(t);
    if (result.success) {
      if (result.feedbackId) {
        setFeedbackId(result.feedbackId);
        logEvent('tengu_bug_report_submitted', {
          feedback_id: result.feedbackId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          last_assistant_message_id: lastAssistantMessageId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        // 1P-only: freeform text approved for BQ. Join on feedback_id.
        logEventTo1P('tengu_bug_report_description', {
          feedback_id: result.feedbackId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          description: redactSensitiveInfo(description) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }
      setStep('done');
    } else {
      if (result.isZdrOrg) {
        setError('Feedback collection is not available for organizations with custom data retention policies.');
      } else {
        setError('Could not submit feedback. Please try again later.');
      }
      // Stay on userInput step so user can retry with their content preserved
      setStep('userInput');
    }
  }, [description, envInfo.isGit, messages]);

  // Handle cancel - this will be called by Dialog's automatic Esc handling
  const handleCancel = useCallback(() => {
    // Don't cancel when done - let other keys close the dialog
    if (step === 'done') {
      if (error) {
        onDone('Error submitting feedback / bug report', {
          display: 'system'
        });
      } else {
        onDone('Feedback / bug report submitted', {
          display: 'system'
        });
      }
      return;
    }
    onDone('Feedback / bug report cancelled', {
      display: 'system'
    });
  }, [step, error, onDone]);

  // During text input, use Settings context where only Escape (not 'n') triggers confirm:no.
  // This allows typing 'n' in the text field while still supporting Escape to cancel.
  useKeybinding('confirm:no', handleCancel, {
    context: 'Settings',
    isActive: step === 'userInput'
  });
  useInput((input, key) => {
    // Allow any key press to close the dialog when done or when there's an error
    if (step === 'done') {
      if (key.return && title) {
        // Open GitHub issue URL when Enter is pressed
        const issueUrl = createGitHubIssueUrl(feedbackId ?? '', title, description, getSanitizedErrorLogs());
        void openBrowser(issueUrl);
      }
      if (error) {
        onDone('Error submitting feedback / bug report', {
          display: 'system'
        });
      } else {
        onDone('Feedback / bug report submitted', {
          display: 'system'
        });
      }
      return;
    }

    // When in userInput step with error, allow user to edit and retry
    // (don't close on any keypress - they can still press Esc to cancel)
    if (error && step !== 'userInput') {
      onDone('Error submitting feedback / bug report', {
        display: 'system'
      });
      return;
    }
    if (step === 'consent' && (key.return || input === ' ')) {
      void submitReport();
    }
  });
  return <Dialog title="Submit Feedback / Bug Report" onCancel={handleCancel} isCancelActive={step !== 'userInput'} inputGuide={exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : step === 'userInput' ? <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="continue" />
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
          </Byline> : step === 'consent' ? <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="submit" />
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
          </Byline> : null}>
      {step === 'userInput' && <Box flexDirection="column" gap={1}>
          <Text>Describe the issue below:</Text>
          <TextInput value={description} onChange={value => {
        setDescription(value);
        // Clear error when user starts editing to allow retry
        if (error) {
          setError(null);
        }
      }} columns={textInputColumns} onSubmit={() => setStep('consent')} onExitMessage={() => onDone('Feedback cancelled', {
        display: 'system'
      })} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} showCursor />
          {error && <Box flexDirection="column" gap={1}>
              <Text color="error">{error}</Text>
              <Text dimColor>
                Edit and press Enter to retry, or Esc to cancel
              </Text>
            </Box>}
        </Box>}

      {step === 'consent' && <Box flexDirection="column">
          <Text>This report will include:</Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>
              - Your feedback / bug description:{' '}
              <Text dimColor>{description}</Text>
            </Text>
            <Text>
              - Environment info:{' '}
              <Text dimColor>
                {env.platform}, {env.terminal}, v{MACRO.VERSION}
              </Text>
            </Text>
            {envInfo.gitState && <Text>
                - Git repo metadata:{' '}
                <Text dimColor>
                  {envInfo.gitState.branchName}
                  {envInfo.gitState.commitHash ? `, ${envInfo.gitState.commitHash.slice(0, 7)}` : ''}
                  {envInfo.gitState.remoteUrl ? ` @ ${envInfo.gitState.remoteUrl}` : ''}
                  {!envInfo.gitState.isHeadOnRemote && ', not synced'}
                  {!envInfo.gitState.isClean && ', has local changes'}
                </Text>
              </Text>}
            <Text>- Current session transcript</Text>
          </Box>
          <Box marginTop={1}>
            <Text wrap="wrap" dimColor>
              We will use your feedback to debug related issues or to improve{' '}
              Claude Code&apos;s functionality (eg. to reduce the risk of bugs
              occurring in the future).
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text>
              Press <Text bold>Enter</Text> to confirm and submit.
            </Text>
          </Box>
        </Box>}

      {step === 'submitting' && <Box flexDirection="row" gap={1}>
          <Text>Submitting report…</Text>
        </Box>}

      {step === 'done' && <Box flexDirection="column">
          {error ? <Text color="error">{error}</Text> : <Text color="success">Thank you for your report!</Text>}
          {feedbackId && <Text dimColor>Feedback ID: {feedbackId}</Text>}
          <Box marginTop={1}>
            <Text>Press </Text>
            <Text bold>Enter </Text>
            <Text>
              to open your browser and draft a GitHub issue, or any other key to
              close.
            </Text>
          </Box>
        </Box>}
    </Dialog>;
}
export function createGitHubIssueUrl(feedbackId: string, title: string, description: string, errors: Array<{
  error?: string;
  timestamp?: string;
}>): string {
  const sanitizedTitle = redactSensitiveInfo(title);
  const sanitizedDescription = redactSensitiveInfo(description);
  const bodyPrefix = `**Bug Description**\n${sanitizedDescription}\n\n` + `**Environment Info**\n` + `- Platform: ${env.platform}\n` + `- Terminal: ${env.terminal}\n` + `- Version: ${MACRO.VERSION || 'unknown'}\n` + `- Feedback ID: ${feedbackId}\n` + `\n**Errors**\n\`\`\`json\n`;
  const errorSuffix = `\n\`\`\`\n`;
  const errorsJson = jsonStringify(errors);
  const baseUrl = `${GITHUB_ISSUES_REPO_URL}/new?title=${encodeURIComponent(sanitizedTitle)}&labels=user-reported,bug&body=`;
  const truncationNote = `\n**Note:** Content was truncated.\n`;
  const encodedPrefix = encodeURIComponent(bodyPrefix);
  const encodedSuffix = encodeURIComponent(errorSuffix);
  const encodedNote = encodeURIComponent(truncationNote);
  const encodedErrors = encodeURIComponent(errorsJson);

  // Calculate space available for errors
  const spaceForErrors = GITHUB_URL_LIMIT - baseUrl.length - encodedPrefix.length - encodedSuffix.length - encodedNote.length;

  // If description alone exceeds limit, truncate everything
  if (spaceForErrors <= 0) {
    const ellipsis = encodeURIComponent('…');
    const buffer = 50; // Extra safety margin
    const maxEncodedLength = GITHUB_URL_LIMIT - baseUrl.length - ellipsis.length - encodedNote.length - buffer;
    const fullBody = bodyPrefix + errorsJson + errorSuffix;
    let encodedFullBody = encodeURIComponent(fullBody);
    if (encodedFullBody.length > maxEncodedLength) {
      encodedFullBody = encodedFullBody.slice(0, maxEncodedLength);
      // Don't cut in middle of %XX sequence
      const lastPercent = encodedFullBody.lastIndexOf('%');
      if (lastPercent >= encodedFullBody.length - 2) {
        encodedFullBody = encodedFullBody.slice(0, lastPercent);
      }
    }
    return baseUrl + encodedFullBody + ellipsis + encodedNote;
  }

  // If errors fit, no truncation needed
  if (encodedErrors.length <= spaceForErrors) {
    return baseUrl + encodedPrefix + encodedErrors + encodedSuffix;
  }

  // Truncate errors to fit (prioritize keeping description)
  // Slice encoded errors directly, then trim to avoid cutting %XX sequences
  const ellipsis = encodeURIComponent('…');
  const buffer = 50; // Extra safety margin
  let truncatedEncodedErrors = encodedErrors.slice(0, spaceForErrors - ellipsis.length - buffer);
  // If we cut in middle of %XX, back up to before the %
  const lastPercent = truncatedEncodedErrors.lastIndexOf('%');
  if (lastPercent >= truncatedEncodedErrors.length - 2) {
    truncatedEncodedErrors = truncatedEncodedErrors.slice(0, lastPercent);
  }
  return baseUrl + encodedPrefix + truncatedEncodedErrors + ellipsis + encodedSuffix + encodedNote;
}
async function generateTitle(description: string, abortSignal: AbortSignal): Promise<string> {
  try {
    const response = await queryHaiku({
      systemPrompt: asSystemPrompt(['Generate a concise, technical issue title (max 80 chars) for a public GitHub issue based on this bug report for Claude Code.', 'Claude Code is an agentic coding CLI based on the Anthropic API.', 'The title should:', '- Include the type of issue [Bug] or [Feature Request] as the first thing in the title', '- Be concise, specific and descriptive of the actual problem', '- Use technical terminology appropriate for a software issue', '- For error messages, extract the key error (e.g., "Missing Tool Result Block" rather than the full message)', '- Be direct and clear for developers to understand the problem', '- If you cannot determine a clear issue, use "Bug Report: [brief description]"', '- Any LLM API errors are from the Anthropic API, not from any other model provider', 'Your response will be directly used as the title of the Github issue, and as such should not contain any other commentary or explaination', 'Examples of good titles include: "[Bug] Auto-Compact triggers to soon", "[Bug] Anthropic API Error: Missing Tool Result Block", "[Bug] Error: Invalid Model Name for Opus"']),
      userPrompt: description,
      signal: abortSignal,
      options: {
        hasAppendSystemPrompt: false,
        toolChoice: undefined,
        isNonInteractiveSession: false,
        agents: [],
        querySource: 'feedback',
        mcpTools: []
      }
    });
    const title = response.message.content[0]?.type === 'text' ? response.message.content[0].text : 'Bug Report';

    // Check if the title contains an API error message
    if (startsWithApiErrorPrefix(title)) {
      return createFallbackTitle(description);
    }
    return title;
  } catch (error) {
    // If there's any error in title generation, use a fallback title
    logError(error);
    return createFallbackTitle(description);
  }
}
function createFallbackTitle(description: string): string {
  // Create a safe fallback title based on the bug description

  // Try to extract a meaningful title from the first line
  const firstLine = description.split('\n')[0] || '';

  // If the first line is very short, use it directly
  if (firstLine.length <= 60 && firstLine.length > 5) {
    return firstLine;
  }

  // For longer descriptions, create a truncated version
  // Truncate at word boundaries when possible
  let truncated = firstLine.slice(0, 60);
  if (firstLine.length > 60) {
    // Find the last space before the 60 char limit
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      // Only trim at word if we're not cutting too much
      truncated = truncated.slice(0, lastSpace);
    }
    truncated += '...';
  }
  return truncated.length < 10 ? 'Bug Report' : truncated;
}

// Helper function to sanitize and log errors without exposing API keys
function sanitizeAndLogError(err: unknown): void {
  if (err instanceof Error) {
    // Create a copy with potentially sensitive info redacted
    const safeError = new Error(redactSensitiveInfo(err.message));

    // Also redact the stack trace if present
    if (err.stack) {
      safeError.stack = redactSensitiveInfo(err.stack);
    }
    logError(safeError);
  } else {
    // For non-Error objects, convert to string and redact sensitive info
    const errorString = redactSensitiveInfo(String(err));
    logError(new Error(errorString));
  }
}
async function submitFeedback(data: FeedbackData, signal?: AbortSignal): Promise<{
  success: boolean;
  feedbackId?: string;
  isZdrOrg?: boolean;
}> {
  if (isEssentialTrafficOnly()) {
    return {
      success: false
    };
  }
  try {
    // Ensure OAuth token is fresh before getting auth headers
    // This prevents 401 errors from stale cached tokens
    await checkAndRefreshOAuthTokenIfNeeded();
    const authResult = getAuthHeaders();
    if (authResult.error) {
      return {
        success: false
      };
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(),
      ...authResult.headers
    };
    const response = await axios.post('https://api.anthropic.com/api/claude_cli_feedback', {
      content: jsonStringify(data)
    }, {
      headers,
      timeout: 30000,
      // 30 second timeout to prevent hanging
      signal
    });
    if (response.status === 200) {
      const result = response.data;
      if (result?.feedback_id) {
        return {
          success: true,
          feedbackId: result.feedback_id
        };
      }
      sanitizeAndLogError(new Error('Failed to submit feedback: request did not return feedback_id'));
      return {
        success: false
      };
    }
    sanitizeAndLogError(new Error('Failed to submit feedback:' + response.status));
    return {
      success: false
    };
  } catch (err) {
    // Handle cancellation/abort - don't log as error
    if (axios.isCancel(err)) {
      return {
        success: false
      };
    }
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      const errorData = err.response.data;
      if (errorData?.error?.type === 'permission_error' && errorData?.error?.message?.includes('Custom data retention settings')) {
        sanitizeAndLogError(new Error('Cannot submit feedback because custom data retention settings are enabled'));
        return {
          success: false,
          isZdrOrg: true
        };
      }
    }
    // Use our safe error logging function to avoid leaking API keys
    sanitizeAndLogError(err);
    return {
      success: false
    };
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJheGlvcyIsInJlYWRGaWxlIiwic3RhdCIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsImdldExhc3RBUElSZXF1ZXN0IiwibG9nRXZlbnRUbzFQIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwiZ2V0TGFzdEFzc2lzdGFudE1lc3NhZ2UiLCJub3JtYWxpemVNZXNzYWdlc0ZvckFQSSIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwidXNlVGVybWluYWxTaXplIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlS2V5YmluZGluZyIsInF1ZXJ5SGFpa3UiLCJzdGFydHNXaXRoQXBpRXJyb3JQcmVmaXgiLCJNZXNzYWdlIiwiY2hlY2tBbmRSZWZyZXNoT0F1dGhUb2tlbklmTmVlZGVkIiwib3BlbkJyb3dzZXIiLCJsb2dGb3JEZWJ1Z2dpbmciLCJlbnYiLCJHaXRSZXBvU3RhdGUiLCJnZXRHaXRTdGF0ZSIsImdldElzR2l0IiwiZ2V0QXV0aEhlYWRlcnMiLCJnZXRVc2VyQWdlbnQiLCJnZXRJbk1lbW9yeUVycm9ycyIsImxvZ0Vycm9yIiwiaXNFc3NlbnRpYWxUcmFmZmljT25seSIsImV4dHJhY3RUZWFtbWF0ZVRyYW5zY3JpcHRzRnJvbVRhc2tzIiwiZ2V0VHJhbnNjcmlwdFBhdGgiLCJsb2FkQWxsU3ViYWdlbnRUcmFuc2NyaXB0c0Zyb21EaXNrIiwiTUFYX1RSQU5TQ1JJUFRfUkVBRF9CWVRFUyIsImpzb25TdHJpbmdpZnkiLCJhc1N5c3RlbVByb21wdCIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIkRpYWxvZyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiVGV4dElucHV0IiwiR0lUSFVCX1VSTF9MSU1JVCIsIkdJVEhVQl9JU1NVRVNfUkVQT19VUkwiLCJQcm9wcyIsImFib3J0U2lnbmFsIiwiQWJvcnRTaWduYWwiLCJtZXNzYWdlcyIsImluaXRpYWxEZXNjcmlwdGlvbiIsIm9uRG9uZSIsInJlc3VsdCIsIm9wdGlvbnMiLCJkaXNwbGF5IiwiYmFja2dyb3VuZFRhc2tzIiwidGFza0lkIiwidHlwZSIsImlkZW50aXR5IiwiYWdlbnRJZCIsIlN0ZXAiLCJGZWVkYmFja0RhdGEiLCJsYXRlc3RBc3Npc3RhbnRNZXNzYWdlSWQiLCJtZXNzYWdlX2NvdW50IiwiZGF0ZXRpbWUiLCJkZXNjcmlwdGlvbiIsInBsYXRmb3JtIiwiZ2l0UmVwbyIsInZlcnNpb24iLCJ0cmFuc2NyaXB0Iiwic3ViYWdlbnRUcmFuc2NyaXB0cyIsInJhd1RyYW5zY3JpcHRKc29ubCIsInJlZGFjdFNlbnNpdGl2ZUluZm8iLCJ0ZXh0IiwicmVkYWN0ZWQiLCJyZXBsYWNlIiwiZ2V0U2FuaXRpemVkRXJyb3JMb2dzIiwiQXJyYXkiLCJlcnJvciIsInRpbWVzdGFtcCIsIm1hcCIsImVycm9ySW5mbyIsImVycm9yQ29weSIsImxvYWRSYXdUcmFuc2NyaXB0SnNvbmwiLCJQcm9taXNlIiwidHJhbnNjcmlwdFBhdGgiLCJzaXplIiwibGV2ZWwiLCJGZWVkYmFjayIsIlJlYWN0Tm9kZSIsInN0ZXAiLCJzZXRTdGVwIiwiY3Vyc29yT2Zmc2V0Iiwic2V0Q3Vyc29yT2Zmc2V0Iiwic2V0RGVzY3JpcHRpb24iLCJmZWVkYmFja0lkIiwic2V0RmVlZGJhY2tJZCIsInNldEVycm9yIiwiZW52SW5mbyIsInNldEVudkluZm8iLCJpc0dpdCIsImdpdFN0YXRlIiwidGl0bGUiLCJzZXRUaXRsZSIsInRleHRJbnB1dENvbHVtbnMiLCJjb2x1bW5zIiwibG9hZEVudkluZm8iLCJzdWJtaXRSZXBvcnQiLCJzYW5pdGl6ZWRFcnJvcnMiLCJsYXN0QXNzaXN0YW50TWVzc2FnZSIsImxhc3RBc3Npc3RhbnRNZXNzYWdlSWQiLCJyZXF1ZXN0SWQiLCJkaXNrVHJhbnNjcmlwdHMiLCJhbGwiLCJ0ZWFtbWF0ZVRyYW5zY3JpcHRzIiwicmVwb3J0RGF0YSIsImxlbmd0aCIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsInRlcm1pbmFsIiwiTUFDUk8iLCJWRVJTSU9OIiwiZXJyb3JzIiwibGFzdEFwaVJlcXVlc3QiLCJPYmplY3QiLCJrZXlzIiwidCIsInN1Ym1pdEZlZWRiYWNrIiwiZ2VuZXJhdGVUaXRsZSIsInN1Y2Nlc3MiLCJmZWVkYmFja19pZCIsImxhc3RfYXNzaXN0YW50X21lc3NhZ2VfaWQiLCJpc1pkck9yZyIsImhhbmRsZUNhbmNlbCIsImNvbnRleHQiLCJpc0FjdGl2ZSIsImlucHV0Iiwia2V5IiwicmV0dXJuIiwiaXNzdWVVcmwiLCJjcmVhdGVHaXRIdWJJc3N1ZVVybCIsImV4aXRTdGF0ZSIsInBlbmRpbmciLCJrZXlOYW1lIiwidmFsdWUiLCJicmFuY2hOYW1lIiwiY29tbWl0SGFzaCIsInNsaWNlIiwicmVtb3RlVXJsIiwiaXNIZWFkT25SZW1vdGUiLCJpc0NsZWFuIiwic2FuaXRpemVkVGl0bGUiLCJzYW5pdGl6ZWREZXNjcmlwdGlvbiIsImJvZHlQcmVmaXgiLCJlcnJvclN1ZmZpeCIsImVycm9yc0pzb24iLCJiYXNlVXJsIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwidHJ1bmNhdGlvbk5vdGUiLCJlbmNvZGVkUHJlZml4IiwiZW5jb2RlZFN1ZmZpeCIsImVuY29kZWROb3RlIiwiZW5jb2RlZEVycm9ycyIsInNwYWNlRm9yRXJyb3JzIiwiZWxsaXBzaXMiLCJidWZmZXIiLCJtYXhFbmNvZGVkTGVuZ3RoIiwiZnVsbEJvZHkiLCJlbmNvZGVkRnVsbEJvZHkiLCJsYXN0UGVyY2VudCIsImxhc3RJbmRleE9mIiwidHJ1bmNhdGVkRW5jb2RlZEVycm9ycyIsInJlc3BvbnNlIiwic3lzdGVtUHJvbXB0IiwidXNlclByb21wdCIsInNpZ25hbCIsImhhc0FwcGVuZFN5c3RlbVByb21wdCIsInRvb2xDaG9pY2UiLCJ1bmRlZmluZWQiLCJpc05vbkludGVyYWN0aXZlU2Vzc2lvbiIsImFnZW50cyIsInF1ZXJ5U291cmNlIiwibWNwVG9vbHMiLCJtZXNzYWdlIiwiY29udGVudCIsImNyZWF0ZUZhbGxiYWNrVGl0bGUiLCJmaXJzdExpbmUiLCJzcGxpdCIsInRydW5jYXRlZCIsImxhc3RTcGFjZSIsInNhbml0aXplQW5kTG9nRXJyb3IiLCJlcnIiLCJFcnJvciIsInNhZmVFcnJvciIsInN0YWNrIiwiZXJyb3JTdHJpbmciLCJTdHJpbmciLCJkYXRhIiwiYXV0aFJlc3VsdCIsImhlYWRlcnMiLCJSZWNvcmQiLCJwb3N0IiwidGltZW91dCIsInN0YXR1cyIsImlzQ2FuY2VsIiwiaXNBeGlvc0Vycm9yIiwiZXJyb3JEYXRhIiwiaW5jbHVkZXMiXSwic291cmNlcyI6WyJGZWVkYmFjay50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGF4aW9zIGZyb20gJ2F4aW9zJ1xuaW1wb3J0IHsgcmVhZEZpbGUsIHN0YXQgfSBmcm9tICdmcy9wcm9taXNlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IGdldExhc3RBUElSZXF1ZXN0IH0gZnJvbSAnc3JjL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7IGxvZ0V2ZW50VG8xUCB9IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvZmlyc3RQYXJ0eUV2ZW50TG9nZ2VyLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7XG4gIGdldExhc3RBc3Npc3RhbnRNZXNzYWdlLFxuICBub3JtYWxpemVNZXNzYWdlc0ZvckFQSSxcbn0gZnJvbSAnc3JjL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kUmVzdWx0RGlzcGxheSB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0LCB1c2VJbnB1dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgcXVlcnlIYWlrdSB9IGZyb20gJy4uL3NlcnZpY2VzL2FwaS9jbGF1ZGUuanMnXG5pbXBvcnQgeyBzdGFydHNXaXRoQXBpRXJyb3JQcmVmaXggfSBmcm9tICcuLi9zZXJ2aWNlcy9hcGkvZXJyb3JzLmpzJ1xuaW1wb3J0IHR5cGUgeyBNZXNzYWdlIH0gZnJvbSAnLi4vdHlwZXMvbWVzc2FnZS5qcydcbmltcG9ydCB7IGNoZWNrQW5kUmVmcmVzaE9BdXRoVG9rZW5JZk5lZWRlZCB9IGZyb20gJy4uL3V0aWxzL2F1dGguanMnXG5pbXBvcnQgeyBvcGVuQnJvd3NlciB9IGZyb20gJy4uL3V0aWxzL2Jyb3dzZXIuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IGVudiB9IGZyb20gJy4uL3V0aWxzL2Vudi5qcydcbmltcG9ydCB7IHR5cGUgR2l0UmVwb1N0YXRlLCBnZXRHaXRTdGF0ZSwgZ2V0SXNHaXQgfSBmcm9tICcuLi91dGlscy9naXQuanMnXG5pbXBvcnQgeyBnZXRBdXRoSGVhZGVycywgZ2V0VXNlckFnZW50IH0gZnJvbSAnLi4vdXRpbHMvaHR0cC5qcydcbmltcG9ydCB7IGdldEluTWVtb3J5RXJyb3JzLCBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7IGlzRXNzZW50aWFsVHJhZmZpY09ubHkgfSBmcm9tICcuLi91dGlscy9wcml2YWN5TGV2ZWwuanMnXG5pbXBvcnQge1xuICBleHRyYWN0VGVhbW1hdGVUcmFuc2NyaXB0c0Zyb21UYXNrcyxcbiAgZ2V0VHJhbnNjcmlwdFBhdGgsXG4gIGxvYWRBbGxTdWJhZ2VudFRyYW5zY3JpcHRzRnJvbURpc2ssXG4gIE1BWF9UUkFOU0NSSVBUX1JFQURfQllURVMsXG59IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHsganNvblN0cmluZ2lmeSB9IGZyb20gJy4uL3V0aWxzL3Nsb3dPcGVyYXRpb25zLmpzJ1xuaW1wb3J0IHsgYXNTeXN0ZW1Qcm9tcHQgfSBmcm9tICcuLi91dGlscy9zeXN0ZW1Qcm9tcHRUeXBlLmpzJ1xuaW1wb3J0IHsgQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IH0gZnJvbSAnLi9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICcuL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0RpYWxvZy5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuaW1wb3J0IFRleHRJbnB1dCBmcm9tICcuL1RleHRJbnB1dC5qcydcblxuLy8gVGhpcyB2YWx1ZSB3YXMgZGV0ZXJtaW5lZCBleHBlcmltZW50YWxseSBieSB0ZXN0aW5nIHRoZSBVUkwgbGVuZ3RoIGxpbWl0XG5jb25zdCBHSVRIVUJfVVJMX0xJTUlUID0gNzI1MFxuY29uc3QgR0lUSFVCX0lTU1VFU19SRVBPX1VSTCA9XG4gIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgICA/ICdodHRwczovL2dpdGh1Yi5jb20vYW50aHJvcGljcy9jbGF1ZGUtY2xpLWludGVybmFsL2lzc3VlcydcbiAgICA6ICdodHRwczovL2dpdGh1Yi5jb20vYW50aHJvcGljcy9jbGF1ZGUtY29kZS9pc3N1ZXMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIGFib3J0U2lnbmFsOiBBYm9ydFNpZ25hbFxuICBtZXNzYWdlczogTWVzc2FnZVtdXG4gIGluaXRpYWxEZXNjcmlwdGlvbj86IHN0cmluZ1xuICBvbkRvbmUocmVzdWx0OiBzdHJpbmcsIG9wdGlvbnM/OiB7IGRpc3BsYXk/OiBDb21tYW5kUmVzdWx0RGlzcGxheSB9KTogdm9pZFxuICBiYWNrZ3JvdW5kVGFza3M/OiB7XG4gICAgW3Rhc2tJZDogc3RyaW5nXToge1xuICAgICAgdHlwZTogc3RyaW5nXG4gICAgICBpZGVudGl0eT86IHsgYWdlbnRJZDogc3RyaW5nIH1cbiAgICAgIG1lc3NhZ2VzPzogTWVzc2FnZVtdXG4gICAgfVxuICB9XG59XG5cbnR5cGUgU3RlcCA9ICd1c2VySW5wdXQnIHwgJ2NvbnNlbnQnIHwgJ3N1Ym1pdHRpbmcnIHwgJ2RvbmUnXG5cbnR5cGUgRmVlZGJhY2tEYXRhID0ge1xuICAvLyBsYXRlc3RBc3Npc3RhbnRNZXNzYWdlSWQgaXMgdGhlIG1lc3NhZ2UgSUQgZnJvbSB0aGUgbGF0ZXN0IG1haW4gbW9kZWwgY2FsbFxuICBsYXRlc3RBc3Npc3RhbnRNZXNzYWdlSWQ6IHN0cmluZyB8IG51bGxcbiAgbWVzc2FnZV9jb3VudDogbnVtYmVyXG4gIGRhdGV0aW1lOiBzdHJpbmdcbiAgZGVzY3JpcHRpb246IHN0cmluZ1xuICBwbGF0Zm9ybTogc3RyaW5nXG4gIGdpdFJlcG86IGJvb2xlYW5cbiAgdmVyc2lvbjogc3RyaW5nIHwgbnVsbFxuICB0cmFuc2NyaXB0OiBNZXNzYWdlW11cbiAgc3ViYWdlbnRUcmFuc2NyaXB0cz86IHsgW2FnZW50SWQ6IHN0cmluZ106IE1lc3NhZ2VbXSB9XG4gIHJhd1RyYW5zY3JpcHRKc29ubD86IHN0cmluZ1xufVxuXG4vLyBVdGlsaXR5IGZ1bmN0aW9uIHRvIHJlZGFjdCBzZW5zaXRpdmUgaW5mb3JtYXRpb24gZnJvbSBzdHJpbmdzXG5leHBvcnQgZnVuY3Rpb24gcmVkYWN0U2Vuc2l0aXZlSW5mbyh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcmVkYWN0ZWQgPSB0ZXh0XG5cbiAgLy8gQW50aHJvcGljIEFQSSBrZXlzIChzay1hbnQuLi4pIHdpdGggb3Igd2l0aG91dCBxdW90ZXNcbiAgLy8gRmlyc3QgaGFuZGxlIHRoZSBjYXNlIHdpdGggcXVvdGVzXG4gIHJlZGFjdGVkID0gcmVkYWN0ZWQucmVwbGFjZSgvXCIoc2stYW50W15cXHNcIiddezI0LH0pXCIvZywgJ1wiW1JFREFDVEVEX0FQSV9LRVldXCInKVxuICAvLyBUaGVuIGhhbmRsZSB0aGUgY2FzZXMgd2l0aG91dCBxdW90ZXMgLSBtb3JlIGdlbmVyYWwgcGF0dGVyblxuICByZWRhY3RlZCA9IHJlZGFjdGVkLnJlcGxhY2UoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby1sb29rYmVoaW5kLXJlZ2V4IC0tIC5yZXBsYWNlKHJlLCBzdHJpbmcpIG9uIC9idWcgcGF0aDogbm8tbWF0Y2ggcmV0dXJucyBzYW1lIHN0cmluZyAoT2JqZWN0LmlzKVxuICAgIC8oPzwhW0EtWmEtejAtOVwiJ10pKHNrLWFudC0/W0EtWmEtejAtOV8tXXsxMCx9KSg/IVtBLVphLXowLTlcIiddKS9nLFxuICAgICdbUkVEQUNURURfQVBJX0tFWV0nLFxuICApXG5cbiAgLy8gQVdTIGtleXMgLSBBV1NYWFhYIGZvcm1hdCAtIGFkZCB0aGUgcGF0dGVybiB3ZSBuZWVkIGZvciB0aGUgdGVzdFxuICByZWRhY3RlZCA9IHJlZGFjdGVkLnJlcGxhY2UoXG4gICAgL0FXUyBrZXk6IFwiKEFXU1tBLVowLTldezIwLH0pXCIvZyxcbiAgICAnQVdTIGtleTogXCJbUkVEQUNURURfQVdTX0tFWV1cIicsXG4gIClcblxuICAvLyBBV1MgQUtJQVhYWCBrZXlzXG4gIHJlZGFjdGVkID0gcmVkYWN0ZWQucmVwbGFjZSgvKEFLSUFbQS1aMC05XXsxNn0pL2csICdbUkVEQUNURURfQVdTX0tFWV0nKVxuXG4gIC8vIEdvb2dsZSBDbG91ZCBrZXlzXG4gIHJlZGFjdGVkID0gcmVkYWN0ZWQucmVwbGFjZShcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLWxvb2tiZWhpbmQtcmVnZXggLS0gc2FtZSBhcyBhYm92ZVxuICAgIC8oPzwhW0EtWmEtejAtOV0pKEFJemFbQS1aYS16MC05Xy1dezM1fSkoPyFbQS1aYS16MC05XSkvZyxcbiAgICAnW1JFREFDVEVEX0dDUF9LRVldJyxcbiAgKVxuXG4gIC8vIFZlcnRleCBBSSBzZXJ2aWNlIGFjY291bnQga2V5c1xuICByZWRhY3RlZCA9IHJlZGFjdGVkLnJlcGxhY2UoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby1sb29rYmVoaW5kLXJlZ2V4IC0tIHNhbWUgYXMgYWJvdmVcbiAgICAvKD88IVtBLVphLXowLTldKShbYS16MC05LV0rQFthLXowLTktXStcXC5pYW1cXC5nc2VydmljZWFjY291bnRcXC5jb20pKD8hW0EtWmEtejAtOV0pL2csXG4gICAgJ1tSRURBQ1RFRF9HQ1BfU0VSVklDRV9BQ0NPVU5UXScsXG4gIClcblxuICAvLyBHZW5lcmljIEFQSSBrZXlzIGluIGhlYWRlcnNcbiAgcmVkYWN0ZWQgPSByZWRhY3RlZC5yZXBsYWNlKFxuICAgIC8oW1wiJ10/eC1hcGkta2V5W1wiJ10/XFxzKls6PV1cXHMqW1wiJ10/KVteXCInLFxccyl9XFxdXSsvZ2ksXG4gICAgJyQxW1JFREFDVEVEX0FQSV9LRVldJyxcbiAgKVxuXG4gIC8vIEF1dGhvcml6YXRpb24gaGVhZGVycyBhbmQgQmVhcmVyIHRva2Vuc1xuICByZWRhY3RlZCA9IHJlZGFjdGVkLnJlcGxhY2UoXG4gICAgLyhbXCInXT9hdXRob3JpemF0aW9uW1wiJ10/XFxzKls6PV1cXHMqW1wiJ10/KGJlYXJlclxccyspPylbXlwiJyxcXHMpfVxcXV0rL2dpLFxuICAgICckMVtSRURBQ1RFRF9UT0tFTl0nLFxuICApXG5cbiAgLy8gQVdTIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICByZWRhY3RlZCA9IHJlZGFjdGVkLnJlcGxhY2UoXG4gICAgLyhBV1NbXy1dW0EtWmEtejAtOV9dK1xccypbPTpdXFxzKilbXCInXT9bXlwiJyxcXHMpfVxcXV0rW1wiJ10/L2dpLFxuICAgICckMVtSRURBQ1RFRF9BV1NfVkFMVUVdJyxcbiAgKVxuXG4gIC8vIEdDUCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgcmVkYWN0ZWQgPSByZWRhY3RlZC5yZXBsYWNlKFxuICAgIC8oR09PR0xFW18tXVtBLVphLXowLTlfXStcXHMqWz06XVxccyopW1wiJ10/W15cIicsXFxzKX1cXF1dK1tcIiddPy9naSxcbiAgICAnJDFbUkVEQUNURURfR0NQX1ZBTFVFXScsXG4gIClcblxuICAvLyBFbnZpcm9ubWVudCB2YXJpYWJsZXMgd2l0aCBrZXlzXG4gIHJlZGFjdGVkID0gcmVkYWN0ZWQucmVwbGFjZShcbiAgICAvKChBUElbLV9dP0tFWXxUT0tFTnxTRUNSRVR8UEFTU1dPUkQpXFxzKls9Ol1cXHMqKVtcIiddP1teXCInLFxccyl9XFxdXStbXCInXT8vZ2ksXG4gICAgJyQxW1JFREFDVEVEXScsXG4gIClcblxuICByZXR1cm4gcmVkYWN0ZWRcbn1cblxuLy8gR2V0IHNhbml0aXplZCBlcnJvciBsb2dzIHdpdGggc2Vuc2l0aXZlIGluZm9ybWF0aW9uIHJlZGFjdGVkXG5mdW5jdGlvbiBnZXRTYW5pdGl6ZWRFcnJvckxvZ3MoKTogQXJyYXk8e1xuICBlcnJvcj86IHN0cmluZ1xuICB0aW1lc3RhbXA/OiBzdHJpbmdcbn0+IHtcbiAgLy8gU2FuaXRpemUgZXJyb3IgbG9ncyB0byByZW1vdmUgYW55IEFQSSBrZXlzXG4gIHJldHVybiBnZXRJbk1lbW9yeUVycm9ycygpLm1hcChlcnJvckluZm8gPT4ge1xuICAgIC8vIENyZWF0ZSBhIGNvcHkgb2YgdGhlIGVycm9yIGluZm8gdG8gYXZvaWQgbW9kaWZ5aW5nIHRoZSBvcmlnaW5hbFxuICAgIGNvbnN0IGVycm9yQ29weSA9IHsgLi4uZXJyb3JJbmZvIH0gYXMgeyBlcnJvcj86IHN0cmluZzsgdGltZXN0YW1wPzogc3RyaW5nIH1cblxuICAgIC8vIFNhbml0aXplIGVycm9yIGlmIHByZXNlbnQgYW5kIGlzIGEgc3RyaW5nXG4gICAgaWYgKGVycm9yQ29weSAmJiB0eXBlb2YgZXJyb3JDb3B5LmVycm9yID09PSAnc3RyaW5nJykge1xuICAgICAgZXJyb3JDb3B5LmVycm9yID0gcmVkYWN0U2Vuc2l0aXZlSW5mbyhlcnJvckNvcHkuZXJyb3IpXG4gICAgfVxuXG4gICAgcmV0dXJuIGVycm9yQ29weVxuICB9KVxufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkUmF3VHJhbnNjcmlwdEpzb25sKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHRyYW5zY3JpcHRQYXRoID0gZ2V0VHJhbnNjcmlwdFBhdGgoKVxuICAgIGNvbnN0IHsgc2l6ZSB9ID0gYXdhaXQgc3RhdCh0cmFuc2NyaXB0UGF0aClcbiAgICBpZiAoc2l6ZSA+IE1BWF9UUkFOU0NSSVBUX1JFQURfQllURVMpIHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFNraXBwaW5nIHJhdyB0cmFuc2NyaXB0IHJlYWQ6IGZpbGUgdG9vIGxhcmdlICgke3NpemV9IGJ5dGVzKWAsXG4gICAgICAgIHsgbGV2ZWw6ICd3YXJuJyB9LFxuICAgICAgKVxuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgcmV0dXJuIGF3YWl0IHJlYWRGaWxlKHRyYW5zY3JpcHRQYXRoLCAndXRmLTgnKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBGZWVkYmFjayh7XG4gIGFib3J0U2lnbmFsLFxuICBtZXNzYWdlcyxcbiAgaW5pdGlhbERlc2NyaXB0aW9uLFxuICBvbkRvbmUsXG4gIGJhY2tncm91bmRUYXNrcyA9IHt9LFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbc3RlcCwgc2V0U3RlcF0gPSB1c2VTdGF0ZTxTdGVwPigndXNlcklucHV0JylcbiAgY29uc3QgW2N1cnNvck9mZnNldCwgc2V0Q3Vyc29yT2Zmc2V0XSA9IHVzZVN0YXRlKDApXG4gIGNvbnN0IFtkZXNjcmlwdGlvbiwgc2V0RGVzY3JpcHRpb25dID0gdXNlU3RhdGUoaW5pdGlhbERlc2NyaXB0aW9uID8/ICcnKVxuICBjb25zdCBbZmVlZGJhY2tJZCwgc2V0RmVlZGJhY2tJZF0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtlbnZJbmZvLCBzZXRFbnZJbmZvXSA9IHVzZVN0YXRlPHtcbiAgICBpc0dpdDogYm9vbGVhblxuICAgIGdpdFN0YXRlOiBHaXRSZXBvU3RhdGUgfCBudWxsXG4gIH0+KHsgaXNHaXQ6IGZhbHNlLCBnaXRTdGF0ZTogbnVsbCB9KVxuICBjb25zdCBbdGl0bGUsIHNldFRpdGxlXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHRleHRJbnB1dENvbHVtbnMgPSB1c2VUZXJtaW5hbFNpemUoKS5jb2x1bW5zIC0gNFxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZEVudkluZm8oKSB7XG4gICAgICBjb25zdCBpc0dpdCA9IGF3YWl0IGdldElzR2l0KClcbiAgICAgIGxldCBnaXRTdGF0ZTogR2l0UmVwb1N0YXRlIHwgbnVsbCA9IG51bGxcbiAgICAgIGlmIChpc0dpdCkge1xuICAgICAgICBnaXRTdGF0ZSA9IGF3YWl0IGdldEdpdFN0YXRlKClcbiAgICAgIH1cbiAgICAgIHNldEVudkluZm8oeyBpc0dpdCwgZ2l0U3RhdGUgfSlcbiAgICB9XG4gICAgdm9pZCBsb2FkRW52SW5mbygpXG4gIH0sIFtdKVxuXG4gIGNvbnN0IHN1Ym1pdFJlcG9ydCA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBzZXRTdGVwKCdzdWJtaXR0aW5nJylcbiAgICBzZXRFcnJvcihudWxsKVxuICAgIHNldEZlZWRiYWNrSWQobnVsbClcblxuICAgIC8vIEdldCBzYW5pdGl6ZWQgZXJyb3JzIGZvciB0aGUgcmVwb3J0XG4gICAgY29uc3Qgc2FuaXRpemVkRXJyb3JzID0gZ2V0U2FuaXRpemVkRXJyb3JMb2dzKClcblxuICAgIC8vIEV4dHJhY3QgbGFzdCBhc3Npc3RhbnQgbWVzc2FnZSBJRCBmcm9tIG1lc3NhZ2VzIGFycmF5XG4gICAgY29uc3QgbGFzdEFzc2lzdGFudE1lc3NhZ2UgPSBnZXRMYXN0QXNzaXN0YW50TWVzc2FnZShtZXNzYWdlcylcbiAgICBjb25zdCBsYXN0QXNzaXN0YW50TWVzc2FnZUlkID0gbGFzdEFzc2lzdGFudE1lc3NhZ2U/LnJlcXVlc3RJZCA/PyBudWxsXG5cbiAgICBjb25zdCBbZGlza1RyYW5zY3JpcHRzLCByYXdUcmFuc2NyaXB0SnNvbmxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgbG9hZEFsbFN1YmFnZW50VHJhbnNjcmlwdHNGcm9tRGlzaygpLFxuICAgICAgbG9hZFJhd1RyYW5zY3JpcHRKc29ubCgpLFxuICAgIF0pXG4gICAgY29uc3QgdGVhbW1hdGVUcmFuc2NyaXB0cyA9XG4gICAgICBleHRyYWN0VGVhbW1hdGVUcmFuc2NyaXB0c0Zyb21UYXNrcyhiYWNrZ3JvdW5kVGFza3MpXG4gICAgY29uc3Qgc3ViYWdlbnRUcmFuc2NyaXB0cyA9IHsgLi4uZGlza1RyYW5zY3JpcHRzLCAuLi50ZWFtbWF0ZVRyYW5zY3JpcHRzIH1cblxuICAgIGNvbnN0IHJlcG9ydERhdGEgPSB7XG4gICAgICBsYXRlc3RBc3Npc3RhbnRNZXNzYWdlSWQ6IGxhc3RBc3Npc3RhbnRNZXNzYWdlSWQsXG4gICAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlcy5sZW5ndGgsXG4gICAgICBkYXRldGltZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBwbGF0Zm9ybTogZW52LnBsYXRmb3JtLFxuICAgICAgZ2l0UmVwbzogZW52SW5mby5pc0dpdCxcbiAgICAgIHRlcm1pbmFsOiBlbnYudGVybWluYWwsXG4gICAgICB2ZXJzaW9uOiBNQUNSTy5WRVJTSU9OLFxuICAgICAgdHJhbnNjcmlwdDogbm9ybWFsaXplTWVzc2FnZXNGb3JBUEkobWVzc2FnZXMpLFxuICAgICAgZXJyb3JzOiBzYW5pdGl6ZWRFcnJvcnMsXG4gICAgICBsYXN0QXBpUmVxdWVzdDogZ2V0TGFzdEFQSVJlcXVlc3QoKSxcbiAgICAgIC4uLihPYmplY3Qua2V5cyhzdWJhZ2VudFRyYW5zY3JpcHRzKS5sZW5ndGggPiAwICYmIHtcbiAgICAgICAgc3ViYWdlbnRUcmFuc2NyaXB0cyxcbiAgICAgIH0pLFxuICAgICAgLi4uKHJhd1RyYW5zY3JpcHRKc29ubCAmJiB7IHJhd1RyYW5zY3JpcHRKc29ubCB9KSxcbiAgICB9XG5cbiAgICBjb25zdCBbcmVzdWx0LCB0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHN1Ym1pdEZlZWRiYWNrKHJlcG9ydERhdGEsIGFib3J0U2lnbmFsKSxcbiAgICAgIGdlbmVyYXRlVGl0bGUoZGVzY3JpcHRpb24sIGFib3J0U2lnbmFsKSxcbiAgICBdKVxuXG4gICAgc2V0VGl0bGUodClcblxuICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgaWYgKHJlc3VsdC5mZWVkYmFja0lkKSB7XG4gICAgICAgIHNldEZlZWRiYWNrSWQocmVzdWx0LmZlZWRiYWNrSWQpXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9idWdfcmVwb3J0X3N1Ym1pdHRlZCcsIHtcbiAgICAgICAgICBmZWVkYmFja19pZDpcbiAgICAgICAgICAgIHJlc3VsdC5mZWVkYmFja0lkIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgbGFzdF9hc3Npc3RhbnRfbWVzc2FnZV9pZDpcbiAgICAgICAgICAgIGxhc3RBc3Npc3RhbnRNZXNzYWdlSWQgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgLy8gMVAtb25seTogZnJlZWZvcm0gdGV4dCBhcHByb3ZlZCBmb3IgQlEuIEpvaW4gb24gZmVlZGJhY2tfaWQuXG4gICAgICAgIGxvZ0V2ZW50VG8xUCgndGVuZ3VfYnVnX3JlcG9ydF9kZXNjcmlwdGlvbicsIHtcbiAgICAgICAgICBmZWVkYmFja19pZDpcbiAgICAgICAgICAgIHJlc3VsdC5mZWVkYmFja0lkIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgZGVzY3JpcHRpb246IHJlZGFjdFNlbnNpdGl2ZUluZm8oXG4gICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBzZXRTdGVwKCdkb25lJylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJlc3VsdC5pc1pkck9yZykge1xuICAgICAgICBzZXRFcnJvcihcbiAgICAgICAgICAnRmVlZGJhY2sgY29sbGVjdGlvbiBpcyBub3QgYXZhaWxhYmxlIGZvciBvcmdhbml6YXRpb25zIHdpdGggY3VzdG9tIGRhdGEgcmV0ZW50aW9uIHBvbGljaWVzLicsXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEVycm9yKCdDb3VsZCBub3Qgc3VibWl0IGZlZWRiYWNrLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLicpXG4gICAgICB9XG4gICAgICAvLyBTdGF5IG9uIHVzZXJJbnB1dCBzdGVwIHNvIHVzZXIgY2FuIHJldHJ5IHdpdGggdGhlaXIgY29udGVudCBwcmVzZXJ2ZWRcbiAgICAgIHNldFN0ZXAoJ3VzZXJJbnB1dCcpXG4gICAgfVxuICB9LCBbZGVzY3JpcHRpb24sIGVudkluZm8uaXNHaXQsIG1lc3NhZ2VzXSlcblxuICAvLyBIYW5kbGUgY2FuY2VsIC0gdGhpcyB3aWxsIGJlIGNhbGxlZCBieSBEaWFsb2cncyBhdXRvbWF0aWMgRXNjIGhhbmRsaW5nXG4gIGNvbnN0IGhhbmRsZUNhbmNlbCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICAvLyBEb24ndCBjYW5jZWwgd2hlbiBkb25lIC0gbGV0IG90aGVyIGtleXMgY2xvc2UgdGhlIGRpYWxvZ1xuICAgIGlmIChzdGVwID09PSAnZG9uZScpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBvbkRvbmUoJ0Vycm9yIHN1Ym1pdHRpbmcgZmVlZGJhY2sgLyBidWcgcmVwb3J0Jywge1xuICAgICAgICAgIGRpc3BsYXk6ICdzeXN0ZW0nLFxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb25Eb25lKCdGZWVkYmFjayAvIGJ1ZyByZXBvcnQgc3VibWl0dGVkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIG9uRG9uZSgnRmVlZGJhY2sgLyBidWcgcmVwb3J0IGNhbmNlbGxlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgfSwgW3N0ZXAsIGVycm9yLCBvbkRvbmVdKVxuXG4gIC8vIER1cmluZyB0ZXh0IGlucHV0LCB1c2UgU2V0dGluZ3MgY29udGV4dCB3aGVyZSBvbmx5IEVzY2FwZSAobm90ICduJykgdHJpZ2dlcnMgY29uZmlybTpuby5cbiAgLy8gVGhpcyBhbGxvd3MgdHlwaW5nICduJyBpbiB0aGUgdGV4dCBmaWVsZCB3aGlsZSBzdGlsbCBzdXBwb3J0aW5nIEVzY2FwZSB0byBjYW5jZWwuXG4gIHVzZUtleWJpbmRpbmcoJ2NvbmZpcm06bm8nLCBoYW5kbGVDYW5jZWwsIHtcbiAgICBjb250ZXh0OiAnU2V0dGluZ3MnLFxuICAgIGlzQWN0aXZlOiBzdGVwID09PSAndXNlcklucHV0JyxcbiAgfSlcblxuICB1c2VJbnB1dCgoaW5wdXQsIGtleSkgPT4ge1xuICAgIC8vIEFsbG93IGFueSBrZXkgcHJlc3MgdG8gY2xvc2UgdGhlIGRpYWxvZyB3aGVuIGRvbmUgb3Igd2hlbiB0aGVyZSdzIGFuIGVycm9yXG4gICAgaWYgKHN0ZXAgPT09ICdkb25lJykge1xuICAgICAgaWYgKGtleS5yZXR1cm4gJiYgdGl0bGUpIHtcbiAgICAgICAgLy8gT3BlbiBHaXRIdWIgaXNzdWUgVVJMIHdoZW4gRW50ZXIgaXMgcHJlc3NlZFxuICAgICAgICBjb25zdCBpc3N1ZVVybCA9IGNyZWF0ZUdpdEh1Yklzc3VlVXJsKFxuICAgICAgICAgIGZlZWRiYWNrSWQgPz8gJycsXG4gICAgICAgICAgdGl0bGUsXG4gICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgZ2V0U2FuaXRpemVkRXJyb3JMb2dzKCksXG4gICAgICAgIClcbiAgICAgICAgdm9pZCBvcGVuQnJvd3Nlcihpc3N1ZVVybClcbiAgICAgIH1cbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBvbkRvbmUoJ0Vycm9yIHN1Ym1pdHRpbmcgZmVlZGJhY2sgLyBidWcgcmVwb3J0Jywge1xuICAgICAgICAgIGRpc3BsYXk6ICdzeXN0ZW0nLFxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb25Eb25lKCdGZWVkYmFjayAvIGJ1ZyByZXBvcnQgc3VibWl0dGVkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gV2hlbiBpbiB1c2VySW5wdXQgc3RlcCB3aXRoIGVycm9yLCBhbGxvdyB1c2VyIHRvIGVkaXQgYW5kIHJldHJ5XG4gICAgLy8gKGRvbid0IGNsb3NlIG9uIGFueSBrZXlwcmVzcyAtIHRoZXkgY2FuIHN0aWxsIHByZXNzIEVzYyB0byBjYW5jZWwpXG4gICAgaWYgKGVycm9yICYmIHN0ZXAgIT09ICd1c2VySW5wdXQnKSB7XG4gICAgICBvbkRvbmUoJ0Vycm9yIHN1Ym1pdHRpbmcgZmVlZGJhY2sgLyBidWcgcmVwb3J0Jywge1xuICAgICAgICBkaXNwbGF5OiAnc3lzdGVtJyxcbiAgICAgIH0pXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoc3RlcCA9PT0gJ2NvbnNlbnQnICYmIChrZXkucmV0dXJuIHx8IGlucHV0ID09PSAnICcpKSB7XG4gICAgICB2b2lkIHN1Ym1pdFJlcG9ydCgpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiAoXG4gICAgPERpYWxvZ1xuICAgICAgdGl0bGU9XCJTdWJtaXQgRmVlZGJhY2sgLyBCdWcgUmVwb3J0XCJcbiAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICBpc0NhbmNlbEFjdGl2ZT17c3RlcCAhPT0gJ3VzZXJJbnB1dCd9XG4gICAgICBpbnB1dEd1aWRlPXtleGl0U3RhdGUgPT5cbiAgICAgICAgZXhpdFN0YXRlLnBlbmRpbmcgPyAoXG4gICAgICAgICAgPFRleHQ+UHJlc3Mge2V4aXRTdGF0ZS5rZXlOYW1lfSBhZ2FpbiB0byBleGl0PC9UZXh0PlxuICAgICAgICApIDogc3RlcCA9PT0gJ3VzZXJJbnB1dCcgPyAoXG4gICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyXCIgYWN0aW9uPVwiY29udGludWVcIiAvPlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjYW5jZWxcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgKSA6IHN0ZXAgPT09ICdjb25zZW50JyA/IChcbiAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJzdWJtaXRcIiAvPlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjYW5jZWxcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgKSA6IG51bGxcbiAgICAgIH1cbiAgICA+XG4gICAgICB7c3RlcCA9PT0gJ3VzZXJJbnB1dCcgJiYgKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICAgIDxUZXh0PkRlc2NyaWJlIHRoZSBpc3N1ZSBiZWxvdzo8L1RleHQ+XG4gICAgICAgICAgPFRleHRJbnB1dFxuICAgICAgICAgICAgdmFsdWU9e2Rlc2NyaXB0aW9ufVxuICAgICAgICAgICAgb25DaGFuZ2U9e3ZhbHVlID0+IHtcbiAgICAgICAgICAgICAgc2V0RGVzY3JpcHRpb24odmFsdWUpXG4gICAgICAgICAgICAgIC8vIENsZWFyIGVycm9yIHdoZW4gdXNlciBzdGFydHMgZWRpdGluZyB0byBhbGxvdyByZXRyeVxuICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBzZXRFcnJvcihudWxsKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9fVxuICAgICAgICAgICAgY29sdW1ucz17dGV4dElucHV0Q29sdW1uc31cbiAgICAgICAgICAgIG9uU3VibWl0PXsoKSA9PiBzZXRTdGVwKCdjb25zZW50Jyl9XG4gICAgICAgICAgICBvbkV4aXRNZXNzYWdlPXsoKSA9PlxuICAgICAgICAgICAgICBvbkRvbmUoJ0ZlZWRiYWNrIGNhbmNlbGxlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnNvck9mZnNldD17Y3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgb25DaGFuZ2VDdXJzb3JPZmZzZXQ9e3NldEN1cnNvck9mZnNldH1cbiAgICAgICAgICAgIHNob3dDdXJzb3JcbiAgICAgICAgICAvPlxuICAgICAgICAgIHtlcnJvciAmJiAoXG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e2Vycm9yfTwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgRWRpdCBhbmQgcHJlc3MgRW50ZXIgdG8gcmV0cnksIG9yIEVzYyB0byBjYW5jZWxcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7c3RlcCA9PT0gJ2NvbnNlbnQnICYmIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPFRleHQ+VGhpcyByZXBvcnQgd2lsbCBpbmNsdWRlOjwvVGV4dD5cbiAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAtIFlvdXIgZmVlZGJhY2sgLyBidWcgZGVzY3JpcHRpb246eycgJ31cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2Rlc2NyaXB0aW9ufTwvVGV4dD5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAtIEVudmlyb25tZW50IGluZm86eycgJ31cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAge2Vudi5wbGF0Zm9ybX0sIHtlbnYudGVybWluYWx9LCB2e01BQ1JPLlZFUlNJT059XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHtlbnZJbmZvLmdpdFN0YXRlICYmIChcbiAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgLSBHaXQgcmVwbyBtZXRhZGF0YTp7JyAnfVxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAge2VudkluZm8uZ2l0U3RhdGUuYnJhbmNoTmFtZX1cbiAgICAgICAgICAgICAgICAgIHtlbnZJbmZvLmdpdFN0YXRlLmNvbW1pdEhhc2hcbiAgICAgICAgICAgICAgICAgICAgPyBgLCAke2VudkluZm8uZ2l0U3RhdGUuY29tbWl0SGFzaC5zbGljZSgwLCA3KX1gXG4gICAgICAgICAgICAgICAgICAgIDogJyd9XG4gICAgICAgICAgICAgICAgICB7ZW52SW5mby5naXRTdGF0ZS5yZW1vdGVVcmxcbiAgICAgICAgICAgICAgICAgICAgPyBgIEAgJHtlbnZJbmZvLmdpdFN0YXRlLnJlbW90ZVVybH1gXG4gICAgICAgICAgICAgICAgICAgIDogJyd9XG4gICAgICAgICAgICAgICAgICB7IWVudkluZm8uZ2l0U3RhdGUuaXNIZWFkT25SZW1vdGUgJiYgJywgbm90IHN5bmNlZCd9XG4gICAgICAgICAgICAgICAgICB7IWVudkluZm8uZ2l0U3RhdGUuaXNDbGVhbiAmJiAnLCBoYXMgbG9jYWwgY2hhbmdlcyd9XG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgPFRleHQ+LSBDdXJyZW50IHNlc3Npb24gdHJhbnNjcmlwdDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCB3cmFwPVwid3JhcFwiIGRpbUNvbG9yPlxuICAgICAgICAgICAgICBXZSB3aWxsIHVzZSB5b3VyIGZlZWRiYWNrIHRvIGRlYnVnIHJlbGF0ZWQgaXNzdWVzIG9yIHRvIGltcHJvdmV7JyAnfVxuICAgICAgICAgICAgICBDbGF1ZGUgQ29kZSZhcG9zO3MgZnVuY3Rpb25hbGl0eSAoZWcuIHRvIHJlZHVjZSB0aGUgcmlzayBvZiBidWdzXG4gICAgICAgICAgICAgIG9jY3VycmluZyBpbiB0aGUgZnV0dXJlKS5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgUHJlc3MgPFRleHQgYm9sZD5FbnRlcjwvVGV4dD4gdG8gY29uZmlybSBhbmQgc3VibWl0LlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHtzdGVwID09PSAnc3VibWl0dGluZycgJiYgKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9PlxuICAgICAgICAgIDxUZXh0PlN1Ym1pdHRpbmcgcmVwb3J04oCmPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHtzdGVwID09PSAnZG9uZScgJiYgKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7ZXJyb3IgPyAoXG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e2Vycm9yfTwvVGV4dD5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+VGhhbmsgeW91IGZvciB5b3VyIHJlcG9ydCE8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7ZmVlZGJhY2tJZCAmJiA8VGV4dCBkaW1Db2xvcj5GZWVkYmFjayBJRDoge2ZlZWRiYWNrSWR9PC9UZXh0Pn1cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dD5QcmVzcyA8L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBib2xkPkVudGVyIDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICB0byBvcGVuIHlvdXIgYnJvd3NlciBhbmQgZHJhZnQgYSBHaXRIdWIgaXNzdWUsIG9yIGFueSBvdGhlciBrZXkgdG9cbiAgICAgICAgICAgICAgY2xvc2UuXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICA8L0RpYWxvZz5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2l0SHViSXNzdWVVcmwoXG4gIGZlZWRiYWNrSWQ6IHN0cmluZyxcbiAgdGl0bGU6IHN0cmluZyxcbiAgZGVzY3JpcHRpb246IHN0cmluZyxcbiAgZXJyb3JzOiBBcnJheTx7XG4gICAgZXJyb3I/OiBzdHJpbmdcbiAgICB0aW1lc3RhbXA/OiBzdHJpbmdcbiAgfT4sXG4pOiBzdHJpbmcge1xuICBjb25zdCBzYW5pdGl6ZWRUaXRsZSA9IHJlZGFjdFNlbnNpdGl2ZUluZm8odGl0bGUpXG4gIGNvbnN0IHNhbml0aXplZERlc2NyaXB0aW9uID0gcmVkYWN0U2Vuc2l0aXZlSW5mbyhkZXNjcmlwdGlvbilcblxuICBjb25zdCBib2R5UHJlZml4ID1cbiAgICBgKipCdWcgRGVzY3JpcHRpb24qKlxcbiR7c2FuaXRpemVkRGVzY3JpcHRpb259XFxuXFxuYCArXG4gICAgYCoqRW52aXJvbm1lbnQgSW5mbyoqXFxuYCArXG4gICAgYC0gUGxhdGZvcm06ICR7ZW52LnBsYXRmb3JtfVxcbmAgK1xuICAgIGAtIFRlcm1pbmFsOiAke2Vudi50ZXJtaW5hbH1cXG5gICtcbiAgICBgLSBWZXJzaW9uOiAke01BQ1JPLlZFUlNJT04gfHwgJ3Vua25vd24nfVxcbmAgK1xuICAgIGAtIEZlZWRiYWNrIElEOiAke2ZlZWRiYWNrSWR9XFxuYCArXG4gICAgYFxcbioqRXJyb3JzKipcXG5cXGBcXGBcXGBqc29uXFxuYFxuICBjb25zdCBlcnJvclN1ZmZpeCA9IGBcXG5cXGBcXGBcXGBcXG5gXG4gIGNvbnN0IGVycm9yc0pzb24gPSBqc29uU3RyaW5naWZ5KGVycm9ycylcblxuICBjb25zdCBiYXNlVXJsID0gYCR7R0lUSFVCX0lTU1VFU19SRVBPX1VSTH0vbmV3P3RpdGxlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNhbml0aXplZFRpdGxlKX0mbGFiZWxzPXVzZXItcmVwb3J0ZWQsYnVnJmJvZHk9YFxuICBjb25zdCB0cnVuY2F0aW9uTm90ZSA9IGBcXG4qKk5vdGU6KiogQ29udGVudCB3YXMgdHJ1bmNhdGVkLlxcbmBcblxuICBjb25zdCBlbmNvZGVkUHJlZml4ID0gZW5jb2RlVVJJQ29tcG9uZW50KGJvZHlQcmVmaXgpXG4gIGNvbnN0IGVuY29kZWRTdWZmaXggPSBlbmNvZGVVUklDb21wb25lbnQoZXJyb3JTdWZmaXgpXG4gIGNvbnN0IGVuY29kZWROb3RlID0gZW5jb2RlVVJJQ29tcG9uZW50KHRydW5jYXRpb25Ob3RlKVxuICBjb25zdCBlbmNvZGVkRXJyb3JzID0gZW5jb2RlVVJJQ29tcG9uZW50KGVycm9yc0pzb24pXG5cbiAgLy8gQ2FsY3VsYXRlIHNwYWNlIGF2YWlsYWJsZSBmb3IgZXJyb3JzXG4gIGNvbnN0IHNwYWNlRm9yRXJyb3JzID1cbiAgICBHSVRIVUJfVVJMX0xJTUlUIC1cbiAgICBiYXNlVXJsLmxlbmd0aCAtXG4gICAgZW5jb2RlZFByZWZpeC5sZW5ndGggLVxuICAgIGVuY29kZWRTdWZmaXgubGVuZ3RoIC1cbiAgICBlbmNvZGVkTm90ZS5sZW5ndGhcblxuICAvLyBJZiBkZXNjcmlwdGlvbiBhbG9uZSBleGNlZWRzIGxpbWl0LCB0cnVuY2F0ZSBldmVyeXRoaW5nXG4gIGlmIChzcGFjZUZvckVycm9ycyA8PSAwKSB7XG4gICAgY29uc3QgZWxsaXBzaXMgPSBlbmNvZGVVUklDb21wb25lbnQoJ+KApicpXG4gICAgY29uc3QgYnVmZmVyID0gNTAgLy8gRXh0cmEgc2FmZXR5IG1hcmdpblxuICAgIGNvbnN0IG1heEVuY29kZWRMZW5ndGggPVxuICAgICAgR0lUSFVCX1VSTF9MSU1JVCAtXG4gICAgICBiYXNlVXJsLmxlbmd0aCAtXG4gICAgICBlbGxpcHNpcy5sZW5ndGggLVxuICAgICAgZW5jb2RlZE5vdGUubGVuZ3RoIC1cbiAgICAgIGJ1ZmZlclxuICAgIGNvbnN0IGZ1bGxCb2R5ID0gYm9keVByZWZpeCArIGVycm9yc0pzb24gKyBlcnJvclN1ZmZpeFxuICAgIGxldCBlbmNvZGVkRnVsbEJvZHkgPSBlbmNvZGVVUklDb21wb25lbnQoZnVsbEJvZHkpXG5cbiAgICBpZiAoZW5jb2RlZEZ1bGxCb2R5Lmxlbmd0aCA+IG1heEVuY29kZWRMZW5ndGgpIHtcbiAgICAgIGVuY29kZWRGdWxsQm9keSA9IGVuY29kZWRGdWxsQm9keS5zbGljZSgwLCBtYXhFbmNvZGVkTGVuZ3RoKVxuICAgICAgLy8gRG9uJ3QgY3V0IGluIG1pZGRsZSBvZiAlWFggc2VxdWVuY2VcbiAgICAgIGNvbnN0IGxhc3RQZXJjZW50ID0gZW5jb2RlZEZ1bGxCb2R5Lmxhc3RJbmRleE9mKCclJylcbiAgICAgIGlmIChsYXN0UGVyY2VudCA+PSBlbmNvZGVkRnVsbEJvZHkubGVuZ3RoIC0gMikge1xuICAgICAgICBlbmNvZGVkRnVsbEJvZHkgPSBlbmNvZGVkRnVsbEJvZHkuc2xpY2UoMCwgbGFzdFBlcmNlbnQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhc2VVcmwgKyBlbmNvZGVkRnVsbEJvZHkgKyBlbGxpcHNpcyArIGVuY29kZWROb3RlXG4gIH1cblxuICAvLyBJZiBlcnJvcnMgZml0LCBubyB0cnVuY2F0aW9uIG5lZWRlZFxuICBpZiAoZW5jb2RlZEVycm9ycy5sZW5ndGggPD0gc3BhY2VGb3JFcnJvcnMpIHtcbiAgICByZXR1cm4gYmFzZVVybCArIGVuY29kZWRQcmVmaXggKyBlbmNvZGVkRXJyb3JzICsgZW5jb2RlZFN1ZmZpeFxuICB9XG5cbiAgLy8gVHJ1bmNhdGUgZXJyb3JzIHRvIGZpdCAocHJpb3JpdGl6ZSBrZWVwaW5nIGRlc2NyaXB0aW9uKVxuICAvLyBTbGljZSBlbmNvZGVkIGVycm9ycyBkaXJlY3RseSwgdGhlbiB0cmltIHRvIGF2b2lkIGN1dHRpbmcgJVhYIHNlcXVlbmNlc1xuICBjb25zdCBlbGxpcHNpcyA9IGVuY29kZVVSSUNvbXBvbmVudCgn4oCmJylcbiAgY29uc3QgYnVmZmVyID0gNTAgLy8gRXh0cmEgc2FmZXR5IG1hcmdpblxuICBsZXQgdHJ1bmNhdGVkRW5jb2RlZEVycm9ycyA9IGVuY29kZWRFcnJvcnMuc2xpY2UoXG4gICAgMCxcbiAgICBzcGFjZUZvckVycm9ycyAtIGVsbGlwc2lzLmxlbmd0aCAtIGJ1ZmZlcixcbiAgKVxuICAvLyBJZiB3ZSBjdXQgaW4gbWlkZGxlIG9mICVYWCwgYmFjayB1cCB0byBiZWZvcmUgdGhlICVcbiAgY29uc3QgbGFzdFBlcmNlbnQgPSB0cnVuY2F0ZWRFbmNvZGVkRXJyb3JzLmxhc3RJbmRleE9mKCclJylcbiAgaWYgKGxhc3RQZXJjZW50ID49IHRydW5jYXRlZEVuY29kZWRFcnJvcnMubGVuZ3RoIC0gMikge1xuICAgIHRydW5jYXRlZEVuY29kZWRFcnJvcnMgPSB0cnVuY2F0ZWRFbmNvZGVkRXJyb3JzLnNsaWNlKDAsIGxhc3RQZXJjZW50KVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICBiYXNlVXJsICtcbiAgICBlbmNvZGVkUHJlZml4ICtcbiAgICB0cnVuY2F0ZWRFbmNvZGVkRXJyb3JzICtcbiAgICBlbGxpcHNpcyArXG4gICAgZW5jb2RlZFN1ZmZpeCArXG4gICAgZW5jb2RlZE5vdGVcbiAgKVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVRpdGxlKFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBhYm9ydFNpZ25hbDogQWJvcnRTaWduYWwsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcXVlcnlIYWlrdSh7XG4gICAgICBzeXN0ZW1Qcm9tcHQ6IGFzU3lzdGVtUHJvbXB0KFtcbiAgICAgICAgJ0dlbmVyYXRlIGEgY29uY2lzZSwgdGVjaG5pY2FsIGlzc3VlIHRpdGxlIChtYXggODAgY2hhcnMpIGZvciBhIHB1YmxpYyBHaXRIdWIgaXNzdWUgYmFzZWQgb24gdGhpcyBidWcgcmVwb3J0IGZvciBDbGF1ZGUgQ29kZS4nLFxuICAgICAgICAnQ2xhdWRlIENvZGUgaXMgYW4gYWdlbnRpYyBjb2RpbmcgQ0xJIGJhc2VkIG9uIHRoZSBBbnRocm9waWMgQVBJLicsXG4gICAgICAgICdUaGUgdGl0bGUgc2hvdWxkOicsXG4gICAgICAgICctIEluY2x1ZGUgdGhlIHR5cGUgb2YgaXNzdWUgW0J1Z10gb3IgW0ZlYXR1cmUgUmVxdWVzdF0gYXMgdGhlIGZpcnN0IHRoaW5nIGluIHRoZSB0aXRsZScsXG4gICAgICAgICctIEJlIGNvbmNpc2UsIHNwZWNpZmljIGFuZCBkZXNjcmlwdGl2ZSBvZiB0aGUgYWN0dWFsIHByb2JsZW0nLFxuICAgICAgICAnLSBVc2UgdGVjaG5pY2FsIHRlcm1pbm9sb2d5IGFwcHJvcHJpYXRlIGZvciBhIHNvZnR3YXJlIGlzc3VlJyxcbiAgICAgICAgJy0gRm9yIGVycm9yIG1lc3NhZ2VzLCBleHRyYWN0IHRoZSBrZXkgZXJyb3IgKGUuZy4sIFwiTWlzc2luZyBUb29sIFJlc3VsdCBCbG9ja1wiIHJhdGhlciB0aGFuIHRoZSBmdWxsIG1lc3NhZ2UpJyxcbiAgICAgICAgJy0gQmUgZGlyZWN0IGFuZCBjbGVhciBmb3IgZGV2ZWxvcGVycyB0byB1bmRlcnN0YW5kIHRoZSBwcm9ibGVtJyxcbiAgICAgICAgJy0gSWYgeW91IGNhbm5vdCBkZXRlcm1pbmUgYSBjbGVhciBpc3N1ZSwgdXNlIFwiQnVnIFJlcG9ydDogW2JyaWVmIGRlc2NyaXB0aW9uXVwiJyxcbiAgICAgICAgJy0gQW55IExMTSBBUEkgZXJyb3JzIGFyZSBmcm9tIHRoZSBBbnRocm9waWMgQVBJLCBub3QgZnJvbSBhbnkgb3RoZXIgbW9kZWwgcHJvdmlkZXInLFxuICAgICAgICAnWW91ciByZXNwb25zZSB3aWxsIGJlIGRpcmVjdGx5IHVzZWQgYXMgdGhlIHRpdGxlIG9mIHRoZSBHaXRodWIgaXNzdWUsIGFuZCBhcyBzdWNoIHNob3VsZCBub3QgY29udGFpbiBhbnkgb3RoZXIgY29tbWVudGFyeSBvciBleHBsYWluYXRpb24nLFxuICAgICAgICAnRXhhbXBsZXMgb2YgZ29vZCB0aXRsZXMgaW5jbHVkZTogXCJbQnVnXSBBdXRvLUNvbXBhY3QgdHJpZ2dlcnMgdG8gc29vblwiLCBcIltCdWddIEFudGhyb3BpYyBBUEkgRXJyb3I6IE1pc3NpbmcgVG9vbCBSZXN1bHQgQmxvY2tcIiwgXCJbQnVnXSBFcnJvcjogSW52YWxpZCBNb2RlbCBOYW1lIGZvciBPcHVzXCInLFxuICAgICAgXSksXG4gICAgICB1c2VyUHJvbXB0OiBkZXNjcmlwdGlvbixcbiAgICAgIHNpZ25hbDogYWJvcnRTaWduYWwsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGhhc0FwcGVuZFN5c3RlbVByb21wdDogZmFsc2UsXG4gICAgICAgIHRvb2xDaG9pY2U6IHVuZGVmaW5lZCxcbiAgICAgICAgaXNOb25JbnRlcmFjdGl2ZVNlc3Npb246IGZhbHNlLFxuICAgICAgICBhZ2VudHM6IFtdLFxuICAgICAgICBxdWVyeVNvdXJjZTogJ2ZlZWRiYWNrJyxcbiAgICAgICAgbWNwVG9vbHM6IFtdLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgY29uc3QgdGl0bGUgPVxuICAgICAgcmVzcG9uc2UubWVzc2FnZS5jb250ZW50WzBdPy50eXBlID09PSAndGV4dCdcbiAgICAgICAgPyByZXNwb25zZS5tZXNzYWdlLmNvbnRlbnRbMF0udGV4dFxuICAgICAgICA6ICdCdWcgUmVwb3J0J1xuXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHRpdGxlIGNvbnRhaW5zIGFuIEFQSSBlcnJvciBtZXNzYWdlXG4gICAgaWYgKHN0YXJ0c1dpdGhBcGlFcnJvclByZWZpeCh0aXRsZSkpIHtcbiAgICAgIHJldHVybiBjcmVhdGVGYWxsYmFja1RpdGxlKGRlc2NyaXB0aW9uKVxuICAgIH1cblxuICAgIHJldHVybiB0aXRsZVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElmIHRoZXJlJ3MgYW55IGVycm9yIGluIHRpdGxlIGdlbmVyYXRpb24sIHVzZSBhIGZhbGxiYWNrIHRpdGxlXG4gICAgbG9nRXJyb3IoZXJyb3IpXG4gICAgcmV0dXJuIGNyZWF0ZUZhbGxiYWNrVGl0bGUoZGVzY3JpcHRpb24pXG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlRmFsbGJhY2tUaXRsZShkZXNjcmlwdGlvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gQ3JlYXRlIGEgc2FmZSBmYWxsYmFjayB0aXRsZSBiYXNlZCBvbiB0aGUgYnVnIGRlc2NyaXB0aW9uXG5cbiAgLy8gVHJ5IHRvIGV4dHJhY3QgYSBtZWFuaW5nZnVsIHRpdGxlIGZyb20gdGhlIGZpcnN0IGxpbmVcbiAgY29uc3QgZmlyc3RMaW5lID0gZGVzY3JpcHRpb24uc3BsaXQoJ1xcbicpWzBdIHx8ICcnXG5cbiAgLy8gSWYgdGhlIGZpcnN0IGxpbmUgaXMgdmVyeSBzaG9ydCwgdXNlIGl0IGRpcmVjdGx5XG4gIGlmIChmaXJzdExpbmUubGVuZ3RoIDw9IDYwICYmIGZpcnN0TGluZS5sZW5ndGggPiA1KSB7XG4gICAgcmV0dXJuIGZpcnN0TGluZVxuICB9XG5cbiAgLy8gRm9yIGxvbmdlciBkZXNjcmlwdGlvbnMsIGNyZWF0ZSBhIHRydW5jYXRlZCB2ZXJzaW9uXG4gIC8vIFRydW5jYXRlIGF0IHdvcmQgYm91bmRhcmllcyB3aGVuIHBvc3NpYmxlXG4gIGxldCB0cnVuY2F0ZWQgPSBmaXJzdExpbmUuc2xpY2UoMCwgNjApXG4gIGlmIChmaXJzdExpbmUubGVuZ3RoID4gNjApIHtcbiAgICAvLyBGaW5kIHRoZSBsYXN0IHNwYWNlIGJlZm9yZSB0aGUgNjAgY2hhciBsaW1pdFxuICAgIGNvbnN0IGxhc3RTcGFjZSA9IHRydW5jYXRlZC5sYXN0SW5kZXhPZignICcpXG4gICAgaWYgKGxhc3RTcGFjZSA+IDMwKSB7XG4gICAgICAvLyBPbmx5IHRyaW0gYXQgd29yZCBpZiB3ZSdyZSBub3QgY3V0dGluZyB0b28gbXVjaFxuICAgICAgdHJ1bmNhdGVkID0gdHJ1bmNhdGVkLnNsaWNlKDAsIGxhc3RTcGFjZSlcbiAgICB9XG4gICAgdHJ1bmNhdGVkICs9ICcuLi4nXG4gIH1cblxuICByZXR1cm4gdHJ1bmNhdGVkLmxlbmd0aCA8IDEwID8gJ0J1ZyBSZXBvcnQnIDogdHJ1bmNhdGVkXG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzYW5pdGl6ZSBhbmQgbG9nIGVycm9ycyB3aXRob3V0IGV4cG9zaW5nIEFQSSBrZXlzXG5mdW5jdGlvbiBzYW5pdGl6ZUFuZExvZ0Vycm9yKGVycjogdW5rbm93bik6IHZvaWQge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAvLyBDcmVhdGUgYSBjb3B5IHdpdGggcG90ZW50aWFsbHkgc2Vuc2l0aXZlIGluZm8gcmVkYWN0ZWRcbiAgICBjb25zdCBzYWZlRXJyb3IgPSBuZXcgRXJyb3IocmVkYWN0U2Vuc2l0aXZlSW5mbyhlcnIubWVzc2FnZSkpXG5cbiAgICAvLyBBbHNvIHJlZGFjdCB0aGUgc3RhY2sgdHJhY2UgaWYgcHJlc2VudFxuICAgIGlmIChlcnIuc3RhY2spIHtcbiAgICAgIHNhZmVFcnJvci5zdGFjayA9IHJlZGFjdFNlbnNpdGl2ZUluZm8oZXJyLnN0YWNrKVxuICAgIH1cblxuICAgIGxvZ0Vycm9yKHNhZmVFcnJvcilcbiAgfSBlbHNlIHtcbiAgICAvLyBGb3Igbm9uLUVycm9yIG9iamVjdHMsIGNvbnZlcnQgdG8gc3RyaW5nIGFuZCByZWRhY3Qgc2Vuc2l0aXZlIGluZm9cbiAgICBjb25zdCBlcnJvclN0cmluZyA9IHJlZGFjdFNlbnNpdGl2ZUluZm8oU3RyaW5nKGVycikpXG4gICAgbG9nRXJyb3IobmV3IEVycm9yKGVycm9yU3RyaW5nKSlcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzdWJtaXRGZWVkYmFjayhcbiAgZGF0YTogRmVlZGJhY2tEYXRhLFxuICBzaWduYWw/OiBBYm9ydFNpZ25hbCxcbik6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBmZWVkYmFja0lkPzogc3RyaW5nOyBpc1pkck9yZz86IGJvb2xlYW4gfT4ge1xuICBpZiAoaXNFc3NlbnRpYWxUcmFmZmljT25seSgpKSB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBFbnN1cmUgT0F1dGggdG9rZW4gaXMgZnJlc2ggYmVmb3JlIGdldHRpbmcgYXV0aCBoZWFkZXJzXG4gICAgLy8gVGhpcyBwcmV2ZW50cyA0MDEgZXJyb3JzIGZyb20gc3RhbGUgY2FjaGVkIHRva2Vuc1xuICAgIGF3YWl0IGNoZWNrQW5kUmVmcmVzaE9BdXRoVG9rZW5JZk5lZWRlZCgpXG5cbiAgICBjb25zdCBhdXRoUmVzdWx0ID0gZ2V0QXV0aEhlYWRlcnMoKVxuICAgIGlmIChhdXRoUmVzdWx0LmVycm9yKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnVXNlci1BZ2VudCc6IGdldFVzZXJBZ2VudCgpLFxuICAgICAgLi4uYXV0aFJlc3VsdC5oZWFkZXJzLFxuICAgIH1cblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdChcbiAgICAgICdodHRwczovL2FwaS5hbnRocm9waWMuY29tL2FwaS9jbGF1ZGVfY2xpX2ZlZWRiYWNrJyxcbiAgICAgIHtcbiAgICAgICAgY29udGVudDoganNvblN0cmluZ2lmeShkYXRhKSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAwLCAvLyAzMCBzZWNvbmQgdGltZW91dCB0byBwcmV2ZW50IGhhbmdpbmdcbiAgICAgICAgc2lnbmFsLFxuICAgICAgfSxcbiAgICApXG5cbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHJlc3BvbnNlLmRhdGFcbiAgICAgIGlmIChyZXN1bHQ/LmZlZWRiYWNrX2lkKSB7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGZlZWRiYWNrSWQ6IHJlc3VsdC5mZWVkYmFja19pZCB9XG4gICAgICB9XG4gICAgICBzYW5pdGl6ZUFuZExvZ0Vycm9yKFxuICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgJ0ZhaWxlZCB0byBzdWJtaXQgZmVlZGJhY2s6IHJlcXVlc3QgZGlkIG5vdCByZXR1cm4gZmVlZGJhY2tfaWQnLFxuICAgICAgICApLFxuICAgICAgKVxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfVxuICAgIH1cblxuICAgIHNhbml0aXplQW5kTG9nRXJyb3IoXG4gICAgICBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBzdWJtaXQgZmVlZGJhY2s6JyArIHJlc3BvbnNlLnN0YXR1cyksXG4gICAgKVxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgLy8gSGFuZGxlIGNhbmNlbGxhdGlvbi9hYm9ydCAtIGRvbid0IGxvZyBhcyBlcnJvclxuICAgIGlmIChheGlvcy5pc0NhbmNlbChlcnIpKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9XG4gICAgfVxuXG4gICAgaWYgKGF4aW9zLmlzQXhpb3NFcnJvcihlcnIpICYmIGVyci5yZXNwb25zZT8uc3RhdHVzID09PSA0MDMpIHtcbiAgICAgIGNvbnN0IGVycm9yRGF0YSA9IGVyci5yZXNwb25zZS5kYXRhXG4gICAgICBpZiAoXG4gICAgICAgIGVycm9yRGF0YT8uZXJyb3I/LnR5cGUgPT09ICdwZXJtaXNzaW9uX2Vycm9yJyAmJlxuICAgICAgICBlcnJvckRhdGE/LmVycm9yPy5tZXNzYWdlPy5pbmNsdWRlcygnQ3VzdG9tIGRhdGEgcmV0ZW50aW9uIHNldHRpbmdzJylcbiAgICAgICkge1xuICAgICAgICBzYW5pdGl6ZUFuZExvZ0Vycm9yKFxuICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICdDYW5ub3Qgc3VibWl0IGZlZWRiYWNrIGJlY2F1c2UgY3VzdG9tIGRhdGEgcmV0ZW50aW9uIHNldHRpbmdzIGFyZSBlbmFibGVkJyxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc1pkck9yZzogdHJ1ZSB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFVzZSBvdXIgc2FmZSBlcnJvciBsb2dnaW5nIGZ1bmN0aW9uIHRvIGF2b2lkIGxlYWtpbmcgQVBJIGtleXNcbiAgICBzYW5pdGl6ZUFuZExvZ0Vycm9yKGVycilcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsT0FBT0EsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsUUFBUSxFQUFFQyxJQUFJLFFBQVEsYUFBYTtBQUM1QyxPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFdBQVcsRUFBRUMsU0FBUyxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUN4RCxTQUFTQyxpQkFBaUIsUUFBUSx3QkFBd0I7QUFDMUQsU0FBU0MsWUFBWSxRQUFRLGlEQUFpRDtBQUM5RSxTQUNFLEtBQUtDLDBEQUEwRCxFQUMvREMsUUFBUSxRQUNILGlDQUFpQztBQUN4QyxTQUNFQyx1QkFBdUIsRUFDdkJDLHVCQUF1QixRQUNsQix1QkFBdUI7QUFDOUIsY0FBY0Msb0JBQW9CLFFBQVEsZ0JBQWdCO0FBQzFELFNBQVNDLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsUUFBUSxXQUFXO0FBQy9DLFNBQVNDLGFBQWEsUUFBUSxp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