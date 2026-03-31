import { readFileSync } from 'fs';
import { REMOTE_CONTROL_DISCONNECTED_MSG } from '../bridge/types.js';
import type { Command } from '../commands.js';
import { DIAMOND_OPEN } from '../constants/figures.js';
import { getRemoteSessionUrl } from '../constants/product.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js';
import type { AppState } from '../state/AppStateStore.js';
import { checkRemoteAgentEligibility, formatPreconditionError, RemoteAgentTask, type RemoteAgentTaskState, registerRemoteAgentTask } from '../tasks/RemoteAgentTask/RemoteAgentTask.js';
import type { LocalJSXCommandCall } from '../types/command.js';
import { logForDebugging } from '../utils/debug.js';
import { errorMessage } from '../utils/errors.js';
import { logError } from '../utils/log.js';
import { enqueuePendingNotification } from '../utils/messageQueueManager.js';
import { ALL_MODEL_CONFIGS } from '../utils/model/configs.js';
import { updateTaskState } from '../utils/task/framework.js';
import { archiveRemoteSession, teleportToRemote } from '../utils/teleport.js';
import { pollForApprovedExitPlanMode, UltraplanPollError } from '../utils/ultraplan/ccrSession.js';

// TODO(prod-hardening): OAuth token may go stale over the 30min poll;
// consider refresh.

// Multi-agent exploration is slow; 30min timeout.
const ULTRAPLAN_TIMEOUT_MS = 30 * 60 * 1000;
export const CCR_TERMS_URL = 'https://code.claude.com/docs/en/claude-code-on-the-web';

// CCR runs against the first-party API — use the canonical ID, not the
// provider-specific string getModelStrings() would return (which may be a
// Bedrock ARN or Vertex ID on the local CLI). Read at call time, not module
// load: the GrowthBook cache is empty at import and `/config` Gates can flip
// it between invocations.
function getUltraplanModel(): string {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_ultraplan_model', ALL_MODEL_CONFIGS.opus46.firstParty);
}

// prompt.txt is wrapped in <system-reminder> so the CCR browser hides
// scaffolding (CLI_BLOCK_TAGS dropped by stripSystemNotifications)
// while the model still sees full text.
// Phrasing deliberately avoids the feature name because
// the remote CCR CLI runs keyword detection on raw input before
// any tag stripping, and a bare "ultraplan" in the prompt would self-trigger as
// /ultraplan, which is filtered out of headless mode as "Unknown skill"
//
// Bundler inlines .txt as a string; the test runner wraps it as {default}.
/* eslint-disable @typescript-eslint/no-require-imports */
const _rawPrompt = require('../utils/ultraplan/prompt.txt');
/* eslint-enable @typescript-eslint/no-require-imports */
const DEFAULT_INSTRUCTIONS: string = (typeof _rawPrompt === 'string' ? _rawPrompt : _rawPrompt.default).trimEnd();

// Dev-only prompt override resolved eagerly at module load.
// Gated to ant builds (USER_TYPE is a build-time define,
// so the override path is DCE'd from external builds).
// Shell-set env only, so top-level process.env read is fine
// — settings.env never injects this.
/* eslint-disable custom-rules/no-process-env-top-level, custom-rules/no-sync-fs -- ant-only dev override; eager top-level read is the point (crash at startup, not silently inside the slash-command try/catch) */
const ULTRAPLAN_INSTRUCTIONS: string = "external" === 'ant' && process.env.ULTRAPLAN_PROMPT_FILE ? readFileSync(process.env.ULTRAPLAN_PROMPT_FILE, 'utf8').trimEnd() : DEFAULT_INSTRUCTIONS;
/* eslint-enable custom-rules/no-process-env-top-level, custom-rules/no-sync-fs */

/**
 * Assemble the initial CCR user message. seedPlan and blurb stay outside the
 * system-reminder so the browser renders them; scaffolding is hidden.
 */
export function buildUltraplanPrompt(blurb: string, seedPlan?: string): string {
  const parts: string[] = [];
  if (seedPlan) {
    parts.push('Here is a draft plan to refine:', '', seedPlan, '');
  }
  parts.push(ULTRAPLAN_INSTRUCTIONS);
  if (blurb) {
    parts.push('', blurb);
  }
  return parts.join('\n');
}
function startDetachedPoll(taskId: string, sessionId: string, url: string, getAppState: () => AppState, setAppState: (f: (prev: AppState) => AppState) => void): void {
  const started = Date.now();
  let failed = false;
  void (async () => {
    try {
      const {
        plan,
        rejectCount,
        executionTarget
      } = await pollForApprovedExitPlanMode(sessionId, ULTRAPLAN_TIMEOUT_MS, phase => {
        if (phase === 'needs_input') logEvent('tengu_ultraplan_awaiting_input', {});
        updateTaskState<RemoteAgentTaskState>(taskId, setAppState, t => {
          if (t.status !== 'running') return t;
          const next = phase === 'running' ? undefined : phase;
          return t.ultraplanPhase === next ? t : {
            ...t,
            ultraplanPhase: next
          };
        });
      }, () => getAppState().tasks?.[taskId]?.status !== 'running');
      logEvent('tengu_ultraplan_approved', {
        duration_ms: Date.now() - started,
        plan_length: plan.length,
        reject_count: rejectCount,
        execution_target: executionTarget as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (executionTarget === 'remote') {
        // User chose "execute in CCR" in the browser PlanModal — the remote
        // session is now coding. Skip archive (ARCHIVE has no running-check,
        // would kill mid-execution) and skip the choice dialog (already chose).
        // Guard on task status so a poll that resolves after stopUltraplan
        // doesn't notify for a killed session.
        const task = getAppState().tasks?.[taskId];
        if (task?.status !== 'running') return;
        updateTaskState<RemoteAgentTaskState>(taskId, setAppState, t => t.status !== 'running' ? t : {
          ...t,
          status: 'completed',
          endTime: Date.now()
        });
        setAppState(prev => prev.ultraplanSessionUrl === url ? {
          ...prev,
          ultraplanSessionUrl: undefined
        } : prev);
        enqueuePendingNotification({
          value: [`Ultraplan approved — executing in Claude Code on the web. Follow along at: ${url}`, '', 'Results will land as a pull request when the remote session finishes. There is nothing to do here.'].join('\n'),
          mode: 'task-notification'
        });
      } else {
        // Teleport: set pendingChoice so REPL mounts UltraplanChoiceDialog.
        // The dialog owns archive + URL clear on choice. Guard on task status
        // so a poll that resolves after stopUltraplan doesn't resurrect the
        // dialog for a killed session.
        setAppState(prev => {
          const task = prev.tasks?.[taskId];
          if (!task || task.status !== 'running') return prev;
          return {
            ...prev,
            ultraplanPendingChoice: {
              plan,
              sessionId,
              taskId
            }
          };
        });
      }
    } catch (e) {
      // If the task was stopped (stopUltraplan sets status=killed), the poll
      // erroring is expected — skip the failure notification and cleanup
      // (kill() already archived; stopUltraplan cleared the URL).
      const task = getAppState().tasks?.[taskId];
      if (task?.status !== 'running') return;
      failed = true;
      logEvent('tengu_ultraplan_failed', {
        duration_ms: Date.now() - started,
        reason: (e instanceof UltraplanPollError ? e.reason : 'network_or_unknown') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        reject_count: e instanceof UltraplanPollError ? e.rejectCount : undefined
      });
      enqueuePendingNotification({
        value: `Ultraplan failed: ${errorMessage(e)}\n\nSession: ${url}`,
        mode: 'task-notification'
      });
      // Error path owns cleanup; teleport path defers to the dialog; remote
      // path handled its own cleanup above.
      void archiveRemoteSession(sessionId).catch(e => logForDebugging(`ultraplan archive failed: ${String(e)}`));
      setAppState(prev =>
      // Compare against this poll's URL so a newer relaunched session's
      // URL isn't cleared by a stale poll erroring out.
      prev.ultraplanSessionUrl === url ? {
        ...prev,
        ultraplanSessionUrl: undefined
      } : prev);
    } finally {
      // Remote path already set status=completed above; teleport path
      // leaves status=running so the pill shows the ultraplanPhase state
      // until UltraplanChoiceDialog completes the task after the user's
      // choice. Setting completed here would filter the task out of
      // isBackgroundTask before the pill can render the phase state.
      // Failure path has no dialog, so it owns the status transition here.
      if (failed) {
        updateTaskState<RemoteAgentTaskState>(taskId, setAppState, t => t.status !== 'running' ? t : {
          ...t,
          status: 'failed',
          endTime: Date.now()
        });
      }
    }
  })();
}

// Renders immediately so the terminal doesn't appear hung during the
// multi-second teleportToRemote round-trip.
function buildLaunchMessage(disconnectedBridge?: boolean): string {
  const prefix = disconnectedBridge ? `${REMOTE_CONTROL_DISCONNECTED_MSG} ` : '';
  return `${DIAMOND_OPEN} ultraplan\n${prefix}Starting Claude Code on the web…`;
}
function buildSessionReadyMessage(url: string): string {
  return `${DIAMOND_OPEN} ultraplan · Monitor progress in Claude Code on the web ${url}\nYou can continue working — when the ${DIAMOND_OPEN} fills, press ↓ to view results`;
}
function buildAlreadyActiveMessage(url: string | undefined): string {
  return url ? `ultraplan: already polling. Open ${url} to check status, or wait for the plan to land here.` : 'ultraplan: already launching. Please wait for the session to start.';
}

/**
 * Stop a running ultraplan: archive the remote session (halts it but keeps the
 * URL viewable), kill the local task entry (clears the pill), and clear
 * ultraplanSessionUrl (re-arms the keyword trigger). startDetachedPoll's
 * shouldStop callback sees the killed status on its next tick and throws;
 * the catch block early-returns when status !== 'running'.
 */
export async function stopUltraplan(taskId: string, sessionId: string, setAppState: (f: (prev: AppState) => AppState) => void): Promise<void> {
  // RemoteAgentTask.kill archives the session (with .catch) — no separate
  // archive call needed here.
  await RemoteAgentTask.kill(taskId, setAppState);
  setAppState(prev => prev.ultraplanSessionUrl || prev.ultraplanPendingChoice || prev.ultraplanLaunching ? {
    ...prev,
    ultraplanSessionUrl: undefined,
    ultraplanPendingChoice: undefined,
    ultraplanLaunching: undefined
  } : prev);
  const url = getRemoteSessionUrl(sessionId, process.env.SESSION_INGRESS_URL);
  enqueuePendingNotification({
    value: `Ultraplan stopped.\n\nSession: ${url}`,
    mode: 'task-notification'
  });
  enqueuePendingNotification({
    value: 'The user stopped the ultraplan session above. Do not respond to the stop notification — wait for their next message.',
    mode: 'task-notification',
    isMeta: true
  });
}

/**
 * Shared entry for the slash command, keyword trigger, and the plan-approval
 * dialog's "Ultraplan" button. When seedPlan is present (dialog path), it is
 * prepended as a draft to refine; blurb may be empty in that case.
 *
 * Resolves immediately with the user-facing message. Eligibility check,
 * session creation, and task registration run detached and failures surface via
 * enqueuePendingNotification.
 */
export async function launchUltraplan(opts: {
  blurb: string;
  seedPlan?: string;
  getAppState: () => AppState;
  setAppState: (f: (prev: AppState) => AppState) => void;
  signal: AbortSignal;
  /** True if the caller disconnected Remote Control before launching. */
  disconnectedBridge?: boolean;
  /**
   * Called once teleportToRemote resolves with a session URL. Callers that
   * have setMessages (REPL) append this as a second transcript message so the
   * URL is visible without opening the ↓ detail view. Callers without
   * transcript access (ExitPlanModePermissionRequest) omit this — the pill
   * still shows live status.
   */
  onSessionReady?: (msg: string) => void;
}): Promise<string> {
  const {
    blurb,
    seedPlan,
    getAppState,
    setAppState,
    signal,
    disconnectedBridge,
    onSessionReady
  } = opts;
  const {
    ultraplanSessionUrl: active,
    ultraplanLaunching
  } = getAppState();
  if (active || ultraplanLaunching) {
    logEvent('tengu_ultraplan_create_failed', {
      reason: (active ? 'already_polling' : 'already_launching') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    return buildAlreadyActiveMessage(active);
  }
  if (!blurb && !seedPlan) {
    // No event — bare /ultraplan is a usage query, not an attempt.
    return [
    // Rendered via <Markdown>; raw <message> is tokenized as HTML
    // and dropped. Backslash-escape the brackets.
    'Usage: /ultraplan \\<prompt\\>, or include "ultraplan" anywhere', 'in your prompt', '', 'Advanced multi-agent plan mode with our most powerful model', '(Opus). Runs in Claude Code on the web. When the plan is ready,', 'you can execute it in the web session or send it back here.', 'Terminal stays free while the remote plans.', 'Requires /login.', '', `Terms: ${CCR_TERMS_URL}`].join('\n');
  }

  // Set synchronously before the detached flow to prevent duplicate launches
  // during the teleportToRemote window.
  setAppState(prev => prev.ultraplanLaunching ? prev : {
    ...prev,
    ultraplanLaunching: true
  });
  void launchDetached({
    blurb,
    seedPlan,
    getAppState,
    setAppState,
    signal,
    onSessionReady
  });
  return buildLaunchMessage(disconnectedBridge);
}
async function launchDetached(opts: {
  blurb: string;
  seedPlan?: string;
  getAppState: () => AppState;
  setAppState: (f: (prev: AppState) => AppState) => void;
  signal: AbortSignal;
  onSessionReady?: (msg: string) => void;
}): Promise<void> {
  const {
    blurb,
    seedPlan,
    getAppState,
    setAppState,
    signal,
    onSessionReady
  } = opts;
  // Hoisted so the catch block can archive the remote session if an error
  // occurs after teleportToRemote succeeds (avoids 30min orphan).
  let sessionId: string | undefined;
  try {
    const model = getUltraplanModel();
    const eligibility = await checkRemoteAgentEligibility();
    if (!eligibility.eligible) {
      logEvent('tengu_ultraplan_create_failed', {
        reason: 'precondition' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        precondition_errors: eligibility.errors.map(e => e.type).join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      const reasons = eligibility.errors.map(formatPreconditionError).join('\n');
      enqueuePendingNotification({
        value: `ultraplan: cannot launch remote session —\n${reasons}`,
        mode: 'task-notification'
      });
      return;
    }
    const prompt = buildUltraplanPrompt(blurb, seedPlan);
    let bundleFailMsg: string | undefined;
    const session = await teleportToRemote({
      initialMessage: prompt,
      description: blurb || 'Refine local plan',
      model,
      permissionMode: 'plan',
      ultraplan: true,
      signal,
      useDefaultEnvironment: true,
      onBundleFail: msg => {
        bundleFailMsg = msg;
      }
    });
    if (!session) {
      logEvent('tengu_ultraplan_create_failed', {
        reason: (bundleFailMsg ? 'bundle_fail' : 'teleport_null') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      enqueuePendingNotification({
        value: `ultraplan: session creation failed${bundleFailMsg ? ` — ${bundleFailMsg}` : ''}. See --debug for details.`,
        mode: 'task-notification'
      });
      return;
    }
    sessionId = session.id;
    const url = getRemoteSessionUrl(session.id, process.env.SESSION_INGRESS_URL);
    setAppState(prev => ({
      ...prev,
      ultraplanSessionUrl: url,
      ultraplanLaunching: undefined
    }));
    onSessionReady?.(buildSessionReadyMessage(url));
    logEvent('tengu_ultraplan_launched', {
      has_seed_plan: Boolean(seedPlan),
      model: model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    // TODO(#23985): replace registerRemoteAgentTask + startDetachedPoll with
    // ExitPlanModeScanner inside startRemoteSessionPolling.
    const {
      taskId
    } = registerRemoteAgentTask({
      remoteTaskType: 'ultraplan',
      session: {
        id: session.id,
        title: blurb || 'Ultraplan'
      },
      command: blurb,
      context: {
        abortController: new AbortController(),
        getAppState,
        setAppState
      },
      isUltraplan: true
    });
    startDetachedPoll(taskId, session.id, url, getAppState, setAppState);
  } catch (e) {
    logError(e);
    logEvent('tengu_ultraplan_create_failed', {
      reason: 'unexpected_error' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    enqueuePendingNotification({
      value: `ultraplan: unexpected error — ${errorMessage(e)}`,
      mode: 'task-notification'
    });
    if (sessionId) {
      // Error after teleport succeeded — archive so the remote doesn't sit
      // running for 30min with nobody polling it.
      void archiveRemoteSession(sessionId).catch(err => logForDebugging('ultraplan: failed to archive orphaned session', err));
      // ultraplanSessionUrl may have been set before the throw; clear it so
      // the "already polling" guard doesn't block future launches.
      setAppState(prev => prev.ultraplanSessionUrl ? {
        ...prev,
        ultraplanSessionUrl: undefined
      } : prev);
    }
  } finally {
    // No-op on success: the url-setting setAppState already cleared this.
    setAppState(prev => prev.ultraplanLaunching ? {
      ...prev,
      ultraplanLaunching: undefined
    } : prev);
  }
}
const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const blurb = args.trim();

  // Bare /ultraplan (no args, no seed plan) just shows usage — no dialog.
  if (!blurb) {
    const msg = await launchUltraplan({
      blurb,
      getAppState: context.getAppState,
      setAppState: context.setAppState,
      signal: context.abortController.signal
    });
    onDone(msg, {
      display: 'system'
    });
    return null;
  }

  // Guard matches launchUltraplan's own check — showing the dialog when a
  // session is already active or launching would waste the user's click and set
  // hasSeenUltraplanTerms before the launch fails.
  const {
    ultraplanSessionUrl: active,
    ultraplanLaunching
  } = context.getAppState();
  if (active || ultraplanLaunching) {
    logEvent('tengu_ultraplan_create_failed', {
      reason: (active ? 'already_polling' : 'already_launching') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    onDone(buildAlreadyActiveMessage(active), {
      display: 'system'
    });
    return null;
  }

  // Mount the pre-launch dialog via focusedInputDialog (bottom region, like
  // permission dialogs) rather than returning JSX (transcript area, anchors
  // at top of scrollback). REPL.tsx handles launch/clear/cancel on choice.
  context.setAppState(prev => ({
    ...prev,
    ultraplanLaunchPending: {
      blurb
    }
  }));
  // 'skip' suppresses the (no content) echo — the dialog's choice handler
  // adds the real /ultraplan echo + launch confirmation.
  onDone(undefined, {
    display: 'skip'
  });
  return null;
};
export default {
  type: 'local-jsx',
  name: 'ultraplan',
  description: `~10–30 min · Claude Code on the web drafts an advanced plan you can edit and approve. See ${CCR_TERMS_URL}`,
  argumentHint: '<prompt>',
  isEnabled: () => "external" === 'ant',
  load: () => Promise.resolve({
    call
  })
} satisfies Command;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJyZWFkRmlsZVN5bmMiLCJSRU1PVEVfQ09OVFJPTF9ESVNDT05ORUNURURfTVNHIiwiQ29tbWFuZCIsIkRJQU1PTkRfT1BFTiIsImdldFJlbW90ZVNlc3Npb25VcmwiLCJnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIkFwcFN0YXRlIiwiY2hlY2tSZW1vdGVBZ2VudEVsaWdpYmlsaXR5IiwiZm9ybWF0UHJlY29uZGl0aW9uRXJyb3IiLCJSZW1vdGVBZ2VudFRhc2siLCJSZW1vdGVBZ2VudFRhc2tTdGF0ZSIsInJlZ2lzdGVyUmVtb3RlQWdlbnRUYXNrIiwiTG9jYWxKU1hDb21tYW5kQ2FsbCIsImxvZ0ZvckRlYnVnZ2luZyIsImVycm9yTWVzc2FnZSIsImxvZ0Vycm9yIiwiZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24iLCJBTExfTU9ERUxfQ09ORklHUyIsInVwZGF0ZVRhc2tTdGF0ZSIsImFyY2hpdmVSZW1vdGVTZXNzaW9uIiwidGVsZXBvcnRUb1JlbW90ZSIsInBvbGxGb3JBcHByb3ZlZEV4aXRQbGFuTW9kZSIsIlVsdHJhcGxhblBvbGxFcnJvciIsIlVMVFJBUExBTl9USU1FT1VUX01TIiwiQ0NSX1RFUk1TX1VSTCIsImdldFVsdHJhcGxhbk1vZGVsIiwib3B1czQ2IiwiZmlyc3RQYXJ0eSIsIl9yYXdQcm9tcHQiLCJyZXF1aXJlIiwiREVGQVVMVF9JTlNUUlVDVElPTlMiLCJkZWZhdWx0IiwidHJpbUVuZCIsIlVMVFJBUExBTl9JTlNUUlVDVElPTlMiLCJwcm9jZXNzIiwiZW52IiwiVUxUUkFQTEFOX1BST01QVF9GSUxFIiwiYnVpbGRVbHRyYXBsYW5Qcm9tcHQiLCJibHVyYiIsInNlZWRQbGFuIiwicGFydHMiLCJwdXNoIiwiam9pbiIsInN0YXJ0RGV0YWNoZWRQb2xsIiwidGFza0lkIiwic2Vzc2lvbklkIiwidXJsIiwiZ2V0QXBwU3RhdGUiLCJzZXRBcHBTdGF0ZSIsImYiLCJwcmV2Iiwic3RhcnRlZCIsIkRhdGUiLCJub3ciLCJmYWlsZWQiLCJwbGFuIiwicmVqZWN0Q291bnQiLCJleGVjdXRpb25UYXJnZXQiLCJwaGFzZSIsInQiLCJzdGF0dXMiLCJuZXh0IiwidW5kZWZpbmVkIiwidWx0cmFwbGFuUGhhc2UiLCJ0YXNrcyIsImR1cmF0aW9uX21zIiwicGxhbl9sZW5ndGgiLCJsZW5ndGgiLCJyZWplY3RfY291bnQiLCJleGVjdXRpb25fdGFyZ2V0IiwidGFzayIsImVuZFRpbWUiLCJ1bHRyYXBsYW5TZXNzaW9uVXJsIiwidmFsdWUiLCJtb2RlIiwidWx0cmFwbGFuUGVuZGluZ0Nob2ljZSIsImUiLCJyZWFzb24iLCJjYXRjaCIsIlN0cmluZyIsImJ1aWxkTGF1bmNoTWVzc2FnZSIsImRpc2Nvbm5lY3RlZEJyaWRnZSIsInByZWZpeCIsImJ1aWxkU2Vzc2lvblJlYWR5TWVzc2FnZSIsImJ1aWxkQWxyZWFkeUFjdGl2ZU1lc3NhZ2UiLCJzdG9wVWx0cmFwbGFuIiwiUHJvbWlzZSIsImtpbGwiLCJ1bHRyYXBsYW5MYXVuY2hpbmciLCJTRVNTSU9OX0lOR1JFU1NfVVJMIiwiaXNNZXRhIiwibGF1bmNoVWx0cmFwbGFuIiwib3B0cyIsInNpZ25hbCIsIkFib3J0U2lnbmFsIiwib25TZXNzaW9uUmVhZHkiLCJtc2ciLCJhY3RpdmUiLCJsYXVuY2hEZXRhY2hlZCIsIm1vZGVsIiwiZWxpZ2liaWxpdHkiLCJlbGlnaWJsZSIsInByZWNvbmRpdGlvbl9lcnJvcnMiLCJlcnJvcnMiLCJtYXAiLCJ0eXBlIiwicmVhc29ucyIsInByb21wdCIsImJ1bmRsZUZhaWxNc2ciLCJzZXNzaW9uIiwiaW5pdGlhbE1lc3NhZ2UiLCJkZXNjcmlwdGlvbiIsInBlcm1pc3Npb25Nb2RlIiwidWx0cmFwbGFuIiwidXNlRGVmYXVsdEVudmlyb25tZW50Iiwib25CdW5kbGVGYWlsIiwiaWQiLCJoYXNfc2VlZF9wbGFuIiwiQm9vbGVhbiIsInJlbW90ZVRhc2tUeXBlIiwidGl0bGUiLCJjb21tYW5kIiwiY29udGV4dCIsImFib3J0Q29udHJvbGxlciIsIkFib3J0Q29udHJvbGxlciIsImlzVWx0cmFwbGFuIiwiZXJyIiwiY2FsbCIsIm9uRG9uZSIsImFyZ3MiLCJ0cmltIiwiZGlzcGxheSIsInVsdHJhcGxhbkxhdW5jaFBlbmRpbmciLCJuYW1lIiwiYXJndW1lbnRIaW50IiwiaXNFbmFibGVkIiwibG9hZCIsInJlc29sdmUiXSwic291cmNlcyI6WyJ1bHRyYXBsYW4udHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJ1xuaW1wb3J0IHsgUkVNT1RFX0NPTlRST0xfRElTQ09OTkVDVEVEX01TRyB9IGZyb20gJy4uL2JyaWRnZS90eXBlcy5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZCB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgRElBTU9ORF9PUEVOIH0gZnJvbSAnLi4vY29uc3RhbnRzL2ZpZ3VyZXMuanMnXG5pbXBvcnQgeyBnZXRSZW1vdGVTZXNzaW9uVXJsIH0gZnJvbSAnLi4vY29uc3RhbnRzL3Byb2R1Y3QuanMnXG5pbXBvcnQgeyBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSB9IGZyb20gJy4uL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnLi4vc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHR5cGUgeyBBcHBTdGF0ZSB9IGZyb20gJy4uL3N0YXRlL0FwcFN0YXRlU3RvcmUuanMnXG5pbXBvcnQge1xuICBjaGVja1JlbW90ZUFnZW50RWxpZ2liaWxpdHksXG4gIGZvcm1hdFByZWNvbmRpdGlvbkVycm9yLFxuICBSZW1vdGVBZ2VudFRhc2ssXG4gIHR5cGUgUmVtb3RlQWdlbnRUYXNrU3RhdGUsXG4gIHJlZ2lzdGVyUmVtb3RlQWdlbnRUYXNrLFxufSBmcm9tICcuLi90YXNrcy9SZW1vdGVBZ2VudFRhc2svUmVtb3RlQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHR5cGUgeyBMb2NhbEpTWENvbW1hbmRDYWxsIH0gZnJvbSAnLi4vdHlwZXMvY29tbWFuZC5qcydcbmltcG9ydCB7IGxvZ0ZvckRlYnVnZ2luZyB9IGZyb20gJy4uL3V0aWxzL2RlYnVnLmpzJ1xuaW1wb3J0IHsgZXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2cuanMnXG5pbXBvcnQgeyBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiB9IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VRdWV1ZU1hbmFnZXIuanMnXG5pbXBvcnQgeyBBTExfTU9ERUxfQ09ORklHUyB9IGZyb20gJy4uL3V0aWxzL21vZGVsL2NvbmZpZ3MuanMnXG5pbXBvcnQgeyB1cGRhdGVUYXNrU3RhdGUgfSBmcm9tICcuLi91dGlscy90YXNrL2ZyYW1ld29yay5qcydcbmltcG9ydCB7IGFyY2hpdmVSZW1vdGVTZXNzaW9uLCB0ZWxlcG9ydFRvUmVtb3RlIH0gZnJvbSAnLi4vdXRpbHMvdGVsZXBvcnQuanMnXG5pbXBvcnQge1xuICBwb2xsRm9yQXBwcm92ZWRFeGl0UGxhbk1vZGUsXG4gIFVsdHJhcGxhblBvbGxFcnJvcixcbn0gZnJvbSAnLi4vdXRpbHMvdWx0cmFwbGFuL2NjclNlc3Npb24uanMnXG5cbi8vIFRPRE8ocHJvZC1oYXJkZW5pbmcpOiBPQXV0aCB0b2tlbiBtYXkgZ28gc3RhbGUgb3ZlciB0aGUgMzBtaW4gcG9sbDtcbi8vIGNvbnNpZGVyIHJlZnJlc2guXG5cbi8vIE11bHRpLWFnZW50IGV4cGxvcmF0aW9uIGlzIHNsb3c7IDMwbWluIHRpbWVvdXQuXG5jb25zdCBVTFRSQVBMQU5fVElNRU9VVF9NUyA9IDMwICogNjAgKiAxMDAwXG5cbmV4cG9ydCBjb25zdCBDQ1JfVEVSTVNfVVJMID1cbiAgJ2h0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vY2xhdWRlLWNvZGUtb24tdGhlLXdlYidcblxuLy8gQ0NSIHJ1bnMgYWdhaW5zdCB0aGUgZmlyc3QtcGFydHkgQVBJIOKAlCB1c2UgdGhlIGNhbm9uaWNhbCBJRCwgbm90IHRoZVxuLy8gcHJvdmlkZXItc3BlY2lmaWMgc3RyaW5nIGdldE1vZGVsU3RyaW5ncygpIHdvdWxkIHJldHVybiAod2hpY2ggbWF5IGJlIGFcbi8vIEJlZHJvY2sgQVJOIG9yIFZlcnRleCBJRCBvbiB0aGUgbG9jYWwgQ0xJKS4gUmVhZCBhdCBjYWxsIHRpbWUsIG5vdCBtb2R1bGVcbi8vIGxvYWQ6IHRoZSBHcm93dGhCb29rIGNhY2hlIGlzIGVtcHR5IGF0IGltcG9ydCBhbmQgYC9jb25maWdgIEdhdGVzIGNhbiBmbGlwXG4vLyBpdCBiZXR3ZWVuIGludm9jYXRpb25zLlxuZnVuY3Rpb24gZ2V0VWx0cmFwbGFuTW9kZWwoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFKFxuICAgICd0ZW5ndV91bHRyYXBsYW5fbW9kZWwnLFxuICAgIEFMTF9NT0RFTF9DT05GSUdTLm9wdXM0Ni5maXJzdFBhcnR5LFxuICApXG59XG5cbi8vIHByb21wdC50eHQgaXMgd3JhcHBlZCBpbiA8c3lzdGVtLXJlbWluZGVyPiBzbyB0aGUgQ0NSIGJyb3dzZXIgaGlkZXNcbi8vIHNjYWZmb2xkaW5nIChDTElfQkxPQ0tfVEFHUyBkcm9wcGVkIGJ5IHN0cmlwU3lzdGVtTm90aWZpY2F0aW9ucylcbi8vIHdoaWxlIHRoZSBtb2RlbCBzdGlsbCBzZWVzIGZ1bGwgdGV4dC5cbi8vIFBocmFzaW5nIGRlbGliZXJhdGVseSBhdm9pZHMgdGhlIGZlYXR1cmUgbmFtZSBiZWNhdXNlXG4vLyB0aGUgcmVtb3RlIENDUiBDTEkgcnVucyBrZXl3b3JkIGRldGVjdGlvbiBvbiByYXcgaW5wdXQgYmVmb3JlXG4vLyBhbnkgdGFnIHN0cmlwcGluZywgYW5kIGEgYmFyZSBcInVsdHJhcGxhblwiIGluIHRoZSBwcm9tcHQgd291bGQgc2VsZi10cmlnZ2VyIGFzXG4vLyAvdWx0cmFwbGFuLCB3aGljaCBpcyBmaWx0ZXJlZCBvdXQgb2YgaGVhZGxlc3MgbW9kZSBhcyBcIlVua25vd24gc2tpbGxcIlxuLy9cbi8vIEJ1bmRsZXIgaW5saW5lcyAudHh0IGFzIGEgc3RyaW5nOyB0aGUgdGVzdCBydW5uZXIgd3JhcHMgaXQgYXMge2RlZmF1bHR9LlxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgX3Jhd1Byb21wdCA9IHJlcXVpcmUoJy4uL3V0aWxzL3VsdHJhcGxhbi9wcm9tcHQudHh0Jylcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgREVGQVVMVF9JTlNUUlVDVElPTlM6IHN0cmluZyA9IChcbiAgdHlwZW9mIF9yYXdQcm9tcHQgPT09ICdzdHJpbmcnID8gX3Jhd1Byb21wdCA6IF9yYXdQcm9tcHQuZGVmYXVsdFxuKS50cmltRW5kKClcblxuLy8gRGV2LW9ubHkgcHJvbXB0IG92ZXJyaWRlIHJlc29sdmVkIGVhZ2VybHkgYXQgbW9kdWxlIGxvYWQuXG4vLyBHYXRlZCB0byBhbnQgYnVpbGRzIChVU0VSX1RZUEUgaXMgYSBidWlsZC10aW1lIGRlZmluZSxcbi8vIHNvIHRoZSBvdmVycmlkZSBwYXRoIGlzIERDRSdkIGZyb20gZXh0ZXJuYWwgYnVpbGRzKS5cbi8vIFNoZWxsLXNldCBlbnYgb25seSwgc28gdG9wLWxldmVsIHByb2Nlc3MuZW52IHJlYWQgaXMgZmluZVxuLy8g4oCUIHNldHRpbmdzLmVudiBuZXZlciBpbmplY3RzIHRoaXMuXG4vKiBlc2xpbnQtZGlzYWJsZSBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsLCBjdXN0b20tcnVsZXMvbm8tc3luYy1mcyAtLSBhbnQtb25seSBkZXYgb3ZlcnJpZGU7IGVhZ2VyIHRvcC1sZXZlbCByZWFkIGlzIHRoZSBwb2ludCAoY3Jhc2ggYXQgc3RhcnR1cCwgbm90IHNpbGVudGx5IGluc2lkZSB0aGUgc2xhc2gtY29tbWFuZCB0cnkvY2F0Y2gpICovXG5jb25zdCBVTFRSQVBMQU5fSU5TVFJVQ1RJT05TOiBzdHJpbmcgPVxuICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIHByb2Nlc3MuZW52LlVMVFJBUExBTl9QUk9NUFRfRklMRVxuICAgID8gcmVhZEZpbGVTeW5jKHByb2Nlc3MuZW52LlVMVFJBUExBTl9QUk9NUFRfRklMRSwgJ3V0ZjgnKS50cmltRW5kKClcbiAgICA6IERFRkFVTFRfSU5TVFJVQ1RJT05TXG4vKiBlc2xpbnQtZW5hYmxlIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWVudi10b3AtbGV2ZWwsIGN1c3RvbS1ydWxlcy9uby1zeW5jLWZzICovXG5cbi8qKlxuICogQXNzZW1ibGUgdGhlIGluaXRpYWwgQ0NSIHVzZXIgbWVzc2FnZS4gc2VlZFBsYW4gYW5kIGJsdXJiIHN0YXkgb3V0c2lkZSB0aGVcbiAqIHN5c3RlbS1yZW1pbmRlciBzbyB0aGUgYnJvd3NlciByZW5kZXJzIHRoZW07IHNjYWZmb2xkaW5nIGlzIGhpZGRlbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVWx0cmFwbGFuUHJvbXB0KGJsdXJiOiBzdHJpbmcsIHNlZWRQbGFuPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW11cbiAgaWYgKHNlZWRQbGFuKSB7XG4gICAgcGFydHMucHVzaCgnSGVyZSBpcyBhIGRyYWZ0IHBsYW4gdG8gcmVmaW5lOicsICcnLCBzZWVkUGxhbiwgJycpXG4gIH1cbiAgcGFydHMucHVzaChVTFRSQVBMQU5fSU5TVFJVQ1RJT05TKVxuICBpZiAoYmx1cmIpIHtcbiAgICBwYXJ0cy5wdXNoKCcnLCBibHVyYilcbiAgfVxuICByZXR1cm4gcGFydHMuam9pbignXFxuJylcbn1cblxuZnVuY3Rpb24gc3RhcnREZXRhY2hlZFBvbGwoXG4gIHRhc2tJZDogc3RyaW5nLFxuICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgdXJsOiBzdHJpbmcsXG4gIGdldEFwcFN0YXRlOiAoKSA9PiBBcHBTdGF0ZSxcbiAgc2V0QXBwU3RhdGU6IChmOiAocHJldjogQXBwU3RhdGUpID0+IEFwcFN0YXRlKSA9PiB2b2lkLFxuKTogdm9pZCB7XG4gIGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpXG4gIGxldCBmYWlsZWQgPSBmYWxzZVxuICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgcGxhbiwgcmVqZWN0Q291bnQsIGV4ZWN1dGlvblRhcmdldCB9ID1cbiAgICAgICAgYXdhaXQgcG9sbEZvckFwcHJvdmVkRXhpdFBsYW5Nb2RlKFxuICAgICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgICBVTFRSQVBMQU5fVElNRU9VVF9NUyxcbiAgICAgICAgICBwaGFzZSA9PiB7XG4gICAgICAgICAgICBpZiAocGhhc2UgPT09ICduZWVkc19pbnB1dCcpXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fYXdhaXRpbmdfaW5wdXQnLCB7fSlcbiAgICAgICAgICAgIHVwZGF0ZVRhc2tTdGF0ZTxSZW1vdGVBZ2VudFRhc2tTdGF0ZT4odGFza0lkLCBzZXRBcHBTdGF0ZSwgdCA9PiB7XG4gICAgICAgICAgICAgIGlmICh0LnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSByZXR1cm4gdFxuICAgICAgICAgICAgICBjb25zdCBuZXh0ID0gcGhhc2UgPT09ICdydW5uaW5nJyA/IHVuZGVmaW5lZCA6IHBoYXNlXG4gICAgICAgICAgICAgIHJldHVybiB0LnVsdHJhcGxhblBoYXNlID09PSBuZXh0XG4gICAgICAgICAgICAgICAgPyB0XG4gICAgICAgICAgICAgICAgOiB7IC4uLnQsIHVsdHJhcGxhblBoYXNlOiBuZXh0IH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoKSA9PiBnZXRBcHBTdGF0ZSgpLnRhc2tzPy5bdGFza0lkXT8uc3RhdHVzICE9PSAncnVubmluZycsXG4gICAgICAgIClcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fYXBwcm92ZWQnLCB7XG4gICAgICAgIGR1cmF0aW9uX21zOiBEYXRlLm5vdygpIC0gc3RhcnRlZCxcbiAgICAgICAgcGxhbl9sZW5ndGg6IHBsYW4ubGVuZ3RoLFxuICAgICAgICByZWplY3RfY291bnQ6IHJlamVjdENvdW50LFxuICAgICAgICBleGVjdXRpb25fdGFyZ2V0OlxuICAgICAgICAgIGV4ZWN1dGlvblRhcmdldCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICAgIGlmIChleGVjdXRpb25UYXJnZXQgPT09ICdyZW1vdGUnKSB7XG4gICAgICAgIC8vIFVzZXIgY2hvc2UgXCJleGVjdXRlIGluIENDUlwiIGluIHRoZSBicm93c2VyIFBsYW5Nb2RhbCDigJQgdGhlIHJlbW90ZVxuICAgICAgICAvLyBzZXNzaW9uIGlzIG5vdyBjb2RpbmcuIFNraXAgYXJjaGl2ZSAoQVJDSElWRSBoYXMgbm8gcnVubmluZy1jaGVjayxcbiAgICAgICAgLy8gd291bGQga2lsbCBtaWQtZXhlY3V0aW9uKSBhbmQgc2tpcCB0aGUgY2hvaWNlIGRpYWxvZyAoYWxyZWFkeSBjaG9zZSkuXG4gICAgICAgIC8vIEd1YXJkIG9uIHRhc2sgc3RhdHVzIHNvIGEgcG9sbCB0aGF0IHJlc29sdmVzIGFmdGVyIHN0b3BVbHRyYXBsYW5cbiAgICAgICAgLy8gZG9lc24ndCBub3RpZnkgZm9yIGEga2lsbGVkIHNlc3Npb24uXG4gICAgICAgIGNvbnN0IHRhc2sgPSBnZXRBcHBTdGF0ZSgpLnRhc2tzPy5bdGFza0lkXVxuICAgICAgICBpZiAodGFzaz8uc3RhdHVzICE9PSAncnVubmluZycpIHJldHVyblxuICAgICAgICB1cGRhdGVUYXNrU3RhdGU8UmVtb3RlQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHQgPT5cbiAgICAgICAgICB0LnN0YXR1cyAhPT0gJ3J1bm5pbmcnXG4gICAgICAgICAgICA/IHRcbiAgICAgICAgICAgIDogeyAuLi50LCBzdGF0dXM6ICdjb21wbGV0ZWQnLCBlbmRUaW1lOiBEYXRlLm5vdygpIH0sXG4gICAgICAgIClcbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PlxuICAgICAgICAgIHByZXYudWx0cmFwbGFuU2Vzc2lvblVybCA9PT0gdXJsXG4gICAgICAgICAgICA/IHsgLi4ucHJldiwgdWx0cmFwbGFuU2Vzc2lvblVybDogdW5kZWZpbmVkIH1cbiAgICAgICAgICAgIDogcHJldixcbiAgICAgICAgKVxuICAgICAgICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7XG4gICAgICAgICAgdmFsdWU6IFtcbiAgICAgICAgICAgIGBVbHRyYXBsYW4gYXBwcm92ZWQg4oCUIGV4ZWN1dGluZyBpbiBDbGF1ZGUgQ29kZSBvbiB0aGUgd2ViLiBGb2xsb3cgYWxvbmcgYXQ6ICR7dXJsfWAsXG4gICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICdSZXN1bHRzIHdpbGwgbGFuZCBhcyBhIHB1bGwgcmVxdWVzdCB3aGVuIHRoZSByZW1vdGUgc2Vzc2lvbiBmaW5pc2hlcy4gVGhlcmUgaXMgbm90aGluZyB0byBkbyBoZXJlLicsXG4gICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nLFxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGVsZXBvcnQ6IHNldCBwZW5kaW5nQ2hvaWNlIHNvIFJFUEwgbW91bnRzIFVsdHJhcGxhbkNob2ljZURpYWxvZy5cbiAgICAgICAgLy8gVGhlIGRpYWxvZyBvd25zIGFyY2hpdmUgKyBVUkwgY2xlYXIgb24gY2hvaWNlLiBHdWFyZCBvbiB0YXNrIHN0YXR1c1xuICAgICAgICAvLyBzbyBhIHBvbGwgdGhhdCByZXNvbHZlcyBhZnRlciBzdG9wVWx0cmFwbGFuIGRvZXNuJ3QgcmVzdXJyZWN0IHRoZVxuICAgICAgICAvLyBkaWFsb2cgZm9yIGEga2lsbGVkIHNlc3Npb24uXG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhc2sgPSBwcmV2LnRhc2tzPy5bdGFza0lkXVxuICAgICAgICAgIGlmICghdGFzayB8fCB0YXNrLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSByZXR1cm4gcHJldlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgdWx0cmFwbGFuUGVuZGluZ0Nob2ljZTogeyBwbGFuLCBzZXNzaW9uSWQsIHRhc2tJZCB9LFxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBJZiB0aGUgdGFzayB3YXMgc3RvcHBlZCAoc3RvcFVsdHJhcGxhbiBzZXRzIHN0YXR1cz1raWxsZWQpLCB0aGUgcG9sbFxuICAgICAgLy8gZXJyb3JpbmcgaXMgZXhwZWN0ZWQg4oCUIHNraXAgdGhlIGZhaWx1cmUgbm90aWZpY2F0aW9uIGFuZCBjbGVhbnVwXG4gICAgICAvLyAoa2lsbCgpIGFscmVhZHkgYXJjaGl2ZWQ7IHN0b3BVbHRyYXBsYW4gY2xlYXJlZCB0aGUgVVJMKS5cbiAgICAgIGNvbnN0IHRhc2sgPSBnZXRBcHBTdGF0ZSgpLnRhc2tzPy5bdGFza0lkXVxuICAgICAgaWYgKHRhc2s/LnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSByZXR1cm5cbiAgICAgIGZhaWxlZCA9IHRydWVcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fZmFpbGVkJywge1xuICAgICAgICBkdXJhdGlvbl9tczogRGF0ZS5ub3coKSAtIHN0YXJ0ZWQsXG4gICAgICAgIHJlYXNvbjogKGUgaW5zdGFuY2VvZiBVbHRyYXBsYW5Qb2xsRXJyb3JcbiAgICAgICAgICA/IGUucmVhc29uXG4gICAgICAgICAgOiAnbmV0d29ya19vcl91bmtub3duJykgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgcmVqZWN0X2NvdW50OlxuICAgICAgICAgIGUgaW5zdGFuY2VvZiBVbHRyYXBsYW5Qb2xsRXJyb3IgPyBlLnJlamVjdENvdW50IDogdW5kZWZpbmVkLFxuICAgICAgfSlcbiAgICAgIGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uKHtcbiAgICAgICAgdmFsdWU6IGBVbHRyYXBsYW4gZmFpbGVkOiAke2Vycm9yTWVzc2FnZShlKX1cXG5cXG5TZXNzaW9uOiAke3VybH1gLFxuICAgICAgICBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nLFxuICAgICAgfSlcbiAgICAgIC8vIEVycm9yIHBhdGggb3ducyBjbGVhbnVwOyB0ZWxlcG9ydCBwYXRoIGRlZmVycyB0byB0aGUgZGlhbG9nOyByZW1vdGVcbiAgICAgIC8vIHBhdGggaGFuZGxlZCBpdHMgb3duIGNsZWFudXAgYWJvdmUuXG4gICAgICB2b2lkIGFyY2hpdmVSZW1vdGVTZXNzaW9uKHNlc3Npb25JZCkuY2F0Y2goZSA9PlxuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYHVsdHJhcGxhbiBhcmNoaXZlIGZhaWxlZDogJHtTdHJpbmcoZSl9YCksXG4gICAgICApXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICAgIC8vIENvbXBhcmUgYWdhaW5zdCB0aGlzIHBvbGwncyBVUkwgc28gYSBuZXdlciByZWxhdW5jaGVkIHNlc3Npb24nc1xuICAgICAgICAvLyBVUkwgaXNuJ3QgY2xlYXJlZCBieSBhIHN0YWxlIHBvbGwgZXJyb3Jpbmcgb3V0LlxuICAgICAgICBwcmV2LnVsdHJhcGxhblNlc3Npb25VcmwgPT09IHVybFxuICAgICAgICAgID8geyAuLi5wcmV2LCB1bHRyYXBsYW5TZXNzaW9uVXJsOiB1bmRlZmluZWQgfVxuICAgICAgICAgIDogcHJldixcbiAgICAgIClcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gUmVtb3RlIHBhdGggYWxyZWFkeSBzZXQgc3RhdHVzPWNvbXBsZXRlZCBhYm92ZTsgdGVsZXBvcnQgcGF0aFxuICAgICAgLy8gbGVhdmVzIHN0YXR1cz1ydW5uaW5nIHNvIHRoZSBwaWxsIHNob3dzIHRoZSB1bHRyYXBsYW5QaGFzZSBzdGF0ZVxuICAgICAgLy8gdW50aWwgVWx0cmFwbGFuQ2hvaWNlRGlhbG9nIGNvbXBsZXRlcyB0aGUgdGFzayBhZnRlciB0aGUgdXNlcidzXG4gICAgICAvLyBjaG9pY2UuIFNldHRpbmcgY29tcGxldGVkIGhlcmUgd291bGQgZmlsdGVyIHRoZSB0YXNrIG91dCBvZlxuICAgICAgLy8gaXNCYWNrZ3JvdW5kVGFzayBiZWZvcmUgdGhlIHBpbGwgY2FuIHJlbmRlciB0aGUgcGhhc2Ugc3RhdGUuXG4gICAgICAvLyBGYWlsdXJlIHBhdGggaGFzIG5vIGRpYWxvZywgc28gaXQgb3ducyB0aGUgc3RhdHVzIHRyYW5zaXRpb24gaGVyZS5cbiAgICAgIGlmIChmYWlsZWQpIHtcbiAgICAgICAgdXBkYXRlVGFza1N0YXRlPFJlbW90ZUFnZW50VGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0ID0+XG4gICAgICAgICAgdC5zdGF0dXMgIT09ICdydW5uaW5nJ1xuICAgICAgICAgICAgPyB0XG4gICAgICAgICAgICA6IHsgLi4udCwgc3RhdHVzOiAnZmFpbGVkJywgZW5kVGltZTogRGF0ZS5ub3coKSB9LFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICB9KSgpXG59XG5cbi8vIFJlbmRlcnMgaW1tZWRpYXRlbHkgc28gdGhlIHRlcm1pbmFsIGRvZXNuJ3QgYXBwZWFyIGh1bmcgZHVyaW5nIHRoZVxuLy8gbXVsdGktc2Vjb25kIHRlbGVwb3J0VG9SZW1vdGUgcm91bmQtdHJpcC5cbmZ1bmN0aW9uIGJ1aWxkTGF1bmNoTWVzc2FnZShkaXNjb25uZWN0ZWRCcmlkZ2U/OiBib29sZWFuKTogc3RyaW5nIHtcbiAgY29uc3QgcHJlZml4ID0gZGlzY29ubmVjdGVkQnJpZGdlID8gYCR7UkVNT1RFX0NPTlRST0xfRElTQ09OTkVDVEVEX01TR30gYCA6ICcnXG4gIHJldHVybiBgJHtESUFNT05EX09QRU59IHVsdHJhcGxhblxcbiR7cHJlZml4fVN0YXJ0aW5nIENsYXVkZSBDb2RlIG9uIHRoZSB3ZWLigKZgXG59XG5cbmZ1bmN0aW9uIGJ1aWxkU2Vzc2lvblJlYWR5TWVzc2FnZSh1cmw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtESUFNT05EX09QRU59IHVsdHJhcGxhbiDCtyBNb25pdG9yIHByb2dyZXNzIGluIENsYXVkZSBDb2RlIG9uIHRoZSB3ZWIgJHt1cmx9XFxuWW91IGNhbiBjb250aW51ZSB3b3JraW5nIOKAlCB3aGVuIHRoZSAke0RJQU1PTkRfT1BFTn0gZmlsbHMsIHByZXNzIOKGkyB0byB2aWV3IHJlc3VsdHNgXG59XG5cbmZ1bmN0aW9uIGJ1aWxkQWxyZWFkeUFjdGl2ZU1lc3NhZ2UodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICByZXR1cm4gdXJsXG4gICAgPyBgdWx0cmFwbGFuOiBhbHJlYWR5IHBvbGxpbmcuIE9wZW4gJHt1cmx9IHRvIGNoZWNrIHN0YXR1cywgb3Igd2FpdCBmb3IgdGhlIHBsYW4gdG8gbGFuZCBoZXJlLmBcbiAgICA6ICd1bHRyYXBsYW46IGFscmVhZHkgbGF1bmNoaW5nLiBQbGVhc2Ugd2FpdCBmb3IgdGhlIHNlc3Npb24gdG8gc3RhcnQuJ1xufVxuXG4vKipcbiAqIFN0b3AgYSBydW5uaW5nIHVsdHJhcGxhbjogYXJjaGl2ZSB0aGUgcmVtb3RlIHNlc3Npb24gKGhhbHRzIGl0IGJ1dCBrZWVwcyB0aGVcbiAqIFVSTCB2aWV3YWJsZSksIGtpbGwgdGhlIGxvY2FsIHRhc2sgZW50cnkgKGNsZWFycyB0aGUgcGlsbCksIGFuZCBjbGVhclxuICogdWx0cmFwbGFuU2Vzc2lvblVybCAocmUtYXJtcyB0aGUga2V5d29yZCB0cmlnZ2VyKS4gc3RhcnREZXRhY2hlZFBvbGwnc1xuICogc2hvdWxkU3RvcCBjYWxsYmFjayBzZWVzIHRoZSBraWxsZWQgc3RhdHVzIG9uIGl0cyBuZXh0IHRpY2sgYW5kIHRocm93cztcbiAqIHRoZSBjYXRjaCBibG9jayBlYXJseS1yZXR1cm5zIHdoZW4gc3RhdHVzICE9PSAncnVubmluZycuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdG9wVWx0cmFwbGFuKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgc2Vzc2lvbklkOiBzdHJpbmcsXG4gIHNldEFwcFN0YXRlOiAoZjogKHByZXY6IEFwcFN0YXRlKSA9PiBBcHBTdGF0ZSkgPT4gdm9pZCxcbik6IFByb21pc2U8dm9pZD4ge1xuICAvLyBSZW1vdGVBZ2VudFRhc2sua2lsbCBhcmNoaXZlcyB0aGUgc2Vzc2lvbiAod2l0aCAuY2F0Y2gpIOKAlCBubyBzZXBhcmF0ZVxuICAvLyBhcmNoaXZlIGNhbGwgbmVlZGVkIGhlcmUuXG4gIGF3YWl0IFJlbW90ZUFnZW50VGFzay5raWxsKHRhc2tJZCwgc2V0QXBwU3RhdGUpXG4gIHNldEFwcFN0YXRlKHByZXYgPT5cbiAgICBwcmV2LnVsdHJhcGxhblNlc3Npb25VcmwgfHxcbiAgICBwcmV2LnVsdHJhcGxhblBlbmRpbmdDaG9pY2UgfHxcbiAgICBwcmV2LnVsdHJhcGxhbkxhdW5jaGluZ1xuICAgICAgPyB7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB1bHRyYXBsYW5TZXNzaW9uVXJsOiB1bmRlZmluZWQsXG4gICAgICAgICAgdWx0cmFwbGFuUGVuZGluZ0Nob2ljZTogdW5kZWZpbmVkLFxuICAgICAgICAgIHVsdHJhcGxhbkxhdW5jaGluZzogdW5kZWZpbmVkLFxuICAgICAgICB9XG4gICAgICA6IHByZXYsXG4gIClcbiAgY29uc3QgdXJsID0gZ2V0UmVtb3RlU2Vzc2lvblVybChzZXNzaW9uSWQsIHByb2Nlc3MuZW52LlNFU1NJT05fSU5HUkVTU19VUkwpXG4gIGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uKHtcbiAgICB2YWx1ZTogYFVsdHJhcGxhbiBzdG9wcGVkLlxcblxcblNlc3Npb246ICR7dXJsfWAsXG4gICAgbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyxcbiAgfSlcbiAgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24oe1xuICAgIHZhbHVlOlxuICAgICAgJ1RoZSB1c2VyIHN0b3BwZWQgdGhlIHVsdHJhcGxhbiBzZXNzaW9uIGFib3ZlLiBEbyBub3QgcmVzcG9uZCB0byB0aGUgc3RvcCBub3RpZmljYXRpb24g4oCUIHdhaXQgZm9yIHRoZWlyIG5leHQgbWVzc2FnZS4nLFxuICAgIG1vZGU6ICd0YXNrLW5vdGlmaWNhdGlvbicsXG4gICAgaXNNZXRhOiB0cnVlLFxuICB9KVxufVxuXG4vKipcbiAqIFNoYXJlZCBlbnRyeSBmb3IgdGhlIHNsYXNoIGNvbW1hbmQsIGtleXdvcmQgdHJpZ2dlciwgYW5kIHRoZSBwbGFuLWFwcHJvdmFsXG4gKiBkaWFsb2cncyBcIlVsdHJhcGxhblwiIGJ1dHRvbi4gV2hlbiBzZWVkUGxhbiBpcyBwcmVzZW50IChkaWFsb2cgcGF0aCksIGl0IGlzXG4gKiBwcmVwZW5kZWQgYXMgYSBkcmFmdCB0byByZWZpbmU7IGJsdXJiIG1heSBiZSBlbXB0eSBpbiB0aGF0IGNhc2UuXG4gKlxuICogUmVzb2x2ZXMgaW1tZWRpYXRlbHkgd2l0aCB0aGUgdXNlci1mYWNpbmcgbWVzc2FnZS4gRWxpZ2liaWxpdHkgY2hlY2ssXG4gKiBzZXNzaW9uIGNyZWF0aW9uLCBhbmQgdGFzayByZWdpc3RyYXRpb24gcnVuIGRldGFjaGVkIGFuZCBmYWlsdXJlcyBzdXJmYWNlIHZpYVxuICogZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsYXVuY2hVbHRyYXBsYW4ob3B0czoge1xuICBibHVyYjogc3RyaW5nXG4gIHNlZWRQbGFuPzogc3RyaW5nXG4gIGdldEFwcFN0YXRlOiAoKSA9PiBBcHBTdGF0ZVxuICBzZXRBcHBTdGF0ZTogKGY6IChwcmV2OiBBcHBTdGF0ZSkgPT4gQXBwU3RhdGUpID0+IHZvaWRcbiAgc2lnbmFsOiBBYm9ydFNpZ25hbFxuICAvKiogVHJ1ZSBpZiB0aGUgY2FsbGVyIGRpc2Nvbm5lY3RlZCBSZW1vdGUgQ29udHJvbCBiZWZvcmUgbGF1bmNoaW5nLiAqL1xuICBkaXNjb25uZWN0ZWRCcmlkZ2U/OiBib29sZWFuXG4gIC8qKlxuICAgKiBDYWxsZWQgb25jZSB0ZWxlcG9ydFRvUmVtb3RlIHJlc29sdmVzIHdpdGggYSBzZXNzaW9uIFVSTC4gQ2FsbGVycyB0aGF0XG4gICAqIGhhdmUgc2V0TWVzc2FnZXMgKFJFUEwpIGFwcGVuZCB0aGlzIGFzIGEgc2Vjb25kIHRyYW5zY3JpcHQgbWVzc2FnZSBzbyB0aGVcbiAgICogVVJMIGlzIHZpc2libGUgd2l0aG91dCBvcGVuaW5nIHRoZSDihpMgZGV0YWlsIHZpZXcuIENhbGxlcnMgd2l0aG91dFxuICAgKiB0cmFuc2NyaXB0IGFjY2VzcyAoRXhpdFBsYW5Nb2RlUGVybWlzc2lvblJlcXVlc3QpIG9taXQgdGhpcyDigJQgdGhlIHBpbGxcbiAgICogc3RpbGwgc2hvd3MgbGl2ZSBzdGF0dXMuXG4gICAqL1xuICBvblNlc3Npb25SZWFkeT86IChtc2c6IHN0cmluZykgPT4gdm9pZFxufSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHtcbiAgICBibHVyYixcbiAgICBzZWVkUGxhbixcbiAgICBnZXRBcHBTdGF0ZSxcbiAgICBzZXRBcHBTdGF0ZSxcbiAgICBzaWduYWwsXG4gICAgZGlzY29ubmVjdGVkQnJpZGdlLFxuICAgIG9uU2Vzc2lvblJlYWR5LFxuICB9ID0gb3B0c1xuXG4gIGNvbnN0IHsgdWx0cmFwbGFuU2Vzc2lvblVybDogYWN0aXZlLCB1bHRyYXBsYW5MYXVuY2hpbmcgfSA9IGdldEFwcFN0YXRlKClcbiAgaWYgKGFjdGl2ZSB8fCB1bHRyYXBsYW5MYXVuY2hpbmcpIHtcbiAgICBsb2dFdmVudCgndGVuZ3VfdWx0cmFwbGFuX2NyZWF0ZV9mYWlsZWQnLCB7XG4gICAgICByZWFzb246IChhY3RpdmVcbiAgICAgICAgPyAnYWxyZWFkeV9wb2xsaW5nJ1xuICAgICAgICA6ICdhbHJlYWR5X2xhdW5jaGluZycpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgfSlcbiAgICByZXR1cm4gYnVpbGRBbHJlYWR5QWN0aXZlTWVzc2FnZShhY3RpdmUpXG4gIH1cblxuICBpZiAoIWJsdXJiICYmICFzZWVkUGxhbikge1xuICAgIC8vIE5vIGV2ZW50IOKAlCBiYXJlIC91bHRyYXBsYW4gaXMgYSB1c2FnZSBxdWVyeSwgbm90IGFuIGF0dGVtcHQuXG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIFJlbmRlcmVkIHZpYSA8TWFya2Rvd24+OyByYXcgPG1lc3NhZ2U+IGlzIHRva2VuaXplZCBhcyBIVE1MXG4gICAgICAvLyBhbmQgZHJvcHBlZC4gQmFja3NsYXNoLWVzY2FwZSB0aGUgYnJhY2tldHMuXG4gICAgICAnVXNhZ2U6IC91bHRyYXBsYW4gXFxcXDxwcm9tcHRcXFxcPiwgb3IgaW5jbHVkZSBcInVsdHJhcGxhblwiIGFueXdoZXJlJyxcbiAgICAgICdpbiB5b3VyIHByb21wdCcsXG4gICAgICAnJyxcbiAgICAgICdBZHZhbmNlZCBtdWx0aS1hZ2VudCBwbGFuIG1vZGUgd2l0aCBvdXIgbW9zdCBwb3dlcmZ1bCBtb2RlbCcsXG4gICAgICAnKE9wdXMpLiBSdW5zIGluIENsYXVkZSBDb2RlIG9uIHRoZSB3ZWIuIFdoZW4gdGhlIHBsYW4gaXMgcmVhZHksJyxcbiAgICAgICd5b3UgY2FuIGV4ZWN1dGUgaXQgaW4gdGhlIHdlYiBzZXNzaW9uIG9yIHNlbmQgaXQgYmFjayBoZXJlLicsXG4gICAgICAnVGVybWluYWwgc3RheXMgZnJlZSB3aGlsZSB0aGUgcmVtb3RlIHBsYW5zLicsXG4gICAgICAnUmVxdWlyZXMgL2xvZ2luLicsXG4gICAgICAnJyxcbiAgICAgIGBUZXJtczogJHtDQ1JfVEVSTVNfVVJMfWAsXG4gICAgXS5qb2luKCdcXG4nKVxuICB9XG5cbiAgLy8gU2V0IHN5bmNocm9ub3VzbHkgYmVmb3JlIHRoZSBkZXRhY2hlZCBmbG93IHRvIHByZXZlbnQgZHVwbGljYXRlIGxhdW5jaGVzXG4gIC8vIGR1cmluZyB0aGUgdGVsZXBvcnRUb1JlbW90ZSB3aW5kb3cuXG4gIHNldEFwcFN0YXRlKHByZXYgPT5cbiAgICBwcmV2LnVsdHJhcGxhbkxhdW5jaGluZyA/IHByZXYgOiB7IC4uLnByZXYsIHVsdHJhcGxhbkxhdW5jaGluZzogdHJ1ZSB9LFxuICApXG4gIHZvaWQgbGF1bmNoRGV0YWNoZWQoe1xuICAgIGJsdXJiLFxuICAgIHNlZWRQbGFuLFxuICAgIGdldEFwcFN0YXRlLFxuICAgIHNldEFwcFN0YXRlLFxuICAgIHNpZ25hbCxcbiAgICBvblNlc3Npb25SZWFkeSxcbiAgfSlcbiAgcmV0dXJuIGJ1aWxkTGF1bmNoTWVzc2FnZShkaXNjb25uZWN0ZWRCcmlkZ2UpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxhdW5jaERldGFjaGVkKG9wdHM6IHtcbiAgYmx1cmI6IHN0cmluZ1xuICBzZWVkUGxhbj86IHN0cmluZ1xuICBnZXRBcHBTdGF0ZTogKCkgPT4gQXBwU3RhdGVcbiAgc2V0QXBwU3RhdGU6IChmOiAocHJldjogQXBwU3RhdGUpID0+IEFwcFN0YXRlKSA9PiB2b2lkXG4gIHNpZ25hbDogQWJvcnRTaWduYWxcbiAgb25TZXNzaW9uUmVhZHk/OiAobXNnOiBzdHJpbmcpID0+IHZvaWRcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgeyBibHVyYiwgc2VlZFBsYW4sIGdldEFwcFN0YXRlLCBzZXRBcHBTdGF0ZSwgc2lnbmFsLCBvblNlc3Npb25SZWFkeSB9ID1cbiAgICBvcHRzXG4gIC8vIEhvaXN0ZWQgc28gdGhlIGNhdGNoIGJsb2NrIGNhbiBhcmNoaXZlIHRoZSByZW1vdGUgc2Vzc2lvbiBpZiBhbiBlcnJvclxuICAvLyBvY2N1cnMgYWZ0ZXIgdGVsZXBvcnRUb1JlbW90ZSBzdWNjZWVkcyAoYXZvaWRzIDMwbWluIG9ycGhhbikuXG4gIGxldCBzZXNzaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZFxuICB0cnkge1xuICAgIGNvbnN0IG1vZGVsID0gZ2V0VWx0cmFwbGFuTW9kZWwoKVxuXG4gICAgY29uc3QgZWxpZ2liaWxpdHkgPSBhd2FpdCBjaGVja1JlbW90ZUFnZW50RWxpZ2liaWxpdHkoKVxuICAgIGlmICghZWxpZ2liaWxpdHkuZWxpZ2libGUpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fY3JlYXRlX2ZhaWxlZCcsIHtcbiAgICAgICAgcmVhc29uOlxuICAgICAgICAgICdwcmVjb25kaXRpb24nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHByZWNvbmRpdGlvbl9lcnJvcnM6IGVsaWdpYmlsaXR5LmVycm9yc1xuICAgICAgICAgIC5tYXAoZSA9PiBlLnR5cGUpXG4gICAgICAgICAgLmpvaW4oXG4gICAgICAgICAgICAnLCcsXG4gICAgICAgICAgKSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICAgIGNvbnN0IHJlYXNvbnMgPSBlbGlnaWJpbGl0eS5lcnJvcnMubWFwKGZvcm1hdFByZWNvbmRpdGlvbkVycm9yKS5qb2luKCdcXG4nKVxuICAgICAgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24oe1xuICAgICAgICB2YWx1ZTogYHVsdHJhcGxhbjogY2Fubm90IGxhdW5jaCByZW1vdGUgc2Vzc2lvbiDigJRcXG4ke3JlYXNvbnN9YCxcbiAgICAgICAgbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyxcbiAgICAgIH0pXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBwcm9tcHQgPSBidWlsZFVsdHJhcGxhblByb21wdChibHVyYiwgc2VlZFBsYW4pXG4gICAgbGV0IGJ1bmRsZUZhaWxNc2c6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0ZWxlcG9ydFRvUmVtb3RlKHtcbiAgICAgIGluaXRpYWxNZXNzYWdlOiBwcm9tcHQsXG4gICAgICBkZXNjcmlwdGlvbjogYmx1cmIgfHwgJ1JlZmluZSBsb2NhbCBwbGFuJyxcbiAgICAgIG1vZGVsLFxuICAgICAgcGVybWlzc2lvbk1vZGU6ICdwbGFuJyxcbiAgICAgIHVsdHJhcGxhbjogdHJ1ZSxcbiAgICAgIHNpZ25hbCxcbiAgICAgIHVzZURlZmF1bHRFbnZpcm9ubWVudDogdHJ1ZSxcbiAgICAgIG9uQnVuZGxlRmFpbDogbXNnID0+IHtcbiAgICAgICAgYnVuZGxlRmFpbE1zZyA9IG1zZ1xuICAgICAgfSxcbiAgICB9KVxuICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3VsdHJhcGxhbl9jcmVhdGVfZmFpbGVkJywge1xuICAgICAgICByZWFzb246IChidW5kbGVGYWlsTXNnXG4gICAgICAgICAgPyAnYnVuZGxlX2ZhaWwnXG4gICAgICAgICAgOiAndGVsZXBvcnRfbnVsbCcpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgICAgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24oe1xuICAgICAgICB2YWx1ZTogYHVsdHJhcGxhbjogc2Vzc2lvbiBjcmVhdGlvbiBmYWlsZWQke2J1bmRsZUZhaWxNc2cgPyBgIOKAlCAke2J1bmRsZUZhaWxNc2d9YCA6ICcnfS4gU2VlIC0tZGVidWcgZm9yIGRldGFpbHMuYCxcbiAgICAgICAgbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyxcbiAgICAgIH0pXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgc2Vzc2lvbklkID0gc2Vzc2lvbi5pZFxuXG4gICAgY29uc3QgdXJsID0gZ2V0UmVtb3RlU2Vzc2lvblVybChzZXNzaW9uLmlkLCBwcm9jZXNzLmVudi5TRVNTSU9OX0lOR1JFU1NfVVJMKVxuICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICB1bHRyYXBsYW5TZXNzaW9uVXJsOiB1cmwsXG4gICAgICB1bHRyYXBsYW5MYXVuY2hpbmc6IHVuZGVmaW5lZCxcbiAgICB9KSlcbiAgICBvblNlc3Npb25SZWFkeT8uKGJ1aWxkU2Vzc2lvblJlYWR5TWVzc2FnZSh1cmwpKVxuICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fbGF1bmNoZWQnLCB7XG4gICAgICBoYXNfc2VlZF9wbGFuOiBCb29sZWFuKHNlZWRQbGFuKSxcbiAgICAgIG1vZGVsOlxuICAgICAgICBtb2RlbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG4gICAgLy8gVE9ETygjMjM5ODUpOiByZXBsYWNlIHJlZ2lzdGVyUmVtb3RlQWdlbnRUYXNrICsgc3RhcnREZXRhY2hlZFBvbGwgd2l0aFxuICAgIC8vIEV4aXRQbGFuTW9kZVNjYW5uZXIgaW5zaWRlIHN0YXJ0UmVtb3RlU2Vzc2lvblBvbGxpbmcuXG4gICAgY29uc3QgeyB0YXNrSWQgfSA9IHJlZ2lzdGVyUmVtb3RlQWdlbnRUYXNrKHtcbiAgICAgIHJlbW90ZVRhc2tUeXBlOiAndWx0cmFwbGFuJyxcbiAgICAgIHNlc3Npb246IHsgaWQ6IHNlc3Npb24uaWQsIHRpdGxlOiBibHVyYiB8fCAnVWx0cmFwbGFuJyB9LFxuICAgICAgY29tbWFuZDogYmx1cmIsXG4gICAgICBjb250ZXh0OiB7XG4gICAgICAgIGFib3J0Q29udHJvbGxlcjogbmV3IEFib3J0Q29udHJvbGxlcigpLFxuICAgICAgICBnZXRBcHBTdGF0ZSxcbiAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICB9LFxuICAgICAgaXNVbHRyYXBsYW46IHRydWUsXG4gICAgfSlcbiAgICBzdGFydERldGFjaGVkUG9sbCh0YXNrSWQsIHNlc3Npb24uaWQsIHVybCwgZ2V0QXBwU3RhdGUsIHNldEFwcFN0YXRlKVxuICB9IGNhdGNoIChlKSB7XG4gICAgbG9nRXJyb3IoZSlcbiAgICBsb2dFdmVudCgndGVuZ3VfdWx0cmFwbGFuX2NyZWF0ZV9mYWlsZWQnLCB7XG4gICAgICByZWFzb246XG4gICAgICAgICd1bmV4cGVjdGVkX2Vycm9yJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG4gICAgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24oe1xuICAgICAgdmFsdWU6IGB1bHRyYXBsYW46IHVuZXhwZWN0ZWQgZXJyb3Ig4oCUICR7ZXJyb3JNZXNzYWdlKGUpfWAsXG4gICAgICBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nLFxuICAgIH0pXG4gICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgLy8gRXJyb3IgYWZ0ZXIgdGVsZXBvcnQgc3VjY2VlZGVkIOKAlCBhcmNoaXZlIHNvIHRoZSByZW1vdGUgZG9lc24ndCBzaXRcbiAgICAgIC8vIHJ1bm5pbmcgZm9yIDMwbWluIHdpdGggbm9ib2R5IHBvbGxpbmcgaXQuXG4gICAgICB2b2lkIGFyY2hpdmVSZW1vdGVTZXNzaW9uKHNlc3Npb25JZCkuY2F0Y2goZXJyID0+XG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZygndWx0cmFwbGFuOiBmYWlsZWQgdG8gYXJjaGl2ZSBvcnBoYW5lZCBzZXNzaW9uJywgZXJyKSxcbiAgICAgIClcbiAgICAgIC8vIHVsdHJhcGxhblNlc3Npb25VcmwgbWF5IGhhdmUgYmVlbiBzZXQgYmVmb3JlIHRoZSB0aHJvdzsgY2xlYXIgaXQgc29cbiAgICAgIC8vIHRoZSBcImFscmVhZHkgcG9sbGluZ1wiIGd1YXJkIGRvZXNuJ3QgYmxvY2sgZnV0dXJlIGxhdW5jaGVzLlxuICAgICAgc2V0QXBwU3RhdGUocHJldiA9PlxuICAgICAgICBwcmV2LnVsdHJhcGxhblNlc3Npb25VcmxcbiAgICAgICAgICA/IHsgLi4ucHJldiwgdWx0cmFwbGFuU2Vzc2lvblVybDogdW5kZWZpbmVkIH1cbiAgICAgICAgICA6IHByZXYsXG4gICAgICApXG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIE5vLW9wIG9uIHN1Y2Nlc3M6IHRoZSB1cmwtc2V0dGluZyBzZXRBcHBTdGF0ZSBhbHJlYWR5IGNsZWFyZWQgdGhpcy5cbiAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICBwcmV2LnVsdHJhcGxhbkxhdW5jaGluZ1xuICAgICAgICA/IHsgLi4ucHJldiwgdWx0cmFwbGFuTGF1bmNoaW5nOiB1bmRlZmluZWQgfVxuICAgICAgICA6IHByZXYsXG4gICAgKVxuICB9XG59XG5cbmNvbnN0IGNhbGw6IExvY2FsSlNYQ29tbWFuZENhbGwgPSBhc3luYyAob25Eb25lLCBjb250ZXh0LCBhcmdzKSA9PiB7XG4gIGNvbnN0IGJsdXJiID0gYXJncy50cmltKClcblxuICAvLyBCYXJlIC91bHRyYXBsYW4gKG5vIGFyZ3MsIG5vIHNlZWQgcGxhbikganVzdCBzaG93cyB1c2FnZSDigJQgbm8gZGlhbG9nLlxuICBpZiAoIWJsdXJiKSB7XG4gICAgY29uc3QgbXNnID0gYXdhaXQgbGF1bmNoVWx0cmFwbGFuKHtcbiAgICAgIGJsdXJiLFxuICAgICAgZ2V0QXBwU3RhdGU6IGNvbnRleHQuZ2V0QXBwU3RhdGUsXG4gICAgICBzZXRBcHBTdGF0ZTogY29udGV4dC5zZXRBcHBTdGF0ZSxcbiAgICAgIHNpZ25hbDogY29udGV4dC5hYm9ydENvbnRyb2xsZXIuc2lnbmFsLFxuICAgIH0pXG4gICAgb25Eb25lKG1zZywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICAvLyBHdWFyZCBtYXRjaGVzIGxhdW5jaFVsdHJhcGxhbidzIG93biBjaGVjayDigJQgc2hvd2luZyB0aGUgZGlhbG9nIHdoZW4gYVxuICAvLyBzZXNzaW9uIGlzIGFscmVhZHkgYWN0aXZlIG9yIGxhdW5jaGluZyB3b3VsZCB3YXN0ZSB0aGUgdXNlcidzIGNsaWNrIGFuZCBzZXRcbiAgLy8gaGFzU2VlblVsdHJhcGxhblRlcm1zIGJlZm9yZSB0aGUgbGF1bmNoIGZhaWxzLlxuICBjb25zdCB7IHVsdHJhcGxhblNlc3Npb25Vcmw6IGFjdGl2ZSwgdWx0cmFwbGFuTGF1bmNoaW5nIH0gPVxuICAgIGNvbnRleHQuZ2V0QXBwU3RhdGUoKVxuICBpZiAoYWN0aXZlIHx8IHVsdHJhcGxhbkxhdW5jaGluZykge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV91bHRyYXBsYW5fY3JlYXRlX2ZhaWxlZCcsIHtcbiAgICAgIHJlYXNvbjogKGFjdGl2ZVxuICAgICAgICA/ICdhbHJlYWR5X3BvbGxpbmcnXG4gICAgICAgIDogJ2FscmVhZHlfbGF1bmNoaW5nJykgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICB9KVxuICAgIG9uRG9uZShidWlsZEFscmVhZHlBY3RpdmVNZXNzYWdlKGFjdGl2ZSksIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgLy8gTW91bnQgdGhlIHByZS1sYXVuY2ggZGlhbG9nIHZpYSBmb2N1c2VkSW5wdXREaWFsb2cgKGJvdHRvbSByZWdpb24sIGxpa2VcbiAgLy8gcGVybWlzc2lvbiBkaWFsb2dzKSByYXRoZXIgdGhhbiByZXR1cm5pbmcgSlNYICh0cmFuc2NyaXB0IGFyZWEsIGFuY2hvcnNcbiAgLy8gYXQgdG9wIG9mIHNjcm9sbGJhY2spLiBSRVBMLnRzeCBoYW5kbGVzIGxhdW5jaC9jbGVhci9jYW5jZWwgb24gY2hvaWNlLlxuICBjb250ZXh0LnNldEFwcFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgdWx0cmFwbGFuTGF1bmNoUGVuZGluZzogeyBibHVyYiB9IH0pKVxuICAvLyAnc2tpcCcgc3VwcHJlc3NlcyB0aGUgKG5vIGNvbnRlbnQpIGVjaG8g4oCUIHRoZSBkaWFsb2cncyBjaG9pY2UgaGFuZGxlclxuICAvLyBhZGRzIHRoZSByZWFsIC91bHRyYXBsYW4gZWNobyArIGxhdW5jaCBjb25maXJtYXRpb24uXG4gIG9uRG9uZSh1bmRlZmluZWQsIHsgZGlzcGxheTogJ3NraXAnIH0pXG4gIHJldHVybiBudWxsXG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgdHlwZTogJ2xvY2FsLWpzeCcsXG4gIG5hbWU6ICd1bHRyYXBsYW4nLFxuICBkZXNjcmlwdGlvbjogYH4xMOKAkzMwIG1pbiDCtyBDbGF1ZGUgQ29kZSBvbiB0aGUgd2ViIGRyYWZ0cyBhbiBhZHZhbmNlZCBwbGFuIHlvdSBjYW4gZWRpdCBhbmQgYXBwcm92ZS4gU2VlICR7Q0NSX1RFUk1TX1VSTH1gLFxuICBhcmd1bWVudEhpbnQ6ICc8cHJvbXB0PicsXG4gIGlzRW5hYmxlZDogKCkgPT4gXCJleHRlcm5hbFwiID09PSAnYW50JyxcbiAgbG9hZDogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgY2FsbCB9KSxcbn0gc2F0aXNmaWVzIENvbW1hbmRcbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsWUFBWSxRQUFRLElBQUk7QUFDakMsU0FBU0MsK0JBQStCLFFBQVEsb0JBQW9CO0FBQ3BFLGNBQWNDLE9BQU8sUUFBUSxnQkFBZ0I7QUFDN0MsU0FBU0MsWUFBWSxRQUFRLHlCQUF5QjtBQUN0RCxTQUFTQyxtQkFBbUIsUUFBUSx5QkFBeUI7QUFDN0QsU0FBU0MsbUNBQW1DLFFBQVEscUNBQXFDO0FBQ3pGLFNBQ0UsS0FBS0MsMERBQTBELEVBQy9EQyxRQUFRLFFBQ0gsZ0NBQWdDO0FBQ3ZDLGNBQWNDLFFBQVEsUUFBUSwyQkFBMkI7QUFDekQsU0FDRUMsMkJBQTJCLEVBQzNCQyx1QkFBdUIsRUFDdkJDLGVBQWUsRUFDZixLQUFLQyxvQkFBb0IsRUFDekJDLHVCQUF1QixRQUNsQiw2Q0FBNkM7QUFDcEQsY0FBY0MsbUJBQW1CLFFBQVEscUJBQXFCO0FBQzlELFNBQVNDLGVBQWUsUUFBUSxtQkFBbUI7QUFDbkQsU0FBU0MsWUFBWSxRQUFRLG9CQUFvQjtBQUNqRCxTQUFTQyxRQUFRLFFBQVEsaUJBQWlCO0FBQzFDLFNBQVNDLDBCQUEwQixRQUFRLGlDQUFpQztBQUM1RSxTQUFTQyxpQkFBaUIsUUFBUSwyQkFBMkI7QUFDN0QsU0FBU0MsZUFBZSxRQUFRLDRCQUE0QjtBQUM1RCxTQUFTQyxvQkFBb0IsRUFBRUMsZ0JBQWdCLFFBQVEsc0JBQXNCO0FBQzdFLFNBQ0VDLDJCQUEyQixFQUMzQkMsa0JBQWtCLFFBQ2Isa0NBQWtDOztBQUV6QztBQUNBOztBQUVBO0FBQ0EsTUFBTUMsb0JBQW9CLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJO0FBRTNDLE9BQU8sTUFBTUMsYUFBYSxHQUN4Qix3REFBd0Q7O0FBRTFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxpQkFBaUJBLENBQUEsQ0FBRSxFQUFFLE1BQU0sQ0FBQztFQUNuQyxPQUFPdEIsbUNBQW1DLENBQ3hDLHVCQUF1QixFQUN2QmMsaUJBQWlCLENBQUNTLE1BQU0sQ0FBQ0MsVUFDM0IsQ0FBQztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsVUFBVSxHQUFHQyxPQUFPLENBQUMsK0JBQStCLENBQUM7QUFDM0Q7QUFDQSxNQUFNQyxvQkFBb0IsRUFBRSxNQUFNLEdBQUcsQ0FDbkMsT0FBT0YsVUFBVSxLQUFLLFFBQVEsR0FBR0EsVUFBVSxHQUFHQSxVQUFVLENBQUNHLE9BQU8sRUFDaEVDLE9BQU8sQ0FBQyxDQUFDOztBQUVYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLHNCQUFzQixFQUFFLE1BQU0sR0FDbEMsVUFBVSxLQUFLLEtBQUssSUFBSUMsT0FBTyxDQUFDQyxHQUFHLENBQUNDLHFCQUFxQixHQUNyRHRDLFlBQVksQ0FBQ29DLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyxxQkFBcUIsRUFBRSxNQUFNLENBQUMsQ0FBQ0osT0FBTyxDQUFDLENBQUMsR0FDakVGLG9CQUFvQjtBQUMxQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sU0FBU08sb0JBQW9CQSxDQUFDQyxLQUFLLEVBQUUsTUFBTSxFQUFFQyxRQUFpQixDQUFSLEVBQUUsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDO0VBQzdFLE1BQU1DLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFO0VBQzFCLElBQUlELFFBQVEsRUFBRTtJQUNaQyxLQUFLLENBQUNDLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLEVBQUVGLFFBQVEsRUFBRSxFQUFFLENBQUM7RUFDakU7RUFDQUMsS0FBSyxDQUFDQyxJQUFJLENBQUNSLHNCQUFzQixDQUFDO0VBQ2xDLElBQUlLLEtBQUssRUFBRTtJQUNURSxLQUFLLENBQUNDLElBQUksQ0FBQyxFQUFFLEVBQUVILEtBQUssQ0FBQztFQUN2QjtFQUNBLE9BQU9FLEtBQUssQ0FBQ0UsSUFBSSxDQUFDLElBQUksQ0FBQztBQUN6QjtBQUVBLFNBQVNDLGlCQUFpQkEsQ0FDeEJDLE1BQU0sRUFBRSxNQUFNLEVBQ2RDLFNBQVMsRUFBRSxNQUFNLEVBQ2pCQyxHQUFHLEVBQUUsTUFBTSxFQUNYQyxXQUFXLEVBQUUsR0FBRyxHQUFHekMsUUFBUSxFQUMzQjBDLFdBQVcsRUFBRSxDQUFDQyxDQUFDLEVBQUUsQ0FBQ0MsSUFBSSxFQUFFNUMsUUFBUSxFQUFFLEdBQUdBLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FDdkQsRUFBRSxJQUFJLENBQUM7RUFDTixNQUFNNkMsT0FBTyxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDO0VBQzFCLElBQUlDLE1BQU0sR0FBRyxLQUFLO0VBQ2xCLEtBQUssQ0FBQyxZQUFZO0lBQ2hCLElBQUk7TUFDRixNQUFNO1FBQUVDLElBQUk7UUFBRUMsV0FBVztRQUFFQztNQUFnQixDQUFDLEdBQzFDLE1BQU1wQywyQkFBMkIsQ0FDL0J3QixTQUFTLEVBQ1R0QixvQkFBb0IsRUFDcEJtQyxLQUFLLElBQUk7UUFDUCxJQUFJQSxLQUFLLEtBQUssYUFBYSxFQUN6QnJELFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRGEsZUFBZSxDQUFDUixvQkFBb0IsQ0FBQyxDQUFDa0MsTUFBTSxFQUFFSSxXQUFXLEVBQUVXLENBQUMsSUFBSTtVQUM5RCxJQUFJQSxDQUFDLENBQUNDLE1BQU0sS0FBSyxTQUFTLEVBQUUsT0FBT0QsQ0FBQztVQUNwQyxNQUFNRSxJQUFJLEdBQUdILEtBQUssS0FBSyxTQUFTLEdBQUdJLFNBQVMsR0FBR0osS0FBSztVQUNwRCxPQUFPQyxDQUFDLENBQUNJLGNBQWMsS0FBS0YsSUFBSSxHQUM1QkYsQ0FBQyxHQUNEO1lBQUUsR0FBR0EsQ0FBQztZQUFFSSxjQUFjLEVBQUVGO1VBQUssQ0FBQztRQUNwQyxDQUFDLENBQUM7TUFDSixDQUFDLEVBQ0QsTUFBTWQsV0FBVyxDQUFDLENBQUMsQ0FBQ2lCLEtBQUssR0FBR3BCLE1BQU0sQ0FBQyxFQUFFZ0IsTUFBTSxLQUFLLFNBQ2xELENBQUM7TUFDSHZELFFBQVEsQ0FBQywwQkFBMEIsRUFBRTtRQUNuQzRELFdBQVcsRUFBRWIsSUFBSSxDQUFDQyxHQUFHLENBQUMsQ0FBQyxHQUFHRixPQUFPO1FBQ2pDZSxXQUFXLEVBQUVYLElBQUksQ0FBQ1ksTUFBTTtRQUN4QkMsWUFBWSxFQUFFWixXQUFXO1FBQ3pCYSxnQkFBZ0IsRUFDZFosZUFBZSxJQUFJckQ7TUFDdkIsQ0FBQyxDQUFDO01BQ0YsSUFBSXFELGVBQWUsS0FBSyxRQUFRLEVBQUU7UUFDaEM7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLE1BQU1hLElBQUksR0FBR3ZCLFdBQVcsQ0FBQyxDQUFDLENBQUNpQixLQUFLLEdBQUdwQixNQUFNLENBQUM7UUFDMUMsSUFBSTBCLElBQUksRUFBRVYsTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUNoQzFDLGVBQWUsQ0FBQ1Isb0JBQW9CLENBQUMsQ0FBQ2tDLE1BQU0sRUFBRUksV0FBVyxFQUFFVyxDQUFDLElBQzFEQSxDQUFDLENBQUNDLE1BQU0sS0FBSyxTQUFTLEdBQ2xCRCxDQUFDLEdBQ0Q7VUFBRSxHQUFHQSxDQUFDO1VBQUVDLE1BQU0sRUFBRSxXQUFXO1VBQUVXLE9BQU8sRUFBRW5CLElBQUksQ0FBQ0MsR0FBRyxDQUFDO1FBQUUsQ0FDdkQsQ0FBQztRQUNETCxXQUFXLENBQUNFLElBQUksSUFDZEEsSUFBSSxDQUFDc0IsbUJBQW1CLEtBQUsxQixHQUFHLEdBQzVCO1VBQUUsR0FBR0ksSUFBSTtVQUFFc0IsbUJBQW1CLEVBQUVWO1FBQVUsQ0FBQyxHQUMzQ1osSUFDTixDQUFDO1FBQ0RsQywwQkFBMEIsQ0FBQztVQUN6QnlELEtBQUssRUFBRSxDQUNMLDhFQUE4RTNCLEdBQUcsRUFBRSxFQUNuRixFQUFFLEVBQ0Ysb0dBQW9HLENBQ3JHLENBQUNKLElBQUksQ0FBQyxJQUFJLENBQUM7VUFDWmdDLElBQUksRUFBRTtRQUNSLENBQUMsQ0FBQztNQUNKLENBQUMsTUFBTTtRQUNMO1FBQ0E7UUFDQTtRQUNBO1FBQ0ExQixXQUFXLENBQUNFLElBQUksSUFBSTtVQUNsQixNQUFNb0IsSUFBSSxHQUFHcEIsSUFBSSxDQUFDYyxLQUFLLEdBQUdwQixNQUFNLENBQUM7VUFDakMsSUFBSSxDQUFDMEIsSUFBSSxJQUFJQSxJQUFJLENBQUNWLE1BQU0sS0FBSyxTQUFTLEVBQUUsT0FBT1YsSUFBSTtVQUNuRCxPQUFPO1lBQ0wsR0FBR0EsSUFBSTtZQUNQeUIsc0JBQXNCLEVBQUU7Y0FBRXBCLElBQUk7Y0FBRVYsU0FBUztjQUFFRDtZQUFPO1VBQ3BELENBQUM7UUFDSCxDQUFDLENBQUM7TUFDSjtJQUNGLENBQUMsQ0FBQyxPQUFPZ0MsQ0FBQyxFQUFFO01BQ1Y7TUFDQTtNQUNBO01BQ0EsTUFBTU4sSUFBSSxHQUFHdkIsV0FBVyxDQUFDLENBQUMsQ0FBQ2lCLEtBQUssR0FBR3BCLE1BQU0sQ0FBQztNQUMxQyxJQUFJMEIsSUFBSSxFQUFFVixNQUFNLEtBQUssU0FBUyxFQUFFO01BQ2hDTixNQUFNLEdBQUcsSUFBSTtNQUNiakQsUUFBUSxDQUFDLHdCQUF3QixFQUFFO1FBQ2pDNEQsV0FBVyxFQUFFYixJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEdBQUdGLE9BQU87UUFDakMwQixNQUFNLEVBQUUsQ0FBQ0QsQ0FBQyxZQUFZdEQsa0JBQWtCLEdBQ3BDc0QsQ0FBQyxDQUFDQyxNQUFNLEdBQ1Isb0JBQW9CLEtBQUt6RSwwREFBMEQ7UUFDdkZnRSxZQUFZLEVBQ1ZRLENBQUMsWUFBWXRELGtCQUFrQixHQUFHc0QsQ0FBQyxDQUFDcEIsV0FBVyxHQUFHTTtNQUN0RCxDQUFDLENBQUM7TUFDRjlDLDBCQUEwQixDQUFDO1FBQ3pCeUQsS0FBSyxFQUFFLHFCQUFxQjNELFlBQVksQ0FBQzhELENBQUMsQ0FBQyxnQkFBZ0I5QixHQUFHLEVBQUU7UUFDaEU0QixJQUFJLEVBQUU7TUFDUixDQUFDLENBQUM7TUFDRjtNQUNBO01BQ0EsS0FBS3ZELG9CQUFvQixDQUFDMEIsU0FBUyxDQUFDLENBQUNpQyxLQUFLLENBQUNGLENBQUMsSUFDMUMvRCxlQUFlLENBQUMsNkJBQTZCa0UsTUFBTSxDQUFDSCxDQUFDLENBQUMsRUFBRSxDQUMxRCxDQUFDO01BQ0Q1QixXQUFXLENBQUNFLElBQUk7TUFDZDtNQUNBO01BQ0FBLElBQUksQ0FBQ3NCLG1CQUFtQixLQUFLMUIsR0FBRyxHQUM1QjtRQUFFLEdBQUdJLElBQUk7UUFBRXNCLG1CQUFtQixFQUFFVjtNQUFVLENBQUMsR0FDM0NaLElBQ04sQ0FBQztJQUNILENBQUMsU0FBUztNQUNSO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLElBQUlJLE1BQU0sRUFBRTtRQUNWcEMsZUFBZSxDQUFDUixvQkFBb0IsQ0FBQyxDQUFDa0MsTUFBTSxFQUFFSSxXQUFXLEVBQUVXLENBQUMsSUFDMURBLENBQUMsQ0FBQ0MsTUFBTSxLQUFLLFNBQVMsR0FDbEJELENBQUMsR0FDRDtVQUFFLEdBQUdBLENBQUM7VUFBRUMsTUFBTSxFQUFFLFFBQVE7VUFBRVcsT0FBTyxFQUFFbkIsSUFBSSxDQUFDQyxHQUFHLENBQUM7UUFBRSxDQUNwRCxDQUFDO01BQ0g7SUFDRjtFQUNGLENBQUMsRUFBRSxDQUFDO0FBQ047O0FBRUE7QUFDQTtBQUNBLFNBQVMyQixrQkFBa0JBLENBQUNDLGtCQUE0QixDQUFULEVBQUUsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFDO0VBQ2hFLE1BQU1DLE1BQU0sR0FBR0Qsa0JBQWtCLEdBQUcsR0FBR2xGLCtCQUErQixHQUFHLEdBQUcsRUFBRTtFQUM5RSxPQUFPLEdBQUdFLFlBQVksZUFBZWlGLE1BQU0sa0NBQWtDO0FBQy9FO0FBRUEsU0FBU0Msd0JBQXdCQSxDQUFDckMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQztFQUNyRCxPQUFPLEdBQUc3QyxZQUFZLDJEQUEyRDZDLEdBQUcseUNBQXlDN0MsWUFBWSxpQ0FBaUM7QUFDNUs7QUFFQSxTQUFTbUYseUJBQXlCQSxDQUFDdEMsR0FBRyxFQUFFLE1BQU0sR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLENBQUM7RUFDbEUsT0FBT0EsR0FBRyxHQUNOLG9DQUFvQ0EsR0FBRyxzREFBc0QsR0FDN0YscUVBQXFFO0FBQzNFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTyxlQUFldUMsYUFBYUEsQ0FDakN6QyxNQUFNLEVBQUUsTUFBTSxFQUNkQyxTQUFTLEVBQUUsTUFBTSxFQUNqQkcsV0FBVyxFQUFFLENBQUNDLENBQUMsRUFBRSxDQUFDQyxJQUFJLEVBQUU1QyxRQUFRLEVBQUUsR0FBR0EsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUN2RCxFQUFFZ0YsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ2Y7RUFDQTtFQUNBLE1BQU03RSxlQUFlLENBQUM4RSxJQUFJLENBQUMzQyxNQUFNLEVBQUVJLFdBQVcsQ0FBQztFQUMvQ0EsV0FBVyxDQUFDRSxJQUFJLElBQ2RBLElBQUksQ0FBQ3NCLG1CQUFtQixJQUN4QnRCLElBQUksQ0FBQ3lCLHNCQUFzQixJQUMzQnpCLElBQUksQ0FBQ3NDLGtCQUFrQixHQUNuQjtJQUNFLEdBQUd0QyxJQUFJO0lBQ1BzQixtQkFBbUIsRUFBRVYsU0FBUztJQUM5QmEsc0JBQXNCLEVBQUViLFNBQVM7SUFDakMwQixrQkFBa0IsRUFBRTFCO0VBQ3RCLENBQUMsR0FDRFosSUFDTixDQUFDO0VBQ0QsTUFBTUosR0FBRyxHQUFHNUMsbUJBQW1CLENBQUMyQyxTQUFTLEVBQUVYLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDc0QsbUJBQW1CLENBQUM7RUFDM0V6RSwwQkFBMEIsQ0FBQztJQUN6QnlELEtBQUssRUFBRSxrQ0FBa0MzQixHQUFHLEVBQUU7SUFDOUM0QixJQUFJLEVBQUU7RUFDUixDQUFDLENBQUM7RUFDRjFELDBCQUEwQixDQUFDO0lBQ3pCeUQsS0FBSyxFQUNILHNIQUFzSDtJQUN4SEMsSUFBSSxFQUFFLG1CQUFtQjtJQUN6QmdCLE1BQU0sRUFBRTtFQUNWLENBQUMsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sZUFBZUMsZUFBZUEsQ0FBQ0MsSUFBSSxFQUFFO0VBQzFDdEQsS0FBSyxFQUFFLE1BQU07RUFDYkMsUUFBUSxDQUFDLEVBQUUsTUFBTTtFQUNqQlEsV0FBVyxFQUFFLEdBQUcsR0FBR3pDLFFBQVE7RUFDM0IwQyxXQUFXLEVBQUUsQ0FBQ0MsQ0FBQyxFQUFFLENBQUNDLElBQUksRUFBRTVDLFFBQVEsRUFBRSxHQUFHQSxRQUFRLEVBQUUsR0FBRyxJQUFJO0VBQ3REdUYsTUFBTSxFQUFFQyxXQUFXO0VBQ25CO0VBQ0FiLGtCQUFrQixDQUFDLEVBQUUsT0FBTztFQUM1QjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFYyxjQUFjLENBQUMsRUFBRSxDQUFDQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSTtBQUN4QyxDQUFDLENBQUMsRUFBRVYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQ2xCLE1BQU07SUFDSmhELEtBQUs7SUFDTEMsUUFBUTtJQUNSUSxXQUFXO0lBQ1hDLFdBQVc7SUFDWDZDLE1BQU07SUFDTlosa0JBQWtCO0lBQ2xCYztFQUNGLENBQUMsR0FBR0gsSUFBSTtFQUVSLE1BQU07SUFBRXBCLG1CQUFtQixFQUFFeUIsTUFBTTtJQUFFVDtFQUFtQixDQUFDLEdBQUd6QyxXQUFXLENBQUMsQ0FBQztFQUN6RSxJQUFJa0QsTUFBTSxJQUFJVCxrQkFBa0IsRUFBRTtJQUNoQ25GLFFBQVEsQ0FBQywrQkFBK0IsRUFBRTtNQUN4Q3dFLE1BQU0sRUFBRSxDQUFDb0IsTUFBTSxHQUNYLGlCQUFpQixHQUNqQixtQkFBbUIsS0FBSzdGO0lBQzlCLENBQUMsQ0FBQztJQUNGLE9BQU9nRix5QkFBeUIsQ0FBQ2EsTUFBTSxDQUFDO0VBQzFDO0VBRUEsSUFBSSxDQUFDM0QsS0FBSyxJQUFJLENBQUNDLFFBQVEsRUFBRTtJQUN2QjtJQUNBLE9BQU87SUFDTDtJQUNBO0lBQ0EsaUVBQWlFLEVBQ2pFLGdCQUFnQixFQUNoQixFQUFFLEVBQ0YsNkRBQTZELEVBQzdELGlFQUFpRSxFQUNqRSw2REFBNkQsRUFDN0QsNkNBQTZDLEVBQzdDLGtCQUFrQixFQUNsQixFQUFFLEVBQ0YsVUFBVWYsYUFBYSxFQUFFLENBQzFCLENBQUNrQixJQUFJLENBQUMsSUFBSSxDQUFDO0VBQ2Q7O0VBRUE7RUFDQTtFQUNBTSxXQUFXLENBQUNFLElBQUksSUFDZEEsSUFBSSxDQUFDc0Msa0JBQWtCLEdBQUd0QyxJQUFJLEdBQUc7SUFBRSxHQUFHQSxJQUFJO0lBQUVzQyxrQkFBa0IsRUFBRTtFQUFLLENBQ3ZFLENBQUM7RUFDRCxLQUFLVSxjQUFjLENBQUM7SUFDbEI1RCxLQUFLO0lBQ0xDLFFBQVE7SUFDUlEsV0FBVztJQUNYQyxXQUFXO0lBQ1g2QyxNQUFNO0lBQ05FO0VBQ0YsQ0FBQyxDQUFDO0VBQ0YsT0FBT2Ysa0JBQWtCLENBQUNDLGtCQUFrQixDQUFDO0FBQy9DO0FBRUEsZUFBZWlCLGNBQWNBLENBQUNOLElBQUksRUFBRTtFQUNsQ3RELEtBQUssRUFBRSxNQUFNO0VBQ2JDLFFBQVEsQ0FBQyxFQUFFLE1BQU07RUFDakJRLFdBQVcsRUFBRSxHQUFHLEdBQUd6QyxRQUFRO0VBQzNCMEMsV0FBVyxFQUFFLENBQUNDLENBQUMsRUFBRSxDQUFDQyxJQUFJLEVBQUU1QyxRQUFRLEVBQUUsR0FBR0EsUUFBUSxFQUFFLEdBQUcsSUFBSTtFQUN0RHVGLE1BQU0sRUFBRUMsV0FBVztFQUNuQkMsY0FBYyxDQUFDLEVBQUUsQ0FBQ0MsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUk7QUFDeEMsQ0FBQyxDQUFDLEVBQUVWLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNoQixNQUFNO0lBQUVoRCxLQUFLO0lBQUVDLFFBQVE7SUFBRVEsV0FBVztJQUFFQyxXQUFXO0lBQUU2QyxNQUFNO0lBQUVFO0VBQWUsQ0FBQyxHQUN6RUgsSUFBSTtFQUNOO0VBQ0E7RUFDQSxJQUFJL0MsU0FBUyxFQUFFLE1BQU0sR0FBRyxTQUFTO0VBQ2pDLElBQUk7SUFDRixNQUFNc0QsS0FBSyxHQUFHMUUsaUJBQWlCLENBQUMsQ0FBQztJQUVqQyxNQUFNMkUsV0FBVyxHQUFHLE1BQU03RiwyQkFBMkIsQ0FBQyxDQUFDO0lBQ3ZELElBQUksQ0FBQzZGLFdBQVcsQ0FBQ0MsUUFBUSxFQUFFO01BQ3pCaEcsUUFBUSxDQUFDLCtCQUErQixFQUFFO1FBQ3hDd0UsTUFBTSxFQUNKLGNBQWMsSUFBSXpFLDBEQUEwRDtRQUM5RWtHLG1CQUFtQixFQUFFRixXQUFXLENBQUNHLE1BQU0sQ0FDcENDLEdBQUcsQ0FBQzVCLENBQUMsSUFBSUEsQ0FBQyxDQUFDNkIsSUFBSSxDQUFDLENBQ2hCL0QsSUFBSSxDQUNILEdBQ0YsQ0FBQyxJQUFJdEM7TUFDVCxDQUFDLENBQUM7TUFDRixNQUFNc0csT0FBTyxHQUFHTixXQUFXLENBQUNHLE1BQU0sQ0FBQ0MsR0FBRyxDQUFDaEcsdUJBQXVCLENBQUMsQ0FBQ2tDLElBQUksQ0FBQyxJQUFJLENBQUM7TUFDMUUxQiwwQkFBMEIsQ0FBQztRQUN6QnlELEtBQUssRUFBRSw4Q0FBOENpQyxPQUFPLEVBQUU7UUFDOURoQyxJQUFJLEVBQUU7TUFDUixDQUFDLENBQUM7TUFDRjtJQUNGO0lBRUEsTUFBTWlDLE1BQU0sR0FBR3RFLG9CQUFvQixDQUFDQyxLQUFLLEVBQUVDLFFBQVEsQ0FBQztJQUNwRCxJQUFJcUUsYUFBYSxFQUFFLE1BQU0sR0FBRyxTQUFTO0lBQ3JDLE1BQU1DLE9BQU8sR0FBRyxNQUFNekYsZ0JBQWdCLENBQUM7TUFDckMwRixjQUFjLEVBQUVILE1BQU07TUFDdEJJLFdBQVcsRUFBRXpFLEtBQUssSUFBSSxtQkFBbUI7TUFDekM2RCxLQUFLO01BQ0xhLGNBQWMsRUFBRSxNQUFNO01BQ3RCQyxTQUFTLEVBQUUsSUFBSTtNQUNmcEIsTUFBTTtNQUNOcUIscUJBQXFCLEVBQUUsSUFBSTtNQUMzQkMsWUFBWSxFQUFFbkIsR0FBRyxJQUFJO1FBQ25CWSxhQUFhLEdBQUdaLEdBQUc7TUFDckI7SUFDRixDQUFDLENBQUM7SUFDRixJQUFJLENBQUNhLE9BQU8sRUFBRTtNQUNaeEcsUUFBUSxDQUFDLCtCQUErQixFQUFFO1FBQ3hDd0UsTUFBTSxFQUFFLENBQUMrQixhQUFhLEdBQ2xCLGFBQWEsR0FDYixlQUFlLEtBQUt4RztNQUMxQixDQUFDLENBQUM7TUFDRlksMEJBQTBCLENBQUM7UUFDekJ5RCxLQUFLLEVBQUUscUNBQXFDbUMsYUFBYSxHQUFHLE1BQU1BLGFBQWEsRUFBRSxHQUFHLEVBQUUsNEJBQTRCO1FBQ2xIbEMsSUFBSSxFQUFFO01BQ1IsQ0FBQyxDQUFDO01BQ0Y7SUFDRjtJQUNBN0IsU0FBUyxHQUFHZ0UsT0FBTyxDQUFDTyxFQUFFO0lBRXRCLE1BQU10RSxHQUFHLEdBQUc1QyxtQkFBbUIsQ0FBQzJHLE9BQU8sQ0FBQ08sRUFBRSxFQUFFbEYsT0FBTyxDQUFDQyxHQUFHLENBQUNzRCxtQkFBbUIsQ0FBQztJQUM1RXpDLFdBQVcsQ0FBQ0UsSUFBSSxLQUFLO01BQ25CLEdBQUdBLElBQUk7TUFDUHNCLG1CQUFtQixFQUFFMUIsR0FBRztNQUN4QjBDLGtCQUFrQixFQUFFMUI7SUFDdEIsQ0FBQyxDQUFDLENBQUM7SUFDSGlDLGNBQWMsR0FBR1osd0JBQXdCLENBQUNyQyxHQUFHLENBQUMsQ0FBQztJQUMvQ3pDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRTtNQUNuQ2dILGFBQWEsRUFBRUMsT0FBTyxDQUFDL0UsUUFBUSxDQUFDO01BQ2hDNEQsS0FBSyxFQUNIQSxLQUFLLElBQUkvRjtJQUNiLENBQUMsQ0FBQztJQUNGO0lBQ0E7SUFDQSxNQUFNO01BQUV3QztJQUFPLENBQUMsR0FBR2pDLHVCQUF1QixDQUFDO01BQ3pDNEcsY0FBYyxFQUFFLFdBQVc7TUFDM0JWLE9BQU8sRUFBRTtRQUFFTyxFQUFFLEVBQUVQLE9BQU8sQ0FBQ08sRUFBRTtRQUFFSSxLQUFLLEVBQUVsRixLQUFLLElBQUk7TUFBWSxDQUFDO01BQ3hEbUYsT0FBTyxFQUFFbkYsS0FBSztNQUNkb0YsT0FBTyxFQUFFO1FBQ1BDLGVBQWUsRUFBRSxJQUFJQyxlQUFlLENBQUMsQ0FBQztRQUN0QzdFLFdBQVc7UUFDWEM7TUFDRixDQUFDO01BQ0Q2RSxXQUFXLEVBQUU7SUFDZixDQUFDLENBQUM7SUFDRmxGLGlCQUFpQixDQUFDQyxNQUFNLEVBQUVpRSxPQUFPLENBQUNPLEVBQUUsRUFBRXRFLEdBQUcsRUFBRUMsV0FBVyxFQUFFQyxXQUFXLENBQUM7RUFDdEUsQ0FBQyxDQUFDLE9BQU80QixDQUFDLEVBQUU7SUFDVjdELFFBQVEsQ0FBQzZELENBQUMsQ0FBQztJQUNYdkUsUUFBUSxDQUFDLCtCQUErQixFQUFFO01BQ3hDd0UsTUFBTSxFQUNKLGtCQUFrQixJQUFJekU7SUFDMUIsQ0FBQyxDQUFDO0lBQ0ZZLDBCQUEwQixDQUFDO01BQ3pCeUQsS0FBSyxFQUFFLGlDQUFpQzNELFlBQVksQ0FBQzhELENBQUMsQ0FBQyxFQUFFO01BQ3pERixJQUFJLEVBQUU7SUFDUixDQUFDLENBQUM7SUFDRixJQUFJN0IsU0FBUyxFQUFFO01BQ2I7TUFDQTtNQUNBLEtBQUsxQixvQkFBb0IsQ0FBQzBCLFNBQVMsQ0FBQyxDQUFDaUMsS0FBSyxDQUFDZ0QsR0FBRyxJQUM1Q2pILGVBQWUsQ0FBQywrQ0FBK0MsRUFBRWlILEdBQUcsQ0FDdEUsQ0FBQztNQUNEO01BQ0E7TUFDQTlFLFdBQVcsQ0FBQ0UsSUFBSSxJQUNkQSxJQUFJLENBQUNzQixtQkFBbUIsR0FDcEI7UUFBRSxHQUFHdEIsSUFBSTtRQUFFc0IsbUJBQW1CLEVBQUVWO01BQVUsQ0FBQyxHQUMzQ1osSUFDTixDQUFDO0lBQ0g7RUFDRixDQUFDLFNBQVM7SUFDUjtJQUNBRixXQUFXLENBQUNFLElBQUksSUFDZEEsSUFBSSxDQUFDc0Msa0JBQWtCLEdBQ25CO01BQUUsR0FBR3RDLElBQUk7TUFBRXNDLGtCQUFrQixFQUFFMUI7SUFBVSxDQUFDLEdBQzFDWixJQUNOLENBQUM7RUFDSDtBQUNGO0FBRUEsTUFBTTZFLElBQUksRUFBRW5ILG1CQUFtQixHQUFHLE1BQUFtSCxDQUFPQyxNQUFNLEVBQUVOLE9BQU8sRUFBRU8sSUFBSSxLQUFLO0VBQ2pFLE1BQU0zRixLQUFLLEdBQUcyRixJQUFJLENBQUNDLElBQUksQ0FBQyxDQUFDOztFQUV6QjtFQUNBLElBQUksQ0FBQzVGLEtBQUssRUFBRTtJQUNWLE1BQU0wRCxHQUFHLEdBQUcsTUFBTUwsZUFBZSxDQUFDO01BQ2hDckQsS0FBSztNQUNMUyxXQUFXLEVBQUUyRSxPQUFPLENBQUMzRSxXQUFXO01BQ2hDQyxXQUFXLEVBQUUwRSxPQUFPLENBQUMxRSxXQUFXO01BQ2hDNkMsTUFBTSxFQUFFNkIsT0FBTyxDQUFDQyxlQUFlLENBQUM5QjtJQUNsQyxDQUFDLENBQUM7SUFDRm1DLE1BQU0sQ0FBQ2hDLEdBQUcsRUFBRTtNQUFFbUMsT0FBTyxFQUFFO0lBQVMsQ0FBQyxDQUFDO0lBQ2xDLE9BQU8sSUFBSTtFQUNiOztFQUVBO0VBQ0E7RUFDQTtFQUNBLE1BQU07SUFBRTNELG1CQUFtQixFQUFFeUIsTUFBTTtJQUFFVDtFQUFtQixDQUFDLEdBQ3ZEa0MsT0FBTyxDQUFDM0UsV0FBVyxDQUFDLENBQUM7RUFDdkIsSUFBSWtELE1BQU0sSUFBSVQsa0JBQWtCLEVBQUU7SUFDaENuRixRQUFRLENBQUMsK0JBQStCLEVBQUU7TUFDeEN3RSxNQUFNLEVBQUUsQ0FBQ29CLE1BQU0sR0FDWCxpQkFBaUIsR0FDakIsbUJBQW1CLEtBQUs3RjtJQUM5QixDQUFDLENBQUM7SUFDRjRILE1BQU0sQ0FBQzVDLHlCQUF5QixDQUFDYSxNQUFNLENBQUMsRUFBRTtNQUFFa0MsT0FBTyxFQUFFO0lBQVMsQ0FBQyxDQUFDO0lBQ2hFLE9BQU8sSUFBSTtFQUNiOztFQUVBO0VBQ0E7RUFDQTtFQUNBVCxPQUFPLENBQUMxRSxXQUFXLENBQUNFLElBQUksS0FBSztJQUFFLEdBQUdBLElBQUk7SUFBRWtGLHNCQUFzQixFQUFFO01BQUU5RjtJQUFNO0VBQUUsQ0FBQyxDQUFDLENBQUM7RUFDN0U7RUFDQTtFQUNBMEYsTUFBTSxDQUFDbEUsU0FBUyxFQUFFO0lBQUVxRSxPQUFPLEVBQUU7RUFBTyxDQUFDLENBQUM7RUFDdEMsT0FBTyxJQUFJO0FBQ2IsQ0FBQztBQUVELGVBQWU7RUFDYjFCLElBQUksRUFBRSxXQUFXO0VBQ2pCNEIsSUFBSSxFQUFFLFdBQVc7RUFDakJ0QixXQUFXLEVBQUUsNkZBQTZGdkYsYUFBYSxFQUFFO0VBQ3pIOEcsWUFBWSxFQUFFLFVBQVU7RUFDeEJDLFNBQVMsRUFBRUEsQ0FBQSxLQUFNLFVBQVUsS0FBSyxLQUFLO0VBQ3JDQyxJQUFJLEVBQUVBLENBQUEsS0FBTWxELE9BQU8sQ0FBQ21ELE9BQU8sQ0FBQztJQUFFVjtFQUFLLENBQUM7QUFDdEMsQ0FBQyxXQUFXL0gsT0FBTyIsImlnbm9yZUxpc3QiOltdfQ==