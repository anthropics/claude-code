/**
 * Component that registers global keybinding handlers.
 *
 * Must be rendered inside KeybindingSetup to have access to the keybinding context.
 * This component renders nothing - it just registers the keybinding handlers.
 */
import { feature } from 'bun:bundle';
import { useCallback } from 'react';
import instances from '../ink/instances.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import type { Screen } from '../screens/REPL.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { count } from '../utils/array.js';
import { getTerminalPanel } from '../utils/terminalPanel.js';
type Props = {
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  showAllInTranscript: boolean;
  setShowAllInTranscript: React.Dispatch<React.SetStateAction<boolean>>;
  messageCount: number;
  onEnterTranscript?: () => void;
  onExitTranscript?: () => void;
  virtualScrollActive?: boolean;
  searchBarOpen?: boolean;
};

/**
 * Registers global keybinding handlers for:
 * - ctrl+t: Toggle todo list
 * - ctrl+o: Toggle transcript mode
 * - ctrl+e: Toggle showing all messages in transcript
 * - ctrl+c/escape: Exit transcript mode
 */
export function GlobalKeybindingHandlers({
  screen,
  setScreen,
  showAllInTranscript,
  setShowAllInTranscript,
  messageCount,
  onEnterTranscript,
  onExitTranscript,
  virtualScrollActive,
  searchBarOpen = false
}: Props): null {
  const expandedView = useAppState(s => s.expandedView);
  const setAppState = useSetAppState();

  // Toggle todo list (ctrl+t) - cycles through views
  const handleToggleTodos = useCallback(() => {
    logEvent('tengu_toggle_todos', {
      is_expanded: expandedView === 'tasks'
    });
    setAppState(prev => {
      const {
        getAllInProcessTeammateTasks
      } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../tasks/InProcessTeammateTask/InProcessTeammateTask.js') as typeof import('../tasks/InProcessTeammateTask/InProcessTeammateTask.js');
      const hasTeammates = count(getAllInProcessTeammateTasks(prev.tasks), t => t.status === 'running') > 0;
      if (hasTeammates) {
        // Both exist: none → tasks → teammates → none
        switch (prev.expandedView) {
          case 'none':
            return {
              ...prev,
              expandedView: 'tasks' as const
            };
          case 'tasks':
            return {
              ...prev,
              expandedView: 'teammates' as const
            };
          case 'teammates':
            return {
              ...prev,
              expandedView: 'none' as const
            };
        }
      }
      // Only tasks: none ↔ tasks
      return {
        ...prev,
        expandedView: prev.expandedView === 'tasks' ? 'none' as const : 'tasks' as const
      };
    });
  }, [expandedView, setAppState]);

  // Toggle transcript mode (ctrl+o). Two-way prompt ↔ transcript.
  // Brief view has its own dedicated toggle on ctrl+shift+b.
  const isBriefOnly = feature('KAIROS') || feature('KAIROS_BRIEF') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s_0 => s_0.isBriefOnly) : false;
  const handleToggleTranscript = useCallback(() => {
    if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
      // Escape hatch: GB kill-switch while defaultView=chat was persisted
      // can leave isBriefOnly stuck on, showing a blank filterForBriefTool
      // view. Users will reach for ctrl+o — clear the stuck state first.
      // Only needed in the prompt screen — transcript mode already ignores
      // isBriefOnly (Messages.tsx filter is gated on !isTranscriptMode).
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {
        isBriefEnabled
      } = require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js');
      /* eslint-enable @typescript-eslint/no-require-imports */
      if (!isBriefEnabled() && isBriefOnly && screen !== 'transcript') {
        setAppState(prev_0 => {
          if (!prev_0.isBriefOnly) return prev_0;
          return {
            ...prev_0,
            isBriefOnly: false
          };
        });
        return;
      }
    }
    const isEnteringTranscript = screen !== 'transcript';
    logEvent('tengu_toggle_transcript', {
      is_entering: isEnteringTranscript,
      show_all: showAllInTranscript,
      message_count: messageCount
    });
    setScreen(s_1 => s_1 === 'transcript' ? 'prompt' : 'transcript');
    setShowAllInTranscript(false);
    if (isEnteringTranscript && onEnterTranscript) {
      onEnterTranscript();
    }
    if (!isEnteringTranscript && onExitTranscript) {
      onExitTranscript();
    }
  }, [screen, setScreen, isBriefOnly, showAllInTranscript, setShowAllInTranscript, messageCount, setAppState, onEnterTranscript, onExitTranscript]);

  // Toggle showing all messages in transcript mode (ctrl+e)
  const handleToggleShowAll = useCallback(() => {
    logEvent('tengu_transcript_toggle_show_all', {
      is_expanding: !showAllInTranscript,
      message_count: messageCount
    });
    setShowAllInTranscript(prev_1 => !prev_1);
  }, [showAllInTranscript, setShowAllInTranscript, messageCount]);

  // Exit transcript mode (ctrl+c or escape)
  const handleExitTranscript = useCallback(() => {
    logEvent('tengu_transcript_exit', {
      show_all: showAllInTranscript,
      message_count: messageCount
    });
    setScreen('prompt');
    setShowAllInTranscript(false);
    if (onExitTranscript) {
      onExitTranscript();
    }
  }, [setScreen, showAllInTranscript, setShowAllInTranscript, messageCount, onExitTranscript]);

  // Toggle brief-only view (ctrl+shift+b). Pure display filter toggle —
  // does not touch opt-in state. Asymmetric gate (mirrors /brief): OFF
  // transition always allowed so the same key that got you in gets you
  // out even if the GB kill-switch fires mid-session.
  const handleToggleBrief = useCallback(() => {
    if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {
        isBriefEnabled: isBriefEnabled_0
      } = require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js');
      /* eslint-enable @typescript-eslint/no-require-imports */
      if (!isBriefEnabled_0() && !isBriefOnly) return;
      const next = !isBriefOnly;
      logEvent('tengu_brief_mode_toggled', {
        enabled: next,
        gated: false,
        source: 'keybinding' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      setAppState(prev_2 => {
        if (prev_2.isBriefOnly === next) return prev_2;
        return {
          ...prev_2,
          isBriefOnly: next
        };
      });
    }
  }, [isBriefOnly, setAppState]);

  // Register keybinding handlers
  useKeybinding('app:toggleTodos', handleToggleTodos, {
    context: 'Global'
  });
  useKeybinding('app:toggleTranscript', handleToggleTranscript, {
    context: 'Global'
  });
  if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useKeybinding('app:toggleBrief', handleToggleBrief, {
      context: 'Global'
    });
  }

  // Register teammate keybinding
  useKeybinding('app:toggleTeammatePreview', () => {
    setAppState(prev_3 => ({
      ...prev_3,
      showTeammateMessagePreview: !prev_3.showTeammateMessagePreview
    }));
  }, {
    context: 'Global'
  });

  // Toggle built-in terminal panel (meta+j).
  // toggle() blocks in spawnSync until the user detaches from tmux.
  const handleToggleTerminal = useCallback(() => {
    if (feature('TERMINAL_PANEL')) {
      if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_terminal_panel', false)) {
        return;
      }
      getTerminalPanel().toggle();
    }
  }, []);
  useKeybinding('app:toggleTerminal', handleToggleTerminal, {
    context: 'Global'
  });

  // Clear screen and force full redraw (ctrl+l). Recovery path when the
  // terminal was cleared externally (macOS Cmd+K) and Ink's diff engine
  // thinks unchanged cells don't need repainting.
  const handleRedraw = useCallback(() => {
    instances.get(process.stdout)?.forceRedraw();
  }, []);
  useKeybinding('app:redraw', handleRedraw, {
    context: 'Global'
  });

  // Transcript-specific bindings (only active when in transcript mode)
  const isInTranscript = screen === 'transcript';
  useKeybinding('transcript:toggleShowAll', handleToggleShowAll, {
    context: 'Transcript',
    isActive: isInTranscript && !virtualScrollActive
  });
  useKeybinding('transcript:exit', handleExitTranscript, {
    context: 'Transcript',
    // Bar-open is a mode (owns keystrokes). Navigating (highlights
    // visible, n/N active, bar closed) is NOT — Esc exits transcript
    // directly, same as less q. useSearchInput doesn't stopPropagation,
    // so without this gate its onCancel AND this handler would both
    // fire on one Esc (child registers first, fires first, bubbles).
    isActive: isInTranscript && !searchBarOpen
  });
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwidXNlQ2FsbGJhY2siLCJpbnN0YW5jZXMiLCJ1c2VLZXliaW5kaW5nIiwiU2NyZWVuIiwiZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJ1c2VBcHBTdGF0ZSIsInVzZVNldEFwcFN0YXRlIiwiY291bnQiLCJnZXRUZXJtaW5hbFBhbmVsIiwiUHJvcHMiLCJzY3JlZW4iLCJzZXRTY3JlZW4iLCJSZWFjdCIsIkRpc3BhdGNoIiwiU2V0U3RhdGVBY3Rpb24iLCJzaG93QWxsSW5UcmFuc2NyaXB0Iiwic2V0U2hvd0FsbEluVHJhbnNjcmlwdCIsIm1lc3NhZ2VDb3VudCIsIm9uRW50ZXJUcmFuc2NyaXB0Iiwib25FeGl0VHJhbnNjcmlwdCIsInZpcnR1YWxTY3JvbGxBY3RpdmUiLCJzZWFyY2hCYXJPcGVuIiwiR2xvYmFsS2V5YmluZGluZ0hhbmRsZXJzIiwiZXhwYW5kZWRWaWV3IiwicyIsInNldEFwcFN0YXRlIiwiaGFuZGxlVG9nZ2xlVG9kb3MiLCJpc19leHBhbmRlZCIsInByZXYiLCJnZXRBbGxJblByb2Nlc3NUZWFtbWF0ZVRhc2tzIiwicmVxdWlyZSIsImhhc1RlYW1tYXRlcyIsInRhc2tzIiwidCIsInN0YXR1cyIsImNvbnN0IiwiaXNCcmllZk9ubHkiLCJoYW5kbGVUb2dnbGVUcmFuc2NyaXB0IiwiaXNCcmllZkVuYWJsZWQiLCJpc0VudGVyaW5nVHJhbnNjcmlwdCIsImlzX2VudGVyaW5nIiwic2hvd19hbGwiLCJtZXNzYWdlX2NvdW50IiwiaGFuZGxlVG9nZ2xlU2hvd0FsbCIsImlzX2V4cGFuZGluZyIsImhhbmRsZUV4aXRUcmFuc2NyaXB0IiwiaGFuZGxlVG9nZ2xlQnJpZWYiLCJuZXh0IiwiZW5hYmxlZCIsImdhdGVkIiwic291cmNlIiwiY29udGV4dCIsInNob3dUZWFtbWF0ZU1lc3NhZ2VQcmV2aWV3IiwiaGFuZGxlVG9nZ2xlVGVybWluYWwiLCJ0b2dnbGUiLCJoYW5kbGVSZWRyYXciLCJnZXQiLCJwcm9jZXNzIiwic3Rkb3V0IiwiZm9yY2VSZWRyYXciLCJpc0luVHJhbnNjcmlwdCIsImlzQWN0aXZlIl0sInNvdXJjZXMiOlsidXNlR2xvYmFsS2V5YmluZGluZ3MudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29tcG9uZW50IHRoYXQgcmVnaXN0ZXJzIGdsb2JhbCBrZXliaW5kaW5nIGhhbmRsZXJzLlxuICpcbiAqIE11c3QgYmUgcmVuZGVyZWQgaW5zaWRlIEtleWJpbmRpbmdTZXR1cCB0byBoYXZlIGFjY2VzcyB0byB0aGUga2V5YmluZGluZyBjb250ZXh0LlxuICogVGhpcyBjb21wb25lbnQgcmVuZGVycyBub3RoaW5nIC0gaXQganVzdCByZWdpc3RlcnMgdGhlIGtleWJpbmRpbmcgaGFuZGxlcnMuXG4gKi9cbmltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2sgfSBmcm9tICdyZWFjdCdcbmltcG9ydCBpbnN0YW5jZXMgZnJvbSAnLi4vaW5rL2luc3RhbmNlcy5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHR5cGUgeyBTY3JlZW4gfSBmcm9tICcuLi9zY3JlZW5zL1JFUEwuanMnXG5pbXBvcnQgeyBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSB9IGZyb20gJy4uL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnLi4vc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUsIHVzZVNldEFwcFN0YXRlIH0gZnJvbSAnLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgZ2V0VGVybWluYWxQYW5lbCB9IGZyb20gJy4uL3V0aWxzL3Rlcm1pbmFsUGFuZWwuanMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIHNjcmVlbjogU2NyZWVuXG4gIHNldFNjcmVlbjogUmVhY3QuRGlzcGF0Y2g8UmVhY3QuU2V0U3RhdGVBY3Rpb248U2NyZWVuPj5cbiAgc2hvd0FsbEluVHJhbnNjcmlwdDogYm9vbGVhblxuICBzZXRTaG93QWxsSW5UcmFuc2NyaXB0OiBSZWFjdC5EaXNwYXRjaDxSZWFjdC5TZXRTdGF0ZUFjdGlvbjxib29sZWFuPj5cbiAgbWVzc2FnZUNvdW50OiBudW1iZXJcbiAgb25FbnRlclRyYW5zY3JpcHQ/OiAoKSA9PiB2b2lkXG4gIG9uRXhpdFRyYW5zY3JpcHQ/OiAoKSA9PiB2b2lkXG4gIHZpcnR1YWxTY3JvbGxBY3RpdmU/OiBib29sZWFuXG4gIHNlYXJjaEJhck9wZW4/OiBib29sZWFuXG59XG5cbi8qKlxuICogUmVnaXN0ZXJzIGdsb2JhbCBrZXliaW5kaW5nIGhhbmRsZXJzIGZvcjpcbiAqIC0gY3RybCt0OiBUb2dnbGUgdG9kbyBsaXN0XG4gKiAtIGN0cmwrbzogVG9nZ2xlIHRyYW5zY3JpcHQgbW9kZVxuICogLSBjdHJsK2U6IFRvZ2dsZSBzaG93aW5nIGFsbCBtZXNzYWdlcyBpbiB0cmFuc2NyaXB0XG4gKiAtIGN0cmwrYy9lc2NhcGU6IEV4aXQgdHJhbnNjcmlwdCBtb2RlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBHbG9iYWxLZXliaW5kaW5nSGFuZGxlcnMoe1xuICBzY3JlZW4sXG4gIHNldFNjcmVlbixcbiAgc2hvd0FsbEluVHJhbnNjcmlwdCxcbiAgc2V0U2hvd0FsbEluVHJhbnNjcmlwdCxcbiAgbWVzc2FnZUNvdW50LFxuICBvbkVudGVyVHJhbnNjcmlwdCxcbiAgb25FeGl0VHJhbnNjcmlwdCxcbiAgdmlydHVhbFNjcm9sbEFjdGl2ZSxcbiAgc2VhcmNoQmFyT3BlbiA9IGZhbHNlLFxufTogUHJvcHMpOiBudWxsIHtcbiAgY29uc3QgZXhwYW5kZWRWaWV3ID0gdXNlQXBwU3RhdGUocyA9PiBzLmV4cGFuZGVkVmlldylcbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG5cbiAgLy8gVG9nZ2xlIHRvZG8gbGlzdCAoY3RybCt0KSAtIGN5Y2xlcyB0aHJvdWdoIHZpZXdzXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZVRvZG9zID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV90b2dnbGVfdG9kb3MnLCB7XG4gICAgICBpc19leHBhbmRlZDogZXhwYW5kZWRWaWV3ID09PSAndGFza3MnLFxuICAgIH0pXG4gICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICBjb25zdCB7IGdldEFsbEluUHJvY2Vzc1RlYW1tYXRlVGFza3MgfSA9XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG4gICAgICAgIHJlcXVpcmUoJy4uL3Rhc2tzL0luUHJvY2Vzc1RlYW1tYXRlVGFzay9JblByb2Nlc3NUZWFtbWF0ZVRhc2suanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi90YXNrcy9JblByb2Nlc3NUZWFtbWF0ZVRhc2svSW5Qcm9jZXNzVGVhbW1hdGVUYXNrLmpzJylcbiAgICAgIGNvbnN0IGhhc1RlYW1tYXRlcyA9XG4gICAgICAgIGNvdW50KFxuICAgICAgICAgIGdldEFsbEluUHJvY2Vzc1RlYW1tYXRlVGFza3MocHJldi50YXNrcyksXG4gICAgICAgICAgdCA9PiB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnLFxuICAgICAgICApID4gMFxuXG4gICAgICBpZiAoaGFzVGVhbW1hdGVzKSB7XG4gICAgICAgIC8vIEJvdGggZXhpc3Q6IG5vbmUg4oaSIHRhc2tzIOKGkiB0ZWFtbWF0ZXMg4oaSIG5vbmVcbiAgICAgICAgc3dpdGNoIChwcmV2LmV4cGFuZGVkVmlldykge1xuICAgICAgICAgIGNhc2UgJ25vbmUnOlxuICAgICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgZXhwYW5kZWRWaWV3OiAndGFza3MnIGFzIGNvbnN0IH1cbiAgICAgICAgICBjYXNlICd0YXNrcyc6XG4gICAgICAgICAgICByZXR1cm4geyAuLi5wcmV2LCBleHBhbmRlZFZpZXc6ICd0ZWFtbWF0ZXMnIGFzIGNvbnN0IH1cbiAgICAgICAgICBjYXNlICd0ZWFtbWF0ZXMnOlxuICAgICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgZXhwYW5kZWRWaWV3OiAnbm9uZScgYXMgY29uc3QgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPbmx5IHRhc2tzOiBub25lIOKGlCB0YXNrc1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgZXhwYW5kZWRWaWV3OlxuICAgICAgICAgIHByZXYuZXhwYW5kZWRWaWV3ID09PSAndGFza3MnXG4gICAgICAgICAgICA/ICgnbm9uZScgYXMgY29uc3QpXG4gICAgICAgICAgICA6ICgndGFza3MnIGFzIGNvbnN0KSxcbiAgICAgIH1cbiAgICB9KVxuICB9LCBbZXhwYW5kZWRWaWV3LCBzZXRBcHBTdGF0ZV0pXG5cbiAgLy8gVG9nZ2xlIHRyYW5zY3JpcHQgbW9kZSAoY3RybCtvKS4gVHdvLXdheSBwcm9tcHQg4oaUIHRyYW5zY3JpcHQuXG4gIC8vIEJyaWVmIHZpZXcgaGFzIGl0cyBvd24gZGVkaWNhdGVkIHRvZ2dsZSBvbiBjdHJsK3NoaWZ0K2IuXG4gIGNvbnN0IGlzQnJpZWZPbmx5ID1cbiAgICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKVxuICAgICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICAgIHVzZUFwcFN0YXRlKHMgPT4gcy5pc0JyaWVmT25seSlcbiAgICAgIDogZmFsc2VcbiAgY29uc3QgaGFuZGxlVG9nZ2xlVHJhbnNjcmlwdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0JSSUVGJykpIHtcbiAgICAgIC8vIEVzY2FwZSBoYXRjaDogR0Iga2lsbC1zd2l0Y2ggd2hpbGUgZGVmYXVsdFZpZXc9Y2hhdCB3YXMgcGVyc2lzdGVkXG4gICAgICAvLyBjYW4gbGVhdmUgaXNCcmllZk9ubHkgc3R1Y2sgb24sIHNob3dpbmcgYSBibGFuayBmaWx0ZXJGb3JCcmllZlRvb2xcbiAgICAgIC8vIHZpZXcuIFVzZXJzIHdpbGwgcmVhY2ggZm9yIGN0cmwrbyDigJQgY2xlYXIgdGhlIHN0dWNrIHN0YXRlIGZpcnN0LlxuICAgICAgLy8gT25seSBuZWVkZWQgaW4gdGhlIHByb21wdCBzY3JlZW4g4oCUIHRyYW5zY3JpcHQgbW9kZSBhbHJlYWR5IGlnbm9yZXNcbiAgICAgIC8vIGlzQnJpZWZPbmx5IChNZXNzYWdlcy50c3ggZmlsdGVyIGlzIGdhdGVkIG9uICFpc1RyYW5zY3JpcHRNb2RlKS5cbiAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgIGNvbnN0IHsgaXNCcmllZkVuYWJsZWQgfSA9XG4gICAgICAgIHJlcXVpcmUoJy4uL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi90b29scy9CcmllZlRvb2wvQnJpZWZUb29sLmpzJylcbiAgICAgIC8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgaWYgKCFpc0JyaWVmRW5hYmxlZCgpICYmIGlzQnJpZWZPbmx5ICYmIHNjcmVlbiAhPT0gJ3RyYW5zY3JpcHQnKSB7XG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgIGlmICghcHJldi5pc0JyaWVmT25seSkgcmV0dXJuIHByZXZcbiAgICAgICAgICByZXR1cm4geyAuLi5wcmV2LCBpc0JyaWVmT25seTogZmFsc2UgfVxuICAgICAgICB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBpc0VudGVyaW5nVHJhbnNjcmlwdCA9IHNjcmVlbiAhPT0gJ3RyYW5zY3JpcHQnXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X3RvZ2dsZV90cmFuc2NyaXB0Jywge1xuICAgICAgaXNfZW50ZXJpbmc6IGlzRW50ZXJpbmdUcmFuc2NyaXB0LFxuICAgICAgc2hvd19hbGw6IHNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgfSlcbiAgICBzZXRTY3JlZW4ocyA9PiAocyA9PT0gJ3RyYW5zY3JpcHQnID8gJ3Byb21wdCcgOiAndHJhbnNjcmlwdCcpKVxuICAgIHNldFNob3dBbGxJblRyYW5zY3JpcHQoZmFsc2UpXG4gICAgaWYgKGlzRW50ZXJpbmdUcmFuc2NyaXB0ICYmIG9uRW50ZXJUcmFuc2NyaXB0KSB7XG4gICAgICBvbkVudGVyVHJhbnNjcmlwdCgpXG4gICAgfVxuICAgIGlmICghaXNFbnRlcmluZ1RyYW5zY3JpcHQgJiYgb25FeGl0VHJhbnNjcmlwdCkge1xuICAgICAgb25FeGl0VHJhbnNjcmlwdCgpXG4gICAgfVxuICB9LCBbXG4gICAgc2NyZWVuLFxuICAgIHNldFNjcmVlbixcbiAgICBpc0JyaWVmT25seSxcbiAgICBzaG93QWxsSW5UcmFuc2NyaXB0LFxuICAgIHNldFNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgbWVzc2FnZUNvdW50LFxuICAgIHNldEFwcFN0YXRlLFxuICAgIG9uRW50ZXJUcmFuc2NyaXB0LFxuICAgIG9uRXhpdFRyYW5zY3JpcHQsXG4gIF0pXG5cbiAgLy8gVG9nZ2xlIHNob3dpbmcgYWxsIG1lc3NhZ2VzIGluIHRyYW5zY3JpcHQgbW9kZSAoY3RybCtlKVxuICBjb25zdCBoYW5kbGVUb2dnbGVTaG93QWxsID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV90cmFuc2NyaXB0X3RvZ2dsZV9zaG93X2FsbCcsIHtcbiAgICAgIGlzX2V4cGFuZGluZzogIXNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgfSlcbiAgICBzZXRTaG93QWxsSW5UcmFuc2NyaXB0KHByZXYgPT4gIXByZXYpXG4gIH0sIFtzaG93QWxsSW5UcmFuc2NyaXB0LCBzZXRTaG93QWxsSW5UcmFuc2NyaXB0LCBtZXNzYWdlQ291bnRdKVxuXG4gIC8vIEV4aXQgdHJhbnNjcmlwdCBtb2RlIChjdHJsK2Mgb3IgZXNjYXBlKVxuICBjb25zdCBoYW5kbGVFeGl0VHJhbnNjcmlwdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBsb2dFdmVudCgndGVuZ3VfdHJhbnNjcmlwdF9leGl0Jywge1xuICAgICAgc2hvd19hbGw6IHNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgICBtZXNzYWdlX2NvdW50OiBtZXNzYWdlQ291bnQsXG4gICAgfSlcbiAgICBzZXRTY3JlZW4oJ3Byb21wdCcpXG4gICAgc2V0U2hvd0FsbEluVHJhbnNjcmlwdChmYWxzZSlcbiAgICBpZiAob25FeGl0VHJhbnNjcmlwdCkge1xuICAgICAgb25FeGl0VHJhbnNjcmlwdCgpXG4gICAgfVxuICB9LCBbXG4gICAgc2V0U2NyZWVuLFxuICAgIHNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgc2V0U2hvd0FsbEluVHJhbnNjcmlwdCxcbiAgICBtZXNzYWdlQ291bnQsXG4gICAgb25FeGl0VHJhbnNjcmlwdCxcbiAgXSlcblxuICAvLyBUb2dnbGUgYnJpZWYtb25seSB2aWV3IChjdHJsK3NoaWZ0K2IpLiBQdXJlIGRpc3BsYXkgZmlsdGVyIHRvZ2dsZSDigJRcbiAgLy8gZG9lcyBub3QgdG91Y2ggb3B0LWluIHN0YXRlLiBBc3ltbWV0cmljIGdhdGUgKG1pcnJvcnMgL2JyaWVmKTogT0ZGXG4gIC8vIHRyYW5zaXRpb24gYWx3YXlzIGFsbG93ZWQgc28gdGhlIHNhbWUga2V5IHRoYXQgZ290IHlvdSBpbiBnZXRzIHlvdVxuICAvLyBvdXQgZXZlbiBpZiB0aGUgR0Iga2lsbC1zd2l0Y2ggZmlyZXMgbWlkLXNlc3Npb24uXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZUJyaWVmID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKSkge1xuICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgY29uc3QgeyBpc0JyaWVmRW5hYmxlZCB9ID1cbiAgICAgICAgcmVxdWlyZSgnLi4vdG9vbHMvQnJpZWZUb29sL0JyaWVmVG9vbC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKVxuICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICBpZiAoIWlzQnJpZWZFbmFibGVkKCkgJiYgIWlzQnJpZWZPbmx5KSByZXR1cm5cbiAgICAgIGNvbnN0IG5leHQgPSAhaXNCcmllZk9ubHlcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9icmllZl9tb2RlX3RvZ2dsZWQnLCB7XG4gICAgICAgIGVuYWJsZWQ6IG5leHQsXG4gICAgICAgIGdhdGVkOiBmYWxzZSxcbiAgICAgICAgc291cmNlOlxuICAgICAgICAgICdrZXliaW5kaW5nJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBpZiAocHJldi5pc0JyaWVmT25seSA9PT0gbmV4dCkgcmV0dXJuIHByZXZcbiAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgaXNCcmllZk9ubHk6IG5leHQgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sIFtpc0JyaWVmT25seSwgc2V0QXBwU3RhdGVdKVxuXG4gIC8vIFJlZ2lzdGVyIGtleWJpbmRpbmcgaGFuZGxlcnNcbiAgdXNlS2V5YmluZGluZygnYXBwOnRvZ2dsZVRvZG9zJywgaGFuZGxlVG9nZ2xlVG9kb3MsIHtcbiAgICBjb250ZXh0OiAnR2xvYmFsJyxcbiAgfSlcbiAgdXNlS2V5YmluZGluZygnYXBwOnRvZ2dsZVRyYW5zY3JpcHQnLCBoYW5kbGVUb2dnbGVUcmFuc2NyaXB0LCB7XG4gICAgY29udGV4dDogJ0dsb2JhbCcsXG4gIH0pXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKSkge1xuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICB1c2VLZXliaW5kaW5nKCdhcHA6dG9nZ2xlQnJpZWYnLCBoYW5kbGVUb2dnbGVCcmllZiwge1xuICAgICAgY29udGV4dDogJ0dsb2JhbCcsXG4gICAgfSlcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIHRlYW1tYXRlIGtleWJpbmRpbmdcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnYXBwOnRvZ2dsZVRlYW1tYXRlUHJldmlldycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAuLi5wcmV2LFxuICAgICAgICBzaG93VGVhbW1hdGVNZXNzYWdlUHJldmlldzogIXByZXYuc2hvd1RlYW1tYXRlTWVzc2FnZVByZXZpZXcsXG4gICAgICB9KSlcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdHbG9iYWwnLFxuICAgIH0sXG4gIClcblxuICAvLyBUb2dnbGUgYnVpbHQtaW4gdGVybWluYWwgcGFuZWwgKG1ldGEraikuXG4gIC8vIHRvZ2dsZSgpIGJsb2NrcyBpbiBzcGF3blN5bmMgdW50aWwgdGhlIHVzZXIgZGV0YWNoZXMgZnJvbSB0bXV4LlxuICBjb25zdCBoYW5kbGVUb2dnbGVUZXJtaW5hbCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoZmVhdHVyZSgnVEVSTUlOQUxfUEFORUwnKSkge1xuICAgICAgaWYgKCFnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSgndGVuZ3VfdGVybWluYWxfcGFuZWwnLCBmYWxzZSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBnZXRUZXJtaW5hbFBhbmVsKCkudG9nZ2xlKClcbiAgICB9XG4gIH0sIFtdKVxuICB1c2VLZXliaW5kaW5nKCdhcHA6dG9nZ2xlVGVybWluYWwnLCBoYW5kbGVUb2dnbGVUZXJtaW5hbCwge1xuICAgIGNvbnRleHQ6ICdHbG9iYWwnLFxuICB9KVxuXG4gIC8vIENsZWFyIHNjcmVlbiBhbmQgZm9yY2UgZnVsbCByZWRyYXcgKGN0cmwrbCkuIFJlY292ZXJ5IHBhdGggd2hlbiB0aGVcbiAgLy8gdGVybWluYWwgd2FzIGNsZWFyZWQgZXh0ZXJuYWxseSAobWFjT1MgQ21kK0spIGFuZCBJbmsncyBkaWZmIGVuZ2luZVxuICAvLyB0aGlua3MgdW5jaGFuZ2VkIGNlbGxzIGRvbid0IG5lZWQgcmVwYWludGluZy5cbiAgY29uc3QgaGFuZGxlUmVkcmF3ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGluc3RhbmNlcy5nZXQocHJvY2Vzcy5zdGRvdXQpPy5mb3JjZVJlZHJhdygpXG4gIH0sIFtdKVxuICB1c2VLZXliaW5kaW5nKCdhcHA6cmVkcmF3JywgaGFuZGxlUmVkcmF3LCB7IGNvbnRleHQ6ICdHbG9iYWwnIH0pXG5cbiAgLy8gVHJhbnNjcmlwdC1zcGVjaWZpYyBiaW5kaW5ncyAob25seSBhY3RpdmUgd2hlbiBpbiB0cmFuc2NyaXB0IG1vZGUpXG4gIGNvbnN0IGlzSW5UcmFuc2NyaXB0ID0gc2NyZWVuID09PSAndHJhbnNjcmlwdCdcbiAgdXNlS2V5YmluZGluZygndHJhbnNjcmlwdDp0b2dnbGVTaG93QWxsJywgaGFuZGxlVG9nZ2xlU2hvd0FsbCwge1xuICAgIGNvbnRleHQ6ICdUcmFuc2NyaXB0JyxcbiAgICBpc0FjdGl2ZTogaXNJblRyYW5zY3JpcHQgJiYgIXZpcnR1YWxTY3JvbGxBY3RpdmUsXG4gIH0pXG4gIHVzZUtleWJpbmRpbmcoJ3RyYW5zY3JpcHQ6ZXhpdCcsIGhhbmRsZUV4aXRUcmFuc2NyaXB0LCB7XG4gICAgY29udGV4dDogJ1RyYW5zY3JpcHQnLFxuICAgIC8vIEJhci1vcGVuIGlzIGEgbW9kZSAob3ducyBrZXlzdHJva2VzKS4gTmF2aWdhdGluZyAoaGlnaGxpZ2h0c1xuICAgIC8vIHZpc2libGUsIG4vTiBhY3RpdmUsIGJhciBjbG9zZWQpIGlzIE5PVCDigJQgRXNjIGV4aXRzIHRyYW5zY3JpcHRcbiAgICAvLyBkaXJlY3RseSwgc2FtZSBhcyBsZXNzIHEuIHVzZVNlYXJjaElucHV0IGRvZXNuJ3Qgc3RvcFByb3BhZ2F0aW9uLFxuICAgIC8vIHNvIHdpdGhvdXQgdGhpcyBnYXRlIGl0cyBvbkNhbmNlbCBBTkQgdGhpcyBoYW5kbGVyIHdvdWxkIGJvdGhcbiAgICAvLyBmaXJlIG9uIG9uZSBFc2MgKGNoaWxkIHJlZ2lzdGVycyBmaXJzdCwgZmlyZXMgZmlyc3QsIGJ1YmJsZXMpLlxuICAgIGlzQWN0aXZlOiBpc0luVHJhbnNjcmlwdCAmJiAhc2VhcmNoQmFyT3BlbixcbiAgfSlcblxuICByZXR1cm4gbnVsbFxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxTQUFTQyxXQUFXLFFBQVEsT0FBTztBQUNuQyxPQUFPQyxTQUFTLE1BQU0scUJBQXFCO0FBQzNDLFNBQVNDLGFBQWEsUUFBUSxpQ0FBaUM7QUFDL0Qs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