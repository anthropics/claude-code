import { feature } from 'bun:bundle';
import type { UUID } from 'crypto';
import figures from 'figures';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { useAppState, useAppStateStore, useSetAppState } from 'src/state/AppState.js';
import { getSdkBetas, getSessionId, isSessionPersistenceDisabled, setHasExitedPlanMode, setNeedsAutoModeExitAttachment, setNeedsPlanModeExitAttachment } from '../../../bootstrap/state.js';
import { generateSessionName } from '../../../commands/rename/generateSessionName.js';
import { launchUltraplan } from '../../../commands/ultraplan.js';
import type { KeyboardEvent } from '../../../ink/events/keyboard-event.js';
import { Box, Text } from '../../../ink.js';
import type { AppState } from '../../../state/AppStateStore.js';
import { AGENT_TOOL_NAME } from '../../../tools/AgentTool/constants.js';
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from '../../../tools/ExitPlanModeTool/constants.js';
import type { AllowedPrompt } from '../../../tools/ExitPlanModeTool/ExitPlanModeV2Tool.js';
import { TEAM_CREATE_TOOL_NAME } from '../../../tools/TeamCreateTool/constants.js';
import { isAgentSwarmsEnabled } from '../../../utils/agentSwarmsEnabled.js';
import { calculateContextPercentages, getContextWindowForModel } from '../../../utils/context.js';
import { getExternalEditor } from '../../../utils/editor.js';
import { getDisplayPath } from '../../../utils/file.js';
import { toIDEDisplayName } from '../../../utils/ide.js';
import { logError } from '../../../utils/log.js';
import { enqueuePendingNotification } from '../../../utils/messageQueueManager.js';
import { createUserMessage } from '../../../utils/messages.js';
import { getMainLoopModel, getRuntimeMainLoopModel } from '../../../utils/model/model.js';
import { createPromptRuleContent, isClassifierPermissionsEnabled, PROMPT_PREFIX } from '../../../utils/permissions/bashClassifier.js';
import { type PermissionMode, toExternalPermissionMode } from '../../../utils/permissions/PermissionMode.js';
import type { PermissionUpdate } from '../../../utils/permissions/PermissionUpdateSchema.js';
import { isAutoModeGateEnabled, restoreDangerousPermissions, stripDangerousPermissionsForAutoMode } from '../../../utils/permissions/permissionSetup.js';
import { getPewterLedgerVariant, isPlanModeInterviewPhaseEnabled } from '../../../utils/planModeV2.js';
import { getPlan, getPlanFilePath } from '../../../utils/plans.js';
import { editFileInEditor, editPromptInEditor } from '../../../utils/promptEditor.js';
import { getCurrentSessionTitle, getTranscriptPath, saveAgentName, saveCustomTitle } from '../../../utils/sessionStorage.js';
import { getSettings_DEPRECATED } from '../../../utils/settings/settings.js';
import { type OptionWithDescription, Select } from '../../CustomSelect/index.js';
import { Markdown } from '../../Markdown.js';
import { PermissionDialog } from '../PermissionDialog.js';
import type { PermissionRequestProps } from '../PermissionRequest.js';
import { PermissionRuleExplanation } from '../PermissionRuleExplanation.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const autoModeStateModule = feature('TRANSCRIPT_CLASSIFIER') ? require('../../../utils/permissions/autoModeState.js') as typeof import('../../../utils/permissions/autoModeState.js') : null;
import type { Base64ImageSource, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
/* eslint-enable @typescript-eslint/no-require-imports */
import type { PastedContent } from '../../../utils/config.js';
import type { ImageDimensions } from '../../../utils/imageResizer.js';
import { maybeResizeAndDownsampleImageBlock } from '../../../utils/imageResizer.js';
import { cacheImagePath, storeImage } from '../../../utils/imageStore.js';
type ResponseValue = 'yes-bypass-permissions' | 'yes-accept-edits' | 'yes-accept-edits-keep-context' | 'yes-default-keep-context' | 'yes-resume-auto-mode' | 'yes-auto-clear-context' | 'ultraplan' | 'no';

/**
 * Build permission updates for plan approval, including prompt-based rules if provided.
 * Prompt-based rules are only added when classifier permissions are enabled (Ant-only).
 */
export function buildPermissionUpdates(mode: PermissionMode, allowedPrompts?: AllowedPrompt[]): PermissionUpdate[] {
  const updates: PermissionUpdate[] = [{
    type: 'setMode',
    mode: toExternalPermissionMode(mode),
    destination: 'session'
  }];

  // Add prompt-based permission rules if provided (Ant-only feature)
  if (isClassifierPermissionsEnabled() && allowedPrompts && allowedPrompts.length > 0) {
    updates.push({
      type: 'addRules',
      rules: allowedPrompts.map(p => ({
        toolName: p.tool,
        ruleContent: createPromptRuleContent(p.prompt)
      })),
      behavior: 'allow',
      destination: 'session'
    });
  }
  return updates;
}

/**
 * Auto-name the session from the plan content when the user accepts a plan,
 * if they haven't already named it via /rename or --name. Fire-and-forget.
 * Mirrors /rename: kebab-case name, updates the prompt-border badge.
 */
export function autoNameSessionFromPlan(plan: string, setAppState: (updater: (prev: AppState) => AppState) => void, isClearContext: boolean): void {
  if (isSessionPersistenceDisabled() || getSettings_DEPRECATED()?.cleanupPeriodDays === 0) {
    return;
  }
  // On clear-context, the current session is about to be abandoned — its
  // title (which may have been set by a PRIOR auto-name) is irrelevant.
  // Checking it would make the feature self-defeating after first use.
  if (!isClearContext && getCurrentSessionTitle(getSessionId())) return;
  void generateSessionName(
  // generateSessionName tail-slices to the last 1000 chars (correct for
  // conversations, where recency matters). Plans front-load the goal and
  // end with testing steps — head-slice so Haiku sees the summary.
  [createUserMessage({
    content: plan.slice(0, 1000)
  })], new AbortController().signal).then(async name => {
    // On clear-context acceptance, regenerateSessionId() has run by now —
    // this intentionally names the NEW execution session. Do not "fix" by
    // capturing sessionId once; that would name the abandoned planning session.
    if (!name || getCurrentSessionTitle(getSessionId())) return;
    const sessionId = getSessionId() as UUID;
    const fullPath = getTranscriptPath();
    await saveCustomTitle(sessionId, name, fullPath, 'auto');
    await saveAgentName(sessionId, name, fullPath, 'auto');
    setAppState(prev => {
      if (prev.standaloneAgentContext?.name === name) return prev;
      return {
        ...prev,
        standaloneAgentContext: {
          ...prev.standaloneAgentContext,
          name
        }
      };
    });
  }).catch(logError);
}
export function ExitPlanModePermissionRequest({
  toolUseConfirm,
  onDone,
  onReject,
  workerBadge,
  setStickyFooter
}: PermissionRequestProps): React.ReactNode {
  const toolPermissionContext = useAppState(s => s.toolPermissionContext);
  const setAppState = useSetAppState();
  const store = useAppStateStore();
  const {
    addNotification
  } = useNotifications();
  // Feedback text from the 'No' option's input. Threaded through onAllow as
  // acceptFeedback when the user approves — lets users annotate the plan
  // ("also update the README") without a reject+re-plan round-trip.
  const [planFeedback, setPlanFeedback] = useState('');
  const [pastedContents, setPastedContents] = useState<Record<number, PastedContent>>({});
  const nextPasteIdRef = useRef(0);
  const showClearContext = useAppState(s => s.settings.showClearContextOnPlanAccept) ?? false;
  const ultraplanSessionUrl = useAppState(s => s.ultraplanSessionUrl);
  const ultraplanLaunching = useAppState(s => s.ultraplanLaunching);
  // Hide the Ultraplan button while a session is active or launching —
  // selecting it would dismiss the dialog and reject locally before
  // launchUltraplan can notice the session exists and return "already polling".
  // feature() must sit directly in an if/ternary (bun:bundle DCE constraint).
  const showUltraplan = feature('ULTRAPLAN') ? !ultraplanSessionUrl && !ultraplanLaunching : false;
  const usage = toolUseConfirm.assistantMessage.message.usage;
  const {
    mode,
    isAutoModeAvailable,
    isBypassPermissionsModeAvailable
  } = toolPermissionContext;
  const options = useMemo(() => buildPlanApprovalOptions({
    showClearContext,
    showUltraplan,
    usedPercent: showClearContext ? getContextUsedPercent(usage, mode) : null,
    isAutoModeAvailable,
    isBypassPermissionsModeAvailable,
    onFeedbackChange: setPlanFeedback
  }), [showClearContext, showUltraplan, usage, mode, isAutoModeAvailable, isBypassPermissionsModeAvailable]);
  function onImagePaste(base64Image: string, mediaType?: string, filename?: string, dimensions?: ImageDimensions, _sourcePath?: string) {
    const pasteId = nextPasteIdRef.current++;
    const newContent: PastedContent = {
      id: pasteId,
      type: 'image',
      content: base64Image,
      mediaType: mediaType || 'image/png',
      filename: filename || 'Pasted image',
      dimensions
    };
    cacheImagePath(newContent);
    void storeImage(newContent);
    setPastedContents(prev => ({
      ...prev,
      [pasteId]: newContent
    }));
  }
  const onRemoveImage = useCallback((id: number) => {
    setPastedContents(prev => {
      const next = {
        ...prev
      };
      delete next[id];
      return next;
    });
  }, []);
  const imageAttachments = Object.values(pastedContents).filter(c => c.type === 'image');
  const hasImages = imageAttachments.length > 0;

  // TODO: Delete the branch after moving to V2
  // Use tool name to detect V2 instead of checking input.plan, because PR #10394
  // injects plan content into input.plan for hooks/SDK, which broke the old detection
  // (see issue #10878)
  const isV2 = toolUseConfirm.tool.name === EXIT_PLAN_MODE_V2_TOOL_NAME;
  const inputPlan = isV2 ? undefined : toolUseConfirm.input.plan as string | undefined;
  const planFilePath = isV2 ? getPlanFilePath() : undefined;

  // Extract allowed prompts requested by the plan (Ant-only feature)
  const allowedPrompts = toolUseConfirm.input.allowedPrompts as AllowedPrompt[] | undefined;

  // Get the raw plan to check if it's empty
  const rawPlan = inputPlan ?? getPlan();
  const isEmpty = !rawPlan || rawPlan.trim() === '';

  // Capture the variant once on mount. GrowthBook reads from a disk cache
  // so the value is stable across a single planning session. undefined =
  // control arm. The variant is a fixed 3-value enum of short literals,
  // not user input.
  const [planStructureVariant] = useState(() => (getPewterLedgerVariant() ?? undefined) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS);
  const [currentPlan, setCurrentPlan] = useState(() => {
    if (inputPlan) return inputPlan;
    const plan = getPlan();
    return plan ?? 'No plan found. Please write your plan to the plan file first.';
  });
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  // Track Ctrl+G local edits so updatedInput can include the plan (the tool
  // only echoes the plan in tool_result when input.plan is set — otherwise
  // the model already has it in context from writing the plan file).
  const [planEditedLocally, setPlanEditedLocally] = useState(false);

  // Auto-hide save message after 5 seconds
  useEffect(() => {
    if (showSaveMessage) {
      const timer = setTimeout(setShowSaveMessage, 5000, false);
      return () => clearTimeout(timer);
    }
  }, [showSaveMessage]);

  // Handle Ctrl+G to edit plan in $EDITOR, Shift+Tab for auto-accept edits
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrl && e.key === 'g') {
      e.preventDefault();
      logEvent('tengu_plan_external_editor_used', {});
      void (async () => {
        if (isV2 && planFilePath) {
          const result = await editFileInEditor(planFilePath);
          if (result.error) {
            addNotification({
              key: 'external-editor-error',
              text: result.error,
              color: 'warning',
              priority: 'high'
            });
          }
          if (result.content !== null) {
            if (result.content !== currentPlan) setPlanEditedLocally(true);
            setCurrentPlan(result.content);
            setShowSaveMessage(true);
          }
        } else {
          const result = await editPromptInEditor(currentPlan);
          if (result.error) {
            addNotification({
              key: 'external-editor-error',
              text: result.error,
              color: 'warning',
              priority: 'high'
            });
          }
          if (result.content !== null && result.content !== currentPlan) {
            setCurrentPlan(result.content);
            setShowSaveMessage(true);
          }
        }
      })();
      return;
    }

    // Shift+Tab immediately selects "auto-accept edits"
    if (e.shift && e.key === 'tab') {
      e.preventDefault();
      void handleResponse(showClearContext ? 'yes-accept-edits' : 'yes-accept-edits-keep-context');
      return;
    }
  };
  async function handleResponse(value: ResponseValue): Promise<void> {
    const trimmedFeedback = planFeedback.trim();
    const acceptFeedback = trimmedFeedback || undefined;

    // Ultraplan: reject locally, teleport the plan to CCR as a seed draft.
    // Dialog dismisses immediately so the query loop unblocks; the teleport
    // runs detached and its launch message lands via the command queue.
    if (value === 'ultraplan') {
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: 'ultraplan' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant
      });
      onDone();
      onReject();
      toolUseConfirm.onReject('Plan being refined via Ultraplan — please wait for the result.');
      void launchUltraplan({
        blurb: '',
        seedPlan: currentPlan,
        getAppState: store.getState,
        setAppState: store.setState,
        signal: new AbortController().signal
      }).then(msg => enqueuePendingNotification({
        value: msg,
        mode: 'task-notification'
      })).catch(logError);
      return;
    }

    // V1: pass plan in input. V2: plan is on disk, but if the user edited it
    // via Ctrl+G we pass it through so the tool echoes the edit in tool_result
    // (otherwise the model never sees the user's changes).
    const updatedInput = isV2 && !planEditedLocally ? {} : {
      plan: currentPlan
    };

    // If auto was active during plan (from auto mode or opt-in) and NOT going
    // to auto, deactivate auto + restore permissions + fire exit attachment.
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      const goingToAuto = (value === 'yes-resume-auto-mode' || value === 'yes-auto-clear-context') && isAutoModeGateEnabled();
      // isAutoModeActive() is the authoritative signal — prePlanMode/
      // strippedDangerousRules are stale after transitionPlanAutoMode
      // deactivates mid-plan (would cause duplicate exit attachment).
      const autoWasUsedDuringPlan = autoModeStateModule?.isAutoModeActive() ?? false;
      if (value !== 'no' && !goingToAuto && autoWasUsedDuringPlan) {
        autoModeStateModule?.setAutoModeActive(false);
        setNeedsAutoModeExitAttachment(true);
        setAppState(prev => ({
          ...prev,
          toolPermissionContext: {
            ...restoreDangerousPermissions(prev.toolPermissionContext),
            prePlanMode: undefined
          }
        }));
      }
    }

    // Clear-context options: set pending plan implementation and reject the dialog
    // The REPL will handle context clear and trigger a fresh query
    // Keep-context options skip this block and go through the normal flow below
    const isResumeAutoOption = feature('TRANSCRIPT_CLASSIFIER') ? value === 'yes-resume-auto-mode' : false;
    const isKeepContextOption = value === 'yes-accept-edits-keep-context' || value === 'yes-default-keep-context' || isResumeAutoOption;
    if (value !== 'no') {
      autoNameSessionFromPlan(currentPlan, setAppState, !isKeepContextOption);
    }
    if (value !== 'no' && !isKeepContextOption) {
      // Determine the permission mode based on the selected option
      let mode: PermissionMode = 'default';
      if (value === 'yes-bypass-permissions') {
        mode = 'bypassPermissions';
      } else if (value === 'yes-accept-edits') {
        mode = 'acceptEdits';
      } else if (feature('TRANSCRIPT_CLASSIFIER') && value === 'yes-auto-clear-context' && isAutoModeGateEnabled()) {
        // REPL's processInitialMessage handles stripDangerousPermissions + mode,
        // but does NOT set autoModeActive. Gate-off falls through to 'default'.
        mode = 'auto';
        autoModeStateModule?.setAutoModeActive(true);
      }

      // Log plan exit event
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        clearContext: true,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant,
        hasFeedback: !!acceptFeedback
      });

      // Set initial message - REPL will handle context clear and fresh query
      // Add verification instruction if the feature is enabled
      // Dead code elimination: CLAUDE_CODE_VERIFY_PLAN='false' in external builds, so === 'true' check allows Bun to eliminate the string
      const verificationInstruction = undefined === 'true' ? `\n\nIMPORTANT: When you have finished implementing the plan, you MUST call the "VerifyPlanExecution" tool directly (NOT the ${AGENT_TOOL_NAME} tool or an agent) to trigger background verification.` : '';

      // Capture the transcript path before context is cleared (session ID will be regenerated)
      const transcriptPath = getTranscriptPath();
      const transcriptHint = `\n\nIf you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: ${transcriptPath}`;
      const teamHint = isAgentSwarmsEnabled() ? `\n\nIf this plan can be broken down into multiple independent tasks, consider using the ${TEAM_CREATE_TOOL_NAME} tool to create a team and parallelize the work.` : '';
      const feedbackSuffix = acceptFeedback ? `\n\nUser feedback on this plan: ${acceptFeedback}` : '';
      setAppState(prev => ({
        ...prev,
        initialMessage: {
          message: {
            ...createUserMessage({
              content: `Implement the following plan:\n\n${currentPlan}${verificationInstruction}${transcriptHint}${teamHint}${feedbackSuffix}`
            }),
            planContent: currentPlan
          },
          clearContext: true,
          mode,
          allowedPrompts
        }
      }));
      setHasExitedPlanMode(true);
      onDone();
      onReject();
      // Reject the tool use to unblock the query loop
      // The REPL will see pendingInitialQuery and trigger fresh query
      toolUseConfirm.onReject();
      return;
    }

    // Handle auto keep-context option — needs special handling because
    // buildPermissionUpdates maps auto to 'default' via toExternalPermissionMode.
    // We set the mode directly via setAppState and sync the bootstrap state.
    if (feature('TRANSCRIPT_CLASSIFIER') && value === 'yes-resume-auto-mode' && isAutoModeGateEnabled()) {
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        clearContext: false,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant,
        hasFeedback: !!acceptFeedback
      });
      setHasExitedPlanMode(true);
      setNeedsPlanModeExitAttachment(true);
      autoModeStateModule?.setAutoModeActive(true);
      setAppState(prev => ({
        ...prev,
        toolPermissionContext: stripDangerousPermissionsForAutoMode({
          ...prev.toolPermissionContext,
          mode: 'auto',
          prePlanMode: undefined
        })
      }));
      onDone();
      toolUseConfirm.onAllow(updatedInput, [], acceptFeedback);
      return;
    }

    // Handle keep-context options (goes through normal onAllow flow)
    // yes-resume-auto-mode falls through here when the auto mode gate is
    // disabled (e.g. circuit breaker fired after the dialog rendered).
    // Without this fallback the function would return without resolving the
    // dialog, leaving the query loop blocked and safety state corrupted.
    const keepContextModes: Record<string, PermissionMode> = {
      'yes-accept-edits-keep-context': toolPermissionContext.isBypassPermissionsModeAvailable ? 'bypassPermissions' : 'acceptEdits',
      'yes-default-keep-context': 'default',
      ...(feature('TRANSCRIPT_CLASSIFIER') ? {
        'yes-resume-auto-mode': 'default' as const
      } : {})
    };
    const keepContextMode = keepContextModes[value];
    if (keepContextMode) {
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        clearContext: false,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant,
        hasFeedback: !!acceptFeedback
      });
      setHasExitedPlanMode(true);
      setNeedsPlanModeExitAttachment(true);
      onDone();
      toolUseConfirm.onAllow(updatedInput, buildPermissionUpdates(keepContextMode, allowedPrompts), acceptFeedback);
      return;
    }

    // Handle standard approval options
    const standardModes: Record<string, PermissionMode> = {
      'yes-bypass-permissions': 'bypassPermissions',
      'yes-accept-edits': 'acceptEdits'
    };
    const standardMode = standardModes[value];
    if (standardMode) {
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant,
        hasFeedback: !!acceptFeedback
      });
      setHasExitedPlanMode(true);
      setNeedsPlanModeExitAttachment(true);
      onDone();
      toolUseConfirm.onAllow(updatedInput, buildPermissionUpdates(standardMode, allowedPrompts), acceptFeedback);
      return;
    }

    // Handle 'no' - stay in plan mode
    if (value === 'no') {
      if (!trimmedFeedback && !hasImages) {
        // No feedback yet - user is still on the input field
        return;
      }
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome: 'no' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant
      });

      // Convert pasted images to ImageBlockParam[] with resizing
      let imageBlocks: ImageBlockParam[] | undefined;
      if (hasImages) {
        imageBlocks = await Promise.all(imageAttachments.map(async img => {
          const block: ImageBlockParam = {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (img.mediaType || 'image/png') as Base64ImageSource['media_type'],
              data: img.content
            }
          };
          const resized = await maybeResizeAndDownsampleImageBlock(block);
          return resized.block;
        }));
      }
      onDone();
      onReject();
      toolUseConfirm.onReject(trimmedFeedback || (hasImages ? '(See attached image)' : undefined), imageBlocks && imageBlocks.length > 0 ? imageBlocks : undefined);
    }
  }
  const editor = getExternalEditor();
  const editorName = editor ? toIDEDisplayName(editor) : null;

  // Sticky footer: when setStickyFooter is provided (fullscreen mode), the
  // Select options render in FullscreenLayout's `bottom` slot so they stay
  // visible while the user scrolls through a long plan. handleResponse is
  // wrapped in a ref so the JSX (set once per options/images change) can call
  // the latest closure without re-registering on every keystroke. React
  // reconciles the sticky-footer Select by type, preserving focus/input state.
  const handleResponseRef = useRef(handleResponse);
  handleResponseRef.current = handleResponse;
  const handleCancelRef = useRef<() => void>(undefined);
  handleCancelRef.current = () => {
    logEvent('tengu_plan_exit', {
      planLengthChars: currentPlan.length,
      outcome: 'no' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
      planStructureVariant
    });
    onDone();
    onReject();
    toolUseConfirm.onReject();
  };
  const useStickyFooter = !isEmpty && !!setStickyFooter;
  useLayoutEffect(() => {
    if (!useStickyFooter) return;
    setStickyFooter(<Box flexDirection="column" borderStyle="round" borderColor="planMode" borderLeft={false} borderRight={false} borderBottom={false} paddingX={1}>
        <Text dimColor>Would you like to proceed?</Text>
        <Box marginTop={1}>
          <Select options={options} onChange={v => void handleResponseRef.current(v)} onCancel={() => handleCancelRef.current?.()} onImagePaste={onImagePaste} pastedContents={pastedContents} onRemoveImage={onRemoveImage} />
        </Box>
        {editorName && <Box flexDirection="row" gap={1} marginTop={1}>
            <Text dimColor>ctrl-g to edit in </Text>
            <Text bold dimColor>
              {editorName}
            </Text>
            {isV2 && planFilePath && <Text dimColor> · {getDisplayPath(planFilePath)}</Text>}
            {showSaveMessage && <>
                <Text dimColor>{' · '}</Text>
                <Text color="success">{figures.tick}Plan saved!</Text>
              </>}
          </Box>}
      </Box>);
    return () => setStickyFooter(null);
    // onImagePaste/onRemoveImage are stable (useCallback/useRef-backed above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useStickyFooter, setStickyFooter, options, pastedContents, editorName, isV2, planFilePath, showSaveMessage]);

  // Simplified UI for empty plans
  if (isEmpty) {
    function handleEmptyPlanResponse(value: 'yes' | 'no'): void {
      if (value === 'yes') {
        logEvent('tengu_plan_exit', {
          planLengthChars: 0,
          outcome: 'yes-default' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
          planStructureVariant
        });
        if (feature('TRANSCRIPT_CLASSIFIER')) {
          const autoWasUsedDuringPlan = autoModeStateModule?.isAutoModeActive() ?? false;
          if (autoWasUsedDuringPlan) {
            autoModeStateModule?.setAutoModeActive(false);
            setNeedsAutoModeExitAttachment(true);
            setAppState(prev => ({
              ...prev,
              toolPermissionContext: {
                ...restoreDangerousPermissions(prev.toolPermissionContext),
                prePlanMode: undefined
              }
            }));
          }
        }
        setHasExitedPlanMode(true);
        setNeedsPlanModeExitAttachment(true);
        onDone();
        toolUseConfirm.onAllow({}, [{
          type: 'setMode',
          mode: 'default',
          destination: 'session'
        }]);
      } else {
        logEvent('tengu_plan_exit', {
          planLengthChars: 0,
          outcome: 'no' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
          planStructureVariant
        });
        onDone();
        onReject();
        toolUseConfirm.onReject();
      }
    }
    return <PermissionDialog color="planMode" title="Exit plan mode?" workerBadge={workerBadge}>
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text>Claude wants to exit plan mode</Text>
          <Box marginTop={1}>
            <Select options={[{
            label: 'Yes',
            value: 'yes' as const
          }, {
            label: 'No',
            value: 'no' as const
          }]} onChange={handleEmptyPlanResponse} onCancel={() => {
            logEvent('tengu_plan_exit', {
              planLengthChars: 0,
              outcome: 'no' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
              planStructureVariant
            });
            onDone();
            onReject();
            toolUseConfirm.onReject();
          }} />
          </Box>
        </Box>
      </PermissionDialog>;
  }
  return <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <PermissionDialog color="planMode" title="Ready to code?" innerPaddingX={0} workerBadge={workerBadge}>
        <Box flexDirection="column" marginTop={1}>
          <Box paddingX={1} flexDirection="column">
            <Text>Here is Claude&apos;s plan:</Text>
          </Box>
          <Box borderColor="subtle" borderStyle="dashed" flexDirection="column" borderLeft={false} borderRight={false} paddingX={1} marginBottom={1}
        // Necessary for Windows Terminal to render properly
        overflow="hidden">
            <Markdown>{currentPlan}</Markdown>
          </Box>
          <Box flexDirection="column" paddingX={1}>
            <PermissionRuleExplanation permissionResult={toolUseConfirm.permissionResult} toolType="tool" />
            {isClassifierPermissionsEnabled() && allowedPrompts && allowedPrompts.length > 0 && <Box flexDirection="column" marginBottom={1}>
                  <Text bold>Requested permissions:</Text>
                  {allowedPrompts.map((p, i) => <Text key={i} dimColor>
                      {'  '}· {p.tool}({PROMPT_PREFIX} {p.prompt})
                    </Text>)}
                </Box>}
            {!useStickyFooter && <>
                <Text dimColor>
                  Claude has written up a plan and is ready to execute. Would
                  you like to proceed?
                </Text>
                <Box marginTop={1}>
                  <Select options={options} onChange={handleResponse} onCancel={() => handleCancelRef.current?.()} onImagePaste={onImagePaste} pastedContents={pastedContents} onRemoveImage={onRemoveImage} />
                </Box>
              </>}
          </Box>
        </Box>
      </PermissionDialog>
      {!useStickyFooter && editorName && <Box flexDirection="row" gap={1} paddingX={1} marginTop={1}>
          <Box>
            <Text dimColor>ctrl-g to edit in </Text>
            <Text bold dimColor>
              {editorName}
            </Text>
            {isV2 && planFilePath && <Text dimColor> · {getDisplayPath(planFilePath)}</Text>}
          </Box>
          {showSaveMessage && <Box>
              <Text dimColor>{' · '}</Text>
              <Text color="success">{figures.tick}Plan saved!</Text>
            </Box>}
        </Box>}
    </Box>;
}

/** @internal Exported for testing. */
export function buildPlanApprovalOptions({
  showClearContext,
  showUltraplan,
  usedPercent,
  isAutoModeAvailable,
  isBypassPermissionsModeAvailable,
  onFeedbackChange
}: {
  showClearContext: boolean;
  showUltraplan: boolean;
  usedPercent: number | null;
  isAutoModeAvailable: boolean | undefined;
  isBypassPermissionsModeAvailable: boolean | undefined;
  onFeedbackChange: (v: string) => void;
}): OptionWithDescription<ResponseValue>[] {
  const options: OptionWithDescription<ResponseValue>[] = [];
  const usedLabel = usedPercent !== null ? ` (${usedPercent}% used)` : '';
  if (showClearContext) {
    if (feature('TRANSCRIPT_CLASSIFIER') && isAutoModeAvailable) {
      options.push({
        label: `Yes, clear context${usedLabel} and use auto mode`,
        value: 'yes-auto-clear-context'
      });
    } else if (isBypassPermissionsModeAvailable) {
      options.push({
        label: `Yes, clear context${usedLabel} and bypass permissions`,
        value: 'yes-bypass-permissions'
      });
    } else {
      options.push({
        label: `Yes, clear context${usedLabel} and auto-accept edits`,
        value: 'yes-accept-edits'
      });
    }
  }

  // Slot 2: keep-context with elevated mode (same priority: auto > bypass > edits).
  if (feature('TRANSCRIPT_CLASSIFIER') && isAutoModeAvailable) {
    options.push({
      label: 'Yes, and use auto mode',
      value: 'yes-resume-auto-mode'
    });
  } else if (isBypassPermissionsModeAvailable) {
    options.push({
      label: 'Yes, and bypass permissions',
      value: 'yes-accept-edits-keep-context'
    });
  } else {
    options.push({
      label: 'Yes, auto-accept edits',
      value: 'yes-accept-edits-keep-context'
    });
  }
  options.push({
    label: 'Yes, manually approve edits',
    value: 'yes-default-keep-context'
  });
  if (showUltraplan) {
    options.push({
      label: 'No, refine with Ultraplan on Claude Code on the web',
      value: 'ultraplan'
    });
  }
  options.push({
    type: 'input',
    label: 'No, keep planning',
    value: 'no',
    placeholder: 'Tell Claude what to change',
    description: 'shift+tab to approve with this feedback',
    onChange: onFeedbackChange
  });
  return options;
}
function getContextUsedPercent(usage: {
  input_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
} | undefined, permissionMode: PermissionMode): number | null {
  if (!usage) return null;
  const runtimeModel = getRuntimeMainLoopModel({
    permissionMode,
    mainLoopModel: getMainLoopModel(),
    exceeds200kTokens: false
  });
  const contextWindowSize = getContextWindowForModel(runtimeModel, getSdkBetas());
  const {
    used
  } = calculateContextPercentages({
    input_tokens: usage.input_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0
  }, contextWindowSize);
  return used;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiVVVJRCIsImZpZ3VyZXMiLCJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlRWZmZWN0IiwidXNlTGF5b3V0RWZmZWN0IiwidXNlTWVtbyIsInVzZVJlZiIsInVzZVN0YXRlIiwidXNlTm90aWZpY2F0aW9ucyIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsInVzZUFwcFN0YXRlIiwidXNlQXBwU3RhdGVTdG9yZSIsInVzZVNldEFwcFN0YXRlIiwiZ2V0U2RrQmV0YXMiLCJnZXRTZXNzaW9uSWQiLCJpc1Nlc3Npb25QZXJzaXN0ZW5jZURpc2FibGVkIiwic2V0SGFzRXhpdGVkUGxhbk1vZGUiLCJzZXROZWVkc0F1dG9Nb2RlRXhpdEF0dGFjaG1lbnQiLCJzZXROZWVkc1BsYW5Nb2RlRXhpdEF0dGFjaG1lbnQiLCJnZW5lcmF0ZVNlc3Npb25OYW1lIiwibGF1bmNoVWx0cmFwbGFuIiwiS2V5Ym9hcmRFdmVudCIsIkJveCIsIlRleHQiLCJBcHBTdGF0ZSIsIkFHRU5UX1RPT0xfTkFNRSIsIkVYSVRfUExBTl9NT0RFX1YyX1RPT0xfTkFNRSIsIkFsbG93ZWRQcm9tcHQiLCJURUFNX0NSRUFURV9UT09MX05BTUUiLCJpc0FnZW50U3dhcm1zRW5hYmxlZCIsImNhbGN1bGF0ZUNvbnRleHRQZXJjZW50YWdlcyIsImdldENvbnRleHRXaW5kb3dGb3JNb2RlbCIsImdldEV4dGVybmFsRWRpdG9yIiwiZ2V0RGlzcGxheVBhdGgiLCJ0b0lERURpc3BsYXlOYW1lIiwibG9nRXJyb3IiLCJlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiIsImNyZWF0ZVVzZXJNZXNzYWdlIiwiZ2V0TWFpbkxvb3BNb2RlbCIsImdldFJ1bnRpbWVNYWluTG9vcE1vZGVsIiwiY3JlYXRlUHJvbXB0UnVsZUNvbnRlbnQiLCJpc0NsYXNzaWZpZXJQZXJtaXNzaW9uc0VuYWJsZWQiLCJQUk9NUFRfUFJFRklYIiwiUGVybWlzc2lvbk1vZGUiLCJ0b0V4dGVybmFsUGVybWlzc2lvbk1vZGUiLCJQZXJtaXNzaW9uVXBkYXRlIiwiaXNBdXRvTW9kZUdhdGVFbmFibGVkIiwicmVzdG9yZURhbmdlcm91c1Blcm1pc3Npb25zIiwic3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlIiwiZ2V0UGV3dGVyTGVkZ2VyVmFyaWFudCIsImlzUGxhbk1vZGVJbnRlcnZpZXdQaGFzZUVuYWJsZWQiLCJnZXRQbGFuIiwiZ2V0UGxhbkZpbGVQYXRoIiwiZWRpdEZpbGVJbkVkaXRvciIsImVkaXRQcm9tcHRJbkVkaXRvciIsImdldEN1cnJlbnRTZXNzaW9uVGl0bGUiLCJnZXRUcmFuc2NyaXB0UGF0aCIsInNhdmVBZ2VudE5hbWUiLCJzYXZlQ3VzdG9tVGl0bGUiLCJnZXRTZXR0aW5nc19ERVBSRUNBVEVEIiwiT3B0aW9uV2l0aERlc2NyaXB0aW9uIiwiU2VsZWN0IiwiTWFya2Rvd24iLCJQZXJtaXNzaW9uRGlhbG9nIiwiUGVybWlzc2lvblJlcXVlc3RQcm9wcyIsIlBlcm1pc3Npb25SdWxlRXhwbGFuYXRpb24iLCJhdXRvTW9kZVN0YXRlTW9kdWxlIiwicmVxdWlyZSIsIkJhc2U2NEltYWdlU291cmNlIiwiSW1hZ2VCbG9ja1BhcmFtIiwiUGFzdGVkQ29udGVudCIsIkltYWdlRGltZW5zaW9ucyIsIm1heWJlUmVzaXplQW5kRG93bnNhbXBsZUltYWdlQmxvY2siLCJjYWNoZUltYWdlUGF0aCIsInN0b3JlSW1hZ2UiLCJSZXNwb25zZVZhbHVlIiwiYnVpbGRQZXJtaXNzaW9uVXBkYXRlcyIsIm1vZGUiLCJhbGxvd2VkUHJvbXB0cyIsInVwZGF0ZXMiLCJ0eXBlIiwiZGVzdGluYXRpb24iLCJsZW5ndGgiLCJwdXNoIiwicnVsZXMiLCJtYXAiLCJwIiwidG9vbE5hbWUiLCJ0b29sIiwicnVsZUNvbnRlbnQiLCJwcm9tcHQiLCJiZWhhdmlvciIsImF1dG9OYW1lU2Vzc2lvbkZyb21QbGFuIiwicGxhbiIsInNldEFwcFN0YXRlIiwidXBkYXRlciIsInByZXYiLCJpc0NsZWFyQ29udGV4dCIsImNsZWFudXBQZXJpb2REYXlzIiwiY29udGVudCIsInNsaWNlIiwiQWJvcnRDb250cm9sbGVyIiwic2lnbmFsIiwidGhlbiIsIm5hbWUiLCJzZXNzaW9uSWQiLCJmdWxsUGF0aCIsInN0YW5kYWxvbmVBZ2VudENvbnRleHQiLCJjYXRjaCIsIkV4aXRQbGFuTW9kZVBlcm1pc3Npb25SZXF1ZXN0IiwidG9vbFVzZUNvbmZpcm0iLCJvbkRvbmUiLCJvblJlamVjdCIsIndvcmtlckJhZGdlIiwic2V0U3RpY2t5Rm9vdGVyIiwiUmVhY3ROb2RlIiwidG9vbFBlcm1pc3Npb25Db250ZXh0IiwicyIsInN0b3JlIiwiYWRkTm90aWZpY2F0aW9uIiwicGxhbkZlZWRiYWNrIiwic2V0UGxhbkZlZWRiYWNrIiwicGFzdGVkQ29udGVudHMiLCJzZXRQYXN0ZWRDb250ZW50cyIsIlJlY29yZCIsIm5leHRQYXN0ZUlkUmVmIiwic2hvd0NsZWFyQ29udGV4dCIsInNldHRpbmdzIiwic2hvd0NsZWFyQ29udGV4dE9uUGxhbkFjY2VwdCIsInVsdHJhcGxhblNlc3Npb25VcmwiLCJ1bHRyYXBsYW5MYXVuY2hpbmciLCJzaG93VWx0cmFwbGFuIiwidXNhZ2UiLCJhc3Npc3RhbnRNZXNzYWdlIiwibWVzc2FnZSIsImlzQXV0b01vZGVBdmFpbGFibGUiLCJpc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZSIsIm9wdGlvbnMiLCJidWlsZFBsYW5BcHByb3ZhbE9wdGlvbnMiLCJ1c2VkUGVyY2VudCIsImdldENvbnRleHRVc2VkUGVyY2VudCIsIm9uRmVlZGJhY2tDaGFuZ2UiLCJvbkltYWdlUGFzdGUiLCJiYXNlNjRJbWFnZSIsIm1lZGlhVHlwZSIsImZpbGVuYW1lIiwiZGltZW5zaW9ucyIsIl9zb3VyY2VQYXRoIiwicGFzdGVJZCIsImN1cnJlbnQiLCJuZXdDb250ZW50IiwiaWQiLCJvblJlbW92ZUltYWdlIiwibmV4dCIsImltYWdlQXR0YWNobWVudHMiLCJPYmplY3QiLCJ2YWx1ZXMiLCJmaWx0ZXIiLCJjIiwiaGFzSW1hZ2VzIiwiaXNWMiIsImlucHV0UGxhbiIsInVuZGVmaW5lZCIsImlucHV0IiwicGxhbkZpbGVQYXRoIiwicmF3UGxhbiIsImlzRW1wdHkiLCJ0cmltIiwicGxhblN0cnVjdHVyZVZhcmlhbnQiLCJjdXJyZW50UGxhbiIsInNldEN1cnJlbnRQbGFuIiwic2hvd1NhdmVNZXNzYWdlIiwic2V0U2hvd1NhdmVNZXNzYWdlIiwicGxhbkVkaXRlZExvY2FsbHkiLCJzZXRQbGFuRWRpdGVkTG9jYWxseSIsInRpbWVyIiwic2V0VGltZW91dCIsImNsZWFyVGltZW91dCIsImhhbmRsZUtleURvd24iLCJlIiwiY3RybCIsImtleSIsInByZXZlbnREZWZhdWx0IiwicmVzdWx0IiwiZXJyb3IiLCJ0ZXh0IiwiY29sb3IiLCJwcmlvcml0eSIsInNoaWZ0IiwiaGFuZGxlUmVzcG9uc2UiLCJ2YWx1ZSIsIlByb21pc2UiLCJ0cmltbWVkRmVlZGJhY2siLCJhY2NlcHRGZWVkYmFjayIsInBsYW5MZW5ndGhDaGFycyIsIm91dGNvbWUiLCJpbnRlcnZpZXdQaGFzZUVuYWJsZWQiLCJibHVyYiIsInNlZWRQbGFuIiwiZ2V0QXBwU3RhdGUiLCJnZXRTdGF0ZSIsInNldFN0YXRlIiwibXNnIiwidXBkYXRlZElucHV0IiwiZ29pbmdUb0F1dG8iLCJhdXRvV2FzVXNlZER1cmluZ1BsYW4iLCJpc0F1dG9Nb2RlQWN0aXZlIiwic2V0QXV0b01vZGVBY3RpdmUiLCJwcmVQbGFuTW9kZSIsImlzUmVzdW1lQXV0b09wdGlvbiIsImlzS2VlcENvbnRleHRPcHRpb24iLCJjbGVhckNvbnRleHQiLCJoYXNGZWVkYmFjayIsInZlcmlmaWNhdGlvbkluc3RydWN0aW9uIiwidHJhbnNjcmlwdFBhdGgiLCJ0cmFuc2NyaXB0SGludCIsInRlYW1IaW50IiwiZmVlZGJhY2tTdWZmaXgiLCJpbml0aWFsTWVzc2FnZSIsInBsYW5Db250ZW50Iiwib25BbGxvdyIsImtlZXBDb250ZXh0TW9kZXMiLCJjb25zdCIsImtlZXBDb250ZXh0TW9kZSIsInN0YW5kYXJkTW9kZXMiLCJzdGFuZGFyZE1vZGUiLCJpbWFnZUJsb2NrcyIsImFsbCIsImltZyIsImJsb2NrIiwic291cmNlIiwibWVkaWFfdHlwZSIsImRhdGEiLCJyZXNpemVkIiwiZWRpdG9yIiwiZWRpdG9yTmFtZSIsImhhbmRsZVJlc3BvbnNlUmVmIiwiaGFuZGxlQ2FuY2VsUmVmIiwidXNlU3RpY2t5Rm9vdGVyIiwidiIsInRpY2siLCJoYW5kbGVFbXB0eVBsYW5SZXNwb25zZSIsImxhYmVsIiwicGVybWlzc2lvblJlc3VsdCIsImkiLCJ1c2VkTGFiZWwiLCJwbGFjZWhvbGRlciIsImRlc2NyaXB0aW9uIiwib25DaGFuZ2UiLCJpbnB1dF90b2tlbnMiLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyIsInBlcm1pc3Npb25Nb2RlIiwicnVudGltZU1vZGVsIiwibWFpbkxvb3BNb2RlbCIsImV4Y2VlZHMyMDBrVG9rZW5zIiwiY29udGV4dFdpbmRvd1NpemUiLCJ1c2VkIl0sInNvdXJjZXMiOlsiRXhpdFBsYW5Nb2RlUGVybWlzc2lvblJlcXVlc3QudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHR5cGUgeyBVVUlEIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCwge1xuICB1c2VDYWxsYmFjayxcbiAgdXNlRWZmZWN0LFxuICB1c2VMYXlvdXRFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlTm90aWZpY2F0aW9ucyB9IGZyb20gJ3NyYy9jb250ZXh0L25vdGlmaWNhdGlvbnMuanMnXG5pbXBvcnQge1xuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIGxvZ0V2ZW50LFxufSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHtcbiAgdXNlQXBwU3RhdGUsXG4gIHVzZUFwcFN0YXRlU3RvcmUsXG4gIHVzZVNldEFwcFN0YXRlLFxufSBmcm9tICdzcmMvc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQge1xuICBnZXRTZGtCZXRhcyxcbiAgZ2V0U2Vzc2lvbklkLFxuICBpc1Nlc3Npb25QZXJzaXN0ZW5jZURpc2FibGVkLFxuICBzZXRIYXNFeGl0ZWRQbGFuTW9kZSxcbiAgc2V0TmVlZHNBdXRvTW9kZUV4aXRBdHRhY2htZW50LFxuICBzZXROZWVkc1BsYW5Nb2RlRXhpdEF0dGFjaG1lbnQsXG59IGZyb20gJy4uLy4uLy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7IGdlbmVyYXRlU2Vzc2lvbk5hbWUgfSBmcm9tICcuLi8uLi8uLi9jb21tYW5kcy9yZW5hbWUvZ2VuZXJhdGVTZXNzaW9uTmFtZS5qcydcbmltcG9ydCB7IGxhdW5jaFVsdHJhcGxhbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1hbmRzL3VsdHJhcGxhbi5qcydcbmltcG9ydCB0eXBlIHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2luay9ldmVudHMva2V5Ym9hcmQtZXZlbnQuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi8uLi9pbmsuanMnXG5pbXBvcnQgdHlwZSB7IEFwcFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vc3RhdGUvQXBwU3RhdGVTdG9yZS5qcydcbmltcG9ydCB7IEFHRU5UX1RPT0xfTkFNRSB9IGZyb20gJy4uLy4uLy4uL3Rvb2xzL0FnZW50VG9vbC9jb25zdGFudHMuanMnXG5pbXBvcnQgeyBFWElUX1BMQU5fTU9ERV9WMl9UT09MX05BTUUgfSBmcm9tICcuLi8uLi8uLi90b29scy9FeGl0UGxhbk1vZGVUb29sL2NvbnN0YW50cy5qcydcbmltcG9ydCB0eXBlIHsgQWxsb3dlZFByb21wdCB9IGZyb20gJy4uLy4uLy4uL3Rvb2xzL0V4aXRQbGFuTW9kZVRvb2wvRXhpdFBsYW5Nb2RlVjJUb29sLmpzJ1xuaW1wb3J0IHsgVEVBTV9DUkVBVEVfVE9PTF9OQU1FIH0gZnJvbSAnLi4vLi4vLi4vdG9vbHMvVGVhbUNyZWF0ZVRvb2wvY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQge1xuICBjYWxjdWxhdGVDb250ZXh0UGVyY2VudGFnZXMsXG4gIGdldENvbnRleHRXaW5kb3dGb3JNb2RlbCxcbn0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvY29udGV4dC5qcydcbmltcG9ydCB7IGdldEV4dGVybmFsRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZWRpdG9yLmpzJ1xuaW1wb3J0IHsgZ2V0RGlzcGxheVBhdGggfSBmcm9tICcuLi8uLi8uLi91dGlscy9maWxlLmpzJ1xuaW1wb3J0IHsgdG9JREVEaXNwbGF5TmFtZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2lkZS5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24gfSBmcm9tICcuLi8uLi8uLi91dGlscy9tZXNzYWdlUXVldWVNYW5hZ2VyLmpzJ1xuaW1wb3J0IHsgY3JlYXRlVXNlck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi91dGlscy9tZXNzYWdlcy5qcydcbmltcG9ydCB7XG4gIGdldE1haW5Mb29wTW9kZWwsXG4gIGdldFJ1bnRpbWVNYWluTG9vcE1vZGVsLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9tb2RlbC9tb2RlbC5qcydcbmltcG9ydCB7XG4gIGNyZWF0ZVByb21wdFJ1bGVDb250ZW50LFxuICBpc0NsYXNzaWZpZXJQZXJtaXNzaW9uc0VuYWJsZWQsXG4gIFBST01QVF9QUkVGSVgsXG59IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL2Jhc2hDbGFzc2lmaWVyLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBQZXJtaXNzaW9uTW9kZSxcbiAgdG9FeHRlcm5hbFBlcm1pc3Npb25Nb2RlLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9wZXJtaXNzaW9ucy9QZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvblVwZGF0ZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25VcGRhdGVTY2hlbWEuanMnXG5pbXBvcnQge1xuICBpc0F1dG9Nb2RlR2F0ZUVuYWJsZWQsXG4gIHJlc3RvcmVEYW5nZXJvdXNQZXJtaXNzaW9ucyxcbiAgc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9wZXJtaXNzaW9ucy9wZXJtaXNzaW9uU2V0dXAuanMnXG5pbXBvcnQge1xuICBnZXRQZXd0ZXJMZWRnZXJWYXJpYW50LFxuICBpc1BsYW5Nb2RlSW50ZXJ2aWV3UGhhc2VFbmFibGVkLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9wbGFuTW9kZVYyLmpzJ1xuaW1wb3J0IHsgZ2V0UGxhbiwgZ2V0UGxhbkZpbGVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvcGxhbnMuanMnXG5pbXBvcnQge1xuICBlZGl0RmlsZUluRWRpdG9yLFxuICBlZGl0UHJvbXB0SW5FZGl0b3IsXG59IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Byb21wdEVkaXRvci5qcydcbmltcG9ydCB7XG4gIGdldEN1cnJlbnRTZXNzaW9uVGl0bGUsXG4gIGdldFRyYW5zY3JpcHRQYXRoLFxuICBzYXZlQWdlbnROYW1lLFxuICBzYXZlQ3VzdG9tVGl0bGUsXG59IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHsgZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgdHlwZSBPcHRpb25XaXRoRGVzY3JpcHRpb24sIFNlbGVjdCB9IGZyb20gJy4uLy4uL0N1c3RvbVNlbGVjdC9pbmRleC5qcydcbmltcG9ydCB7IE1hcmtkb3duIH0gZnJvbSAnLi4vLi4vTWFya2Rvd24uanMnXG5pbXBvcnQgeyBQZXJtaXNzaW9uRGlhbG9nIH0gZnJvbSAnLi4vUGVybWlzc2lvbkRpYWxvZy5qcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvblJlcXVlc3RQcm9wcyB9IGZyb20gJy4uL1Blcm1pc3Npb25SZXF1ZXN0LmpzJ1xuaW1wb3J0IHsgUGVybWlzc2lvblJ1bGVFeHBsYW5hdGlvbiB9IGZyb20gJy4uL1Blcm1pc3Npb25SdWxlRXhwbGFuYXRpb24uanMnXG5cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IGF1dG9Nb2RlU3RhdGVNb2R1bGUgPSBmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKVxuICA/IChyZXF1aXJlKCcuLi8uLi8uLi91dGlscy9wZXJtaXNzaW9ucy9hdXRvTW9kZVN0YXRlLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vLi4vLi4vdXRpbHMvcGVybWlzc2lvbnMvYXV0b01vZGVTdGF0ZS5qcycpKVxuICA6IG51bGxcblxuaW1wb3J0IHR5cGUge1xuICBCYXNlNjRJbWFnZVNvdXJjZSxcbiAgSW1hZ2VCbG9ja1BhcmFtLFxufSBmcm9tICdAYW50aHJvcGljLWFpL3Nkay9yZXNvdXJjZXMvbWVzc2FnZXMubWpzJ1xuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5pbXBvcnQgdHlwZSB7IFBhc3RlZENvbnRlbnQgfSBmcm9tICcuLi8uLi8uLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgdHlwZSB7IEltYWdlRGltZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2ltYWdlUmVzaXplci5qcydcbmltcG9ydCB7IG1heWJlUmVzaXplQW5kRG93bnNhbXBsZUltYWdlQmxvY2sgfSBmcm9tICcuLi8uLi8uLi91dGlscy9pbWFnZVJlc2l6ZXIuanMnXG5pbXBvcnQgeyBjYWNoZUltYWdlUGF0aCwgc3RvcmVJbWFnZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2ltYWdlU3RvcmUuanMnXG5cbnR5cGUgUmVzcG9uc2VWYWx1ZSA9XG4gIHwgJ3llcy1ieXBhc3MtcGVybWlzc2lvbnMnXG4gIHwgJ3llcy1hY2NlcHQtZWRpdHMnXG4gIHwgJ3llcy1hY2NlcHQtZWRpdHMta2VlcC1jb250ZXh0J1xuICB8ICd5ZXMtZGVmYXVsdC1rZWVwLWNvbnRleHQnXG4gIHwgJ3llcy1yZXN1bWUtYXV0by1tb2RlJ1xuICB8ICd5ZXMtYXV0by1jbGVhci1jb250ZXh0J1xuICB8ICd1bHRyYXBsYW4nXG4gIHwgJ25vJ1xuXG4vKipcbiAqIEJ1aWxkIHBlcm1pc3Npb24gdXBkYXRlcyBmb3IgcGxhbiBhcHByb3ZhbCwgaW5jbHVkaW5nIHByb21wdC1iYXNlZCBydWxlcyBpZiBwcm92aWRlZC5cbiAqIFByb21wdC1iYXNlZCBydWxlcyBhcmUgb25seSBhZGRlZCB3aGVuIGNsYXNzaWZpZXIgcGVybWlzc2lvbnMgYXJlIGVuYWJsZWQgKEFudC1vbmx5KS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkUGVybWlzc2lvblVwZGF0ZXMoXG4gIG1vZGU6IFBlcm1pc3Npb25Nb2RlLFxuICBhbGxvd2VkUHJvbXB0cz86IEFsbG93ZWRQcm9tcHRbXSxcbik6IFBlcm1pc3Npb25VcGRhdGVbXSB7XG4gIGNvbnN0IHVwZGF0ZXM6IFBlcm1pc3Npb25VcGRhdGVbXSA9IFtcbiAgICB7XG4gICAgICB0eXBlOiAnc2V0TW9kZScsXG4gICAgICBtb2RlOiB0b0V4dGVybmFsUGVybWlzc2lvbk1vZGUobW9kZSksXG4gICAgICBkZXN0aW5hdGlvbjogJ3Nlc3Npb24nLFxuICAgIH0sXG4gIF1cblxuICAvLyBBZGQgcHJvbXB0LWJhc2VkIHBlcm1pc3Npb24gcnVsZXMgaWYgcHJvdmlkZWQgKEFudC1vbmx5IGZlYXR1cmUpXG4gIGlmIChcbiAgICBpc0NsYXNzaWZpZXJQZXJtaXNzaW9uc0VuYWJsZWQoKSAmJlxuICAgIGFsbG93ZWRQcm9tcHRzICYmXG4gICAgYWxsb3dlZFByb21wdHMubGVuZ3RoID4gMFxuICApIHtcbiAgICB1cGRhdGVzLnB1c2goe1xuICAgICAgdHlwZTogJ2FkZFJ1bGVzJyxcbiAgICAgIHJ1bGVzOiBhbGxvd2VkUHJvbXB0cy5tYXAocCA9PiAoe1xuICAgICAgICB0b29sTmFtZTogcC50b29sLFxuICAgICAgICBydWxlQ29udGVudDogY3JlYXRlUHJvbXB0UnVsZUNvbnRlbnQocC5wcm9tcHQpLFxuICAgICAgfSkpLFxuICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gICAgICBkZXN0aW5hdGlvbjogJ3Nlc3Npb24nLFxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gdXBkYXRlc1xufVxuXG4vKipcbiAqIEF1dG8tbmFtZSB0aGUgc2Vzc2lvbiBmcm9tIHRoZSBwbGFuIGNvbnRlbnQgd2hlbiB0aGUgdXNlciBhY2NlcHRzIGEgcGxhbixcbiAqIGlmIHRoZXkgaGF2ZW4ndCBhbHJlYWR5IG5hbWVkIGl0IHZpYSAvcmVuYW1lIG9yIC0tbmFtZS4gRmlyZS1hbmQtZm9yZ2V0LlxuICogTWlycm9ycyAvcmVuYW1lOiBrZWJhYi1jYXNlIG5hbWUsIHVwZGF0ZXMgdGhlIHByb21wdC1ib3JkZXIgYmFkZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhdXRvTmFtZVNlc3Npb25Gcm9tUGxhbihcbiAgcGxhbjogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogKHVwZGF0ZXI6IChwcmV2OiBBcHBTdGF0ZSkgPT4gQXBwU3RhdGUpID0+IHZvaWQsXG4gIGlzQ2xlYXJDb250ZXh0OiBib29sZWFuLFxuKTogdm9pZCB7XG4gIGlmIChcbiAgICBpc1Nlc3Npb25QZXJzaXN0ZW5jZURpc2FibGVkKCkgfHxcbiAgICBnZXRTZXR0aW5nc19ERVBSRUNBVEVEKCk/LmNsZWFudXBQZXJpb2REYXlzID09PSAwXG4gICkge1xuICAgIHJldHVyblxuICB9XG4gIC8vIE9uIGNsZWFyLWNvbnRleHQsIHRoZSBjdXJyZW50IHNlc3Npb24gaXMgYWJvdXQgdG8gYmUgYWJhbmRvbmVkIOKAlCBpdHNcbiAgLy8gdGl0bGUgKHdoaWNoIG1heSBoYXZlIGJlZW4gc2V0IGJ5IGEgUFJJT1IgYXV0by1uYW1lKSBpcyBpcnJlbGV2YW50LlxuICAvLyBDaGVja2luZyBpdCB3b3VsZCBtYWtlIHRoZSBmZWF0dXJlIHNlbGYtZGVmZWF0aW5nIGFmdGVyIGZpcnN0IHVzZS5cbiAgaWYgKCFpc0NsZWFyQ29udGV4dCAmJiBnZXRDdXJyZW50U2Vzc2lvblRpdGxlKGdldFNlc3Npb25JZCgpKSkgcmV0dXJuXG4gIHZvaWQgZ2VuZXJhdGVTZXNzaW9uTmFtZShcbiAgICAvLyBnZW5lcmF0ZVNlc3Npb25OYW1lIHRhaWwtc2xpY2VzIHRvIHRoZSBsYXN0IDEwMDAgY2hhcnMgKGNvcnJlY3QgZm9yXG4gICAgLy8gY29udmVyc2F0aW9ucywgd2hlcmUgcmVjZW5jeSBtYXR0ZXJzKS4gUGxhbnMgZnJvbnQtbG9hZCB0aGUgZ29hbCBhbmRcbiAgICAvLyBlbmQgd2l0aCB0ZXN0aW5nIHN0ZXBzIOKAlCBoZWFkLXNsaWNlIHNvIEhhaWt1IHNlZXMgdGhlIHN1bW1hcnkuXG4gICAgW2NyZWF0ZVVzZXJNZXNzYWdlKHsgY29udGVudDogcGxhbi5zbGljZSgwLCAxMDAwKSB9KV0sXG4gICAgbmV3IEFib3J0Q29udHJvbGxlcigpLnNpZ25hbCxcbiAgKVxuICAgIC50aGVuKGFzeW5jIG5hbWUgPT4ge1xuICAgICAgLy8gT24gY2xlYXItY29udGV4dCBhY2NlcHRhbmNlLCByZWdlbmVyYXRlU2Vzc2lvbklkKCkgaGFzIHJ1biBieSBub3cg4oCUXG4gICAgICAvLyB0aGlzIGludGVudGlvbmFsbHkgbmFtZXMgdGhlIE5FVyBleGVjdXRpb24gc2Vzc2lvbi4gRG8gbm90IFwiZml4XCIgYnlcbiAgICAgIC8vIGNhcHR1cmluZyBzZXNzaW9uSWQgb25jZTsgdGhhdCB3b3VsZCBuYW1lIHRoZSBhYmFuZG9uZWQgcGxhbm5pbmcgc2Vzc2lvbi5cbiAgICAgIGlmICghbmFtZSB8fCBnZXRDdXJyZW50U2Vzc2lvblRpdGxlKGdldFNlc3Npb25JZCgpKSkgcmV0dXJuXG4gICAgICBjb25zdCBzZXNzaW9uSWQgPSBnZXRTZXNzaW9uSWQoKSBhcyBVVUlEXG4gICAgICBjb25zdCBmdWxsUGF0aCA9IGdldFRyYW5zY3JpcHRQYXRoKClcbiAgICAgIGF3YWl0IHNhdmVDdXN0b21UaXRsZShzZXNzaW9uSWQsIG5hbWUsIGZ1bGxQYXRoLCAnYXV0bycpXG4gICAgICBhd2FpdCBzYXZlQWdlbnROYW1lKHNlc3Npb25JZCwgbmFtZSwgZnVsbFBhdGgsICdhdXRvJylcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBpZiAocHJldi5zdGFuZGFsb25lQWdlbnRDb250ZXh0Py5uYW1lID09PSBuYW1lKSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgc3RhbmRhbG9uZUFnZW50Q29udGV4dDogeyAuLi5wcmV2LnN0YW5kYWxvbmVBZ2VudENvbnRleHQsIG5hbWUgfSxcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuICAgIC5jYXRjaChsb2dFcnJvcilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEV4aXRQbGFuTW9kZVBlcm1pc3Npb25SZXF1ZXN0KHtcbiAgdG9vbFVzZUNvbmZpcm0sXG4gIG9uRG9uZSxcbiAgb25SZWplY3QsXG4gIHdvcmtlckJhZGdlLFxuICBzZXRTdGlja3lGb290ZXIsXG59OiBQZXJtaXNzaW9uUmVxdWVzdFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgdG9vbFBlcm1pc3Npb25Db250ZXh0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnRvb2xQZXJtaXNzaW9uQ29udGV4dClcbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG4gIGNvbnN0IHN0b3JlID0gdXNlQXBwU3RhdGVTdG9yZSgpXG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcbiAgLy8gRmVlZGJhY2sgdGV4dCBmcm9tIHRoZSAnTm8nIG9wdGlvbidzIGlucHV0LiBUaHJlYWRlZCB0aHJvdWdoIG9uQWxsb3cgYXNcbiAgLy8gYWNjZXB0RmVlZGJhY2sgd2hlbiB0aGUgdXNlciBhcHByb3ZlcyDigJQgbGV0cyB1c2VycyBhbm5vdGF0ZSB0aGUgcGxhblxuICAvLyAoXCJhbHNvIHVwZGF0ZSB0aGUgUkVBRE1FXCIpIHdpdGhvdXQgYSByZWplY3QrcmUtcGxhbiByb3VuZC10cmlwLlxuICBjb25zdCBbcGxhbkZlZWRiYWNrLCBzZXRQbGFuRmVlZGJhY2tdID0gdXNlU3RhdGUoJycpXG4gIGNvbnN0IFtwYXN0ZWRDb250ZW50cywgc2V0UGFzdGVkQ29udGVudHNdID0gdXNlU3RhdGU8XG4gICAgUmVjb3JkPG51bWJlciwgUGFzdGVkQ29udGVudD5cbiAgPih7fSlcbiAgY29uc3QgbmV4dFBhc3RlSWRSZWYgPSB1c2VSZWYoMClcblxuICBjb25zdCBzaG93Q2xlYXJDb250ZXh0ID1cbiAgICB1c2VBcHBTdGF0ZShzID0+IHMuc2V0dGluZ3Muc2hvd0NsZWFyQ29udGV4dE9uUGxhbkFjY2VwdCkgPz8gZmFsc2VcbiAgY29uc3QgdWx0cmFwbGFuU2Vzc2lvblVybCA9IHVzZUFwcFN0YXRlKHMgPT4gcy51bHRyYXBsYW5TZXNzaW9uVXJsKVxuICBjb25zdCB1bHRyYXBsYW5MYXVuY2hpbmcgPSB1c2VBcHBTdGF0ZShzID0+IHMudWx0cmFwbGFuTGF1bmNoaW5nKVxuICAvLyBIaWRlIHRoZSBVbHRyYXBsYW4gYnV0dG9uIHdoaWxlIGEgc2Vzc2lvbiBpcyBhY3RpdmUgb3IgbGF1bmNoaW5nIOKAlFxuICAvLyBzZWxlY3RpbmcgaXQgd291bGQgZGlzbWlzcyB0aGUgZGlhbG9nIGFuZCByZWplY3QgbG9jYWxseSBiZWZvcmVcbiAgLy8gbGF1bmNoVWx0cmFwbGFuIGNhbiBub3RpY2UgdGhlIHNlc3Npb24gZXhpc3RzIGFuZCByZXR1cm4gXCJhbHJlYWR5IHBvbGxpbmdcIi5cbiAgLy8gZmVhdHVyZSgpIG11c3Qgc2l0IGRpcmVjdGx5IGluIGFuIGlmL3Rlcm5hcnkgKGJ1bjpidW5kbGUgRENFIGNvbnN0cmFpbnQpLlxuICBjb25zdCBzaG93VWx0cmFwbGFuID0gZmVhdHVyZSgnVUxUUkFQTEFOJylcbiAgICA/ICF1bHRyYXBsYW5TZXNzaW9uVXJsICYmICF1bHRyYXBsYW5MYXVuY2hpbmdcbiAgICA6IGZhbHNlXG4gIGNvbnN0IHVzYWdlID0gdG9vbFVzZUNvbmZpcm0uYXNzaXN0YW50TWVzc2FnZS5tZXNzYWdlLnVzYWdlXG4gIGNvbnN0IHsgbW9kZSwgaXNBdXRvTW9kZUF2YWlsYWJsZSwgaXNCeXBhc3NQZXJtaXNzaW9uc01vZGVBdmFpbGFibGUgfSA9XG4gICAgdG9vbFBlcm1pc3Npb25Db250ZXh0XG4gIGNvbnN0IG9wdGlvbnMgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICBidWlsZFBsYW5BcHByb3ZhbE9wdGlvbnMoe1xuICAgICAgICBzaG93Q2xlYXJDb250ZXh0LFxuICAgICAgICBzaG93VWx0cmFwbGFuLFxuICAgICAgICB1c2VkUGVyY2VudDogc2hvd0NsZWFyQ29udGV4dFxuICAgICAgICAgID8gZ2V0Q29udGV4dFVzZWRQZXJjZW50KHVzYWdlLCBtb2RlKVxuICAgICAgICAgIDogbnVsbCxcbiAgICAgICAgaXNBdXRvTW9kZUF2YWlsYWJsZSxcbiAgICAgICAgaXNCeXBhc3NQZXJtaXNzaW9uc01vZGVBdmFpbGFibGUsXG4gICAgICAgIG9uRmVlZGJhY2tDaGFuZ2U6IHNldFBsYW5GZWVkYmFjayxcbiAgICAgIH0pLFxuICAgIFtcbiAgICAgIHNob3dDbGVhckNvbnRleHQsXG4gICAgICBzaG93VWx0cmFwbGFuLFxuICAgICAgdXNhZ2UsXG4gICAgICBtb2RlLFxuICAgICAgaXNBdXRvTW9kZUF2YWlsYWJsZSxcbiAgICAgIGlzQnlwYXNzUGVybWlzc2lvbnNNb2RlQXZhaWxhYmxlLFxuICAgIF0sXG4gIClcblxuICBmdW5jdGlvbiBvbkltYWdlUGFzdGUoXG4gICAgYmFzZTY0SW1hZ2U6IHN0cmluZyxcbiAgICBtZWRpYVR5cGU/OiBzdHJpbmcsXG4gICAgZmlsZW5hbWU/OiBzdHJpbmcsXG4gICAgZGltZW5zaW9ucz86IEltYWdlRGltZW5zaW9ucyxcbiAgICBfc291cmNlUGF0aD86IHN0cmluZyxcbiAgKSB7XG4gICAgY29uc3QgcGFzdGVJZCA9IG5leHRQYXN0ZUlkUmVmLmN1cnJlbnQrK1xuICAgIGNvbnN0IG5ld0NvbnRlbnQ6IFBhc3RlZENvbnRlbnQgPSB7XG4gICAgICBpZDogcGFzdGVJZCxcbiAgICAgIHR5cGU6ICdpbWFnZScsXG4gICAgICBjb250ZW50OiBiYXNlNjRJbWFnZSxcbiAgICAgIG1lZGlhVHlwZTogbWVkaWFUeXBlIHx8ICdpbWFnZS9wbmcnLFxuICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lIHx8ICdQYXN0ZWQgaW1hZ2UnLFxuICAgICAgZGltZW5zaW9ucyxcbiAgICB9XG4gICAgY2FjaGVJbWFnZVBhdGgobmV3Q29udGVudClcbiAgICB2b2lkIHN0b3JlSW1hZ2UobmV3Q29udGVudClcbiAgICBzZXRQYXN0ZWRDb250ZW50cyhwcmV2ID0+ICh7IC4uLnByZXYsIFtwYXN0ZUlkXTogbmV3Q29udGVudCB9KSlcbiAgfVxuXG4gIGNvbnN0IG9uUmVtb3ZlSW1hZ2UgPSB1c2VDYWxsYmFjaygoaWQ6IG51bWJlcikgPT4ge1xuICAgIHNldFBhc3RlZENvbnRlbnRzKHByZXYgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IHsgLi4ucHJldiB9XG4gICAgICBkZWxldGUgbmV4dFtpZF1cbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSlcbiAgfSwgW10pXG5cbiAgY29uc3QgaW1hZ2VBdHRhY2htZW50cyA9IE9iamVjdC52YWx1ZXMocGFzdGVkQ29udGVudHMpLmZpbHRlcihcbiAgICBjID0+IGMudHlwZSA9PT0gJ2ltYWdlJyxcbiAgKVxuICBjb25zdCBoYXNJbWFnZXMgPSBpbWFnZUF0dGFjaG1lbnRzLmxlbmd0aCA+IDBcblxuICAvLyBUT0RPOiBEZWxldGUgdGhlIGJyYW5jaCBhZnRlciBtb3ZpbmcgdG8gVjJcbiAgLy8gVXNlIHRvb2wgbmFtZSB0byBkZXRlY3QgVjIgaW5zdGVhZCBvZiBjaGVja2luZyBpbnB1dC5wbGFuLCBiZWNhdXNlIFBSICMxMDM5NFxuICAvLyBpbmplY3RzIHBsYW4gY29udGVudCBpbnRvIGlucHV0LnBsYW4gZm9yIGhvb2tzL1NESywgd2hpY2ggYnJva2UgdGhlIG9sZCBkZXRlY3Rpb25cbiAgLy8gKHNlZSBpc3N1ZSAjMTA4NzgpXG4gIGNvbnN0IGlzVjIgPSB0b29sVXNlQ29uZmlybS50b29sLm5hbWUgPT09IEVYSVRfUExBTl9NT0RFX1YyX1RPT0xfTkFNRVxuICBjb25zdCBpbnB1dFBsYW4gPSBpc1YyXG4gICAgPyB1bmRlZmluZWRcbiAgICA6ICh0b29sVXNlQ29uZmlybS5pbnB1dC5wbGFuIGFzIHN0cmluZyB8IHVuZGVmaW5lZClcbiAgY29uc3QgcGxhbkZpbGVQYXRoID0gaXNWMiA/IGdldFBsYW5GaWxlUGF0aCgpIDogdW5kZWZpbmVkXG5cbiAgLy8gRXh0cmFjdCBhbGxvd2VkIHByb21wdHMgcmVxdWVzdGVkIGJ5IHRoZSBwbGFuIChBbnQtb25seSBmZWF0dXJlKVxuICBjb25zdCBhbGxvd2VkUHJvbXB0cyA9IHRvb2xVc2VDb25maXJtLmlucHV0LmFsbG93ZWRQcm9tcHRzIGFzXG4gICAgfCBBbGxvd2VkUHJvbXB0W11cbiAgICB8IHVuZGVmaW5lZFxuXG4gIC8vIEdldCB0aGUgcmF3IHBsYW4gdG8gY2hlY2sgaWYgaXQncyBlbXB0eVxuICBjb25zdCByYXdQbGFuID0gaW5wdXRQbGFuID8/IGdldFBsYW4oKVxuICBjb25zdCBpc0VtcHR5ID0gIXJhd1BsYW4gfHwgcmF3UGxhbi50cmltKCkgPT09ICcnXG5cbiAgLy8gQ2FwdHVyZSB0aGUgdmFyaWFudCBvbmNlIG9uIG1vdW50LiBHcm93dGhCb29rIHJlYWRzIGZyb20gYSBkaXNrIGNhY2hlXG4gIC8vIHNvIHRoZSB2YWx1ZSBpcyBzdGFibGUgYWNyb3NzIGEgc2luZ2xlIHBsYW5uaW5nIHNlc3Npb24uIHVuZGVmaW5lZCA9XG4gIC8vIGNvbnRyb2wgYXJtLiBUaGUgdmFyaWFudCBpcyBhIGZpeGVkIDMtdmFsdWUgZW51bSBvZiBzaG9ydCBsaXRlcmFscyxcbiAgLy8gbm90IHVzZXIgaW5wdXQuXG4gIGNvbnN0IFtwbGFuU3RydWN0dXJlVmFyaWFudF0gPSB1c2VTdGF0ZShcbiAgICAoKSA9PlxuICAgICAgKGdldFBld3RlckxlZGdlclZhcmlhbnQoKSA/P1xuICAgICAgICB1bmRlZmluZWQpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIClcblxuICBjb25zdCBbY3VycmVudFBsYW4sIHNldEN1cnJlbnRQbGFuXSA9IHVzZVN0YXRlKCgpID0+IHtcbiAgICBpZiAoaW5wdXRQbGFuKSByZXR1cm4gaW5wdXRQbGFuXG4gICAgY29uc3QgcGxhbiA9IGdldFBsYW4oKVxuICAgIHJldHVybiAoXG4gICAgICBwbGFuID8/ICdObyBwbGFuIGZvdW5kLiBQbGVhc2Ugd3JpdGUgeW91ciBwbGFuIHRvIHRoZSBwbGFuIGZpbGUgZmlyc3QuJ1xuICAgIClcbiAgfSlcbiAgY29uc3QgW3Nob3dTYXZlTWVzc2FnZSwgc2V0U2hvd1NhdmVNZXNzYWdlXSA9IHVzZVN0YXRlKGZhbHNlKVxuICAvLyBUcmFjayBDdHJsK0cgbG9jYWwgZWRpdHMgc28gdXBkYXRlZElucHV0IGNhbiBpbmNsdWRlIHRoZSBwbGFuICh0aGUgdG9vbFxuICAvLyBvbmx5IGVjaG9lcyB0aGUgcGxhbiBpbiB0b29sX3Jlc3VsdCB3aGVuIGlucHV0LnBsYW4gaXMgc2V0IOKAlCBvdGhlcndpc2VcbiAgLy8gdGhlIG1vZGVsIGFscmVhZHkgaGFzIGl0IGluIGNvbnRleHQgZnJvbSB3cml0aW5nIHRoZSBwbGFuIGZpbGUpLlxuICBjb25zdCBbcGxhbkVkaXRlZExvY2FsbHksIHNldFBsYW5FZGl0ZWRMb2NhbGx5XSA9IHVzZVN0YXRlKGZhbHNlKVxuXG4gIC8vIEF1dG8taGlkZSBzYXZlIG1lc3NhZ2UgYWZ0ZXIgNSBzZWNvbmRzXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHNob3dTYXZlTWVzc2FnZSkge1xuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KHNldFNob3dTYXZlTWVzc2FnZSwgNTAwMCwgZmFsc2UpXG4gICAgICByZXR1cm4gKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVyKVxuICAgIH1cbiAgfSwgW3Nob3dTYXZlTWVzc2FnZV0pXG5cbiAgLy8gSGFuZGxlIEN0cmwrRyB0byBlZGl0IHBsYW4gaW4gJEVESVRPUiwgU2hpZnQrVGFiIGZvciBhdXRvLWFjY2VwdCBlZGl0c1xuICBjb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICBpZiAoZS5jdHJsICYmIGUua2V5ID09PSAnZycpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3BsYW5fZXh0ZXJuYWxfZWRpdG9yX3VzZWQnLCB7fSlcblxuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoaXNWMiAmJiBwbGFuRmlsZVBhdGgpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBlZGl0RmlsZUluRWRpdG9yKHBsYW5GaWxlUGF0aClcbiAgICAgICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICAgICAgICBrZXk6ICdleHRlcm5hbC1lZGl0b3ItZXJyb3InLFxuICAgICAgICAgICAgICB0ZXh0OiByZXN1bHQuZXJyb3IsXG4gICAgICAgICAgICAgIGNvbG9yOiAnd2FybmluZycsXG4gICAgICAgICAgICAgIHByaW9yaXR5OiAnaGlnaCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVzdWx0LmNvbnRlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQuY29udGVudCAhPT0gY3VycmVudFBsYW4pIHNldFBsYW5FZGl0ZWRMb2NhbGx5KHRydWUpXG4gICAgICAgICAgICBzZXRDdXJyZW50UGxhbihyZXN1bHQuY29udGVudClcbiAgICAgICAgICAgIHNldFNob3dTYXZlTWVzc2FnZSh0cnVlKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBlZGl0UHJvbXB0SW5FZGl0b3IoY3VycmVudFBsYW4pXG4gICAgICAgICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICAgICAga2V5OiAnZXh0ZXJuYWwtZWRpdG9yLWVycm9yJyxcbiAgICAgICAgICAgICAgdGV4dDogcmVzdWx0LmVycm9yLFxuICAgICAgICAgICAgICBjb2xvcjogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHJlc3VsdC5jb250ZW50ICE9PSBudWxsICYmIHJlc3VsdC5jb250ZW50ICE9PSBjdXJyZW50UGxhbikge1xuICAgICAgICAgICAgc2V0Q3VycmVudFBsYW4ocmVzdWx0LmNvbnRlbnQpXG4gICAgICAgICAgICBzZXRTaG93U2F2ZU1lc3NhZ2UodHJ1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pKClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIFNoaWZ0K1RhYiBpbW1lZGlhdGVseSBzZWxlY3RzIFwiYXV0by1hY2NlcHQgZWRpdHNcIlxuICAgIGlmIChlLnNoaWZ0ICYmIGUua2V5ID09PSAndGFiJykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB2b2lkIGhhbmRsZVJlc3BvbnNlKFxuICAgICAgICBzaG93Q2xlYXJDb250ZXh0ID8gJ3llcy1hY2NlcHQtZWRpdHMnIDogJ3llcy1hY2NlcHQtZWRpdHMta2VlcC1jb250ZXh0JyxcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlc3BvbnNlKHZhbHVlOiBSZXNwb25zZVZhbHVlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdHJpbW1lZEZlZWRiYWNrID0gcGxhbkZlZWRiYWNrLnRyaW0oKVxuICAgIGNvbnN0IGFjY2VwdEZlZWRiYWNrID0gdHJpbW1lZEZlZWRiYWNrIHx8IHVuZGVmaW5lZFxuXG4gICAgLy8gVWx0cmFwbGFuOiByZWplY3QgbG9jYWxseSwgdGVsZXBvcnQgdGhlIHBsYW4gdG8gQ0NSIGFzIGEgc2VlZCBkcmFmdC5cbiAgICAvLyBEaWFsb2cgZGlzbWlzc2VzIGltbWVkaWF0ZWx5IHNvIHRoZSBxdWVyeSBsb29wIHVuYmxvY2tzOyB0aGUgdGVsZXBvcnRcbiAgICAvLyBydW5zIGRldGFjaGVkIGFuZCBpdHMgbGF1bmNoIG1lc3NhZ2UgbGFuZHMgdmlhIHRoZSBjb21tYW5kIHF1ZXVlLlxuICAgIGlmICh2YWx1ZSA9PT0gJ3VsdHJhcGxhbicpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9wbGFuX2V4aXQnLCB7XG4gICAgICAgIHBsYW5MZW5ndGhDaGFyczogY3VycmVudFBsYW4ubGVuZ3RoLFxuICAgICAgICBvdXRjb21lOlxuICAgICAgICAgICd1bHRyYXBsYW4nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGludGVydmlld1BoYXNlRW5hYmxlZDogaXNQbGFuTW9kZUludGVydmlld1BoYXNlRW5hYmxlZCgpLFxuICAgICAgICBwbGFuU3RydWN0dXJlVmFyaWFudCxcbiAgICAgIH0pXG4gICAgICBvbkRvbmUoKVxuICAgICAgb25SZWplY3QoKVxuICAgICAgdG9vbFVzZUNvbmZpcm0ub25SZWplY3QoXG4gICAgICAgICdQbGFuIGJlaW5nIHJlZmluZWQgdmlhIFVsdHJhcGxhbiDigJQgcGxlYXNlIHdhaXQgZm9yIHRoZSByZXN1bHQuJyxcbiAgICAgIClcbiAgICAgIHZvaWQgbGF1bmNoVWx0cmFwbGFuKHtcbiAgICAgICAgYmx1cmI6ICcnLFxuICAgICAgICBzZWVkUGxhbjogY3VycmVudFBsYW4sXG4gICAgICAgIGdldEFwcFN0YXRlOiBzdG9yZS5nZXRTdGF0ZSxcbiAgICAgICAgc2V0QXBwU3RhdGU6IHN0b3JlLnNldFN0YXRlLFxuICAgICAgICBzaWduYWw6IG5ldyBBYm9ydENvbnRyb2xsZXIoKS5zaWduYWwsXG4gICAgICB9KVxuICAgICAgICAudGhlbihtc2cgPT5cbiAgICAgICAgICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7IHZhbHVlOiBtc2csIG1vZGU6ICd0YXNrLW5vdGlmaWNhdGlvbicgfSksXG4gICAgICAgIClcbiAgICAgICAgLmNhdGNoKGxvZ0Vycm9yKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gVjE6IHBhc3MgcGxhbiBpbiBpbnB1dC4gVjI6IHBsYW4gaXMgb24gZGlzaywgYnV0IGlmIHRoZSB1c2VyIGVkaXRlZCBpdFxuICAgIC8vIHZpYSBDdHJsK0cgd2UgcGFzcyBpdCB0aHJvdWdoIHNvIHRoZSB0b29sIGVjaG9lcyB0aGUgZWRpdCBpbiB0b29sX3Jlc3VsdFxuICAgIC8vIChvdGhlcndpc2UgdGhlIG1vZGVsIG5ldmVyIHNlZXMgdGhlIHVzZXIncyBjaGFuZ2VzKS5cbiAgICBjb25zdCB1cGRhdGVkSW5wdXQgPSBpc1YyICYmICFwbGFuRWRpdGVkTG9jYWxseSA/IHt9IDogeyBwbGFuOiBjdXJyZW50UGxhbiB9XG5cbiAgICAvLyBJZiBhdXRvIHdhcyBhY3RpdmUgZHVyaW5nIHBsYW4gKGZyb20gYXV0byBtb2RlIG9yIG9wdC1pbikgYW5kIE5PVCBnb2luZ1xuICAgIC8vIHRvIGF1dG8sIGRlYWN0aXZhdGUgYXV0byArIHJlc3RvcmUgcGVybWlzc2lvbnMgKyBmaXJlIGV4aXQgYXR0YWNobWVudC5cbiAgICBpZiAoZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJykpIHtcbiAgICAgIGNvbnN0IGdvaW5nVG9BdXRvID1cbiAgICAgICAgKHZhbHVlID09PSAneWVzLXJlc3VtZS1hdXRvLW1vZGUnIHx8XG4gICAgICAgICAgdmFsdWUgPT09ICd5ZXMtYXV0by1jbGVhci1jb250ZXh0JykgJiZcbiAgICAgICAgaXNBdXRvTW9kZUdhdGVFbmFibGVkKClcbiAgICAgIC8vIGlzQXV0b01vZGVBY3RpdmUoKSBpcyB0aGUgYXV0aG9yaXRhdGl2ZSBzaWduYWwg4oCUIHByZVBsYW5Nb2RlL1xuICAgICAgLy8gc3RyaXBwZWREYW5nZXJvdXNSdWxlcyBhcmUgc3RhbGUgYWZ0ZXIgdHJhbnNpdGlvblBsYW5BdXRvTW9kZVxuICAgICAgLy8gZGVhY3RpdmF0ZXMgbWlkLXBsYW4gKHdvdWxkIGNhdXNlIGR1cGxpY2F0ZSBleGl0IGF0dGFjaG1lbnQpLlxuICAgICAgY29uc3QgYXV0b1dhc1VzZWREdXJpbmdQbGFuID1cbiAgICAgICAgYXV0b01vZGVTdGF0ZU1vZHVsZT8uaXNBdXRvTW9kZUFjdGl2ZSgpID8/IGZhbHNlXG4gICAgICBpZiAodmFsdWUgIT09ICdubycgJiYgIWdvaW5nVG9BdXRvICYmIGF1dG9XYXNVc2VkRHVyaW5nUGxhbikge1xuICAgICAgICBhdXRvTW9kZVN0YXRlTW9kdWxlPy5zZXRBdXRvTW9kZUFjdGl2ZShmYWxzZSlcbiAgICAgICAgc2V0TmVlZHNBdXRvTW9kZUV4aXRBdHRhY2htZW50KHRydWUpXG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dDoge1xuICAgICAgICAgICAgLi4ucmVzdG9yZURhbmdlcm91c1Blcm1pc3Npb25zKHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0KSxcbiAgICAgICAgICAgIHByZVBsYW5Nb2RlOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2xlYXItY29udGV4dCBvcHRpb25zOiBzZXQgcGVuZGluZyBwbGFuIGltcGxlbWVudGF0aW9uIGFuZCByZWplY3QgdGhlIGRpYWxvZ1xuICAgIC8vIFRoZSBSRVBMIHdpbGwgaGFuZGxlIGNvbnRleHQgY2xlYXIgYW5kIHRyaWdnZXIgYSBmcmVzaCBxdWVyeVxuICAgIC8vIEtlZXAtY29udGV4dCBvcHRpb25zIHNraXAgdGhpcyBibG9jayBhbmQgZ28gdGhyb3VnaCB0aGUgbm9ybWFsIGZsb3cgYmVsb3dcbiAgICBjb25zdCBpc1Jlc3VtZUF1dG9PcHRpb24gPSBmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKVxuICAgICAgPyB2YWx1ZSA9PT0gJ3llcy1yZXN1bWUtYXV0by1tb2RlJ1xuICAgICAgOiBmYWxzZVxuICAgIGNvbnN0IGlzS2VlcENvbnRleHRPcHRpb24gPVxuICAgICAgdmFsdWUgPT09ICd5ZXMtYWNjZXB0LWVkaXRzLWtlZXAtY29udGV4dCcgfHxcbiAgICAgIHZhbHVlID09PSAneWVzLWRlZmF1bHQta2VlcC1jb250ZXh0JyB8fFxuICAgICAgaXNSZXN1bWVBdXRvT3B0aW9uXG5cbiAgICBpZiAodmFsdWUgIT09ICdubycpIHtcbiAgICAgIGF1dG9OYW1lU2Vzc2lvbkZyb21QbGFuKGN1cnJlbnRQbGFuLCBzZXRBcHBTdGF0ZSwgIWlzS2VlcENvbnRleHRPcHRpb24pXG4gICAgfVxuXG4gICAgaWYgKHZhbHVlICE9PSAnbm8nICYmICFpc0tlZXBDb250ZXh0T3B0aW9uKSB7XG4gICAgICAvLyBEZXRlcm1pbmUgdGhlIHBlcm1pc3Npb24gbW9kZSBiYXNlZCBvbiB0aGUgc2VsZWN0ZWQgb3B0aW9uXG4gICAgICBsZXQgbW9kZTogUGVybWlzc2lvbk1vZGUgPSAnZGVmYXVsdCdcbiAgICAgIGlmICh2YWx1ZSA9PT0gJ3llcy1ieXBhc3MtcGVybWlzc2lvbnMnKSB7XG4gICAgICAgIG1vZGUgPSAnYnlwYXNzUGVybWlzc2lvbnMnXG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAneWVzLWFjY2VwdC1lZGl0cycpIHtcbiAgICAgICAgbW9kZSA9ICdhY2NlcHRFZGl0cydcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpICYmXG4gICAgICAgIHZhbHVlID09PSAneWVzLWF1dG8tY2xlYXItY29udGV4dCcgJiZcbiAgICAgICAgaXNBdXRvTW9kZUdhdGVFbmFibGVkKClcbiAgICAgICkge1xuICAgICAgICAvLyBSRVBMJ3MgcHJvY2Vzc0luaXRpYWxNZXNzYWdlIGhhbmRsZXMgc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9ucyArIG1vZGUsXG4gICAgICAgIC8vIGJ1dCBkb2VzIE5PVCBzZXQgYXV0b01vZGVBY3RpdmUuIEdhdGUtb2ZmIGZhbGxzIHRocm91Z2ggdG8gJ2RlZmF1bHQnLlxuICAgICAgICBtb2RlID0gJ2F1dG8nXG4gICAgICAgIGF1dG9Nb2RlU3RhdGVNb2R1bGU/LnNldEF1dG9Nb2RlQWN0aXZlKHRydWUpXG4gICAgICB9XG5cbiAgICAgIC8vIExvZyBwbGFuIGV4aXQgZXZlbnRcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9wbGFuX2V4aXQnLCB7XG4gICAgICAgIHBsYW5MZW5ndGhDaGFyczogY3VycmVudFBsYW4ubGVuZ3RoLFxuICAgICAgICBvdXRjb21lOlxuICAgICAgICAgIHZhbHVlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGNsZWFyQ29udGV4dDogdHJ1ZSxcbiAgICAgICAgaW50ZXJ2aWV3UGhhc2VFbmFibGVkOiBpc1BsYW5Nb2RlSW50ZXJ2aWV3UGhhc2VFbmFibGVkKCksXG4gICAgICAgIHBsYW5TdHJ1Y3R1cmVWYXJpYW50LFxuICAgICAgICBoYXNGZWVkYmFjazogISFhY2NlcHRGZWVkYmFjayxcbiAgICAgIH0pXG5cbiAgICAgIC8vIFNldCBpbml0aWFsIG1lc3NhZ2UgLSBSRVBMIHdpbGwgaGFuZGxlIGNvbnRleHQgY2xlYXIgYW5kIGZyZXNoIHF1ZXJ5XG4gICAgICAvLyBBZGQgdmVyaWZpY2F0aW9uIGluc3RydWN0aW9uIGlmIHRoZSBmZWF0dXJlIGlzIGVuYWJsZWRcbiAgICAgIC8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogQ0xBVURFX0NPREVfVkVSSUZZX1BMQU49J2ZhbHNlJyBpbiBleHRlcm5hbCBidWlsZHMsIHNvID09PSAndHJ1ZScgY2hlY2sgYWxsb3dzIEJ1biB0byBlbGltaW5hdGUgdGhlIHN0cmluZ1xuICAgICAgY29uc3QgdmVyaWZpY2F0aW9uSW5zdHJ1Y3Rpb24gPVxuICAgICAgICB1bmRlZmluZWQgPT09ICd0cnVlJ1xuICAgICAgICAgID8gYFxcblxcbklNUE9SVEFOVDogV2hlbiB5b3UgaGF2ZSBmaW5pc2hlZCBpbXBsZW1lbnRpbmcgdGhlIHBsYW4sIHlvdSBNVVNUIGNhbGwgdGhlIFwiVmVyaWZ5UGxhbkV4ZWN1dGlvblwiIHRvb2wgZGlyZWN0bHkgKE5PVCB0aGUgJHtBR0VOVF9UT09MX05BTUV9IHRvb2wgb3IgYW4gYWdlbnQpIHRvIHRyaWdnZXIgYmFja2dyb3VuZCB2ZXJpZmljYXRpb24uYFxuICAgICAgICAgIDogJydcblxuICAgICAgLy8gQ2FwdHVyZSB0aGUgdHJhbnNjcmlwdCBwYXRoIGJlZm9yZSBjb250ZXh0IGlzIGNsZWFyZWQgKHNlc3Npb24gSUQgd2lsbCBiZSByZWdlbmVyYXRlZClcbiAgICAgIGNvbnN0IHRyYW5zY3JpcHRQYXRoID0gZ2V0VHJhbnNjcmlwdFBhdGgoKVxuICAgICAgY29uc3QgdHJhbnNjcmlwdEhpbnQgPSBgXFxuXFxuSWYgeW91IG5lZWQgc3BlY2lmaWMgZGV0YWlscyBmcm9tIGJlZm9yZSBleGl0aW5nIHBsYW4gbW9kZSAobGlrZSBleGFjdCBjb2RlIHNuaXBwZXRzLCBlcnJvciBtZXNzYWdlcywgb3IgY29udGVudCB5b3UgZ2VuZXJhdGVkKSwgcmVhZCB0aGUgZnVsbCB0cmFuc2NyaXB0IGF0OiAke3RyYW5zY3JpcHRQYXRofWBcblxuICAgICAgY29uc3QgdGVhbUhpbnQgPSBpc0FnZW50U3dhcm1zRW5hYmxlZCgpXG4gICAgICAgID8gYFxcblxcbklmIHRoaXMgcGxhbiBjYW4gYmUgYnJva2VuIGRvd24gaW50byBtdWx0aXBsZSBpbmRlcGVuZGVudCB0YXNrcywgY29uc2lkZXIgdXNpbmcgdGhlICR7VEVBTV9DUkVBVEVfVE9PTF9OQU1FfSB0b29sIHRvIGNyZWF0ZSBhIHRlYW0gYW5kIHBhcmFsbGVsaXplIHRoZSB3b3JrLmBcbiAgICAgICAgOiAnJ1xuXG4gICAgICBjb25zdCBmZWVkYmFja1N1ZmZpeCA9IGFjY2VwdEZlZWRiYWNrXG4gICAgICAgID8gYFxcblxcblVzZXIgZmVlZGJhY2sgb24gdGhpcyBwbGFuOiAke2FjY2VwdEZlZWRiYWNrfWBcbiAgICAgICAgOiAnJ1xuXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgIC4uLnByZXYsXG4gICAgICAgIGluaXRpYWxNZXNzYWdlOiB7XG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgLi4uY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgICAgICBjb250ZW50OiBgSW1wbGVtZW50IHRoZSBmb2xsb3dpbmcgcGxhbjpcXG5cXG4ke2N1cnJlbnRQbGFufSR7dmVyaWZpY2F0aW9uSW5zdHJ1Y3Rpb259JHt0cmFuc2NyaXB0SGludH0ke3RlYW1IaW50fSR7ZmVlZGJhY2tTdWZmaXh9YCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgcGxhbkNvbnRlbnQ6IGN1cnJlbnRQbGFuLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY2xlYXJDb250ZXh0OiB0cnVlLFxuICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgYWxsb3dlZFByb21wdHMsXG4gICAgICAgIH0sXG4gICAgICB9KSlcblxuICAgICAgc2V0SGFzRXhpdGVkUGxhbk1vZGUodHJ1ZSlcbiAgICAgIG9uRG9uZSgpXG4gICAgICBvblJlamVjdCgpXG4gICAgICAvLyBSZWplY3QgdGhlIHRvb2wgdXNlIHRvIHVuYmxvY2sgdGhlIHF1ZXJ5IGxvb3BcbiAgICAgIC8vIFRoZSBSRVBMIHdpbGwgc2VlIHBlbmRpbmdJbml0aWFsUXVlcnkgYW5kIHRyaWdnZXIgZnJlc2ggcXVlcnlcbiAgICAgIHRvb2xVc2VDb25maXJtLm9uUmVqZWN0KClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBhdXRvIGtlZXAtY29udGV4dCBvcHRpb24g4oCUIG5lZWRzIHNwZWNpYWwgaGFuZGxpbmcgYmVjYXVzZVxuICAgIC8vIGJ1aWxkUGVybWlzc2lvblVwZGF0ZXMgbWFwcyBhdXRvIHRvICdkZWZhdWx0JyB2aWEgdG9FeHRlcm5hbFBlcm1pc3Npb25Nb2RlLlxuICAgIC8vIFdlIHNldCB0aGUgbW9kZSBkaXJlY3RseSB2aWEgc2V0QXBwU3RhdGUgYW5kIHN5bmMgdGhlIGJvb3RzdHJhcCBzdGF0ZS5cbiAgICBpZiAoXG4gICAgICBmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSAmJlxuICAgICAgdmFsdWUgPT09ICd5ZXMtcmVzdW1lLWF1dG8tbW9kZScgJiZcbiAgICAgIGlzQXV0b01vZGVHYXRlRW5hYmxlZCgpXG4gICAgKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfcGxhbl9leGl0Jywge1xuICAgICAgICBwbGFuTGVuZ3RoQ2hhcnM6IGN1cnJlbnRQbGFuLmxlbmd0aCxcbiAgICAgICAgb3V0Y29tZTpcbiAgICAgICAgICB2YWx1ZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICBjbGVhckNvbnRleHQ6IGZhbHNlLFxuICAgICAgICBpbnRlcnZpZXdQaGFzZUVuYWJsZWQ6IGlzUGxhbk1vZGVJbnRlcnZpZXdQaGFzZUVuYWJsZWQoKSxcbiAgICAgICAgcGxhblN0cnVjdHVyZVZhcmlhbnQsXG4gICAgICAgIGhhc0ZlZWRiYWNrOiAhIWFjY2VwdEZlZWRiYWNrLFxuICAgICAgfSlcbiAgICAgIHNldEhhc0V4aXRlZFBsYW5Nb2RlKHRydWUpXG4gICAgICBzZXROZWVkc1BsYW5Nb2RlRXhpdEF0dGFjaG1lbnQodHJ1ZSlcbiAgICAgIGF1dG9Nb2RlU3RhdGVNb2R1bGU/LnNldEF1dG9Nb2RlQWN0aXZlKHRydWUpXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgIC4uLnByZXYsXG4gICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dDogc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlKHtcbiAgICAgICAgICAuLi5wcmV2LnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgICBtb2RlOiAnYXV0bycsXG4gICAgICAgICAgcHJlUGxhbk1vZGU6IHVuZGVmaW5lZCxcbiAgICAgICAgfSksXG4gICAgICB9KSlcbiAgICAgIG9uRG9uZSgpXG4gICAgICB0b29sVXNlQ29uZmlybS5vbkFsbG93KHVwZGF0ZWRJbnB1dCwgW10sIGFjY2VwdEZlZWRiYWNrKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGtlZXAtY29udGV4dCBvcHRpb25zIChnb2VzIHRocm91Z2ggbm9ybWFsIG9uQWxsb3cgZmxvdylcbiAgICAvLyB5ZXMtcmVzdW1lLWF1dG8tbW9kZSBmYWxscyB0aHJvdWdoIGhlcmUgd2hlbiB0aGUgYXV0byBtb2RlIGdhdGUgaXNcbiAgICAvLyBkaXNhYmxlZCAoZS5nLiBjaXJjdWl0IGJyZWFrZXIgZmlyZWQgYWZ0ZXIgdGhlIGRpYWxvZyByZW5kZXJlZCkuXG4gICAgLy8gV2l0aG91dCB0aGlzIGZhbGxiYWNrIHRoZSBmdW5jdGlvbiB3b3VsZCByZXR1cm4gd2l0aG91dCByZXNvbHZpbmcgdGhlXG4gICAgLy8gZGlhbG9nLCBsZWF2aW5nIHRoZSBxdWVyeSBsb29wIGJsb2NrZWQgYW5kIHNhZmV0eSBzdGF0ZSBjb3JydXB0ZWQuXG4gICAgY29uc3Qga2VlcENvbnRleHRNb2RlczogUmVjb3JkPHN0cmluZywgUGVybWlzc2lvbk1vZGU+ID0ge1xuICAgICAgJ3llcy1hY2NlcHQtZWRpdHMta2VlcC1jb250ZXh0JzpcbiAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0LmlzQnlwYXNzUGVybWlzc2lvbnNNb2RlQXZhaWxhYmxlXG4gICAgICAgICAgPyAnYnlwYXNzUGVybWlzc2lvbnMnXG4gICAgICAgICAgOiAnYWNjZXB0RWRpdHMnLFxuICAgICAgJ3llcy1kZWZhdWx0LWtlZXAtY29udGV4dCc6ICdkZWZhdWx0JyxcbiAgICAgIC4uLihmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKVxuICAgICAgICA/IHsgJ3llcy1yZXN1bWUtYXV0by1tb2RlJzogJ2RlZmF1bHQnIGFzIGNvbnN0IH1cbiAgICAgICAgOiB7fSksXG4gICAgfVxuICAgIGNvbnN0IGtlZXBDb250ZXh0TW9kZSA9IGtlZXBDb250ZXh0TW9kZXNbdmFsdWVdXG4gICAgaWYgKGtlZXBDb250ZXh0TW9kZSkge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3BsYW5fZXhpdCcsIHtcbiAgICAgICAgcGxhbkxlbmd0aENoYXJzOiBjdXJyZW50UGxhbi5sZW5ndGgsXG4gICAgICAgIG91dGNvbWU6XG4gICAgICAgICAgdmFsdWUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgY2xlYXJDb250ZXh0OiBmYWxzZSxcbiAgICAgICAgaW50ZXJ2aWV3UGhhc2VFbmFibGVkOiBpc1BsYW5Nb2RlSW50ZXJ2aWV3UGhhc2VFbmFibGVkKCksXG4gICAgICAgIHBsYW5TdHJ1Y3R1cmVWYXJpYW50LFxuICAgICAgICBoYXNGZWVkYmFjazogISFhY2NlcHRGZWVkYmFjayxcbiAgICAgIH0pXG4gICAgICBzZXRIYXNFeGl0ZWRQbGFuTW9kZSh0cnVlKVxuICAgICAgc2V0TmVlZHNQbGFuTW9kZUV4aXRBdHRhY2htZW50KHRydWUpXG4gICAgICBvbkRvbmUoKVxuICAgICAgdG9vbFVzZUNvbmZpcm0ub25BbGxvdyhcbiAgICAgICAgdXBkYXRlZElucHV0LFxuICAgICAgICBidWlsZFBlcm1pc3Npb25VcGRhdGVzKGtlZXBDb250ZXh0TW9kZSwgYWxsb3dlZFByb21wdHMpLFxuICAgICAgICBhY2NlcHRGZWVkYmFjayxcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBzdGFuZGFyZCBhcHByb3ZhbCBvcHRpb25zXG4gICAgY29uc3Qgc3RhbmRhcmRNb2RlczogUmVjb3JkPHN0cmluZywgUGVybWlzc2lvbk1vZGU+ID0ge1xuICAgICAgJ3llcy1ieXBhc3MtcGVybWlzc2lvbnMnOiAnYnlwYXNzUGVybWlzc2lvbnMnLFxuICAgICAgJ3llcy1hY2NlcHQtZWRpdHMnOiAnYWNjZXB0RWRpdHMnLFxuICAgIH1cbiAgICBjb25zdCBzdGFuZGFyZE1vZGUgPSBzdGFuZGFyZE1vZGVzW3ZhbHVlXVxuICAgIGlmIChzdGFuZGFyZE1vZGUpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9wbGFuX2V4aXQnLCB7XG4gICAgICAgIHBsYW5MZW5ndGhDaGFyczogY3VycmVudFBsYW4ubGVuZ3RoLFxuICAgICAgICBvdXRjb21lOlxuICAgICAgICAgIHZhbHVlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGludGVydmlld1BoYXNlRW5hYmxlZDogaXNQbGFuTW9kZUludGVydmlld1BoYXNlRW5hYmxlZCgpLFxuICAgICAgICBwbGFuU3RydWN0dXJlVmFyaWFudCxcbiAgICAgICAgaGFzRmVlZGJhY2s6ICEhYWNjZXB0RmVlZGJhY2ssXG4gICAgICB9KVxuICAgICAgc2V0SGFzRXhpdGVkUGxhbk1vZGUodHJ1ZSlcbiAgICAgIHNldE5lZWRzUGxhbk1vZGVFeGl0QXR0YWNobWVudCh0cnVlKVxuICAgICAgb25Eb25lKClcbiAgICAgIHRvb2xVc2VDb25maXJtLm9uQWxsb3coXG4gICAgICAgIHVwZGF0ZWRJbnB1dCxcbiAgICAgICAgYnVpbGRQZXJtaXNzaW9uVXBkYXRlcyhzdGFuZGFyZE1vZGUsIGFsbG93ZWRQcm9tcHRzKSxcbiAgICAgICAgYWNjZXB0RmVlZGJhY2ssXG4gICAgICApXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgJ25vJyAtIHN0YXkgaW4gcGxhbiBtb2RlXG4gICAgaWYgKHZhbHVlID09PSAnbm8nKSB7XG4gICAgICBpZiAoIXRyaW1tZWRGZWVkYmFjayAmJiAhaGFzSW1hZ2VzKSB7XG4gICAgICAgIC8vIE5vIGZlZWRiYWNrIHlldCAtIHVzZXIgaXMgc3RpbGwgb24gdGhlIGlucHV0IGZpZWxkXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBsb2dFdmVudCgndGVuZ3VfcGxhbl9leGl0Jywge1xuICAgICAgICBwbGFuTGVuZ3RoQ2hhcnM6IGN1cnJlbnRQbGFuLmxlbmd0aCxcbiAgICAgICAgb3V0Y29tZTpcbiAgICAgICAgICAnbm8nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGludGVydmlld1BoYXNlRW5hYmxlZDogaXNQbGFuTW9kZUludGVydmlld1BoYXNlRW5hYmxlZCgpLFxuICAgICAgICBwbGFuU3RydWN0dXJlVmFyaWFudCxcbiAgICAgIH0pXG5cbiAgICAgIC8vIENvbnZlcnQgcGFzdGVkIGltYWdlcyB0byBJbWFnZUJsb2NrUGFyYW1bXSB3aXRoIHJlc2l6aW5nXG4gICAgICBsZXQgaW1hZ2VCbG9ja3M6IEltYWdlQmxvY2tQYXJhbVtdIHwgdW5kZWZpbmVkXG4gICAgICBpZiAoaGFzSW1hZ2VzKSB7XG4gICAgICAgIGltYWdlQmxvY2tzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgaW1hZ2VBdHRhY2htZW50cy5tYXAoYXN5bmMgaW1nID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrOiBJbWFnZUJsb2NrUGFyYW0gPSB7XG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZScsXG4gICAgICAgICAgICAgIHNvdXJjZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdiYXNlNjQnLFxuICAgICAgICAgICAgICAgIG1lZGlhX3R5cGU6IChpbWcubWVkaWFUeXBlIHx8XG4gICAgICAgICAgICAgICAgICAnaW1hZ2UvcG5nJykgYXMgQmFzZTY0SW1hZ2VTb3VyY2VbJ21lZGlhX3R5cGUnXSxcbiAgICAgICAgICAgICAgICBkYXRhOiBpbWcuY29udGVudCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlc2l6ZWQgPSBhd2FpdCBtYXliZVJlc2l6ZUFuZERvd25zYW1wbGVJbWFnZUJsb2NrKGJsb2NrKVxuICAgICAgICAgICAgcmV0dXJuIHJlc2l6ZWQuYmxvY2tcbiAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICBvbkRvbmUoKVxuICAgICAgb25SZWplY3QoKVxuICAgICAgdG9vbFVzZUNvbmZpcm0ub25SZWplY3QoXG4gICAgICAgIHRyaW1tZWRGZWVkYmFjayB8fCAoaGFzSW1hZ2VzID8gJyhTZWUgYXR0YWNoZWQgaW1hZ2UpJyA6IHVuZGVmaW5lZCksXG4gICAgICAgIGltYWdlQmxvY2tzICYmIGltYWdlQmxvY2tzLmxlbmd0aCA+IDAgPyBpbWFnZUJsb2NrcyA6IHVuZGVmaW5lZCxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBjb25zdCBlZGl0b3IgPSBnZXRFeHRlcm5hbEVkaXRvcigpXG4gIGNvbnN0IGVkaXRvck5hbWUgPSBlZGl0b3IgPyB0b0lERURpc3BsYXlOYW1lKGVkaXRvcikgOiBudWxsXG5cbiAgLy8gU3RpY2t5IGZvb3Rlcjogd2hlbiBzZXRTdGlja3lGb290ZXIgaXMgcHJvdmlkZWQgKGZ1bGxzY3JlZW4gbW9kZSksIHRoZVxuICAvLyBTZWxlY3Qgb3B0aW9ucyByZW5kZXIgaW4gRnVsbHNjcmVlbkxheW91dCdzIGBib3R0b21gIHNsb3Qgc28gdGhleSBzdGF5XG4gIC8vIHZpc2libGUgd2hpbGUgdGhlIHVzZXIgc2Nyb2xscyB0aHJvdWdoIGEgbG9uZyBwbGFuLiBoYW5kbGVSZXNwb25zZSBpc1xuICAvLyB3cmFwcGVkIGluIGEgcmVmIHNvIHRoZSBKU1ggKHNldCBvbmNlIHBlciBvcHRpb25zL2ltYWdlcyBjaGFuZ2UpIGNhbiBjYWxsXG4gIC8vIHRoZSBsYXRlc3QgY2xvc3VyZSB3aXRob3V0IHJlLXJlZ2lzdGVyaW5nIG9uIGV2ZXJ5IGtleXN0cm9rZS4gUmVhY3RcbiAgLy8gcmVjb25jaWxlcyB0aGUgc3RpY2t5LWZvb3RlciBTZWxlY3QgYnkgdHlwZSwgcHJlc2VydmluZyBmb2N1cy9pbnB1dCBzdGF0ZS5cbiAgY29uc3QgaGFuZGxlUmVzcG9uc2VSZWYgPSB1c2VSZWYoaGFuZGxlUmVzcG9uc2UpXG4gIGhhbmRsZVJlc3BvbnNlUmVmLmN1cnJlbnQgPSBoYW5kbGVSZXNwb25zZVxuICBjb25zdCBoYW5kbGVDYW5jZWxSZWYgPSB1c2VSZWY8KCkgPT4gdm9pZD4odW5kZWZpbmVkKVxuICBoYW5kbGVDYW5jZWxSZWYuY3VycmVudCA9ICgpID0+IHtcbiAgICBsb2dFdmVudCgndGVuZ3VfcGxhbl9leGl0Jywge1xuICAgICAgcGxhbkxlbmd0aENoYXJzOiBjdXJyZW50UGxhbi5sZW5ndGgsXG4gICAgICBvdXRjb21lOlxuICAgICAgICAnbm8nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBpbnRlcnZpZXdQaGFzZUVuYWJsZWQ6IGlzUGxhbk1vZGVJbnRlcnZpZXdQaGFzZUVuYWJsZWQoKSxcbiAgICAgIHBsYW5TdHJ1Y3R1cmVWYXJpYW50LFxuICAgIH0pXG4gICAgb25Eb25lKClcbiAgICBvblJlamVjdCgpXG4gICAgdG9vbFVzZUNvbmZpcm0ub25SZWplY3QoKVxuICB9XG4gIGNvbnN0IHVzZVN0aWNreUZvb3RlciA9ICFpc0VtcHR5ICYmICEhc2V0U3RpY2t5Rm9vdGVyXG4gIHVzZUxheW91dEVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCF1c2VTdGlja3lGb290ZXIpIHJldHVyblxuICAgIHNldFN0aWNreUZvb3RlcihcbiAgICAgIDxCb3hcbiAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgIGJvcmRlclN0eWxlPVwicm91bmRcIlxuICAgICAgICBib3JkZXJDb2xvcj1cInBsYW5Nb2RlXCJcbiAgICAgICAgYm9yZGVyTGVmdD17ZmFsc2V9XG4gICAgICAgIGJvcmRlclJpZ2h0PXtmYWxzZX1cbiAgICAgICAgYm9yZGVyQm90dG9tPXtmYWxzZX1cbiAgICAgICAgcGFkZGluZ1g9ezF9XG4gICAgICA+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPldvdWxkIHlvdSBsaWtlIHRvIHByb2NlZWQ/PC9UZXh0PlxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgb3B0aW9ucz17b3B0aW9uc31cbiAgICAgICAgICAgIG9uQ2hhbmdlPXt2ID0+IHZvaWQgaGFuZGxlUmVzcG9uc2VSZWYuY3VycmVudCh2KX1cbiAgICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBoYW5kbGVDYW5jZWxSZWYuY3VycmVudD8uKCl9XG4gICAgICAgICAgICBvbkltYWdlUGFzdGU9e29uSW1hZ2VQYXN0ZX1cbiAgICAgICAgICAgIHBhc3RlZENvbnRlbnRzPXtwYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgIG9uUmVtb3ZlSW1hZ2U9e29uUmVtb3ZlSW1hZ2V9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHtlZGl0b3JOYW1lICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5jdHJsLWcgdG8gZWRpdCBpbiA8L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBib2xkIGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7ZWRpdG9yTmFtZX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHtpc1YyICYmIHBsYW5GaWxlUGF0aCAmJiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyB7Z2V0RGlzcGxheVBhdGgocGxhbkZpbGVQYXRoKX08L1RleHQ+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAge3Nob3dTYXZlTWVzc2FnZSAmJiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+eycgwrcgJ308L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+e2ZpZ3VyZXMudGlja31QbGFuIHNhdmVkITwvVGV4dD5cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+LFxuICAgIClcbiAgICByZXR1cm4gKCkgPT4gc2V0U3RpY2t5Rm9vdGVyKG51bGwpXG4gICAgLy8gb25JbWFnZVBhc3RlL29uUmVtb3ZlSW1hZ2UgYXJlIHN0YWJsZSAodXNlQ2FsbGJhY2svdXNlUmVmLWJhY2tlZCBhYm92ZSlcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0sIFtcbiAgICB1c2VTdGlja3lGb290ZXIsXG4gICAgc2V0U3RpY2t5Rm9vdGVyLFxuICAgIG9wdGlvbnMsXG4gICAgcGFzdGVkQ29udGVudHMsXG4gICAgZWRpdG9yTmFtZSxcbiAgICBpc1YyLFxuICAgIHBsYW5GaWxlUGF0aCxcbiAgICBzaG93U2F2ZU1lc3NhZ2UsXG4gIF0pXG5cbiAgLy8gU2ltcGxpZmllZCBVSSBmb3IgZW1wdHkgcGxhbnNcbiAgaWYgKGlzRW1wdHkpIHtcbiAgICBmdW5jdGlvbiBoYW5kbGVFbXB0eVBsYW5SZXNwb25zZSh2YWx1ZTogJ3llcycgfCAnbm8nKTogdm9pZCB7XG4gICAgICBpZiAodmFsdWUgPT09ICd5ZXMnKSB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9wbGFuX2V4aXQnLCB7XG4gICAgICAgICAgcGxhbkxlbmd0aENoYXJzOiAwLFxuICAgICAgICAgIG91dGNvbWU6XG4gICAgICAgICAgICAneWVzLWRlZmF1bHQnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgaW50ZXJ2aWV3UGhhc2VFbmFibGVkOiBpc1BsYW5Nb2RlSW50ZXJ2aWV3UGhhc2VFbmFibGVkKCksXG4gICAgICAgICAgcGxhblN0cnVjdHVyZVZhcmlhbnQsXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgICAgIGNvbnN0IGF1dG9XYXNVc2VkRHVyaW5nUGxhbiA9XG4gICAgICAgICAgICBhdXRvTW9kZVN0YXRlTW9kdWxlPy5pc0F1dG9Nb2RlQWN0aXZlKCkgPz8gZmFsc2VcbiAgICAgICAgICBpZiAoYXV0b1dhc1VzZWREdXJpbmdQbGFuKSB7XG4gICAgICAgICAgICBhdXRvTW9kZVN0YXRlTW9kdWxlPy5zZXRBdXRvTW9kZUFjdGl2ZShmYWxzZSlcbiAgICAgICAgICAgIHNldE5lZWRzQXV0b01vZGVFeGl0QXR0YWNobWVudCh0cnVlKVxuICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6IHtcbiAgICAgICAgICAgICAgICAuLi5yZXN0b3JlRGFuZ2Vyb3VzUGVybWlzc2lvbnMocHJldi50b29sUGVybWlzc2lvbkNvbnRleHQpLFxuICAgICAgICAgICAgICAgIHByZVBsYW5Nb2RlOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc2V0SGFzRXhpdGVkUGxhbk1vZGUodHJ1ZSlcbiAgICAgICAgc2V0TmVlZHNQbGFuTW9kZUV4aXRBdHRhY2htZW50KHRydWUpXG4gICAgICAgIG9uRG9uZSgpXG4gICAgICAgIHRvb2xVc2VDb25maXJtLm9uQWxsb3coe30sIFtcbiAgICAgICAgICB7IHR5cGU6ICdzZXRNb2RlJywgbW9kZTogJ2RlZmF1bHQnLCBkZXN0aW5hdGlvbjogJ3Nlc3Npb24nIH0sXG4gICAgICAgIF0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfcGxhbl9leGl0Jywge1xuICAgICAgICAgIHBsYW5MZW5ndGhDaGFyczogMCxcbiAgICAgICAgICBvdXRjb21lOlxuICAgICAgICAgICAgJ25vJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIGludGVydmlld1BoYXNlRW5hYmxlZDogaXNQbGFuTW9kZUludGVydmlld1BoYXNlRW5hYmxlZCgpLFxuICAgICAgICAgIHBsYW5TdHJ1Y3R1cmVWYXJpYW50LFxuICAgICAgICB9KVxuICAgICAgICBvbkRvbmUoKVxuICAgICAgICBvblJlamVjdCgpXG4gICAgICAgIHRvb2xVc2VDb25maXJtLm9uUmVqZWN0KClcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPFBlcm1pc3Npb25EaWFsb2dcbiAgICAgICAgY29sb3I9XCJwbGFuTW9kZVwiXG4gICAgICAgIHRpdGxlPVwiRXhpdCBwbGFuIG1vZGU/XCJcbiAgICAgICAgd29ya2VyQmFkZ2U9e3dvcmtlckJhZGdlfVxuICAgICAgPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBwYWRkaW5nWD17MX0gbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dD5DbGF1ZGUgd2FudHMgdG8gZXhpdCBwbGFuIG1vZGU8L1RleHQ+XG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBvcHRpb25zPXtbXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ1llcycsIHZhbHVlOiAneWVzJyBhcyBjb25zdCB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdObycsIHZhbHVlOiAnbm8nIGFzIGNvbnN0IH0sXG4gICAgICAgICAgICAgIF19XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVFbXB0eVBsYW5SZXNwb25zZX1cbiAgICAgICAgICAgICAgb25DYW5jZWw9eygpID0+IHtcbiAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfcGxhbl9leGl0Jywge1xuICAgICAgICAgICAgICAgICAgcGxhbkxlbmd0aENoYXJzOiAwLFxuICAgICAgICAgICAgICAgICAgb3V0Y29tZTpcbiAgICAgICAgICAgICAgICAgICAgJ25vJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgICAgaW50ZXJ2aWV3UGhhc2VFbmFibGVkOiBpc1BsYW5Nb2RlSW50ZXJ2aWV3UGhhc2VFbmFibGVkKCksXG4gICAgICAgICAgICAgICAgICBwbGFuU3RydWN0dXJlVmFyaWFudCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIG9uRG9uZSgpXG4gICAgICAgICAgICAgICAgb25SZWplY3QoKVxuICAgICAgICAgICAgICAgIHRvb2xVc2VDb25maXJtLm9uUmVqZWN0KClcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9QZXJtaXNzaW9uRGlhbG9nPlxuICAgIClcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPEJveFxuICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICB0YWJJbmRleD17MH1cbiAgICAgIGF1dG9Gb2N1c1xuICAgICAgb25LZXlEb3duPXtoYW5kbGVLZXlEb3dufVxuICAgID5cbiAgICAgIDxQZXJtaXNzaW9uRGlhbG9nXG4gICAgICAgIGNvbG9yPVwicGxhbk1vZGVcIlxuICAgICAgICB0aXRsZT1cIlJlYWR5IHRvIGNvZGU/XCJcbiAgICAgICAgaW5uZXJQYWRkaW5nWD17MH1cbiAgICAgICAgd29ya2VyQmFkZ2U9e3dvcmtlckJhZGdlfVxuICAgICAgPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxCb3ggcGFkZGluZ1g9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0PkhlcmUgaXMgQ2xhdWRlJmFwb3M7cyBwbGFuOjwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Qm94XG4gICAgICAgICAgICBib3JkZXJDb2xvcj1cInN1YnRsZVwiXG4gICAgICAgICAgICBib3JkZXJTdHlsZT1cImRhc2hlZFwiXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgIGJvcmRlckxlZnQ9e2ZhbHNlfVxuICAgICAgICAgICAgYm9yZGVyUmlnaHQ9e2ZhbHNlfVxuICAgICAgICAgICAgcGFkZGluZ1g9ezF9XG4gICAgICAgICAgICBtYXJnaW5Cb3R0b209ezF9XG4gICAgICAgICAgICAvLyBOZWNlc3NhcnkgZm9yIFdpbmRvd3MgVGVybWluYWwgdG8gcmVuZGVyIHByb3Blcmx5XG4gICAgICAgICAgICBvdmVyZmxvdz1cImhpZGRlblwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPE1hcmtkb3duPntjdXJyZW50UGxhbn08L01hcmtkb3duPlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHBhZGRpbmdYPXsxfT5cbiAgICAgICAgICAgIDxQZXJtaXNzaW9uUnVsZUV4cGxhbmF0aW9uXG4gICAgICAgICAgICAgIHBlcm1pc3Npb25SZXN1bHQ9e3Rvb2xVc2VDb25maXJtLnBlcm1pc3Npb25SZXN1bHR9XG4gICAgICAgICAgICAgIHRvb2xUeXBlPVwidG9vbFwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAge2lzQ2xhc3NpZmllclBlcm1pc3Npb25zRW5hYmxlZCgpICYmXG4gICAgICAgICAgICAgIGFsbG93ZWRQcm9tcHRzICYmXG4gICAgICAgICAgICAgIGFsbG93ZWRQcm9tcHRzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBib2xkPlJlcXVlc3RlZCBwZXJtaXNzaW9uczo8L1RleHQ+XG4gICAgICAgICAgICAgICAgICB7YWxsb3dlZFByb21wdHMubWFwKChwLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0IGtleT17aX0gZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgeycgICd9wrcge3AudG9vbH0oe1BST01QVF9QUkVGSVh9IHtwLnByb21wdH0pXG4gICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgeyF1c2VTdGlja3lGb290ZXIgJiYgKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgQ2xhdWRlIGhhcyB3cml0dGVuIHVwIGEgcGxhbiBhbmQgaXMgcmVhZHkgdG8gZXhlY3V0ZS4gV291bGRcbiAgICAgICAgICAgICAgICAgIHlvdSBsaWtlIHRvIHByb2NlZWQ/XG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgICAgIDxTZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucz17b3B0aW9uc31cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2hhbmRsZVJlc3BvbnNlfVxuICAgICAgICAgICAgICAgICAgICBvbkNhbmNlbD17KCkgPT4gaGFuZGxlQ2FuY2VsUmVmLmN1cnJlbnQ/LigpfVxuICAgICAgICAgICAgICAgICAgICBvbkltYWdlUGFzdGU9e29uSW1hZ2VQYXN0ZX1cbiAgICAgICAgICAgICAgICAgICAgcGFzdGVkQ29udGVudHM9e3Bhc3RlZENvbnRlbnRzfVxuICAgICAgICAgICAgICAgICAgICBvblJlbW92ZUltYWdlPXtvblJlbW92ZUltYWdlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvUGVybWlzc2lvbkRpYWxvZz5cbiAgICAgIHshdXNlU3RpY2t5Rm9vdGVyICYmIGVkaXRvck5hbWUgJiYgKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9IHBhZGRpbmdYPXsxfSBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5jdHJsLWcgdG8gZWRpdCBpbiA8L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBib2xkIGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7ZWRpdG9yTmFtZX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHtpc1YyICYmIHBsYW5GaWxlUGF0aCAmJiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyB7Z2V0RGlzcGxheVBhdGgocGxhbkZpbGVQYXRoKX08L1RleHQ+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIHtzaG93U2F2ZU1lc3NhZ2UgJiYgKFxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+eycgwrcgJ308L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiPntmaWd1cmVzLnRpY2t9UGxhbiBzYXZlZCE8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLyoqIEBpbnRlcm5hbCBFeHBvcnRlZCBmb3IgdGVzdGluZy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFBsYW5BcHByb3ZhbE9wdGlvbnMoe1xuICBzaG93Q2xlYXJDb250ZXh0LFxuICBzaG93VWx0cmFwbGFuLFxuICB1c2VkUGVyY2VudCxcbiAgaXNBdXRvTW9kZUF2YWlsYWJsZSxcbiAgaXNCeXBhc3NQZXJtaXNzaW9uc01vZGVBdmFpbGFibGUsXG4gIG9uRmVlZGJhY2tDaGFuZ2UsXG59OiB7XG4gIHNob3dDbGVhckNvbnRleHQ6IGJvb2xlYW5cbiAgc2hvd1VsdHJhcGxhbjogYm9vbGVhblxuICB1c2VkUGVyY2VudDogbnVtYmVyIHwgbnVsbFxuICBpc0F1dG9Nb2RlQXZhaWxhYmxlOiBib29sZWFuIHwgdW5kZWZpbmVkXG4gIGlzQnlwYXNzUGVybWlzc2lvbnNNb2RlQXZhaWxhYmxlOiBib29sZWFuIHwgdW5kZWZpbmVkXG4gIG9uRmVlZGJhY2tDaGFuZ2U6ICh2OiBzdHJpbmcpID0+IHZvaWRcbn0pOiBPcHRpb25XaXRoRGVzY3JpcHRpb248UmVzcG9uc2VWYWx1ZT5bXSB7XG4gIGNvbnN0IG9wdGlvbnM6IE9wdGlvbldpdGhEZXNjcmlwdGlvbjxSZXNwb25zZVZhbHVlPltdID0gW11cbiAgY29uc3QgdXNlZExhYmVsID0gdXNlZFBlcmNlbnQgIT09IG51bGwgPyBgICgke3VzZWRQZXJjZW50fSUgdXNlZClgIDogJydcblxuICBpZiAoc2hvd0NsZWFyQ29udGV4dCkge1xuICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSAmJiBpc0F1dG9Nb2RlQXZhaWxhYmxlKSB7XG4gICAgICBvcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogYFllcywgY2xlYXIgY29udGV4dCR7dXNlZExhYmVsfSBhbmQgdXNlIGF1dG8gbW9kZWAsXG4gICAgICAgIHZhbHVlOiAneWVzLWF1dG8tY2xlYXItY29udGV4dCcsXG4gICAgICB9KVxuICAgIH0gZWxzZSBpZiAoaXNCeXBhc3NQZXJtaXNzaW9uc01vZGVBdmFpbGFibGUpIHtcbiAgICAgIG9wdGlvbnMucHVzaCh7XG4gICAgICAgIGxhYmVsOiBgWWVzLCBjbGVhciBjb250ZXh0JHt1c2VkTGFiZWx9IGFuZCBieXBhc3MgcGVybWlzc2lvbnNgLFxuICAgICAgICB2YWx1ZTogJ3llcy1ieXBhc3MtcGVybWlzc2lvbnMnLFxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucy5wdXNoKHtcbiAgICAgICAgbGFiZWw6IGBZZXMsIGNsZWFyIGNvbnRleHQke3VzZWRMYWJlbH0gYW5kIGF1dG8tYWNjZXB0IGVkaXRzYCxcbiAgICAgICAgdmFsdWU6ICd5ZXMtYWNjZXB0LWVkaXRzJyxcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgLy8gU2xvdCAyOiBrZWVwLWNvbnRleHQgd2l0aCBlbGV2YXRlZCBtb2RlIChzYW1lIHByaW9yaXR5OiBhdXRvID4gYnlwYXNzID4gZWRpdHMpLlxuICBpZiAoZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJykgJiYgaXNBdXRvTW9kZUF2YWlsYWJsZSkge1xuICAgIG9wdGlvbnMucHVzaCh7XG4gICAgICBsYWJlbDogJ1llcywgYW5kIHVzZSBhdXRvIG1vZGUnLFxuICAgICAgdmFsdWU6ICd5ZXMtcmVzdW1lLWF1dG8tbW9kZScsXG4gICAgfSlcbiAgfSBlbHNlIGlmIChpc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZSkge1xuICAgIG9wdGlvbnMucHVzaCh7XG4gICAgICBsYWJlbDogJ1llcywgYW5kIGJ5cGFzcyBwZXJtaXNzaW9ucycsXG4gICAgICB2YWx1ZTogJ3llcy1hY2NlcHQtZWRpdHMta2VlcC1jb250ZXh0JyxcbiAgICB9KVxuICB9IGVsc2Uge1xuICAgIG9wdGlvbnMucHVzaCh7XG4gICAgICBsYWJlbDogJ1llcywgYXV0by1hY2NlcHQgZWRpdHMnLFxuICAgICAgdmFsdWU6ICd5ZXMtYWNjZXB0LWVkaXRzLWtlZXAtY29udGV4dCcsXG4gICAgfSlcbiAgfVxuXG4gIG9wdGlvbnMucHVzaCh7XG4gICAgbGFiZWw6ICdZZXMsIG1hbnVhbGx5IGFwcHJvdmUgZWRpdHMnLFxuICAgIHZhbHVlOiAneWVzLWRlZmF1bHQta2VlcC1jb250ZXh0JyxcbiAgfSlcblxuICBpZiAoc2hvd1VsdHJhcGxhbikge1xuICAgIG9wdGlvbnMucHVzaCh7XG4gICAgICBsYWJlbDogJ05vLCByZWZpbmUgd2l0aCBVbHRyYXBsYW4gb24gQ2xhdWRlIENvZGUgb24gdGhlIHdlYicsXG4gICAgICB2YWx1ZTogJ3VsdHJhcGxhbicsXG4gICAgfSlcbiAgfVxuXG4gIG9wdGlvbnMucHVzaCh7XG4gICAgdHlwZTogJ2lucHV0JyxcbiAgICBsYWJlbDogJ05vLCBrZWVwIHBsYW5uaW5nJyxcbiAgICB2YWx1ZTogJ25vJyxcbiAgICBwbGFjZWhvbGRlcjogJ1RlbGwgQ2xhdWRlIHdoYXQgdG8gY2hhbmdlJyxcbiAgICBkZXNjcmlwdGlvbjogJ3NoaWZ0K3RhYiB0byBhcHByb3ZlIHdpdGggdGhpcyBmZWVkYmFjaycsXG4gICAgb25DaGFuZ2U6IG9uRmVlZGJhY2tDaGFuZ2UsXG4gIH0pXG5cbiAgcmV0dXJuIG9wdGlvbnNcbn1cblxuZnVuY3Rpb24gZ2V0Q29udGV4dFVzZWRQZXJjZW50KFxuICB1c2FnZTpcbiAgICB8IHtcbiAgICAgICAgaW5wdXRfdG9rZW5zOiBudW1iZXJcbiAgICAgICAgY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zPzogbnVtYmVyIHwgbnVsbFxuICAgICAgICBjYWNoZV9yZWFkX2lucHV0X3Rva2Vucz86IG51bWJlciB8IG51bGxcbiAgICAgIH1cbiAgICB8IHVuZGVmaW5lZCxcbiAgcGVybWlzc2lvbk1vZGU6IFBlcm1pc3Npb25Nb2RlLFxuKTogbnVtYmVyIHwgbnVsbCB7XG4gIGlmICghdXNhZ2UpIHJldHVybiBudWxsXG4gIGNvbnN0IHJ1bnRpbWVNb2RlbCA9IGdldFJ1bnRpbWVNYWluTG9vcE1vZGVsKHtcbiAgICBwZXJtaXNzaW9uTW9kZSxcbiAgICBtYWluTG9vcE1vZGVsOiBnZXRNYWluTG9vcE1vZGVsKCksXG4gICAgZXhjZWVkczIwMGtUb2tlbnM6IGZhbHNlLFxuICB9KVxuICBjb25zdCBjb250ZXh0V2luZG93U2l6ZSA9IGdldENvbnRleHRXaW5kb3dGb3JNb2RlbChcbiAgICBydW50aW1lTW9kZWwsXG4gICAgZ2V0U2RrQmV0YXMoKSxcbiAgKVxuICBjb25zdCB7IHVzZWQgfSA9IGNhbGN1bGF0ZUNvbnRleHRQZXJjZW50YWdlcyhcbiAgICB7XG4gICAgICBpbnB1dF90b2tlbnM6IHVzYWdlLmlucHV0X3Rva2VucyxcbiAgICAgIGNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VuczogdXNhZ2UuY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zID8/IDAsXG4gICAgICBjYWNoZV9yZWFkX2lucHV0X3Rva2VuczogdXNhZ2UuY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMgPz8gMCxcbiAgICB9LFxuICAgIGNvbnRleHRXaW5kb3dTaXplLFxuICApXG4gIHJldHVybiB1c2VkXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLGNBQWNDLElBQUksUUFBUSxRQUFRO0FBQ2xDLE9BQU9DLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU9DLEtBQUssSUFDVkMsV0FBVyxFQUNYQyxTQUFTLEVBQ1RDLGVBQWUsRUFDZkMsT0FBTyxFQUNQQyxNQUFNLEVBQ05DLFFBQVEsUUFDSCxPQUFPO0FBQ2QsU0FBU0MsZ0JBQWdCLFFBQVEsOEJBQThCO0FBQy9ELFNBQ0UsS0FBS0MsMERBQTBELEVBQy9EQyxRQUFRLFFBQ0gsaUNBQWlDO0FBQ3hDLFNBQ0VDLFdBQVcsRUFDWEMsZ0JBQWdCLEVBQ2hCQyxjQUFjLFFBQ1QsdUJBQXVCO0FBQzlCLFNBQ0VDLFdBQVcsRUFDWEMsWUFBWSxFQUNaQyw0QkFBNEIsRUFDNUJDLG9CQUFvQixFQUNwQkMsOEJBQThCLEVBQzlCQyw4QkFBOEIsUUFDekIsNkJBQTZCO0FBQ3BDLFNBQVNDLG1CQUFtQixRQUFRLGlEQUFpRDtBQUNyRixTQUFTQyxlQUFlLFFBQVEsZ0NBQWdDO0FBQ2hFLGNBQWNDLGFBQWEsUUFBUSx1Q0FBdUM7QUFDMUUsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsaUJBQWlCO0FBQzNDLGNBQWNDLFFBQVEsUUFBUSxpQ0FBaUM7QUFDL0QsU0FBU0MsZUFBZSxRQUFRLHVDQUF1QztBQUN2RSxTQUFTQywyQkFBMkIsUUFBUSw4Q0FBOEM7QUFDMUYsY0FBY0MsYUFBYSxRQUFRLHVEQUF1RDtBQUMxRixTQUFTQyxxQkFBcUIsUUFBUSw0Q0FBNEM7QUFDbEYsU0FBU0Msb0JBQW9CLFFBQVEsc0NBQXNDO0FBQzNFLFNBQ0VDLDJCQUEyQixFQUMzQkMsd0JBQXdCLFFBQ25CLDJCQUEyQjtBQUNsQyxTQUFTQyxpQkFBaUIsUUFBUSwwQkFBMEI7QUFDNUQsU0FBU0MsY0FBYyxRQUFRLHdCQUF3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