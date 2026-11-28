import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import figures from 'figures';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useTheme } from '../../../ink.js';
import { useKeybinding } from '../../../keybindings/useKeybinding.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../../services/analytics/index.js';
import { sanitizeToolNameForAnalytics } from '../../../services/analytics/metadata.js';
import { useAppState } from '../../../state/AppState.js';
import { BashTool } from '../../../tools/BashTool/BashTool.js';
import { getFirstWordPrefix, getSimpleCommandPrefix } from '../../../tools/BashTool/bashPermissions.js';
import { getDestructiveCommandWarning } from '../../../tools/BashTool/destructiveCommandWarning.js';
import { parseSedEditCommand } from '../../../tools/BashTool/sedEditParser.js';
import { shouldUseSandbox } from '../../../tools/BashTool/shouldUseSandbox.js';
import { getCompoundCommandPrefixesStatic } from '../../../utils/bash/prefix.js';
import { createPromptRuleContent, generateGenericDescription, getBashPromptAllowDescriptions, isClassifierPermissionsEnabled } from '../../../utils/permissions/bashClassifier.js';
import { extractRules } from '../../../utils/permissions/PermissionUpdate.js';
import type { PermissionUpdate } from '../../../utils/permissions/PermissionUpdateSchema.js';
import { SandboxManager } from '../../../utils/sandbox/sandbox-adapter.js';
import { Select } from '../../CustomSelect/select.js';
import { ShimmerChar } from '../../Spinner/ShimmerChar.js';
import { useShimmerAnimation } from '../../Spinner/useShimmerAnimation.js';
import { type UnaryEvent, usePermissionRequestLogging } from '../hooks.js';
import { PermissionDecisionDebugInfo } from '../PermissionDecisionDebugInfo.js';
import { PermissionDialog } from '../PermissionDialog.js';
import { PermissionExplainerContent, usePermissionExplainerUI } from '../PermissionExplanation.js';
import type { PermissionRequestProps } from '../PermissionRequest.js';
import { PermissionRuleExplanation } from '../PermissionRuleExplanation.js';
import { SedEditPermissionRequest } from '../SedEditPermissionRequest/SedEditPermissionRequest.js';
import { useShellPermissionFeedback } from '../useShellPermissionFeedback.js';
import { logUnaryPermissionEvent } from '../utils.js';
import { bashToolUseOptions } from './bashToolUseOptions.js';
const CHECKING_TEXT = 'Attempting to auto-approve\u2026';

// Isolates the 20fps shimmer clock from BashPermissionRequestInner. Before this
// extraction, useShimmerAnimation lived inside the 535-line Inner body, so every
// 50ms clock tick re-rendered the entire dialog (PermissionDialog + Select +
// all children) for the ~1-3 seconds the classifier typically takes. Inner also
// has a Compiler bailout (see below), so nothing was auto-memoized — the full
// JSX tree was reconstructed 20-60 times per classifier check.
function ClassifierCheckingSubtitle() {
  const $ = _c(6);
  const [ref, glimmerIndex] = useShimmerAnimation("requesting", CHECKING_TEXT, false);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = [...CHECKING_TEXT];
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  let t1;
  if ($[1] !== glimmerIndex) {
    t1 = <Text>{t0.map((char, i) => <ShimmerChar key={i} char={char} index={i} glimmerIndex={glimmerIndex} messageColor="inactive" shimmerColor="subtle" />)}</Text>;
    $[1] = glimmerIndex;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  let t2;
  if ($[3] !== ref || $[4] !== t1) {
    t2 = <Box ref={ref}>{t1}</Box>;
    $[3] = ref;
    $[4] = t1;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  return t2;
}
export function BashPermissionRequest(props) {
  const $ = _c(21);
  const {
    toolUseConfirm,
    toolUseContext,
    onDone,
    onReject,
    verbose,
    workerBadge
  } = props;
  let command;
  let description;
  let t0;
  if ($[0] !== toolUseConfirm.input) {
    ({
      command,
      description
    } = BashTool.inputSchema.parse(toolUseConfirm.input));
    t0 = parseSedEditCommand(command);
    $[0] = toolUseConfirm.input;
    $[1] = command;
    $[2] = description;
    $[3] = t0;
  } else {
    command = $[1];
    description = $[2];
    t0 = $[3];
  }
  const sedInfo = t0;
  if (sedInfo) {
    let t1;
    if ($[4] !== onDone || $[5] !== onReject || $[6] !== sedInfo || $[7] !== toolUseConfirm || $[8] !== toolUseContext || $[9] !== verbose || $[10] !== workerBadge) {
      t1 = <SedEditPermissionRequest toolUseConfirm={toolUseConfirm} toolUseContext={toolUseContext} onDone={onDone} onReject={onReject} verbose={verbose} workerBadge={workerBadge} sedInfo={sedInfo} />;
      $[4] = onDone;
      $[5] = onReject;
      $[6] = sedInfo;
      $[7] = toolUseConfirm;
      $[8] = toolUseContext;
      $[9] = verbose;
      $[10] = workerBadge;
      $[11] = t1;
    } else {
      t1 = $[11];
    }
    return t1;
  }
  let t1;
  if ($[12] !== command || $[13] !== description || $[14] !== onDone || $[15] !== onReject || $[16] !== toolUseConfirm || $[17] !== toolUseContext || $[18] !== verbose || $[19] !== workerBadge) {
    t1 = <BashPermissionRequestInner toolUseConfirm={toolUseConfirm} toolUseContext={toolUseContext} onDone={onDone} onReject={onReject} verbose={verbose} workerBadge={workerBadge} command={command} description={description} />;
    $[12] = command;
    $[13] = description;
    $[14] = onDone;
    $[15] = onReject;
    $[16] = toolUseConfirm;
    $[17] = toolUseContext;
    $[18] = verbose;
    $[19] = workerBadge;
    $[20] = t1;
  } else {
    t1 = $[20];
  }
  return t1;
}

// Inner component that uses hooks - only called for non-MCP CLI commands
function BashPermissionRequestInner({
  toolUseConfirm,
  toolUseContext,
  onDone,
  onReject,
  verbose: _verbose,
  workerBadge,
  command,
  description
}: PermissionRequestProps & {
  command: string;
  description?: string;
}): React.ReactNode {
  const [theme] = useTheme();
  const toolPermissionContext = useAppState(s => s.toolPermissionContext);
  const explainerState = usePermissionExplainerUI({
    toolName: toolUseConfirm.tool.name,
    toolInput: toolUseConfirm.input,
    toolDescription: toolUseConfirm.description,
    messages: toolUseContext.messages
  });
  const {
    yesInputMode,
    noInputMode,
    yesFeedbackModeEntered,
    noFeedbackModeEntered,
    acceptFeedback,
    rejectFeedback,
    setAcceptFeedback,
    setRejectFeedback,
    focusedOption,
    handleInputModeToggle,
    handleReject,
    handleFocus
  } = useShellPermissionFeedback({
    toolUseConfirm,
    onDone,
    onReject,
    explainerVisible: explainerState.visible
  });
  const [showPermissionDebug, setShowPermissionDebug] = useState(false);
  const [classifierDescription, setClassifierDescription] = useState(description || '');
  // Track whether the initial description (from prop or async generation) was empty.
  // Once we receive a non-empty description, this stays false.
  const [initialClassifierDescriptionEmpty, setInitialClassifierDescriptionEmpty] = useState(!description?.trim());

  // Asynchronously generate a generic description for the classifier
  useEffect(() => {
    if (!isClassifierPermissionsEnabled()) return;
    const abortController = new AbortController();
    generateGenericDescription(command, description, abortController.signal).then(generic => {
      if (generic && !abortController.signal.aborted) {
        setClassifierDescription(generic);
        setInitialClassifierDescriptionEmpty(false);
      }
    }).catch(() => {}); // Keep original on error
    return () => abortController.abort();
  }, [command, description]);

  // GH#11380: For compound commands (cd src && git status && npm test), the
  // backend already computed correct per-subcommand suggestions via tree-sitter
  // split + per-subcommand permission checks. decisionReason.type ===
  // 'subcommandResults' marks this path. The sync prefix heuristics below
  // (getSimpleCommandPrefix/getFirstWordPrefix) operate on the FULL compound
  // string and pick the first two words — producing dead rules like
  // `Bash(cd src:*)` or `Bash(./script.sh && npm test)` that never match again.
  // Users accumulate 150+ of these in settings.local.json.
  //
  // When compound with exactly one Bash rule (e.g. `cd src && npm test` where
  // cd is read-only → only npm test needs approval), seed the editable input
  // from the backend rule. When compound with 2+ rules, editablePrefix stays
  // undefined so bashToolUseOptions falls through to yes-apply-suggestions,
  // which saves all per-subcommand rules atomically.
  const isCompound = toolUseConfirm.permissionResult.decisionReason?.type === 'subcommandResults';

  // Editable prefix — initialize synchronously with the best prefix we can
  // extract without tree-sitter, then refine via tree-sitter for compound
  // commands. The sync path matters because TREE_SITTER_BASH is gated
  // ant-only: in external builds the async refinement below always resolves
  // to [] and this initial value is what the user sees.
  //
  // Lazy initializer: this runs regex + split on every render if left in
  // the render body; it's only needed for initial state.
  const [editablePrefix, setEditablePrefix] = useState<string | undefined>(() => {
    if (isCompound) {
      // Backend suggestion is the source of truth for compound commands.
      // Single rule → seed the editable input so the user can refine it.
      // Multiple/zero rules → undefined → yes-apply-suggestions handles it.
      const backendBashRules = extractRules('suggestions' in toolUseConfirm.permissionResult ? toolUseConfirm.permissionResult.suggestions : undefined).filter(r => r.toolName === BashTool.name && r.ruleContent);
      return backendBashRules.length === 1 ? backendBashRules[0]!.ruleContent : undefined;
    }
    const two = getSimpleCommandPrefix(command);
    if (two) return `${two}:*`;
    const one = getFirstWordPrefix(command);
    if (one) return `${one}:*`;
    return command;
  });
  const hasUserEditedPrefix = useRef(false);
  const onEditablePrefixChange = useCallback((value: string) => {
    hasUserEditedPrefix.current = true;
    setEditablePrefix(value);
  }, []);
  useEffect(() => {
    // Skip async refinement for compound commands — the backend already ran
    // the full per-subcommand analysis and its suggestion is correct.
    if (isCompound) return;
    let cancelled = false;
    getCompoundCommandPrefixesStatic(command, subcmd => BashTool.isReadOnly({
      command: subcmd
    })).then(prefixes => {
      if (cancelled || hasUserEditedPrefix.current) return;
      if (prefixes.length > 0) {
        setEditablePrefix(`${prefixes[0]}:*`);
      }
    }).catch(() => {}); // Keep sync prefix on tree-sitter failure
    return () => {
      cancelled = true;
    };
  }, [command, isCompound]);

  // Track whether classifier check was ever in progress (persists after completion).
  // classifierCheckInProgress is set once at queue-push time (interactiveHandler)
  // and only ever transitions true→false, so capturing the mount-time value is
  // sufficient — no latch/ref needed. The feature() ternary keeps the property
  // read out of external builds (forbidden-string check).
  const [classifierWasChecking] = useState(feature('BASH_CLASSIFIER') ? !!toolUseConfirm.classifierCheckInProgress : false);

  // These derive solely from the tool input (fixed for the dialog lifetime).
  // The shimmer clock used to live in this component and re-render it at 20fps
  // while the classifier ran (see ClassifierCheckingSubtitle above for the
  // extraction). React Compiler can't auto-memoize imported functions (can't
  // prove side-effect freedom), so this useMemo still guards against any
  // re-render source (e.g. Inner state updates). Same pattern as PR#20730.
  const {
    destructiveWarning: destructiveWarning_0,
    sandboxingEnabled: sandboxingEnabled_0,
    isSandboxed: isSandboxed_0
  } = useMemo(() => {
    const destructiveWarning = getFeatureValue_CACHED_MAY_BE_STALE('tengu_destructive_command_warning', false) ? getDestructiveCommandWarning(command) : null;
    const sandboxingEnabled = SandboxManager.isSandboxingEnabled();
    const isSandboxed = sandboxingEnabled && shouldUseSandbox(toolUseConfirm.input);
    return {
      destructiveWarning,
      sandboxingEnabled,
      isSandboxed
    };
  }, [command, toolUseConfirm.input]);
  const unaryEvent = useMemo<UnaryEvent>(() => ({
    completion_type: 'tool_use_single',
    language_name: 'none'
  }), []);
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const existingAllowDescriptions = useMemo(() => getBashPromptAllowDescriptions(toolPermissionContext), [toolPermissionContext]);
  const options = useMemo(() => bashToolUseOptions({
    suggestions: toolUseConfirm.permissionResult.behavior === 'ask' ? toolUseConfirm.permissionResult.suggestions : undefined,
    decisionReason: toolUseConfirm.permissionResult.decisionReason,
    onRejectFeedbackChange: setRejectFeedback,
    onAcceptFeedbackChange: setAcceptFeedback,
    onClassifierDescriptionChange: setClassifierDescription,
    classifierDescription,
    initialClassifierDescriptionEmpty,
    existingAllowDescriptions,
    yesInputMode,
    noInputMode,
    editablePrefix,
    onEditablePrefixChange
  }), [toolUseConfirm, classifierDescription, initialClassifierDescriptionEmpty, existingAllowDescriptions, yesInputMode, noInputMode, editablePrefix, onEditablePrefixChange]);

  // Toggle permission debug info with keybinding
  const handleToggleDebug = useCallback(() => {
    setShowPermissionDebug(prev => !prev);
  }, []);
  useKeybinding('permission:toggleDebug', handleToggleDebug, {
    context: 'Confirmation'
  });

  // Allow Esc to dismiss the checkmark after auto-approval
  const handleDismissCheckmark = useCallback(() => {
    toolUseConfirm.onDismissCheckmark?.();
  }, [toolUseConfirm]);
  useKeybinding('confirm:no', handleDismissCheckmark, {
    context: 'Confirmation',
    isActive: feature('BASH_CLASSIFIER') ? !!toolUseConfirm.classifierAutoApproved : false
  });
  function onSelect(value_0: string) {
    // Map options to numeric values for analytics (strings not allowed in logEvent)
    let optionIndex: Record<string, number> = {
      yes: 1,
      'yes-apply-suggestions': 2,
      'yes-prefix-edited': 2,
      no: 3
    };
    if (feature('BASH_CLASSIFIER')) {
      optionIndex = {
        yes: 1,
        'yes-apply-suggestions': 2,
        'yes-prefix-edited': 2,
        'yes-classifier-reviewed': 3,
        no: 4
      };
    }
    logEvent('tengu_permission_request_option_selected', {
      option_index: optionIndex[value_0],
      explainer_visible: explainerState.visible
    });
    const toolNameForAnalytics = sanitizeToolNameForAnalytics(toolUseConfirm.tool.name) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    if (value_0 === 'yes-prefix-edited') {
      const trimmedPrefix = (editablePrefix ?? '').trim();
      logUnaryPermissionEvent('tool_use_single', toolUseConfirm, 'accept');
      if (!trimmedPrefix) {
        toolUseConfirm.onAllow(toolUseConfirm.input, []);
      } else {
        const prefixUpdates: PermissionUpdate[] = [{
          type: 'addRules',
          rules: [{
            toolName: BashTool.name,
            ruleContent: trimmedPrefix
          }],
          behavior: 'allow',
          destination: 'localSettings'
        }];
        toolUseConfirm.onAllow(toolUseConfirm.input, prefixUpdates);
      }
      onDone();
      return;
    }
    if (feature('BASH_CLASSIFIER') && value_0 === 'yes-classifier-reviewed') {
      const trimmedDescription = classifierDescription.trim();
      logUnaryPermissionEvent('tool_use_single', toolUseConfirm, 'accept');
      if (!trimmedDescription) {
        toolUseConfirm.onAllow(toolUseConfirm.input, []);
      } else {
        const permissionUpdates: PermissionUpdate[] = [{
          type: 'addRules',
          rules: [{
            toolName: BashTool.name,
            ruleContent: createPromptRuleContent(trimmedDescription)
          }],
          behavior: 'allow',
          destination: 'session'
        }];
        toolUseConfirm.onAllow(toolUseConfirm.input, permissionUpdates);
      }
      onDone();
      return;
    }
    switch (value_0) {
      case 'yes':
        {
          const trimmedFeedback_0 = acceptFeedback.trim();
          logUnaryPermissionEvent('tool_use_single', toolUseConfirm, 'accept');
          // Log accept submission with feedback context
          logEvent('tengu_accept_submitted', {
            toolName: toolNameForAnalytics,
            isMcp: toolUseConfirm.tool.isMcp ?? false,
            has_instructions: !!trimmedFeedback_0,
            instructions_length: trimmedFeedback_0.length,
            entered_feedback_mode: yesFeedbackModeEntered
          });
          toolUseConfirm.onAllow(toolUseConfirm.input, [], trimmedFeedback_0 || undefined);
          onDone();
          break;
        }
      case 'yes-apply-suggestions':
        {
          logUnaryPermissionEvent('tool_use_single', toolUseConfirm, 'accept');
          // Extract suggestions if present (works for both 'ask' and 'passthrough' behaviors)
          const permissionUpdates_0 = 'suggestions' in toolUseConfirm.permissionResult ? toolUseConfirm.permissionResult.suggestions || [] : [];
          toolUseConfirm.onAllow(toolUseConfirm.input, permissionUpdates_0);
          onDone();
          break;
        }
      case 'no':
        {
          const trimmedFeedback = rejectFeedback.trim();

          // Log reject submission with feedback context
          logEvent('tengu_reject_submitted', {
            toolName: toolNameForAnalytics,
            isMcp: toolUseConfirm.tool.isMcp ?? false,
            has_instructions: !!trimmedFeedback,
            instructions_length: trimmedFeedback.length,
            entered_feedback_mode: noFeedbackModeEntered
          });

          // Process rejection (with or without feedback)
          handleReject(trimmedFeedback || undefined);
          break;
        }
    }
  }
  const classifierSubtitle = feature('BASH_CLASSIFIER') ? toolUseConfirm.classifierAutoApproved ? <Text>
        <Text color="success">{figures.tick} Auto-approved</Text>
        {toolUseConfirm.classifierMatchedRule && <Text dimColor>
            {' \u00b7 matched "'}
            {toolUseConfirm.classifierMatchedRule}
            {'"'}
          </Text>}
      </Text> : toolUseConfirm.classifierCheckInProgress ? <ClassifierCheckingSubtitle /> : classifierWasChecking ? <Text dimColor>Requires manual approval</Text> : undefined : undefined;
  return <PermissionDialog workerBadge={workerBadge} title={sandboxingEnabled_0 && !isSandboxed_0 ? 'Bash command (unsandboxed)' : 'Bash command'} subtitle={classifierSubtitle}>
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text dimColor={explainerState.visible}>
          {BashTool.renderToolUseMessage({
          command,
          description
        }, {
          theme,
          verbose: true
        } // always show the full command
        )}
        </Text>
        {!explainerState.visible && <Text dimColor>{toolUseConfirm.description}</Text>}
        <PermissionExplainerContent visible={explainerState.visible} promise={explainerState.promise} />
      </Box>
      {showPermissionDebug ? <>
          <PermissionDecisionDebugInfo permissionResult={toolUseConfirm.permissionResult} toolName="Bash" />
          {toolUseContext.options.debug && <Box justifyContent="flex-end" marginTop={1}>
              <Text dimColor>Ctrl-D to hide debug info</Text>
            </Box>}
        </> : <>
          <Box flexDirection="column">
            <PermissionRuleExplanation permissionResult={toolUseConfirm.permissionResult} toolType="command" />
            {destructiveWarning_0 && <Box marginBottom={1}>
                <Text color="warning" dimColor={feature('BASH_CLASSIFIER') ? toolUseConfirm.classifierAutoApproved : false}>
                  {destructiveWarning_0}
                </Text>
              </Box>}
            <Text dimColor={feature('BASH_CLASSIFIER') ? toolUseConfirm.classifierAutoApproved : false}>
              Do you want to proceed?
            </Text>
            <Select options={feature('BASH_CLASSIFIER') ? toolUseConfirm.classifierAutoApproved ? options.map(o => ({
          ...o,
          disabled: true
        })) : options : options} isDisabled={feature('BASH_CLASSIFIER') ? toolUseConfirm.classifierAutoApproved : false} inlineDescriptions onChange={onSelect} onCancel={() => handleReject()} onFocus={handleFocus} onInputModeToggle={handleInputModeToggle} />
          </Box>
          <Box justifyContent="space-between" marginTop={1}>
            <Text dimColor>
              Esc to cancel
              {(focusedOption === 'yes' && !yesInputMode || focusedOption === 'no' && !noInputMode) && ' · Tab to amend'}
              {explainerState.enabled && ` · ctrl+e to ${explainerState.visible ? 'hide' : 'explain'}`}
            </Text>
            {toolUseContext.options.debug && <Text dimColor>Ctrl+d to show debug info</Text>}
          </Box>
        </>}
    </PermissionDialog>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiZmlndXJlcyIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJCb3giLCJUZXh0IiwidXNlVGhlbWUiLCJ1c2VLZXliaW5kaW5nIiwiZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJzYW5pdGl6ZVRvb2xOYW1lRm9yQW5hbHl0aWNzIiwidXNlQXBwU3RhdGUiLCJCYXNoVG9vbCIsImdldEZpcnN0V29yZFByZWZpeCIsImdldFNpbXBsZUNvbW1hbmRQcmVmaXgiLCJnZXREZXN0cnVjdGl2ZUNvbW1hbmRXYXJuaW5nIiwicGFyc2VTZWRFZGl0Q29tbWFuZCIsInNob3VsZFVzZVNhbmRib3giLCJnZXRDb21wb3VuZENvbW1hbmRQcmVmaXhlc1N0YXRpYyIsImNyZWF0ZVByb21wdFJ1bGVDb250ZW50IiwiZ2VuZXJhdGVHZW5lcmljRGVzY3JpcHRpb24iLCJnZXRCYXNoUHJvbXB0QWxsb3dEZXNjcmlwdGlvbnMiLCJpc0NsYXNzaWZpZXJQZXJtaXNzaW9uc0VuYWJsZWQiLCJleHRyYWN0UnVsZXMiLCJQZXJtaXNzaW9uVXBkYXRlIiwiU2FuZGJveE1hbmFnZXIiLCJTZWxlY3QiLCJTaGltbWVyQ2hhciIsInVzZVNoaW1tZXJBbmltYXRpb24iLCJVbmFyeUV2ZW50IiwidXNlUGVybWlzc2lvblJlcXVlc3RMb2dnaW5nIiwiUGVybWlzc2lvbkRlY2lzaW9uRGVidWdJbmZvIiwiUGVybWlzc2lvbkRpYWxvZyIsIlBlcm1pc3Npb25FeHBsYWluZXJDb250ZW50IiwidXNlUGVybWlzc2lvbkV4cGxhaW5lclVJIiwiUGVybWlzc2lvblJlcXVlc3RQcm9wcyIsIlBlcm1pc3Npb25SdWxlRXhwbGFuYXRpb24iLCJTZWRFZGl0UGVybWlzc2lvblJlcXVlc3QiLCJ1c2VTaGVsbFBlcm1pc3Npb25GZWVkYmFjayIsImxvZ1VuYXJ5UGVybWlzc2lvbkV2ZW50IiwiYmFzaFRvb2xVc2VPcHRpb25zIiwiQ0hFQ0tJTkdfVEVYVCIsIkNsYXNzaWZpZXJDaGVja2luZ1N1YnRpdGxlIiwiJCIsIl9jIiwicmVmIiwiZ2xpbW1lckluZGV4IiwidDAiLCJTeW1ib2wiLCJmb3IiLCJ0MSIsIm1hcCIsImNoYXIiLCJpIiwidDIiLCJCYXNoUGVybWlzc2lvblJlcXVlc3QiLCJwcm9wcyIsInRvb2xVc2VDb25maXJtIiwidG9vbFVzZUNvbnRleHQiLCJvbkRvbmUiLCJvblJlamVjdCIsInZlcmJvc2UiLCJ3b3JrZXJCYWRnZSIsImNvbW1hbmQiLCJkZXNjcmlwdGlvbiIsImlucHV0IiwiaW5wdXRTY2hlbWEiLCJwYXJzZSIsInNlZEluZm8iLCJCYXNoUGVybWlzc2lvblJlcXVlc3RJbm5lciIsIl92ZXJib3NlIiwiUmVhY3ROb2RlIiwidGhlbWUiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJzIiwiZXhwbGFpbmVyU3RhdGUiLCJ0b29sTmFtZSIsInRvb2wiLCJuYW1lIiwidG9vbElucHV0IiwidG9vbERlc2NyaXB0aW9uIiwibWVzc2FnZXMiLCJ5ZXNJbnB1dE1vZGUiLCJub0lucHV0TW9kZSIsInllc0ZlZWRiYWNrTW9kZUVudGVyZWQiLCJub0ZlZWRiYWNrTW9kZUVudGVyZWQiLCJhY2NlcHRGZWVkYmFjayIsInJlamVjdEZlZWRiYWNrIiwic2V0QWNjZXB0RmVlZGJhY2siLCJzZXRSZWplY3RGZWVkYmFjayIsImZvY3VzZWRPcHRpb24iLCJoYW5kbGVJbnB1dE1vZGVUb2dnbGUiLCJoYW5kbGVSZWplY3QiLCJoYW5kbGVGb2N1cyIsImV4cGxhaW5lclZpc2libGUiLCJ2aXNpYmxlIiwic2hvd1Blcm1pc3Npb25EZWJ1ZyIsInNldFNob3dQZXJtaXNzaW9uRGVidWciLCJjbGFzc2lmaWVyRGVzY3JpcHRpb24iLCJzZXRDbGFzc2lmaWVyRGVzY3JpcHRpb24iLCJpbml0aWFsQ2xhc3NpZmllckRlc2NyaXB0aW9uRW1wdHkiLCJzZXRJbml0aWFsQ2xhc3NpZmllckRlc2NyaXB0aW9uRW1wdHkiLCJ0cmltIiwiYWJvcnRDb250cm9sbGVyIiwiQWJvcnRDb250cm9sbGVyIiwic2lnbmFsIiwidGhlbiIsImdlbmVyaWMiLCJhYm9ydGVkIiwiY2F0Y2giLCJhYm9ydCIsImlzQ29tcG91bmQiLCJwZXJtaXNzaW9uUmVzdWx0IiwiZGVjaXNpb25SZWFzb24iLCJ0eXBlIiwiZWRpdGFibGVQcmVmaXgiLCJzZXRFZGl0YWJsZVByZWZpeCIsImJhY2tlbmRCYXNoUnVsZXMiLCJzdWdnZXN0aW9ucyIsInVuZGVmaW5lZCIsImZpbHRlciIsInIiLCJydWxlQ29udGVudCIsImxlbmd0aCIsInR3byIsIm9uZSIsImhhc1VzZXJFZGl0ZWRQcmVmaXgiLCJvbkVkaXRhYmxlUHJlZml4Q2hhbmdlIiwidmFsdWUiLCJjdXJyZW50IiwiY2FuY2VsbGVkIiwic3ViY21kIiwiaXNSZWFkT25seSIsInByZWZpeGVzIiwiY2xhc3NpZmllcldhc0NoZWNraW5nIiwiY2xhc3NpZmllckNoZWNrSW5Qcm9ncmVzcyIsImRlc3RydWN0aXZlV2FybmluZyIsInNhbmRib3hpbmdFbmFibGVkIiwiaXNTYW5kYm94ZWQiLCJpc1NhbmRib3hpbmdFbmFibGVkIiwidW5hcnlFdmVudCIsImNvbXBsZXRpb25fdHlwZSIsImxhbmd1YWdlX25hbWUiLCJleGlzdGluZ0FsbG93RGVzY3JpcHRpb25zIiwib3B0aW9ucyIsImJlaGF2aW9yIiwib25SZWplY3RGZWVkYmFja0NoYW5nZSIsIm9uQWNjZXB0RmVlZGJhY2tDaGFuZ2UiLCJvbkNsYXNzaWZpZXJEZXNjcmlwdGlvbkNoYW5nZSIsImhhbmRsZVRvZ2dsZURlYnVnIiwicHJldiIsImNvbnRleHQiLCJoYW5kbGVEaXNtaXNzQ2hlY2ttYXJrIiwib25EaXNtaXNzQ2hlY2ttYXJrIiwiaXNBY3RpdmUiLCJjbGFzc2lmaWVyQXV0b0FwcHJvdmVkIiwib25TZWxlY3QiLCJvcHRpb25JbmRleCIsIlJlY29yZCIsInllcyIsIm5vIiwib3B0aW9uX2luZGV4IiwiZXhwbGFpbmVyX3Zpc2libGUiLCJ0b29sTmFtZUZvckFuYWx5dGljcyIsInRyaW1tZWRQcmVmaXgiLCJvbkFsbG93IiwicHJlZml4VXBkYXRlcyIsInJ1bGVzIiwiZGVzdGluYXRpb24iLCJ0cmltbWVkRGVzY3JpcHRpb24iLCJwZXJtaXNzaW9uVXBkYXRlcyIsInRyaW1tZWRGZWVkYmFjayIsImlzTWNwIiwiaGFzX2luc3RydWN0aW9ucyIsImluc3RydWN0aW9uc19sZW5ndGgiLCJlbnRlcmVkX2ZlZWRiYWNrX21vZGUiLCJjbGFzc2lmaWVyU3VidGl0bGUiLCJ0aWNrIiwiY2xhc3NpZmllck1hdGNoZWRSdWxlIiwicmVuZGVyVG9vbFVzZU1lc3NhZ2UiLCJwcm9taXNlIiwiZGVidWciLCJvIiwiZGlzYWJsZWQiLCJlbmFibGVkIl0sInNvdXJjZXMiOlsiQmFzaFBlcm1pc3Npb25SZXF1ZXN0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgUmVhY3QsIHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgQm94LCBUZXh0LCB1c2VUaGVtZSB9IGZyb20gJy4uLy4uLy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hbmFseXRpY3MvZ3Jvd3RoYm9vay5qcydcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IHNhbml0aXplVG9vbE5hbWVGb3JBbmFseXRpY3MgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hbmFseXRpY3MvbWV0YWRhdGEuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgQmFzaFRvb2wgfSBmcm9tICcuLi8uLi8uLi90b29scy9CYXNoVG9vbC9CYXNoVG9vbC5qcydcbmltcG9ydCB7XG4gIGdldEZpcnN0V29yZFByZWZpeCxcbiAgZ2V0U2ltcGxlQ29tbWFuZFByZWZpeCxcbn0gZnJvbSAnLi4vLi4vLi4vdG9vbHMvQmFzaFRvb2wvYmFzaFBlcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHsgZ2V0RGVzdHJ1Y3RpdmVDb21tYW5kV2FybmluZyB9IGZyb20gJy4uLy4uLy4uL3Rvb2xzL0Jhc2hUb29sL2Rlc3RydWN0aXZlQ29tbWFuZFdhcm5pbmcuanMnXG5pbXBvcnQgeyBwYXJzZVNlZEVkaXRDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vdG9vbHMvQmFzaFRvb2wvc2VkRWRpdFBhcnNlci5qcydcbmltcG9ydCB7IHNob3VsZFVzZVNhbmRib3ggfSBmcm9tICcuLi8uLi8uLi90b29scy9CYXNoVG9vbC9zaG91bGRVc2VTYW5kYm94LmpzJ1xuaW1wb3J0IHsgZ2V0Q29tcG91bmRDb21tYW5kUHJlZml4ZXNTdGF0aWMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9iYXNoL3ByZWZpeC5qcydcbmltcG9ydCB7XG4gIGNyZWF0ZVByb21wdFJ1bGVDb250ZW50LFxuICBnZW5lcmF0ZUdlbmVyaWNEZXNjcmlwdGlvbixcbiAgZ2V0QmFzaFByb21wdEFsbG93RGVzY3JpcHRpb25zLFxuICBpc0NsYXNzaWZpZXJQZXJtaXNzaW9uc0VuYWJsZWQsXG59IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL2Jhc2hDbGFzc2lmaWVyLmpzJ1xuaW1wb3J0IHsgZXh0cmFjdFJ1bGVzIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvcGVybWlzc2lvbnMvUGVybWlzc2lvblVwZGF0ZS5qcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvblVwZGF0ZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25VcGRhdGVTY2hlbWEuanMnXG5pbXBvcnQgeyBTYW5kYm94TWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3NhbmRib3gvc2FuZGJveC1hZGFwdGVyLmpzJ1xuaW1wb3J0IHsgU2VsZWN0IH0gZnJvbSAnLi4vLi4vQ3VzdG9tU2VsZWN0L3NlbGVjdC5qcydcbmltcG9ydCB7IFNoaW1tZXJDaGFyIH0gZnJvbSAnLi4vLi4vU3Bpbm5lci9TaGltbWVyQ2hhci5qcydcbmltcG9ydCB7IHVzZVNoaW1tZXJBbmltYXRpb24gfSBmcm9tICcuLi8uLi9TcGlubmVyL3VzZVNoaW1tZXJBbmltYXRpb24uanMnXG5pbXBvcnQgeyB0eXBlIFVuYXJ5RXZlbnQsIHVzZVBlcm1pc3Npb25SZXF1ZXN0TG9nZ2luZyB9IGZyb20gJy4uL2hvb2tzLmpzJ1xuaW1wb3J0IHsgUGVybWlzc2lvbkRlY2lzaW9uRGVidWdJbmZvIH0gZnJvbSAnLi4vUGVybWlzc2lvbkRlY2lzaW9uRGVidWdJbmZvLmpzJ1xuaW1wb3J0IHsgUGVybWlzc2lvbkRpYWxvZyB9IGZyb20gJy4uL1Blcm1pc3Npb25EaWFsb2cuanMnXG5pbXBvcnQge1xuICBQZXJtaXNzaW9uRXhwbGFpbmVyQ29udGVudCxcbiAgdXNlUGVybWlzc2lvbkV4cGxhaW5lclVJLFxufSBmcm9tICcuLi9QZXJtaXNzaW9uRXhwbGFuYXRpb24uanMnXG5pbXBvcnQgdHlwZSB7IFBlcm1pc3Npb25SZXF1ZXN0UHJvcHMgfSBmcm9tICcuLi9QZXJtaXNzaW9uUmVxdWVzdC5qcydcbmltcG9ydCB7IFBlcm1pc3Npb25SdWxlRXhwbGFuYXRpb24gfSBmcm9tICcuLi9QZXJtaXNzaW9uUnVsZUV4cGxhbmF0aW9uLmpzJ1xuaW1wb3J0IHsgU2VkRWRpdFBlcm1pc3Npb25SZXF1ZXN0IH0gZnJvbSAnLi4vU2VkRWRpdFBlcm1pc3Npb25SZXF1ZXN0L1NlZEVkaXRQZXJtaXNzaW9uUmVxdWVzdC5qcydcbmltcG9ydCB7IHVzZVNoZWxsUGVybWlzc2lvbkZlZWRiYWNrIH0gZnJvbSAnLi4vdXNlU2hlbGxQZXJtaXNzaW9uRmVlZGJhY2suanMnXG5pbXBvcnQgeyBsb2dVbmFyeVBlcm1pc3Npb25FdmVudCB9IGZyb20gJy4uL3V0aWxzLmpzJ1xuaW1wb3J0IHsgYmFzaFRvb2xVc2VPcHRpb25zIH0gZnJvbSAnLi9iYXNoVG9vbFVzZU9wdGlvbnMuanMnXG5cbmNvbnN0IENIRUNLSU5HX1RFWFQgPSAnQXR0ZW1wdGluZyB0byBhdXRvLWFwcHJvdmVcXHUyMDI2J1xuXG4vLyBJc29sYXRlcyB0aGUgMjBmcHMgc2hpbW1lciBjbG9jayBmcm9tIEJhc2hQZXJtaXNzaW9uUmVxdWVzdElubmVyLiBCZWZvcmUgdGhpc1xuLy8gZXh0cmFjdGlvbiwgdXNlU2hpbW1lckFuaW1hdGlvbiBsaXZlZCBpbnNpZGUgdGhlIDUzNS1saW5lIElubmVyIGJvZHksIHNvIGV2ZXJ5XG4vLyA1MG1zIGNsb2NrIHRpY2sgcmUtcmVuZGVyZWQgdGhlIGVudGlyZSBkaWFsb2cgKFBlcm1pc3Npb25EaWFsb2cgKyBTZWxlY3QgK1xuLy8gYWxsIGNoaWxkcmVuKSBmb3IgdGhlIH4xLTMgc2Vjb25kcyB0aGUgY2xhc3NpZmllciB0eXBpY2FsbHkgdGFrZXMuIElubmVyIGFsc29cbi8vIGhhcyBhIENvbXBpbGVyIGJhaWxvdXQgKHNlZSBiZWxvdyksIHNvIG5vdGhpbmcgd2FzIGF1dG8tbWVtb2l6ZWQg4oCUIHRoZSBmdWxsXG4vLyBKU1ggdHJlZSB3YXMgcmVjb25zdHJ1Y3RlZCAyMC02MCB0aW1lcyBwZXIgY2xhc3NpZmllciBjaGVjay5cbmZ1bmN0aW9uIENsYXNzaWZpZXJDaGVja2luZ1N1YnRpdGxlKCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtyZWYsIGdsaW1tZXJJbmRleF0gPSB1c2VTaGltbWVyQW5pbWF0aW9uKFxuICAgICdyZXF1ZXN0aW5nJyxcbiAgICBDSEVDS0lOR19URVhULFxuICAgIGZhbHNlLFxuICApXG4gIHJldHVybiAoXG4gICAgPEJveCByZWY9e3JlZn0+XG4gICAgICA8VGV4dD5cbiAgICAgICAge1suLi5DSEVDS0lOR19URVhUXS5tYXAoKGNoYXIsIGkpID0+IChcbiAgICAgICAgICA8U2hpbW1lckNoYXJcbiAgICAgICAgICAgIGtleT17aX1cbiAgICAgICAgICAgIGNoYXI9e2NoYXJ9XG4gICAgICAgICAgICBpbmRleD17aX1cbiAgICAgICAgICAgIGdsaW1tZXJJbmRleD17Z2xpbW1lckluZGV4fVxuICAgICAgICAgICAgbWVzc2FnZUNvbG9yPVwiaW5hY3RpdmVcIlxuICAgICAgICAgICAgc2hpbW1lckNvbG9yPVwic3VidGxlXCJcbiAgICAgICAgICAvPlxuICAgICAgICApKX1cbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQmFzaFBlcm1pc3Npb25SZXF1ZXN0KFxuICBwcm9wczogUGVybWlzc2lvblJlcXVlc3RQcm9wcyxcbik6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHtcbiAgICB0b29sVXNlQ29uZmlybSxcbiAgICB0b29sVXNlQ29udGV4dCxcbiAgICBvbkRvbmUsXG4gICAgb25SZWplY3QsXG4gICAgdmVyYm9zZSxcbiAgICB3b3JrZXJCYWRnZSxcbiAgfSA9IHByb3BzXG5cbiAgY29uc3QgeyBjb21tYW5kLCBkZXNjcmlwdGlvbiB9ID0gQmFzaFRvb2wuaW5wdXRTY2hlbWEucGFyc2UoXG4gICAgdG9vbFVzZUNvbmZpcm0uaW5wdXQsXG4gIClcblxuICAvLyBEZXRlY3Qgc2VkIGluLXBsYWNlIGVkaXQgY29tbWFuZHMgYW5kIGRlbGVnYXRlIHRvIFNlZEVkaXRQZXJtaXNzaW9uUmVxdWVzdFxuICAvLyBUaGlzIHJlbmRlcnMgc2VkIGVkaXRzIGxpa2UgZmlsZSBlZGl0cyB3aXRoIGEgZGlmZiB2aWV3XG4gIGNvbnN0IHNlZEluZm8gPSBwYXJzZVNlZEVkaXRDb21tYW5kKGNvbW1hbmQpXG5cbiAgaWYgKHNlZEluZm8pIHtcbiAgICByZXR1cm4gKFxuICAgICAgPFNlZEVkaXRQZXJtaXNzaW9uUmVxdWVzdFxuICAgICAgICB0b29sVXNlQ29uZmlybT17dG9vbFVzZUNvbmZpcm19XG4gICAgICAgIHRvb2xVc2VDb250ZXh0PXt0b29sVXNlQ29udGV4dH1cbiAgICAgICAgb25Eb25lPXtvbkRvbmV9XG4gICAgICAgIG9uUmVqZWN0PXtvblJlamVjdH1cbiAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgd29ya2VyQmFkZ2U9e3dvcmtlckJhZGdlfVxuICAgICAgICBzZWRJbmZvPXtzZWRJbmZvfVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBSZWd1bGFyIGJhc2ggY29tbWFuZCAtIHJlbmRlciB3aXRoIGhvb2tzXG4gIHJldHVybiAoXG4gICAgPEJhc2hQZXJtaXNzaW9uUmVxdWVzdElubmVyXG4gICAgICB0b29sVXNlQ29uZmlybT17dG9vbFVzZUNvbmZpcm19XG4gICAgICB0b29sVXNlQ29udGV4dD17dG9vbFVzZUNvbnRleHR9XG4gICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgIG9uUmVqZWN0PXtvblJlamVjdH1cbiAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICB3b3JrZXJCYWRnZT17d29ya2VyQmFkZ2V9XG4gICAgICBjb21tYW5kPXtjb21tYW5kfVxuICAgICAgZGVzY3JpcHRpb249e2Rlc2NyaXB0aW9ufVxuICAgIC8+XG4gIClcbn1cblxuLy8gSW5uZXIgY29tcG9uZW50IHRoYXQgdXNlcyBob29rcyAtIG9ubHkgY2FsbGVkIGZvciBub24tTUNQIENMSSBjb21tYW5kc1xuZnVuY3Rpb24gQmFzaFBlcm1pc3Npb25SZXF1ZXN0SW5uZXIoe1xuICB0b29sVXNlQ29uZmlybSxcbiAgdG9vbFVzZUNvbnRleHQsXG4gIG9uRG9uZSxcbiAgb25SZWplY3QsXG4gIHZlcmJvc2U6IF92ZXJib3NlLFxuICB3b3JrZXJCYWRnZSxcbiAgY29tbWFuZCxcbiAgZGVzY3JpcHRpb24sXG59OiBQZXJtaXNzaW9uUmVxdWVzdFByb3BzICYge1xuICBjb21tYW5kOiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbdGhlbWVdID0gdXNlVGhlbWUoKVxuICBjb25zdCB0b29sUGVybWlzc2lvbkNvbnRleHQgPSB1c2VBcHBTdGF0ZShzID0+IHMudG9vbFBlcm1pc3Npb25Db250ZXh0KVxuICBjb25zdCBleHBsYWluZXJTdGF0ZSA9IHVzZVBlcm1pc3Npb25FeHBsYWluZXJVSSh7XG4gICAgdG9vbE5hbWU6IHRvb2xVc2VDb25maXJtLnRvb2wubmFtZSxcbiAgICB0b29sSW5wdXQ6IHRvb2xVc2VDb25maXJtLmlucHV0LFxuICAgIHRvb2xEZXNjcmlwdGlvbjogdG9vbFVzZUNvbmZpcm0uZGVzY3JpcHRpb24sXG4gICAgbWVzc2FnZXM6IHRvb2xVc2VDb250ZXh0Lm1lc3NhZ2VzLFxuICB9KVxuICBjb25zdCB7XG4gICAgeWVzSW5wdXRNb2RlLFxuICAgIG5vSW5wdXRNb2RlLFxuICAgIHllc0ZlZWRiYWNrTW9kZUVudGVyZWQsXG4gICAgbm9GZWVkYmFja01vZGVFbnRlcmVkLFxuICAgIGFjY2VwdEZlZWRiYWNrLFxuICAgIHJlamVjdEZlZWRiYWNrLFxuICAgIHNldEFjY2VwdEZlZWRiYWNrLFxuICAgIHNldFJlamVjdEZlZWRiYWNrLFxuICAgIGZvY3VzZWRPcHRpb24sXG4gICAgaGFuZGxlSW5wdXRNb2RlVG9nZ2xlLFxuICAgIGhhbmRsZVJlamVjdCxcbiAgICBoYW5kbGVGb2N1cyxcbiAgfSA9IHVzZVNoZWxsUGVybWlzc2lvbkZlZWRiYWNrKHtcbiAgICB0b29sVXNlQ29uZmlybSxcbiAgICBvbkRvbmUsXG4gICAgb25SZWplY3QsXG4gICAgZXhwbGFpbmVyVmlzaWJsZTogZXhwbGFpbmVyU3RhdGUudmlzaWJsZSxcbiAgfSlcbiAgY29uc3QgW3Nob3dQZXJtaXNzaW9uRGVidWcsIHNldFNob3dQZXJtaXNzaW9uRGVidWddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtjbGFzc2lmaWVyRGVzY3JpcHRpb24sIHNldENsYXNzaWZpZXJEZXNjcmlwdGlvbl0gPSB1c2VTdGF0ZShcbiAgICBkZXNjcmlwdGlvbiB8fCAnJyxcbiAgKVxuICAvLyBUcmFjayB3aGV0aGVyIHRoZSBpbml0aWFsIGRlc2NyaXB0aW9uIChmcm9tIHByb3Agb3IgYXN5bmMgZ2VuZXJhdGlvbikgd2FzIGVtcHR5LlxuICAvLyBPbmNlIHdlIHJlY2VpdmUgYSBub24tZW1wdHkgZGVzY3JpcHRpb24sIHRoaXMgc3RheXMgZmFsc2UuXG4gIGNvbnN0IFtcbiAgICBpbml0aWFsQ2xhc3NpZmllckRlc2NyaXB0aW9uRW1wdHksXG4gICAgc2V0SW5pdGlhbENsYXNzaWZpZXJEZXNjcmlwdGlvbkVtcHR5LFxuICBdID0gdXNlU3RhdGUoIWRlc2NyaXB0aW9uPy50cmltKCkpXG5cbiAgLy8gQXN5bmNocm9ub3VzbHkgZ2VuZXJhdGUgYSBnZW5lcmljIGRlc2NyaXB0aW9uIGZvciB0aGUgY2xhc3NpZmllclxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghaXNDbGFzc2lmaWVyUGVybWlzc2lvbnNFbmFibGVkKCkpIHJldHVyblxuXG4gICAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG4gICAgZ2VuZXJhdGVHZW5lcmljRGVzY3JpcHRpb24oY29tbWFuZCwgZGVzY3JpcHRpb24sIGFib3J0Q29udHJvbGxlci5zaWduYWwpXG4gICAgICAudGhlbihnZW5lcmljID0+IHtcbiAgICAgICAgaWYgKGdlbmVyaWMgJiYgIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgICAgIHNldENsYXNzaWZpZXJEZXNjcmlwdGlvbihnZW5lcmljKVxuICAgICAgICAgIHNldEluaXRpYWxDbGFzc2lmaWVyRGVzY3JpcHRpb25FbXB0eShmYWxzZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7fSkgLy8gS2VlcCBvcmlnaW5hbCBvbiBlcnJvclxuICAgIHJldHVybiAoKSA9PiBhYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuICB9LCBbY29tbWFuZCwgZGVzY3JpcHRpb25dKVxuXG4gIC8vIEdIIzExMzgwOiBGb3IgY29tcG91bmQgY29tbWFuZHMgKGNkIHNyYyAmJiBnaXQgc3RhdHVzICYmIG5wbSB0ZXN0KSwgdGhlXG4gIC8vIGJhY2tlbmQgYWxyZWFkeSBjb21wdXRlZCBjb3JyZWN0IHBlci1zdWJjb21tYW5kIHN1Z2dlc3Rpb25zIHZpYSB0cmVlLXNpdHRlclxuICAvLyBzcGxpdCArIHBlci1zdWJjb21tYW5kIHBlcm1pc3Npb24gY2hlY2tzLiBkZWNpc2lvblJlYXNvbi50eXBlID09PVxuICAvLyAnc3ViY29tbWFuZFJlc3VsdHMnIG1hcmtzIHRoaXMgcGF0aC4gVGhlIHN5bmMgcHJlZml4IGhldXJpc3RpY3MgYmVsb3dcbiAgLy8gKGdldFNpbXBsZUNvbW1hbmRQcmVmaXgvZ2V0Rmlyc3RXb3JkUHJlZml4KSBvcGVyYXRlIG9uIHRoZSBGVUxMIGNvbXBvdW5kXG4gIC8vIHN0cmluZyBhbmQgcGljayB0aGUgZmlyc3QgdHdvIHdvcmRzIOKAlCBwcm9kdWNpbmcgZGVhZCBydWxlcyBsaWtlXG4gIC8vIGBCYXNoKGNkIHNyYzoqKWAgb3IgYEJhc2goLi9zY3JpcHQuc2ggJiYgbnBtIHRlc3QpYCB0aGF0IG5ldmVyIG1hdGNoIGFnYWluLlxuICAvLyBVc2VycyBhY2N1bXVsYXRlIDE1MCsgb2YgdGhlc2UgaW4gc2V0dGluZ3MubG9jYWwuanNvbi5cbiAgLy9cbiAgLy8gV2hlbiBjb21wb3VuZCB3aXRoIGV4YWN0bHkgb25lIEJhc2ggcnVsZSAoZS5nLiBgY2Qgc3JjICYmIG5wbSB0ZXN0YCB3aGVyZVxuICAvLyBjZCBpcyByZWFkLW9ubHkg4oaSIG9ubHkgbnBtIHRlc3QgbmVlZHMgYXBwcm92YWwpLCBzZWVkIHRoZSBlZGl0YWJsZSBpbnB1dFxuICAvLyBmcm9tIHRoZSBiYWNrZW5kIHJ1bGUuIFdoZW4gY29tcG91bmQgd2l0aCAyKyBydWxlcywgZWRpdGFibGVQcmVmaXggc3RheXNcbiAgLy8gdW5kZWZpbmVkIHNvIGJhc2hUb29sVXNlT3B0aW9ucyBmYWxscyB0aHJvdWdoIHRvIHllcy1hcHBseS1zdWdnZXN0aW9ucyxcbiAgLy8gd2hpY2ggc2F2ZXMgYWxsIHBlci1zdWJjb21tYW5kIHJ1bGVzIGF0b21pY2FsbHkuXG4gIGNvbnN0IGlzQ29tcG91bmQgPVxuICAgIHRvb2xVc2VDb25maXJtLnBlcm1pc3Npb25SZXN1bHQuZGVjaXNpb25SZWFzb24/LnR5cGUgPT09ICdzdWJjb21tYW5kUmVzdWx0cydcblxuICAvLyBFZGl0YWJsZSBwcmVmaXgg4oCUIGluaXRpYWxpemUgc3luY2hyb25vdXNseSB3aXRoIHRoZSBiZXN0IHByZWZpeCB3ZSBjYW5cbiAgLy8gZXh0cmFjdCB3aXRob3V0IHRyZWUtc2l0dGVyLCB0aGVuIHJlZmluZSB2aWEgdHJlZS1zaXR0ZXIgZm9yIGNvbXBvdW5kXG4gIC8vIGNvbW1hbmRzLiBUaGUgc3luYyBwYXRoIG1hdHRlcnMgYmVjYXVzZSBUUkVFX1NJVFRFUl9CQVNIIGlzIGdhdGVkXG4gIC8vIGFudC1vbmx5OiBpbiBleHRlcm5hbCBidWlsZHMgdGhlIGFzeW5jIHJlZmluZW1lbnQgYmVsb3cgYWx3YXlzIHJlc29sdmVzXG4gIC8vIHRvIFtdIGFuZCB0aGlzIGluaXRpYWwgdmFsdWUgaXMgd2hhdCB0aGUgdXNlciBzZWVzLlxuICAvL1xuICAvLyBMYXp5IGluaXRpYWxpemVyOiB0aGlzIHJ1bnMgcmVnZXggKyBzcGxpdCBvbiBldmVyeSByZW5kZXIgaWYgbGVmdCBpblxuICAvLyB0aGUgcmVuZGVyIGJvZHk7IGl0J3Mgb25seSBuZWVkZWQgZm9yIGluaXRpYWwgc3RhdGUuXG4gIGNvbnN0IFtlZGl0YWJsZVByZWZpeCwgc2V0RWRpdGFibGVQcmVmaXhdID0gdXNlU3RhdGU8c3RyaW5nIHwgdW5kZWZpbmVkPihcbiAgICAoKSA9PiB7XG4gICAgICBpZiAoaXNDb21wb3VuZCkge1xuICAgICAgICAvLyBCYWNrZW5kIHN1Z2dlc3Rpb24gaXMgdGhlIHNvdXJjZSBvZiB0cnV0aCBmb3IgY29tcG91bmQgY29tbWFuZHMuXG4gICAgICAgIC8vIFNpbmdsZSBydWxlIOKGkiBzZWVkIHRoZSBlZGl0YWJsZSBpbnB1dCBzbyB0aGUgdXNlciBjYW4gcmVmaW5lIGl0LlxuICAgICAgICAvLyBNdWx0aXBsZS96ZXJvIHJ1bGVzIOKGkiB1bmRlZmluZWQg4oaSIHllcy1hcHBseS1zdWdnZXN0aW9ucyBoYW5kbGVzIGl0LlxuICAgICAgICBjb25zdCBiYWNrZW5kQmFzaFJ1bGVzID0gZXh0cmFjdFJ1bGVzKFxuICAgICAgICAgICdzdWdnZXN0aW9ucycgaW4gdG9vbFVzZUNvbmZpcm0ucGVybWlzc2lvblJlc3VsdFxuICAgICAgICAgICAgPyB0b29sVXNlQ29uZmlybS5wZXJtaXNzaW9uUmVzdWx0LnN1Z2dlc3Rpb25zXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgKS5maWx0ZXIociA9PiByLnRvb2xOYW1lID09PSBCYXNoVG9vbC5uYW1lICYmIHIucnVsZUNvbnRlbnQpXG4gICAgICAgIHJldHVybiBiYWNrZW5kQmFzaFJ1bGVzLmxlbmd0aCA9PT0gMVxuICAgICAgICAgID8gYmFja2VuZEJhc2hSdWxlc1swXSEucnVsZUNvbnRlbnRcbiAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgfVxuICAgICAgY29uc3QgdHdvID0gZ2V0U2ltcGxlQ29tbWFuZFByZWZpeChjb21tYW5kKVxuICAgICAgaWYgKHR3bykgcmV0dXJuIGAke3R3b306KmBcbiAgICAgIGNvbnN0IG9uZSA9IGdldEZpcnN0V29yZFByZWZpeChjb21tYW5kKVxuICAgICAgaWYgKG9uZSkgcmV0dXJuIGAke29uZX06KmBcbiAgICAgIHJldHVybiBjb21tYW5kXG4gICAgfSxcbiAgKVxuICBjb25zdCBoYXNVc2VyRWRpdGVkUHJlZml4ID0gdXNlUmVmKGZhbHNlKVxuICBjb25zdCBvbkVkaXRhYmxlUHJlZml4Q2hhbmdlID0gdXNlQ2FsbGJhY2soKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICBoYXNVc2VyRWRpdGVkUHJlZml4LmN1cnJlbnQgPSB0cnVlXG4gICAgc2V0RWRpdGFibGVQcmVmaXgodmFsdWUpXG4gIH0sIFtdKVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIFNraXAgYXN5bmMgcmVmaW5lbWVudCBmb3IgY29tcG91bmQgY29tbWFuZHMg4oCUIHRoZSBiYWNrZW5kIGFscmVhZHkgcmFuXG4gICAgLy8gdGhlIGZ1bGwgcGVyLXN1YmNvbW1hbmQgYW5hbHlzaXMgYW5kIGl0cyBzdWdnZXN0aW9uIGlzIGNvcnJlY3QuXG4gICAgaWYgKGlzQ29tcG91bmQpIHJldHVyblxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxuICAgIGdldENvbXBvdW5kQ29tbWFuZFByZWZpeGVzU3RhdGljKGNvbW1hbmQsIHN1YmNtZCA9PlxuICAgICAgQmFzaFRvb2wuaXNSZWFkT25seSh7IGNvbW1hbmQ6IHN1YmNtZCB9KSxcbiAgICApXG4gICAgICAudGhlbihwcmVmaXhlcyA9PiB7XG4gICAgICAgIGlmIChjYW5jZWxsZWQgfHwgaGFzVXNlckVkaXRlZFByZWZpeC5jdXJyZW50KSByZXR1cm5cbiAgICAgICAgaWYgKHByZWZpeGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBzZXRFZGl0YWJsZVByZWZpeChgJHtwcmVmaXhlc1swXX06KmApXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKCkgPT4ge30pIC8vIEtlZXAgc3luYyBwcmVmaXggb24gdHJlZS1zaXR0ZXIgZmFpbHVyZVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlXG4gICAgfVxuICB9LCBbY29tbWFuZCwgaXNDb21wb3VuZF0pXG5cbiAgLy8gVHJhY2sgd2hldGhlciBjbGFzc2lmaWVyIGNoZWNrIHdhcyBldmVyIGluIHByb2dyZXNzIChwZXJzaXN0cyBhZnRlciBjb21wbGV0aW9uKS5cbiAgLy8gY2xhc3NpZmllckNoZWNrSW5Qcm9ncmVzcyBpcyBzZXQgb25jZSBhdCBxdWV1ZS1wdXNoIHRpbWUgKGludGVyYWN0aXZlSGFuZGxlcilcbiAgLy8gYW5kIG9ubHkgZXZlciB0cmFuc2l0aW9ucyB0cnVl4oaSZmFsc2UsIHNvIGNhcHR1cmluZyB0aGUgbW91bnQtdGltZSB2YWx1ZSBpc1xuICAvLyBzdWZmaWNpZW50IOKAlCBubyBsYXRjaC9yZWYgbmVlZGVkLiBUaGUgZmVhdHVyZSgpIHRlcm5hcnkga2VlcHMgdGhlIHByb3BlcnR5XG4gIC8vIHJlYWQgb3V0IG9mIGV4dGVybmFsIGJ1aWxkcyAoZm9yYmlkZGVuLXN0cmluZyBjaGVjaykuXG4gIGNvbnN0IFtjbGFzc2lmaWVyV2FzQ2hlY2tpbmddID0gdXNlU3RhdGUoXG4gICAgZmVhdHVyZSgnQkFTSF9DTEFTU0lGSUVSJylcbiAgICAgID8gISF0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyQ2hlY2tJblByb2dyZXNzXG4gICAgICA6IGZhbHNlLFxuICApXG5cbiAgLy8gVGhlc2UgZGVyaXZlIHNvbGVseSBmcm9tIHRoZSB0b29sIGlucHV0IChmaXhlZCBmb3IgdGhlIGRpYWxvZyBsaWZldGltZSkuXG4gIC8vIFRoZSBzaGltbWVyIGNsb2NrIHVzZWQgdG8gbGl2ZSBpbiB0aGlzIGNvbXBvbmVudCBhbmQgcmUtcmVuZGVyIGl0IGF0IDIwZnBzXG4gIC8vIHdoaWxlIHRoZSBjbGFzc2lmaWVyIHJhbiAoc2VlIENsYXNzaWZpZXJDaGVja2luZ1N1YnRpdGxlIGFib3ZlIGZvciB0aGVcbiAgLy8gZXh0cmFjdGlvbikuIFJlYWN0IENvbXBpbGVyIGNhbid0IGF1dG8tbWVtb2l6ZSBpbXBvcnRlZCBmdW5jdGlvbnMgKGNhbid0XG4gIC8vIHByb3ZlIHNpZGUtZWZmZWN0IGZyZWVkb20pLCBzbyB0aGlzIHVzZU1lbW8gc3RpbGwgZ3VhcmRzIGFnYWluc3QgYW55XG4gIC8vIHJlLXJlbmRlciBzb3VyY2UgKGUuZy4gSW5uZXIgc3RhdGUgdXBkYXRlcykuIFNhbWUgcGF0dGVybiBhcyBQUiMyMDczMC5cbiAgY29uc3QgeyBkZXN0cnVjdGl2ZVdhcm5pbmcsIHNhbmRib3hpbmdFbmFibGVkLCBpc1NhbmRib3hlZCB9ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgZGVzdHJ1Y3RpdmVXYXJuaW5nID0gZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUoXG4gICAgICAndGVuZ3VfZGVzdHJ1Y3RpdmVfY29tbWFuZF93YXJuaW5nJyxcbiAgICAgIGZhbHNlLFxuICAgIClcbiAgICAgID8gZ2V0RGVzdHJ1Y3RpdmVDb21tYW5kV2FybmluZyhjb21tYW5kKVxuICAgICAgOiBudWxsXG5cbiAgICBjb25zdCBzYW5kYm94aW5nRW5hYmxlZCA9IFNhbmRib3hNYW5hZ2VyLmlzU2FuZGJveGluZ0VuYWJsZWQoKVxuICAgIGNvbnN0IGlzU2FuZGJveGVkID1cbiAgICAgIHNhbmRib3hpbmdFbmFibGVkICYmIHNob3VsZFVzZVNhbmRib3godG9vbFVzZUNvbmZpcm0uaW5wdXQpXG5cbiAgICByZXR1cm4geyBkZXN0cnVjdGl2ZVdhcm5pbmcsIHNhbmRib3hpbmdFbmFibGVkLCBpc1NhbmRib3hlZCB9XG4gIH0sIFtjb21tYW5kLCB0b29sVXNlQ29uZmlybS5pbnB1dF0pXG5cbiAgY29uc3QgdW5hcnlFdmVudCA9IHVzZU1lbW88VW5hcnlFdmVudD4oXG4gICAgKCkgPT4gKHsgY29tcGxldGlvbl90eXBlOiAndG9vbF91c2Vfc2luZ2xlJywgbGFuZ3VhZ2VfbmFtZTogJ25vbmUnIH0pLFxuICAgIFtdLFxuICApXG5cbiAgdXNlUGVybWlzc2lvblJlcXVlc3RMb2dnaW5nKHRvb2xVc2VDb25maXJtLCB1bmFyeUV2ZW50KVxuXG4gIGNvbnN0IGV4aXN0aW5nQWxsb3dEZXNjcmlwdGlvbnMgPSB1c2VNZW1vKFxuICAgICgpID0+IGdldEJhc2hQcm9tcHRBbGxvd0Rlc2NyaXB0aW9ucyh0b29sUGVybWlzc2lvbkNvbnRleHQpLFxuICAgIFt0b29sUGVybWlzc2lvbkNvbnRleHRdLFxuICApXG5cbiAgY29uc3Qgb3B0aW9ucyA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIGJhc2hUb29sVXNlT3B0aW9ucyh7XG4gICAgICAgIHN1Z2dlc3Rpb25zOlxuICAgICAgICAgIHRvb2xVc2VDb25maXJtLnBlcm1pc3Npb25SZXN1bHQuYmVoYXZpb3IgPT09ICdhc2snXG4gICAgICAgICAgICA/IHRvb2xVc2VDb25maXJtLnBlcm1pc3Npb25SZXN1bHQuc3VnZ2VzdGlvbnNcbiAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICBkZWNpc2lvblJlYXNvbjogdG9vbFVzZUNvbmZpcm0ucGVybWlzc2lvblJlc3VsdC5kZWNpc2lvblJlYXNvbixcbiAgICAgICAgb25SZWplY3RGZWVkYmFja0NoYW5nZTogc2V0UmVqZWN0RmVlZGJhY2ssXG4gICAgICAgIG9uQWNjZXB0RmVlZGJhY2tDaGFuZ2U6IHNldEFjY2VwdEZlZWRiYWNrLFxuICAgICAgICBvbkNsYXNzaWZpZXJEZXNjcmlwdGlvbkNoYW5nZTogc2V0Q2xhc3NpZmllckRlc2NyaXB0aW9uLFxuICAgICAgICBjbGFzc2lmaWVyRGVzY3JpcHRpb24sXG4gICAgICAgIGluaXRpYWxDbGFzc2lmaWVyRGVzY3JpcHRpb25FbXB0eSxcbiAgICAgICAgZXhpc3RpbmdBbGxvd0Rlc2NyaXB0aW9ucyxcbiAgICAgICAgeWVzSW5wdXRNb2RlLFxuICAgICAgICBub0lucHV0TW9kZSxcbiAgICAgICAgZWRpdGFibGVQcmVmaXgsXG4gICAgICAgIG9uRWRpdGFibGVQcmVmaXhDaGFuZ2UsXG4gICAgICB9KSxcbiAgICBbXG4gICAgICB0b29sVXNlQ29uZmlybSxcbiAgICAgIGNsYXNzaWZpZXJEZXNjcmlwdGlvbixcbiAgICAgIGluaXRpYWxDbGFzc2lmaWVyRGVzY3JpcHRpb25FbXB0eSxcbiAgICAgIGV4aXN0aW5nQWxsb3dEZXNjcmlwdGlvbnMsXG4gICAgICB5ZXNJbnB1dE1vZGUsXG4gICAgICBub0lucHV0TW9kZSxcbiAgICAgIGVkaXRhYmxlUHJlZml4LFxuICAgICAgb25FZGl0YWJsZVByZWZpeENoYW5nZSxcbiAgICBdLFxuICApXG5cbiAgLy8gVG9nZ2xlIHBlcm1pc3Npb24gZGVidWcgaW5mbyB3aXRoIGtleWJpbmRpbmdcbiAgY29uc3QgaGFuZGxlVG9nZ2xlRGVidWcgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0U2hvd1Blcm1pc3Npb25EZWJ1ZyhwcmV2ID0+ICFwcmV2KVxuICB9LCBbXSlcbiAgdXNlS2V5YmluZGluZygncGVybWlzc2lvbjp0b2dnbGVEZWJ1ZycsIGhhbmRsZVRvZ2dsZURlYnVnLCB7XG4gICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gIH0pXG5cbiAgLy8gQWxsb3cgRXNjIHRvIGRpc21pc3MgdGhlIGNoZWNrbWFyayBhZnRlciBhdXRvLWFwcHJvdmFsXG4gIGNvbnN0IGhhbmRsZURpc21pc3NDaGVja21hcmsgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgdG9vbFVzZUNvbmZpcm0ub25EaXNtaXNzQ2hlY2ttYXJrPy4oKVxuICB9LCBbdG9vbFVzZUNvbmZpcm1dKVxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlRGlzbWlzc0NoZWNrbWFyaywge1xuICAgIGNvbnRleHQ6ICdDb25maXJtYXRpb24nLFxuICAgIGlzQWN0aXZlOiBmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKVxuICAgICAgPyAhIXRvb2xVc2VDb25maXJtLmNsYXNzaWZpZXJBdXRvQXBwcm92ZWRcbiAgICAgIDogZmFsc2UsXG4gIH0pXG5cbiAgZnVuY3Rpb24gb25TZWxlY3QodmFsdWU6IHN0cmluZykge1xuICAgIC8vIE1hcCBvcHRpb25zIHRvIG51bWVyaWMgdmFsdWVzIGZvciBhbmFseXRpY3MgKHN0cmluZ3Mgbm90IGFsbG93ZWQgaW4gbG9nRXZlbnQpXG4gICAgbGV0IG9wdGlvbkluZGV4OiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAgICAgeWVzOiAxLFxuICAgICAgJ3llcy1hcHBseS1zdWdnZXN0aW9ucyc6IDIsXG4gICAgICAneWVzLXByZWZpeC1lZGl0ZWQnOiAyLFxuICAgICAgbm86IDMsXG4gICAgfVxuICAgIGlmIChmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKSkge1xuICAgICAgb3B0aW9uSW5kZXggPSB7XG4gICAgICAgIHllczogMSxcbiAgICAgICAgJ3llcy1hcHBseS1zdWdnZXN0aW9ucyc6IDIsXG4gICAgICAgICd5ZXMtcHJlZml4LWVkaXRlZCc6IDIsXG4gICAgICAgICd5ZXMtY2xhc3NpZmllci1yZXZpZXdlZCc6IDMsXG4gICAgICAgIG5vOiA0LFxuICAgICAgfVxuICAgIH1cbiAgICBsb2dFdmVudCgndGVuZ3VfcGVybWlzc2lvbl9yZXF1ZXN0X29wdGlvbl9zZWxlY3RlZCcsIHtcbiAgICAgIG9wdGlvbl9pbmRleDogb3B0aW9uSW5kZXhbdmFsdWVdLFxuICAgICAgZXhwbGFpbmVyX3Zpc2libGU6IGV4cGxhaW5lclN0YXRlLnZpc2libGUsXG4gICAgfSlcblxuICAgIGNvbnN0IHRvb2xOYW1lRm9yQW5hbHl0aWNzID0gc2FuaXRpemVUb29sTmFtZUZvckFuYWx5dGljcyhcbiAgICAgIHRvb2xVc2VDb25maXJtLnRvb2wubmFtZSxcbiAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcblxuICAgIGlmICh2YWx1ZSA9PT0gJ3llcy1wcmVmaXgtZWRpdGVkJykge1xuICAgICAgY29uc3QgdHJpbW1lZFByZWZpeCA9IChlZGl0YWJsZVByZWZpeCA/PyAnJykudHJpbSgpXG4gICAgICBsb2dVbmFyeVBlcm1pc3Npb25FdmVudCgndG9vbF91c2Vfc2luZ2xlJywgdG9vbFVzZUNvbmZpcm0sICdhY2NlcHQnKVxuICAgICAgaWYgKCF0cmltbWVkUHJlZml4KSB7XG4gICAgICAgIHRvb2xVc2VDb25maXJtLm9uQWxsb3codG9vbFVzZUNvbmZpcm0uaW5wdXQsIFtdKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcHJlZml4VXBkYXRlczogUGVybWlzc2lvblVwZGF0ZVtdID0gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdhZGRSdWxlcycsXG4gICAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdG9vbE5hbWU6IEJhc2hUb29sLm5hbWUsXG4gICAgICAgICAgICAgICAgcnVsZUNvbnRlbnQ6IHRyaW1tZWRQcmVmaXgsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogJ2xvY2FsU2V0dGluZ3MnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgICAgdG9vbFVzZUNvbmZpcm0ub25BbGxvdyh0b29sVXNlQ29uZmlybS5pbnB1dCwgcHJlZml4VXBkYXRlcylcbiAgICAgIH1cbiAgICAgIG9uRG9uZSgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoZmVhdHVyZSgnQkFTSF9DTEFTU0lGSUVSJykgJiYgdmFsdWUgPT09ICd5ZXMtY2xhc3NpZmllci1yZXZpZXdlZCcpIHtcbiAgICAgIGNvbnN0IHRyaW1tZWREZXNjcmlwdGlvbiA9IGNsYXNzaWZpZXJEZXNjcmlwdGlvbi50cmltKClcbiAgICAgIGxvZ1VuYXJ5UGVybWlzc2lvbkV2ZW50KCd0b29sX3VzZV9zaW5nbGUnLCB0b29sVXNlQ29uZmlybSwgJ2FjY2VwdCcpXG4gICAgICBpZiAoIXRyaW1tZWREZXNjcmlwdGlvbikge1xuICAgICAgICB0b29sVXNlQ29uZmlybS5vbkFsbG93KHRvb2xVc2VDb25maXJtLmlucHV0LCBbXSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBlcm1pc3Npb25VcGRhdGVzOiBQZXJtaXNzaW9uVXBkYXRlW10gPSBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2FkZFJ1bGVzJyxcbiAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0b29sTmFtZTogQmFzaFRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBydWxlQ29udGVudDogY3JlYXRlUHJvbXB0UnVsZUNvbnRlbnQodHJpbW1lZERlc2NyaXB0aW9uKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBiZWhhdmlvcjogJ2FsbG93JyxcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uOiAnc2Vzc2lvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgICB0b29sVXNlQ29uZmlybS5vbkFsbG93KHRvb2xVc2VDb25maXJtLmlucHV0LCBwZXJtaXNzaW9uVXBkYXRlcylcbiAgICAgIH1cbiAgICAgIG9uRG9uZSgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBzd2l0Y2ggKHZhbHVlKSB7XG4gICAgICBjYXNlICd5ZXMnOiB7XG4gICAgICAgIGNvbnN0IHRyaW1tZWRGZWVkYmFjayA9IGFjY2VwdEZlZWRiYWNrLnRyaW0oKVxuICAgICAgICBsb2dVbmFyeVBlcm1pc3Npb25FdmVudCgndG9vbF91c2Vfc2luZ2xlJywgdG9vbFVzZUNvbmZpcm0sICdhY2NlcHQnKVxuICAgICAgICAvLyBMb2cgYWNjZXB0IHN1Ym1pc3Npb24gd2l0aCBmZWVkYmFjayBjb250ZXh0XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9hY2NlcHRfc3VibWl0dGVkJywge1xuICAgICAgICAgIHRvb2xOYW1lOiB0b29sTmFtZUZvckFuYWx5dGljcyxcbiAgICAgICAgICBpc01jcDogdG9vbFVzZUNvbmZpcm0udG9vbC5pc01jcCA/PyBmYWxzZSxcbiAgICAgICAgICBoYXNfaW5zdHJ1Y3Rpb25zOiAhIXRyaW1tZWRGZWVkYmFjayxcbiAgICAgICAgICBpbnN0cnVjdGlvbnNfbGVuZ3RoOiB0cmltbWVkRmVlZGJhY2subGVuZ3RoLFxuICAgICAgICAgIGVudGVyZWRfZmVlZGJhY2tfbW9kZTogeWVzRmVlZGJhY2tNb2RlRW50ZXJlZCxcbiAgICAgICAgfSlcbiAgICAgICAgdG9vbFVzZUNvbmZpcm0ub25BbGxvdyhcbiAgICAgICAgICB0b29sVXNlQ29uZmlybS5pbnB1dCxcbiAgICAgICAgICBbXSxcbiAgICAgICAgICB0cmltbWVkRmVlZGJhY2sgfHwgdW5kZWZpbmVkLFxuICAgICAgICApXG4gICAgICAgIG9uRG9uZSgpXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICd5ZXMtYXBwbHktc3VnZ2VzdGlvbnMnOiB7XG4gICAgICAgIGxvZ1VuYXJ5UGVybWlzc2lvbkV2ZW50KCd0b29sX3VzZV9zaW5nbGUnLCB0b29sVXNlQ29uZmlybSwgJ2FjY2VwdCcpXG4gICAgICAgIC8vIEV4dHJhY3Qgc3VnZ2VzdGlvbnMgaWYgcHJlc2VudCAod29ya3MgZm9yIGJvdGggJ2FzaycgYW5kICdwYXNzdGhyb3VnaCcgYmVoYXZpb3JzKVxuICAgICAgICBjb25zdCBwZXJtaXNzaW9uVXBkYXRlcyA9XG4gICAgICAgICAgJ3N1Z2dlc3Rpb25zJyBpbiB0b29sVXNlQ29uZmlybS5wZXJtaXNzaW9uUmVzdWx0XG4gICAgICAgICAgICA/IHRvb2xVc2VDb25maXJtLnBlcm1pc3Npb25SZXN1bHQuc3VnZ2VzdGlvbnMgfHwgW11cbiAgICAgICAgICAgIDogW11cbiAgICAgICAgdG9vbFVzZUNvbmZpcm0ub25BbGxvdyh0b29sVXNlQ29uZmlybS5pbnB1dCwgcGVybWlzc2lvblVwZGF0ZXMpXG4gICAgICAgIG9uRG9uZSgpXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICdubyc6IHtcbiAgICAgICAgY29uc3QgdHJpbW1lZEZlZWRiYWNrID0gcmVqZWN0RmVlZGJhY2sudHJpbSgpXG5cbiAgICAgICAgLy8gTG9nIHJlamVjdCBzdWJtaXNzaW9uIHdpdGggZmVlZGJhY2sgY29udGV4dFxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfcmVqZWN0X3N1Ym1pdHRlZCcsIHtcbiAgICAgICAgICB0b29sTmFtZTogdG9vbE5hbWVGb3JBbmFseXRpY3MsXG4gICAgICAgICAgaXNNY3A6IHRvb2xVc2VDb25maXJtLnRvb2wuaXNNY3AgPz8gZmFsc2UsXG4gICAgICAgICAgaGFzX2luc3RydWN0aW9uczogISF0cmltbWVkRmVlZGJhY2ssXG4gICAgICAgICAgaW5zdHJ1Y3Rpb25zX2xlbmd0aDogdHJpbW1lZEZlZWRiYWNrLmxlbmd0aCxcbiAgICAgICAgICBlbnRlcmVkX2ZlZWRiYWNrX21vZGU6IG5vRmVlZGJhY2tNb2RlRW50ZXJlZCxcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBQcm9jZXNzIHJlamVjdGlvbiAod2l0aCBvciB3aXRob3V0IGZlZWRiYWNrKVxuICAgICAgICBoYW5kbGVSZWplY3QodHJpbW1lZEZlZWRiYWNrIHx8IHVuZGVmaW5lZClcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBjbGFzc2lmaWVyU3VidGl0bGUgPSBmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKSA/IChcbiAgICB0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyQXV0b0FwcHJvdmVkID8gKFxuICAgICAgPFRleHQ+XG4gICAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiPntmaWd1cmVzLnRpY2t9IEF1dG8tYXBwcm92ZWQ8L1RleHQ+XG4gICAgICAgIHt0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyTWF0Y2hlZFJ1bGUgJiYgKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgeycgXFx1MDBiNyBtYXRjaGVkIFwiJ31cbiAgICAgICAgICAgIHt0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyTWF0Y2hlZFJ1bGV9XG4gICAgICAgICAgICB7J1wiJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICl9XG4gICAgICA8L1RleHQ+XG4gICAgKSA6IHRvb2xVc2VDb25maXJtLmNsYXNzaWZpZXJDaGVja0luUHJvZ3Jlc3MgPyAoXG4gICAgICA8Q2xhc3NpZmllckNoZWNraW5nU3VidGl0bGUgLz5cbiAgICApIDogY2xhc3NpZmllcldhc0NoZWNraW5nID8gKFxuICAgICAgPFRleHQgZGltQ29sb3I+UmVxdWlyZXMgbWFudWFsIGFwcHJvdmFsPC9UZXh0PlxuICAgICkgOiB1bmRlZmluZWRcbiAgKSA6IHVuZGVmaW5lZFxuXG4gIHJldHVybiAoXG4gICAgPFBlcm1pc3Npb25EaWFsb2dcbiAgICAgIHdvcmtlckJhZGdlPXt3b3JrZXJCYWRnZX1cbiAgICAgIHRpdGxlPXtcbiAgICAgICAgc2FuZGJveGluZ0VuYWJsZWQgJiYgIWlzU2FuZGJveGVkXG4gICAgICAgICAgPyAnQmFzaCBjb21tYW5kICh1bnNhbmRib3hlZCknXG4gICAgICAgICAgOiAnQmFzaCBjb21tYW5kJ1xuICAgICAgfVxuICAgICAgc3VidGl0bGU9e2NsYXNzaWZpZXJTdWJ0aXRsZX1cbiAgICA+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBwYWRkaW5nWD17Mn0gcGFkZGluZ1k9ezF9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj17ZXhwbGFpbmVyU3RhdGUudmlzaWJsZX0+XG4gICAgICAgICAge0Jhc2hUb29sLnJlbmRlclRvb2xVc2VNZXNzYWdlKFxuICAgICAgICAgICAgeyBjb21tYW5kLCBkZXNjcmlwdGlvbiB9LFxuICAgICAgICAgICAgeyB0aGVtZSwgdmVyYm9zZTogdHJ1ZSB9LCAvLyBhbHdheXMgc2hvdyB0aGUgZnVsbCBjb21tYW5kXG4gICAgICAgICAgKX1cbiAgICAgICAgPC9UZXh0PlxuICAgICAgICB7IWV4cGxhaW5lclN0YXRlLnZpc2libGUgJiYgKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPnt0b29sVXNlQ29uZmlybS5kZXNjcmlwdGlvbn08L1RleHQ+XG4gICAgICAgICl9XG4gICAgICAgIDxQZXJtaXNzaW9uRXhwbGFpbmVyQ29udGVudFxuICAgICAgICAgIHZpc2libGU9e2V4cGxhaW5lclN0YXRlLnZpc2libGV9XG4gICAgICAgICAgcHJvbWlzZT17ZXhwbGFpbmVyU3RhdGUucHJvbWlzZX1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgICAge3Nob3dQZXJtaXNzaW9uRGVidWcgPyAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFBlcm1pc3Npb25EZWNpc2lvbkRlYnVnSW5mb1xuICAgICAgICAgICAgcGVybWlzc2lvblJlc3VsdD17dG9vbFVzZUNvbmZpcm0ucGVybWlzc2lvblJlc3VsdH1cbiAgICAgICAgICAgIHRvb2xOYW1lPVwiQmFzaFwiXG4gICAgICAgICAgLz5cbiAgICAgICAgICB7dG9vbFVzZUNvbnRleHQub3B0aW9ucy5kZWJ1ZyAmJiAoXG4gICAgICAgICAgICA8Qm94IGp1c3RpZnlDb250ZW50PVwiZmxleC1lbmRcIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5DdHJsLUQgdG8gaGlkZSBkZWJ1ZyBpbmZvPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC8+XG4gICAgICApIDogKFxuICAgICAgICA8PlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPFBlcm1pc3Npb25SdWxlRXhwbGFuYXRpb25cbiAgICAgICAgICAgICAgcGVybWlzc2lvblJlc3VsdD17dG9vbFVzZUNvbmZpcm0ucGVybWlzc2lvblJlc3VsdH1cbiAgICAgICAgICAgICAgdG9vbFR5cGU9XCJjb21tYW5kXCJcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICB7ZGVzdHJ1Y3RpdmVXYXJuaW5nICYmIChcbiAgICAgICAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICBjb2xvcj1cIndhcm5pbmdcIlxuICAgICAgICAgICAgICAgICAgZGltQ29sb3I9e1xuICAgICAgICAgICAgICAgICAgICBmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKVxuICAgICAgICAgICAgICAgICAgICAgID8gdG9vbFVzZUNvbmZpcm0uY2xhc3NpZmllckF1dG9BcHByb3ZlZFxuICAgICAgICAgICAgICAgICAgICAgIDogZmFsc2VcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7ZGVzdHJ1Y3RpdmVXYXJuaW5nfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgZGltQ29sb3I9e1xuICAgICAgICAgICAgICAgIGZlYXR1cmUoJ0JBU0hfQ0xBU1NJRklFUicpXG4gICAgICAgICAgICAgICAgICA/IHRvb2xVc2VDb25maXJtLmNsYXNzaWZpZXJBdXRvQXBwcm92ZWRcbiAgICAgICAgICAgICAgICAgIDogZmFsc2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBEbyB5b3Ugd2FudCB0byBwcm9jZWVkP1xuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBvcHRpb25zPXtcbiAgICAgICAgICAgICAgICBmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKVxuICAgICAgICAgICAgICAgICAgPyB0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyQXV0b0FwcHJvdmVkXG4gICAgICAgICAgICAgICAgICAgID8gb3B0aW9ucy5tYXAobyA9PiAoeyAuLi5vLCBkaXNhYmxlZDogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAgICAgOiBvcHRpb25zXG4gICAgICAgICAgICAgICAgICA6IG9wdGlvbnNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpc0Rpc2FibGVkPXtcbiAgICAgICAgICAgICAgICBmZWF0dXJlKCdCQVNIX0NMQVNTSUZJRVInKVxuICAgICAgICAgICAgICAgICAgPyB0b29sVXNlQ29uZmlybS5jbGFzc2lmaWVyQXV0b0FwcHJvdmVkXG4gICAgICAgICAgICAgICAgICA6IGZhbHNlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5saW5lRGVzY3JpcHRpb25zXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtvblNlbGVjdH1cbiAgICAgICAgICAgICAgb25DYW5jZWw9eygpID0+IGhhbmRsZVJlamVjdCgpfVxuICAgICAgICAgICAgICBvbkZvY3VzPXtoYW5kbGVGb2N1c31cbiAgICAgICAgICAgICAgb25JbnB1dE1vZGVUb2dnbGU9e2hhbmRsZUlucHV0TW9kZVRvZ2dsZX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPEJveCBqdXN0aWZ5Q29udGVudD1cInNwYWNlLWJldHdlZW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIEVzYyB0byBjYW5jZWxcbiAgICAgICAgICAgICAgeygoZm9jdXNlZE9wdGlvbiA9PT0gJ3llcycgJiYgIXllc0lucHV0TW9kZSkgfHxcbiAgICAgICAgICAgICAgICAoZm9jdXNlZE9wdGlvbiA9PT0gJ25vJyAmJiAhbm9JbnB1dE1vZGUpKSAmJlxuICAgICAgICAgICAgICAgICcgwrcgVGFiIHRvIGFtZW5kJ31cbiAgICAgICAgICAgICAge2V4cGxhaW5lclN0YXRlLmVuYWJsZWQgJiZcbiAgICAgICAgICAgICAgICBgIMK3IGN0cmwrZSB0byAke2V4cGxhaW5lclN0YXRlLnZpc2libGUgPyAnaGlkZScgOiAnZXhwbGFpbid9YH1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHt0b29sVXNlQ29udGV4dC5vcHRpb25zLmRlYnVnICYmIChcbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+Q3RybCtkIHRvIHNob3cgZGVidWcgaW5mbzwvVGV4dD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvPlxuICAgICAgKX1cbiAgICA8L1Blcm1pc3Npb25EaWFsb2c+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLE9BQU9DLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU9DLEtBQUssSUFBSUMsV0FBVyxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRUMsTUFBTSxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUNoRixTQUFTQyxHQUFHLEVBQUVDLElBQUksRUFBRUMsUUFBUSxRQUFRLGlCQUFpQjtBQUNyRCxTQUFTQyxhQUFhLFFBQVEsdUNBQXVDO0FBQ3JFLFNBQVNDLG1DQUFtQyxRQUFRLDJDQUEyQztBQUMvRixTQUNFLEtBQUtDLDBEQUEwRCxFQUMvREMsUUFBUSxRQUNILHNDQUFzQztBQUM3QyxTQUFTQyw0QkFBNEIsUUFBUSx5Q0FBeUM7QUFDdEYsU0FBU0MsV0FBVyxRQUFRLDRCQUE0QjtBQUN4RCxTQUFTQyxRQUFRLFFBQVEscUNBQXFDO0FBQzlELFNBQ0VDLGtCQUFrQixFQUNsQkMsc0JBQXNCLFFBQ2pCLDRDQUE0QztBQUNuRCxTQUFTQyw0QkFBNEIsUUFBUSxzREFBc0Q7QUFDbkcsU0FBU0MsbUJBQW1CLFFBQVEsMENBQTBDO0FBQzlFLFNBQVNDLGdCQUFnQixRQUFRLDZDQUE2QztBQUM5RSxTQUFTQyxnQ0FBZ0MsUUFBUSwrQkFBK0I7QUFDaEYsU0FDRUMsdUJBQXVCLEVBQ3ZCQywwQkFBMEIsRUFDMUJDLDhCQUE4QixFQUM5QkMsOEJBQThCLFFBQ3pCLDhDQUE4QztBQUNy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QUMsaUJBQWlCLENBQUMsR0FDdEI4RCxjQUFjLENBQUNrRyxzQkFBc0IsR0FDckMsS0FDTixDQUFDO0FBRWY7QUFDQSxZQUFZLEVBQUUsSUFBSTtBQUNsQixZQUFZLENBQUMsTUFBTSxDQUNMLE9BQU8sQ0FBQyxDQUNOaEssT0FBTyxDQUFDLGlCQUFpQixDQUFDLEdBQ3RCOEQsY0FBYyxDQUFDa0csc0JBQXNCLEdBQ25DWCxPQUFPLENBQUM3RixHQUFHLENBQUNtSSxDQUFDLEtBQUs7VUFBRSxHQUFHQSxDQUFDO1VBQUVDLFFBQVEsRUFBRTtRQUFLLENBQUMsQ0FBQyxDQUFDLEdBQzVDdkMsT0FBTyxHQUNUQSxPQUNOLENBQUMsQ0FDRCxVQUFVLENBQUMsQ0FDVHJKLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxHQUN0QjhELGNBQWMsQ0FBQ2tHLHNCQUFzQixHQUNyQyxLQUNOLENBQUMsQ0FDRCxrQkFBa0IsQ0FDbEIsUUFBUSxDQUFDLENBQUNDLFFBQVEsQ0FBQyxDQUNuQixRQUFRLENBQUMsQ0FBQyxNQUFNaEUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUMvQixPQUFPLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQ3JCLGlCQUFpQixDQUFDLENBQUNGLHFCQUFxQixDQUFDO0FBRXZELFVBQVUsRUFBRSxHQUFHO0FBQ2YsVUFBVSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzRCxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVE7QUFDMUI7QUFDQSxjQUFjLENBQUMsQ0FBRUQsYUFBYSxLQUFLLEtBQUssSUFBSSxDQUFDUixZQUFZLElBQ3hDUSxhQUFhLEtBQUssSUFBSSxJQUFJLENBQUNQLFdBQVksS0FDeEMsaUJBQWlCO0FBQ2pDLGNBQWMsQ0FBQ1IsY0FBYyxDQUFDNkcsT0FBTyxJQUNyQixnQkFBZ0I3RyxjQUFjLENBQUNvQixPQUFPLEdBQUcsTUFBTSxHQUFHLFNBQVMsRUFBRTtBQUM3RSxZQUFZLEVBQUUsSUFBSTtBQUNsQixZQUFZLENBQUNyQyxjQUFjLENBQUNzRixPQUFPLENBQUNxQyxLQUFLLElBQzNCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLENBQy9DO0FBQ2IsVUFBVSxFQUFFLEdBQUc7QUFDZixRQUFRLEdBQ0Q7QUFDUCxJQUFJLEVBQUUsZ0JBQWdCLENBQUM7QUFFdkIiLCJpZ25vcmVMaXN0IjpbXX0=