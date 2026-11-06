import { c as _c } from "react/compiler-runtime";
import { execa } from 'execa';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CommandResultDisplay } from '../../commands.js';
import { Select } from '../../components/CustomSelect/select.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Spinner } from '../../components/Spinner.js';
import instances from '../../ink/instances.js';
import { Box, Text } from '../../ink.js';
import { enablePluginOp } from '../../services/plugins/pluginOperations.js';
import { logForDebugging } from '../../utils/debug.js';
import { isENOENT, toError } from '../../utils/errors.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { pathExists } from '../../utils/file.js';
import { logError } from '../../utils/log.js';
import { getPlatform } from '../../utils/platform.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { isPluginInstalled } from '../../utils/plugins/installedPluginsManager.js';
import { addMarketplaceSource, clearMarketplacesCache, loadKnownMarketplacesConfig, refreshMarketplace } from '../../utils/plugins/marketplaceManager.js';
import { OFFICIAL_MARKETPLACE_NAME } from '../../utils/plugins/officialMarketplace.js';
import { loadAllPlugins } from '../../utils/plugins/pluginLoader.js';
import { installSelectedPlugins } from '../../utils/plugins/pluginStartupCheck.js';

// Marketplace and plugin identifiers - varies by user type
const INTERNAL_MARKETPLACE_NAME = 'claude-code-marketplace';
const INTERNAL_MARKETPLACE_REPO = 'anthropics/claude-code-marketplace';
const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';
function getMarketplaceName(): string {
  return "external" === 'ant' ? INTERNAL_MARKETPLACE_NAME : OFFICIAL_MARKETPLACE_NAME;
}
function getMarketplaceRepo(): string {
  return "external" === 'ant' ? INTERNAL_MARKETPLACE_REPO : OFFICIAL_MARKETPLACE_REPO;
}
function getPluginId(): string {
  return `thinkback@${getMarketplaceName()}`;
}
const SKILL_NAME = 'thinkback';

/**
 * Get the thinkback skill directory from the installed plugin's cache path
 */
async function getThinkbackSkillDir(): Promise<string | null> {
  const {
    enabled
  } = await loadAllPlugins();
  const thinkbackPlugin = enabled.find(p => p.name === 'thinkback' || p.source && p.source.includes(getPluginId()));
  if (!thinkbackPlugin) {
    return null;
  }
  const skillDir = join(thinkbackPlugin.path, 'skills', SKILL_NAME);
  if (await pathExists(skillDir)) {
    return skillDir;
  }
  return null;
}
export async function playAnimation(skillDir: string): Promise<{
  success: boolean;
  message: string;
}> {
  const dataPath = join(skillDir, 'year_in_review.js');
  const playerPath = join(skillDir, 'player.js');

  // Both files are prerequisites for the node subprocess. Read them here
  // (not at call sites) so all callers get consistent error messaging. The
  // subprocess runs with reject: false, so a missing file would otherwise
  // silently return success. Using readFile (not access) per CLAUDE.md.
  //
  // Non-ENOENT errors (EACCES etc) are logged and returned as failures rather
  // than thrown — the old pathExists-based code never threw, and one caller
  // (handleSelect) uses `void playAnimation().then(...)` without a .catch().
  try {
    await readFile(dataPath);
  } catch (e: unknown) {
    if (isENOENT(e)) {
      return {
        success: false,
        message: 'No animation found. Run /think-back first to generate one.'
      };
    }
    logError(e);
    return {
      success: false,
      message: `Could not access animation data: ${toError(e).message}`
    };
  }
  try {
    await readFile(playerPath);
  } catch (e: unknown) {
    if (isENOENT(e)) {
      return {
        success: false,
        message: 'Player script not found. The player.js file is missing from the thinkback skill.'
      };
    }
    logError(e);
    return {
      success: false,
      message: `Could not access player script: ${toError(e).message}`
    };
  }

  // Get ink instance for terminal takeover
  const inkInstance = instances.get(process.stdout);
  if (!inkInstance) {
    return {
      success: false,
      message: 'Failed to access terminal instance'
    };
  }
  inkInstance.enterAlternateScreen();
  try {
    await execa('node', [playerPath], {
      stdio: 'inherit',
      cwd: skillDir,
      reject: false
    });
  } catch {
    // Animation may have been interrupted (e.g., Ctrl+C)
  } finally {
    inkInstance.exitAlternateScreen();
  }

  // Open the HTML file in browser for video download
  const htmlPath = join(skillDir, 'year_in_review.html');
  if (await pathExists(htmlPath)) {
    const platform = getPlatform();
    const openCmd = platform === 'macos' ? 'open' : platform === 'windows' ? 'start' : 'xdg-open';
    void execFileNoThrow(openCmd, [htmlPath]);
  }
  return {
    success: true,
    message: 'Year in review animation complete!'
  };
}
type InstallState = {
  phase: 'checking';
} | {
  phase: 'installing-marketplace';
} | {
  phase: 'installing-plugin';
} | {
  phase: 'enabling-plugin';
} | {
  phase: 'ready';
} | {
  phase: 'error';
  message: string;
};
function ThinkbackInstaller({
  onReady,
  onError
}: {
  onReady: () => void;
  onError: (message: string) => void;
}): React.ReactNode {
  const [state, setState] = useState<InstallState>({
    phase: 'checking'
  });
  const [progressMessage, setProgressMessage] = useState('');
  useEffect(() => {
    async function checkAndInstall(): Promise<void> {
      try {
        // Check if marketplace is installed
        const knownMarketplaces = await loadKnownMarketplacesConfig();
        const marketplaceName = getMarketplaceName();
        const marketplaceRepo = getMarketplaceRepo();
        const pluginId = getPluginId();
        const marketplaceInstalled = marketplaceName in knownMarketplaces;

        // Check if plugin is already installed first
        const pluginAlreadyInstalled = isPluginInstalled(pluginId);
        if (!marketplaceInstalled) {
          // Install the marketplace
          setState({
            phase: 'installing-marketplace'
          });
          logForDebugging(`Installing marketplace ${marketplaceRepo}`);
          await addMarketplaceSource({
            source: 'github',
            repo: marketplaceRepo
          }, message => {
            setProgressMessage(message);
          });
          clearAllCaches();
          logForDebugging(`Marketplace ${marketplaceName} installed`);
        } else if (!pluginAlreadyInstalled) {
          // Marketplace installed but plugin not installed - refresh to get latest plugins
          // Only refresh when needed to avoid potentially destructive git operations
          setState({
            phase: 'installing-marketplace'
          });
          setProgressMessage('Updating marketplace…');
          logForDebugging(`Refreshing marketplace ${marketplaceName}`);
          await refreshMarketplace(marketplaceName, message_0 => {
            setProgressMessage(message_0);
          });
          clearMarketplacesCache();
          clearAllCaches();
          logForDebugging(`Marketplace ${marketplaceName} refreshed`);
        }
        if (!pluginAlreadyInstalled) {
          // Install the plugin
          setState({
            phase: 'installing-plugin'
          });
          logForDebugging(`Installing plugin ${pluginId}`);
          const result = await installSelectedPlugins([pluginId]);
          if (result.failed.length > 0) {
            const errorMsg = result.failed.map(f => `${f.name}: ${f.error}`).join(', ');
            throw new Error(`Failed to install plugin: ${errorMsg}`);
          }
          clearAllCaches();
          logForDebugging(`Plugin ${pluginId} installed`);
        } else {
          // Plugin is installed, check if it's enabled
          const {
            disabled
          } = await loadAllPlugins();
          const isDisabled = disabled.some(p => p.name === 'thinkback' || p.source?.includes(pluginId));
          if (isDisabled) {
            // Enable the plugin
            setState({
              phase: 'enabling-plugin'
            });
            logForDebugging(`Enabling plugin ${pluginId}`);
            const enableResult = await enablePluginOp(pluginId);
            if (!enableResult.success) {
              throw new Error(`Failed to enable plugin: ${enableResult.message}`);
            }
            clearAllCaches();
            logForDebugging(`Plugin ${pluginId} enabled`);
          }
        }
        setState({
          phase: 'ready'
        });
        onReady();
      } catch (error) {
        const err = toError(error);
        logError(err);
        setState({
          phase: 'error',
          message: err.message
        });
        onError(err.message);
      }
    }
    void checkAndInstall();
  }, [onReady, onError]);
  if (state.phase === 'error') {
    return <Box flexDirection="column">
        <Text color="error">Error: {state.message}</Text>
      </Box>;
  }
  if (state.phase === 'ready') {
    return null;
  }
  const statusMessage = state.phase === 'checking' ? 'Checking thinkback installation…' : state.phase === 'installing-marketplace' ? 'Installing marketplace…' : state.phase === 'enabling-plugin' ? 'Enabling thinkback plugin…' : 'Installing thinkback plugin…';
  return <Box flexDirection="column">
      <Box>
        <Spinner />
        <Text>{progressMessage || statusMessage}</Text>
      </Box>
    </Box>;
}
type MenuAction = 'play' | 'edit' | 'fix' | 'regenerate';
type GenerativeAction = Exclude<MenuAction, 'play'>;
function ThinkbackMenu(t0) {
  const $ = _c(19);
  const {
    onDone,
    onAction,
    skillDir,
    hasGenerated
  } = t0;
  const [hasSelected, setHasSelected] = useState(false);
  let t1;
  if ($[0] !== hasGenerated) {
    t1 = hasGenerated ? [{
      label: "Play animation",
      value: "play" as const,
      description: "Watch your year in review"
    }, {
      label: "Edit content",
      value: "edit" as const,
      description: "Modify the animation"
    }, {
      label: "Fix errors",
      value: "fix" as const,
      description: "Fix validation or rendering issues"
    }, {
      label: "Regenerate",
      value: "regenerate" as const,
      description: "Create a new animation from scratch"
    }] : [{
      label: "Let's go!",
      value: "regenerate" as const,
      description: "Generate your personalized animation"
    }];
    $[0] = hasGenerated;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const options = t1;
  let t2;
  if ($[2] !== onAction || $[3] !== onDone || $[4] !== skillDir) {
    t2 = function handleSelect(value) {
      setHasSelected(true);
      if (value === "play") {
        playAnimation(skillDir).then(() => {
          onDone(undefined, {
            display: "skip"
          });
        });
      } else {
        onAction(value);
      }
    };
    $[2] = onAction;
    $[3] = onDone;
    $[4] = skillDir;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  const handleSelect = t2;
  let t3;
  if ($[6] !== onDone) {
    t3 = function handleCancel() {
      onDone(undefined, {
        display: "skip"
      });
    };
    $[6] = onDone;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  const handleCancel = t3;
  if (hasSelected) {
    return null;
  }
  let t4;
  if ($[8] !== hasGenerated) {
    t4 = !hasGenerated && <Box flexDirection="column"><Text>Relive your year of coding with Claude.</Text><Text dimColor={true}>{"We'll create a personalized ASCII animation celebrating your journey."}</Text></Box>;
    $[8] = hasGenerated;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  let t5;
  if ($[10] !== handleSelect || $[11] !== options) {
    t5 = <Select options={options} onChange={handleSelect} visibleOptionCount={5} />;
    $[10] = handleSelect;
    $[11] = options;
    $[12] = t5;
  } else {
    t5 = $[12];
  }
  let t6;
  if ($[13] !== t4 || $[14] !== t5) {
    t6 = <Box flexDirection="column" gap={1}>{t4}{t5}</Box>;
    $[13] = t4;
    $[14] = t5;
    $[15] = t6;
  } else {
    t6 = $[15];
  }
  let t7;
  if ($[16] !== handleCancel || $[17] !== t6) {
    t7 = <Dialog title="Think Back on 2025 with Claude Code" subtitle="Generate your 2025 Claude Code Think Back (takes a few minutes to run)" onCancel={handleCancel} color="claude">{t6}</Dialog>;
    $[16] = handleCancel;
    $[17] = t6;
    $[18] = t7;
  } else {
    t7 = $[18];
  }
  return t7;
}
const EDIT_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=edit to modify my existing Claude Code year in review animation. Ask me what I want to change. When the animation is ready, tell the user to run /think-back again to play it.';
const FIX_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=fix to fix validation or rendering errors in my existing Claude Code year in review animation. Run the validator, identify errors, and fix them. When the animation is ready, tell the user to run /think-back again to play it.';
const REGENERATE_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=regenerate to create a completely new Claude Code year in review animation from scratch. Delete the existing animation and start fresh. When the animation is ready, tell the user to run /think-back again to play it.';
function ThinkbackFlow(t0) {
  const $ = _c(27);
  const {
    onDone
  } = t0;
  const [installComplete, setInstallComplete] = useState(false);
  const [installError, setInstallError] = useState(null);
  const [skillDir, setSkillDir] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(null);
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = function handleReady() {
      setInstallComplete(true);
    };
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const handleReady = t1;
  let t2;
  if ($[1] !== onDone) {
    t2 = message => {
      setInstallError(message);
      onDone(`Error with thinkback: ${message}. Try running /plugin to manually install the think-back plugin.`, {
        display: "system"
      });
    };
    $[1] = onDone;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  const handleError = t2;
  let t3;
  let t4;
  if ($[3] !== handleError || $[4] !== installComplete || $[5] !== installError || $[6] !== skillDir) {
    t3 = () => {
      if (installComplete && !skillDir && !installError) {
        getThinkbackSkillDir().then(dir => {
          if (dir) {
            logForDebugging(`Thinkback skill directory: ${dir}`);
            setSkillDir(dir);
          } else {
            handleError("Could not find thinkback skill directory");
          }
        });
      }
    };
    t4 = [installComplete, skillDir, installError, handleError];
    $[3] = handleError;
    $[4] = installComplete;
    $[5] = installError;
    $[6] = skillDir;
    $[7] = t3;
    $[8] = t4;
  } else {
    t3 = $[7];
    t4 = $[8];
  }
  useEffect(t3, t4);
  let t5;
  let t6;
  if ($[9] !== skillDir) {
    t5 = () => {
      if (!skillDir) {
        return;
      }
      const dataPath = join(skillDir, "year_in_review.js");
      pathExists(dataPath).then(exists => {
        logForDebugging(`Checking for ${dataPath}: ${exists ? "found" : "not found"}`);
        setHasGenerated(exists);
      });
    };
    t6 = [skillDir];
    $[9] = skillDir;
    $[10] = t5;
    $[11] = t6;
  } else {
    t5 = $[10];
    t6 = $[11];
  }
  useEffect(t5, t6);
  let t7;
  if ($[12] !== onDone) {
    t7 = function handleAction(action) {
      const prompts = {
        edit: EDIT_PROMPT,
        fix: FIX_PROMPT,
        regenerate: REGENERATE_PROMPT
      };
      onDone(prompts[action], {
        display: "user",
        shouldQuery: true
      });
    };
    $[12] = onDone;
    $[13] = t7;
  } else {
    t7 = $[13];
  }
  const handleAction = t7;
  if (installError) {
    let t8;
    if ($[14] !== installError) {
      t8 = <Text color="error">Error: {installError}</Text>;
      $[14] = installError;
      $[15] = t8;
    } else {
      t8 = $[15];
    }
    let t9;
    if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
      t9 = <Text dimColor={true}>Try running /plugin to manually install the think-back plugin.</Text>;
      $[16] = t9;
    } else {
      t9 = $[16];
    }
    let t10;
    if ($[17] !== t8) {
      t10 = <Box flexDirection="column">{t8}{t9}</Box>;
      $[17] = t8;
      $[18] = t10;
    } else {
      t10 = $[18];
    }
    return t10;
  }
  if (!installComplete) {
    let t8;
    if ($[19] !== handleError) {
      t8 = <ThinkbackInstaller onReady={handleReady} onError={handleError} />;
      $[19] = handleError;
      $[20] = t8;
    } else {
      t8 = $[20];
    }
    return t8;
  }
  if (!skillDir || hasGenerated === null) {
    let t8;
    if ($[21] === Symbol.for("react.memo_cache_sentinel")) {
      t8 = <Box><Spinner /><Text>Loading thinkback skill…</Text></Box>;
      $[21] = t8;
    } else {
      t8 = $[21];
    }
    return t8;
  }
  let t8;
  if ($[22] !== handleAction || $[23] !== hasGenerated || $[24] !== onDone || $[25] !== skillDir) {
    t8 = <ThinkbackMenu onDone={onDone} onAction={handleAction} skillDir={skillDir} hasGenerated={hasGenerated} />;
    $[22] = handleAction;
    $[23] = hasGenerated;
    $[24] = onDone;
    $[25] = skillDir;
    $[26] = t8;
  } else {
    t8 = $[26];
  }
  return t8;
}
export async function call(onDone: (result?: string, options?: {
  display?: CommandResultDisplay;
  shouldQuery?: boolean;
}) => void): Promise<React.ReactNode> {
  return <ThinkbackFlow onDone={onDone} />;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJleGVjYSIsInJlYWRGaWxlIiwiam9pbiIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwiU2VsZWN0IiwiRGlhbG9nIiwiU3Bpbm5lciIsImluc3RhbmNlcyIsIkJveCIsIlRleHQiLCJlbmFibGVQbHVnaW5PcCIsImxvZ0ZvckRlYnVnZ2luZyIsImlzRU5PRU5UIiwidG9FcnJvciIsImV4ZWNGaWxlTm9UaHJvdyIsInBhdGhFeGlzdHMiLCJsb2dFcnJvciIsImdldFBsYXRmb3JtIiwiY2xlYXJBbGxDYWNoZXMiLCJpc1BsdWdpbkluc3RhbGxlZCIsImFkZE1hcmtldHBsYWNlU291cmNlIiwiY2xlYXJNYXJrZXRwbGFjZXNDYWNoZSIsImxvYWRLbm93bk1hcmtldHBsYWNlc0NvbmZpZyIsInJlZnJlc2hNYXJrZXRwbGFjZSIsIk9GRklDSUFMX01BUktFVFBMQUNFX05BTUUiLCJsb2FkQWxsUGx1Z2lucyIsImluc3RhbGxTZWxlY3RlZFBsdWdpbnMiLCJJTlRFUk5BTF9NQVJLRVRQTEFDRV9OQU1FIiwiSU5URVJOQUxfTUFSS0VUUExBQ0VfUkVQTyIsIk9GRklDSUFMX01BUktFVFBMQUNFX1JFUE8iLCJnZXRNYXJrZXRwbGFjZU5hbWUiLCJnZXRNYXJrZXRwbGFjZVJlcG8iLCJnZXRQbHVnaW5JZCIsIlNLSUxMX05BTUUiLCJnZXRUaGlua2JhY2tTa2lsbERpciIsIlByb21pc2UiLCJlbmFibGVkIiwidGhpbmtiYWNrUGx1Z2luIiwiZmluZCIsInAiLCJuYW1lIiwic291cmNlIiwiaW5jbHVkZXMiLCJza2lsbERpciIsInBhdGgiLCJwbGF5QW5pbWF0aW9uIiwic3VjY2VzcyIsIm1lc3NhZ2UiLCJkYXRhUGF0aCIsInBsYXllclBhdGgiLCJlIiwiaW5rSW5zdGFuY2UiLCJnZXQiLCJwcm9jZXNzIiwic3Rkb3V0IiwiZW50ZXJBbHRlcm5hdGVTY3JlZW4iLCJzdGRpbyIsImN3ZCIsInJlamVjdCIsImV4aXRBbHRlcm5hdGVTY3JlZW4iLCJodG1sUGF0aCIsInBsYXRmb3JtIiwib3BlbkNtZCIsIkluc3RhbGxTdGF0ZSIsInBoYXNlIiwiVGhpbmtiYWNrSW5zdGFsbGVyIiwib25SZWFkeSIsIm9uRXJyb3IiLCJSZWFjdE5vZGUiLCJzdGF0ZSIsInNldFN0YXRlIiwicHJvZ3Jlc3NNZXNzYWdlIiwic2V0UHJvZ3Jlc3NNZXNzYWdlIiwiY2hlY2tBbmRJbnN0YWxsIiwia25vd25NYXJrZXRwbGFjZXMiLCJtYXJrZXRwbGFjZU5hbWUiLCJtYXJrZXRwbGFjZVJlcG8iLCJwbHVnaW5JZCIsIm1hcmtldHBsYWNlSW5zdGFsbGVkIiwicGx1Z2luQWxyZWFkeUluc3RhbGxlZCIsInJlcG8iLCJyZXN1bHQiLCJmYWlsZWQiLCJsZW5ndGgiLCJlcnJvck1zZyIsIm1hcCIsImYiLCJlcnJvciIsIkVycm9yIiwiZGlzYWJsZWQiLCJpc0Rpc2FibGVkIiwic29tZSIsImVuYWJsZVJlc3VsdCIsImVyciIsInN0YXR1c01lc3NhZ2UiLCJNZW51QWN0aW9uIiwiR2VuZXJhdGl2ZUFjdGlvbiIsIkV4Y2x1ZGUiLCJUaGlua2JhY2tNZW51IiwidDAiLCIkIiwiX2MiLCJvbkRvbmUiLCJvbkFjdGlvbiIsImhhc0dlbmVyYXRlZCIsImhhc1NlbGVjdGVkIiwic2V0SGFzU2VsZWN0ZWQiLCJ0MSIsImxhYmVsIiwidmFsdWUiLCJjb25zdCIsImRlc2NyaXB0aW9uIiwib3B0aW9ucyIsInQyIiwiaGFuZGxlU2VsZWN0IiwidGhlbiIsInVuZGVmaW5lZCIsImRpc3BsYXkiLCJ0MyIsImhhbmRsZUNhbmNlbCIsInQ0IiwidDUiLCJ0NiIsInQ3IiwiRURJVF9QUk9NUFQiLCJGSVhfUFJPTVBUIiwiUkVHRU5FUkFURV9QUk9NUFQiLCJUaGlua2JhY2tGbG93IiwiaW5zdGFsbENvbXBsZXRlIiwic2V0SW5zdGFsbENvbXBsZXRlIiwiaW5zdGFsbEVycm9yIiwic2V0SW5zdGFsbEVycm9yIiwic2V0U2tpbGxEaXIiLCJzZXRIYXNHZW5lcmF0ZWQiLCJTeW1ib2wiLCJmb3IiLCJoYW5kbGVSZWFkeSIsImhhbmRsZUVycm9yIiwiZGlyIiwiZXhpc3RzIiwiaGFuZGxlQWN0aW9uIiwiYWN0aW9uIiwicHJvbXB0cyIsImVkaXQiLCJmaXgiLCJyZWdlbmVyYXRlIiwic2hvdWxkUXVlcnkiLCJ0OCIsInQ5IiwidDEwIiwiY2FsbCJdLCJzb3VyY2VzIjpbInRoaW5rYmFjay50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhlY2EgfSBmcm9tICdleGVjYSdcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IFNlbGVjdCB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQ3VzdG9tU2VsZWN0L3NlbGVjdC5qcydcbmltcG9ydCB7IERpYWxvZyB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9TcGlubmVyLmpzJ1xuaW1wb3J0IGluc3RhbmNlcyBmcm9tICcuLi8uLi9pbmsvaW5zdGFuY2VzLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgZW5hYmxlUGx1Z2luT3AgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wbHVnaW5zL3BsdWdpbk9wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi8uLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IGlzRU5PRU5ULCB0b0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgZXhlY0ZpbGVOb1Rocm93IH0gZnJvbSAnLi4vLi4vdXRpbHMvZXhlY0ZpbGVOb1Rocm93LmpzJ1xuaW1wb3J0IHsgcGF0aEV4aXN0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2ZpbGUuanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7IGdldFBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGxhdGZvcm0uanMnXG5pbXBvcnQgeyBjbGVhckFsbENhY2hlcyB9IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvY2FjaGVVdGlscy5qcydcbmltcG9ydCB7IGlzUGx1Z2luSW5zdGFsbGVkIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9pbnN0YWxsZWRQbHVnaW5zTWFuYWdlci5qcydcbmltcG9ydCB7XG4gIGFkZE1hcmtldHBsYWNlU291cmNlLFxuICBjbGVhck1hcmtldHBsYWNlc0NhY2hlLFxuICBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcsXG4gIHJlZnJlc2hNYXJrZXRwbGFjZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZU1hbmFnZXIuanMnXG5pbXBvcnQgeyBPRkZJQ0lBTF9NQVJLRVRQTEFDRV9OQU1FIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9vZmZpY2lhbE1hcmtldHBsYWNlLmpzJ1xuaW1wb3J0IHsgbG9hZEFsbFBsdWdpbnMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpbkxvYWRlci5qcydcbmltcG9ydCB7IGluc3RhbGxTZWxlY3RlZFBsdWdpbnMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpblN0YXJ0dXBDaGVjay5qcydcblxuLy8gTWFya2V0cGxhY2UgYW5kIHBsdWdpbiBpZGVudGlmaWVycyAtIHZhcmllcyBieSB1c2VyIHR5cGVcbmNvbnN0IElOVEVSTkFMX01BUktFVFBMQUNFX05BTUUgPSAnY2xhdWRlLWNvZGUtbWFya2V0cGxhY2UnXG5jb25zdCBJTlRFUk5BTF9NQVJLRVRQTEFDRV9SRVBPID0gJ2FudGhyb3BpY3MvY2xhdWRlLWNvZGUtbWFya2V0cGxhY2UnXG5jb25zdCBPRkZJQ0lBTF9NQVJLRVRQTEFDRV9SRVBPID0gJ2FudGhyb3BpY3MvY2xhdWRlLXBsdWdpbnMtb2ZmaWNpYWwnXG5cbmZ1bmN0aW9uIGdldE1hcmtldHBsYWNlTmFtZSgpOiBzdHJpbmcge1xuICByZXR1cm4gXCJleHRlcm5hbFwiID09PSAnYW50J1xuICAgID8gSU5URVJOQUxfTUFSS0VUUExBQ0VfTkFNRVxuICAgIDogT0ZGSUNJQUxfTUFSS0VUUExBQ0VfTkFNRVxufVxuXG5mdW5jdGlvbiBnZXRNYXJrZXRwbGFjZVJlcG8oKTogc3RyaW5nIHtcbiAgcmV0dXJuIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgICA/IElOVEVSTkFMX01BUktFVFBMQUNFX1JFUE9cbiAgICA6IE9GRklDSUFMX01BUktFVFBMQUNFX1JFUE9cbn1cblxuZnVuY3Rpb24gZ2V0UGx1Z2luSWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGB0aGlua2JhY2tAJHtnZXRNYXJrZXRwbGFjZU5hbWUoKX1gXG59XG5cbmNvbnN0IFNLSUxMX05BTUUgPSAndGhpbmtiYWNrJ1xuXG4vKipcbiAqIEdldCB0aGUgdGhpbmtiYWNrIHNraWxsIGRpcmVjdG9yeSBmcm9tIHRoZSBpbnN0YWxsZWQgcGx1Z2luJ3MgY2FjaGUgcGF0aFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRUaGlua2JhY2tTa2lsbERpcigpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgeyBlbmFibGVkIH0gPSBhd2FpdCBsb2FkQWxsUGx1Z2lucygpXG4gIGNvbnN0IHRoaW5rYmFja1BsdWdpbiA9IGVuYWJsZWQuZmluZChcbiAgICBwID0+XG4gICAgICBwLm5hbWUgPT09ICd0aGlua2JhY2snIHx8IChwLnNvdXJjZSAmJiBwLnNvdXJjZS5pbmNsdWRlcyhnZXRQbHVnaW5JZCgpKSksXG4gIClcblxuICBpZiAoIXRoaW5rYmFja1BsdWdpbikge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBjb25zdCBza2lsbERpciA9IGpvaW4odGhpbmtiYWNrUGx1Z2luLnBhdGgsICdza2lsbHMnLCBTS0lMTF9OQU1FKVxuICBpZiAoYXdhaXQgcGF0aEV4aXN0cyhza2lsbERpcikpIHtcbiAgICByZXR1cm4gc2tpbGxEaXJcbiAgfVxuXG4gIHJldHVybiBudWxsXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwbGF5QW5pbWF0aW9uKHNraWxsRGlyOiBzdHJpbmcpOiBQcm9taXNlPHtcbiAgc3VjY2VzczogYm9vbGVhblxuICBtZXNzYWdlOiBzdHJpbmdcbn0+IHtcbiAgY29uc3QgZGF0YVBhdGggPSBqb2luKHNraWxsRGlyLCAneWVhcl9pbl9yZXZpZXcuanMnKVxuICBjb25zdCBwbGF5ZXJQYXRoID0gam9pbihza2lsbERpciwgJ3BsYXllci5qcycpXG5cbiAgLy8gQm90aCBmaWxlcyBhcmUgcHJlcmVxdWlzaXRlcyBmb3IgdGhlIG5vZGUgc3VicHJvY2Vzcy4gUmVhZCB0aGVtIGhlcmVcbiAgLy8gKG5vdCBhdCBjYWxsIHNpdGVzKSBzbyBhbGwgY2FsbGVycyBnZXQgY29uc2lzdGVudCBlcnJvciBtZXNzYWdpbmcuIFRoZVxuICAvLyBzdWJwcm9jZXNzIHJ1bnMgd2l0aCByZWplY3Q6IGZhbHNlLCBzbyBhIG1pc3NpbmcgZmlsZSB3b3VsZCBvdGhlcndpc2VcbiAgLy8gc2lsZW50bHkgcmV0dXJuIHN1Y2Nlc3MuIFVzaW5nIHJlYWRGaWxlIChub3QgYWNjZXNzKSBwZXIgQ0xBVURFLm1kLlxuICAvL1xuICAvLyBOb24tRU5PRU5UIGVycm9ycyAoRUFDQ0VTIGV0YykgYXJlIGxvZ2dlZCBhbmQgcmV0dXJuZWQgYXMgZmFpbHVyZXMgcmF0aGVyXG4gIC8vIHRoYW4gdGhyb3duIOKAlCB0aGUgb2xkIHBhdGhFeGlzdHMtYmFzZWQgY29kZSBuZXZlciB0aHJldywgYW5kIG9uZSBjYWxsZXJcbiAgLy8gKGhhbmRsZVNlbGVjdCkgdXNlcyBgdm9pZCBwbGF5QW5pbWF0aW9uKCkudGhlbiguLi4pYCB3aXRob3V0IGEgLmNhdGNoKCkuXG4gIHRyeSB7XG4gICAgYXdhaXQgcmVhZEZpbGUoZGF0YVBhdGgpXG4gIH0gY2F0Y2ggKGU6IHVua25vd24pIHtcbiAgICBpZiAoaXNFTk9FTlQoZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiAnTm8gYW5pbWF0aW9uIGZvdW5kLiBSdW4gL3RoaW5rLWJhY2sgZmlyc3QgdG8gZ2VuZXJhdGUgb25lLicsXG4gICAgICB9XG4gICAgfVxuICAgIGxvZ0Vycm9yKGUpXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBhY2Nlc3MgYW5pbWF0aW9uIGRhdGE6ICR7dG9FcnJvcihlKS5tZXNzYWdlfWAsXG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCByZWFkRmlsZShwbGF5ZXJQYXRoKVxuICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgaWYgKGlzRU5PRU5UKGUpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTpcbiAgICAgICAgICAnUGxheWVyIHNjcmlwdCBub3QgZm91bmQuIFRoZSBwbGF5ZXIuanMgZmlsZSBpcyBtaXNzaW5nIGZyb20gdGhlIHRoaW5rYmFjayBza2lsbC4nLFxuICAgICAgfVxuICAgIH1cbiAgICBsb2dFcnJvcihlKVxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3QgYWNjZXNzIHBsYXllciBzY3JpcHQ6ICR7dG9FcnJvcihlKS5tZXNzYWdlfWAsXG4gICAgfVxuICB9XG5cbiAgLy8gR2V0IGluayBpbnN0YW5jZSBmb3IgdGVybWluYWwgdGFrZW92ZXJcbiAgY29uc3QgaW5rSW5zdGFuY2UgPSBpbnN0YW5jZXMuZ2V0KHByb2Nlc3Muc3Rkb3V0KVxuICBpZiAoIWlua0luc3RhbmNlKSB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdGYWlsZWQgdG8gYWNjZXNzIHRlcm1pbmFsIGluc3RhbmNlJyB9XG4gIH1cblxuICBpbmtJbnN0YW5jZS5lbnRlckFsdGVybmF0ZVNjcmVlbigpXG4gIHRyeSB7XG4gICAgYXdhaXQgZXhlY2EoJ25vZGUnLCBbcGxheWVyUGF0aF0sIHtcbiAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgICBjd2Q6IHNraWxsRGlyLFxuICAgICAgcmVqZWN0OiBmYWxzZSxcbiAgICB9KVxuICB9IGNhdGNoIHtcbiAgICAvLyBBbmltYXRpb24gbWF5IGhhdmUgYmVlbiBpbnRlcnJ1cHRlZCAoZS5nLiwgQ3RybCtDKVxuICB9IGZpbmFsbHkge1xuICAgIGlua0luc3RhbmNlLmV4aXRBbHRlcm5hdGVTY3JlZW4oKVxuICB9XG5cbiAgLy8gT3BlbiB0aGUgSFRNTCBmaWxlIGluIGJyb3dzZXIgZm9yIHZpZGVvIGRvd25sb2FkXG4gIGNvbnN0IGh0bWxQYXRoID0gam9pbihza2lsbERpciwgJ3llYXJfaW5fcmV2aWV3Lmh0bWwnKVxuICBpZiAoYXdhaXQgcGF0aEV4aXN0cyhodG1sUGF0aCkpIHtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IGdldFBsYXRmb3JtKClcbiAgICBjb25zdCBvcGVuQ21kID1cbiAgICAgIHBsYXRmb3JtID09PSAnbWFjb3MnXG4gICAgICAgID8gJ29wZW4nXG4gICAgICAgIDogcGxhdGZvcm0gPT09ICd3aW5kb3dzJ1xuICAgICAgICAgID8gJ3N0YXJ0J1xuICAgICAgICAgIDogJ3hkZy1vcGVuJ1xuICAgIHZvaWQgZXhlY0ZpbGVOb1Rocm93KG9wZW5DbWQsIFtodG1sUGF0aF0pXG4gIH1cblxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnWWVhciBpbiByZXZpZXcgYW5pbWF0aW9uIGNvbXBsZXRlIScgfVxufVxuXG50eXBlIEluc3RhbGxTdGF0ZSA9XG4gIHwgeyBwaGFzZTogJ2NoZWNraW5nJyB9XG4gIHwgeyBwaGFzZTogJ2luc3RhbGxpbmctbWFya2V0cGxhY2UnIH1cbiAgfCB7IHBoYXNlOiAnaW5zdGFsbGluZy1wbHVnaW4nIH1cbiAgfCB7IHBoYXNlOiAnZW5hYmxpbmctcGx1Z2luJyB9XG4gIHwgeyBwaGFzZTogJ3JlYWR5JyB9XG4gIHwgeyBwaGFzZTogJ2Vycm9yJzsgbWVzc2FnZTogc3RyaW5nIH1cblxuZnVuY3Rpb24gVGhpbmtiYWNrSW5zdGFsbGVyKHtcbiAgb25SZWFkeSxcbiAgb25FcnJvcixcbn06IHtcbiAgb25SZWFkeTogKCkgPT4gdm9pZFxuICBvbkVycm9yOiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW3N0YXRlLCBzZXRTdGF0ZV0gPSB1c2VTdGF0ZTxJbnN0YWxsU3RhdGU+KHsgcGhhc2U6ICdjaGVja2luZycgfSlcbiAgY29uc3QgW3Byb2dyZXNzTWVzc2FnZSwgc2V0UHJvZ3Jlc3NNZXNzYWdlXSA9IHVzZVN0YXRlKCcnKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tBbmRJbnN0YWxsKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgbWFya2V0cGxhY2UgaXMgaW5zdGFsbGVkXG4gICAgICAgIGNvbnN0IGtub3duTWFya2V0cGxhY2VzID0gYXdhaXQgbG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnKClcbiAgICAgICAgY29uc3QgbWFya2V0cGxhY2VOYW1lID0gZ2V0TWFya2V0cGxhY2VOYW1lKClcbiAgICAgICAgY29uc3QgbWFya2V0cGxhY2VSZXBvID0gZ2V0TWFya2V0cGxhY2VSZXBvKClcbiAgICAgICAgY29uc3QgcGx1Z2luSWQgPSBnZXRQbHVnaW5JZCgpXG4gICAgICAgIGNvbnN0IG1hcmtldHBsYWNlSW5zdGFsbGVkID0gbWFya2V0cGxhY2VOYW1lIGluIGtub3duTWFya2V0cGxhY2VzXG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgcGx1Z2luIGlzIGFscmVhZHkgaW5zdGFsbGVkIGZpcnN0XG4gICAgICAgIGNvbnN0IHBsdWdpbkFscmVhZHlJbnN0YWxsZWQgPSBpc1BsdWdpbkluc3RhbGxlZChwbHVnaW5JZClcblxuICAgICAgICBpZiAoIW1hcmtldHBsYWNlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgLy8gSW5zdGFsbCB0aGUgbWFya2V0cGxhY2VcbiAgICAgICAgICBzZXRTdGF0ZSh7IHBoYXNlOiAnaW5zdGFsbGluZy1tYXJrZXRwbGFjZScgfSlcbiAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYEluc3RhbGxpbmcgbWFya2V0cGxhY2UgJHttYXJrZXRwbGFjZVJlcG99YClcblxuICAgICAgICAgIGF3YWl0IGFkZE1hcmtldHBsYWNlU291cmNlKFxuICAgICAgICAgICAgeyBzb3VyY2U6ICdnaXRodWInLCByZXBvOiBtYXJrZXRwbGFjZVJlcG8gfSxcbiAgICAgICAgICAgIG1lc3NhZ2UgPT4ge1xuICAgICAgICAgICAgICBzZXRQcm9ncmVzc01lc3NhZ2UobWVzc2FnZSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICAgIGNsZWFyQWxsQ2FjaGVzKClcbiAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYE1hcmtldHBsYWNlICR7bWFya2V0cGxhY2VOYW1lfSBpbnN0YWxsZWRgKVxuICAgICAgICB9IGVsc2UgaWYgKCFwbHVnaW5BbHJlYWR5SW5zdGFsbGVkKSB7XG4gICAgICAgICAgLy8gTWFya2V0cGxhY2UgaW5zdGFsbGVkIGJ1dCBwbHVnaW4gbm90IGluc3RhbGxlZCAtIHJlZnJlc2ggdG8gZ2V0IGxhdGVzdCBwbHVnaW5zXG4gICAgICAgICAgLy8gT25seSByZWZyZXNoIHdoZW4gbmVlZGVkIHRvIGF2b2lkIHBvdGVudGlhbGx5IGRlc3RydWN0aXZlIGdpdCBvcGVyYXRpb25zXG4gICAgICAgICAgc2V0U3RhdGUoeyBwaGFzZTogJ2luc3RhbGxpbmctbWFya2V0cGxhY2UnIH0pXG4gICAgICAgICAgc2V0UHJvZ3Jlc3NNZXNzYWdlKCdVcGRhdGluZyBtYXJrZXRwbGFjZeKApicpXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBSZWZyZXNoaW5nIG1hcmtldHBsYWNlICR7bWFya2V0cGxhY2VOYW1lfWApXG5cbiAgICAgICAgICBhd2FpdCByZWZyZXNoTWFya2V0cGxhY2UobWFya2V0cGxhY2VOYW1lLCBtZXNzYWdlID0+IHtcbiAgICAgICAgICAgIHNldFByb2dyZXNzTWVzc2FnZShtZXNzYWdlKVxuICAgICAgICAgIH0pXG4gICAgICAgICAgY2xlYXJNYXJrZXRwbGFjZXNDYWNoZSgpXG4gICAgICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgTWFya2V0cGxhY2UgJHttYXJrZXRwbGFjZU5hbWV9IHJlZnJlc2hlZGApXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXBsdWdpbkFscmVhZHlJbnN0YWxsZWQpIHtcbiAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBwbHVnaW5cbiAgICAgICAgICBzZXRTdGF0ZSh7IHBoYXNlOiAnaW5zdGFsbGluZy1wbHVnaW4nIH0pXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBJbnN0YWxsaW5nIHBsdWdpbiAke3BsdWdpbklkfWApXG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnN0YWxsU2VsZWN0ZWRQbHVnaW5zKFtwbHVnaW5JZF0pXG5cbiAgICAgICAgICBpZiAocmVzdWx0LmZhaWxlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBlcnJvck1zZyA9IHJlc3VsdC5mYWlsZWRcbiAgICAgICAgICAgICAgLm1hcChmID0+IGAke2YubmFtZX06ICR7Zi5lcnJvcn1gKVxuICAgICAgICAgICAgICAuam9pbignLCAnKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gaW5zdGFsbCBwbHVnaW46ICR7ZXJyb3JNc2d9YClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjbGVhckFsbENhY2hlcygpXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBQbHVnaW4gJHtwbHVnaW5JZH0gaW5zdGFsbGVkYClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQbHVnaW4gaXMgaW5zdGFsbGVkLCBjaGVjayBpZiBpdCdzIGVuYWJsZWRcbiAgICAgICAgICBjb25zdCB7IGRpc2FibGVkIH0gPSBhd2FpdCBsb2FkQWxsUGx1Z2lucygpXG4gICAgICAgICAgY29uc3QgaXNEaXNhYmxlZCA9IGRpc2FibGVkLnNvbWUoXG4gICAgICAgICAgICBwID0+IHAubmFtZSA9PT0gJ3RoaW5rYmFjaycgfHwgcC5zb3VyY2U/LmluY2x1ZGVzKHBsdWdpbklkKSxcbiAgICAgICAgICApXG5cbiAgICAgICAgICBpZiAoaXNEaXNhYmxlZCkge1xuICAgICAgICAgICAgLy8gRW5hYmxlIHRoZSBwbHVnaW5cbiAgICAgICAgICAgIHNldFN0YXRlKHsgcGhhc2U6ICdlbmFibGluZy1wbHVnaW4nIH0pXG4gICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYEVuYWJsaW5nIHBsdWdpbiAke3BsdWdpbklkfWApXG5cbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZVJlc3VsdCA9IGF3YWl0IGVuYWJsZVBsdWdpbk9wKHBsdWdpbklkKVxuICAgICAgICAgICAgaWYgKCFlbmFibGVSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZhaWxlZCB0byBlbmFibGUgcGx1Z2luOiAke2VuYWJsZVJlc3VsdC5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBQbHVnaW4gJHtwbHVnaW5JZH0gZW5hYmxlZGApXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2V0U3RhdGUoeyBwaGFzZTogJ3JlYWR5JyB9KVxuICAgICAgICBvblJlYWR5KClcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IHRvRXJyb3IoZXJyb3IpXG4gICAgICAgIGxvZ0Vycm9yKGVycilcbiAgICAgICAgc2V0U3RhdGUoeyBwaGFzZTogJ2Vycm9yJywgbWVzc2FnZTogZXJyLm1lc3NhZ2UgfSlcbiAgICAgICAgb25FcnJvcihlcnIubWVzc2FnZSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2b2lkIGNoZWNrQW5kSW5zdGFsbCgpXG4gIH0sIFtvblJlYWR5LCBvbkVycm9yXSlcblxuICBpZiAoc3RhdGUucGhhc2UgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5FcnJvcjoge3N0YXRlLm1lc3NhZ2V9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKHN0YXRlLnBoYXNlID09PSAncmVhZHknKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGNvbnN0IHN0YXR1c01lc3NhZ2UgPVxuICAgIHN0YXRlLnBoYXNlID09PSAnY2hlY2tpbmcnXG4gICAgICA/ICdDaGVja2luZyB0aGlua2JhY2sgaW5zdGFsbGF0aW9u4oCmJ1xuICAgICAgOiBzdGF0ZS5waGFzZSA9PT0gJ2luc3RhbGxpbmctbWFya2V0cGxhY2UnXG4gICAgICAgID8gJ0luc3RhbGxpbmcgbWFya2V0cGxhY2XigKYnXG4gICAgICAgIDogc3RhdGUucGhhc2UgPT09ICdlbmFibGluZy1wbHVnaW4nXG4gICAgICAgICAgPyAnRW5hYmxpbmcgdGhpbmtiYWNrIHBsdWdpbuKApidcbiAgICAgICAgICA6ICdJbnN0YWxsaW5nIHRoaW5rYmFjayBwbHVnaW7igKYnXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxCb3g+XG4gICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgIDxUZXh0Pntwcm9ncmVzc01lc3NhZ2UgfHwgc3RhdHVzTWVzc2FnZX08L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG50eXBlIE1lbnVBY3Rpb24gPSAncGxheScgfCAnZWRpdCcgfCAnZml4JyB8ICdyZWdlbmVyYXRlJ1xudHlwZSBHZW5lcmF0aXZlQWN0aW9uID0gRXhjbHVkZTxNZW51QWN0aW9uLCAncGxheSc+XG5cbmZ1bmN0aW9uIFRoaW5rYmFja01lbnUoe1xuICBvbkRvbmUsXG4gIG9uQWN0aW9uLFxuICBza2lsbERpcixcbiAgaGFzR2VuZXJhdGVkLFxufToge1xuICBvbkRvbmU6IChcbiAgICByZXN1bHQ/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5OyBzaG91bGRRdWVyeT86IGJvb2xlYW4gfSxcbiAgKSA9PiB2b2lkXG4gIG9uQWN0aW9uOiAoYWN0aW9uOiBHZW5lcmF0aXZlQWN0aW9uKSA9PiB2b2lkXG4gIHNraWxsRGlyOiBzdHJpbmdcbiAgaGFzR2VuZXJhdGVkOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW2hhc1NlbGVjdGVkLCBzZXRIYXNTZWxlY3RlZF0gPSB1c2VTdGF0ZShmYWxzZSlcblxuICBjb25zdCBvcHRpb25zID0gaGFzR2VuZXJhdGVkXG4gICAgPyBbXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ1BsYXkgYW5pbWF0aW9uJyxcbiAgICAgICAgICB2YWx1ZTogJ3BsYXknIGFzIGNvbnN0LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnV2F0Y2ggeW91ciB5ZWFyIGluIHJldmlldycsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ0VkaXQgY29udGVudCcsXG4gICAgICAgICAgdmFsdWU6ICdlZGl0JyBhcyBjb25zdCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ01vZGlmeSB0aGUgYW5pbWF0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiAnRml4IGVycm9ycycsXG4gICAgICAgICAgdmFsdWU6ICdmaXgnIGFzIGNvbnN0LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRml4IHZhbGlkYXRpb24gb3IgcmVuZGVyaW5nIGlzc3VlcycsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ1JlZ2VuZXJhdGUnLFxuICAgICAgICAgIHZhbHVlOiAncmVnZW5lcmF0ZScgYXMgY29uc3QsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgYW5pbWF0aW9uIGZyb20gc2NyYXRjaCcsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogXCJMZXQncyBnbyFcIixcbiAgICAgICAgICB2YWx1ZTogJ3JlZ2VuZXJhdGUnIGFzIGNvbnN0LFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgeW91ciBwZXJzb25hbGl6ZWQgYW5pbWF0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgIF1cblxuICBmdW5jdGlvbiBoYW5kbGVTZWxlY3QodmFsdWU6IE1lbnVBY3Rpb24pOiB2b2lkIHtcbiAgICBzZXRIYXNTZWxlY3RlZCh0cnVlKVxuICAgIGlmICh2YWx1ZSA9PT0gJ3BsYXknKSB7XG4gICAgICAvLyBQbGF5IHJ1bnMgdGhlIHRlcm1pbmFsLXRha2VvdmVyIGFuaW1hdGlvbiwgdGhlbiBzaWduYWwgZG9uZSB3aXRoIHNraXBcbiAgICAgIHZvaWQgcGxheUFuaW1hdGlvbihza2lsbERpcikudGhlbigoKSA9PiB7XG4gICAgICAgIG9uRG9uZSh1bmRlZmluZWQsIHsgZGlzcGxheTogJ3NraXAnIH0pXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBvbkFjdGlvbih2YWx1ZSlcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVDYW5jZWwoKTogdm9pZCB7XG4gICAgb25Eb25lKHVuZGVmaW5lZCwgeyBkaXNwbGF5OiAnc2tpcCcgfSlcbiAgfVxuXG4gIGlmIChoYXNTZWxlY3RlZCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxEaWFsb2dcbiAgICAgIHRpdGxlPVwiVGhpbmsgQmFjayBvbiAyMDI1IHdpdGggQ2xhdWRlIENvZGVcIlxuICAgICAgc3VidGl0bGU9XCJHZW5lcmF0ZSB5b3VyIDIwMjUgQ2xhdWRlIENvZGUgVGhpbmsgQmFjayAodGFrZXMgYSBmZXcgbWludXRlcyB0byBydW4pXCJcbiAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICBjb2xvcj1cImNsYXVkZVwiXG4gICAgPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgey8qIERlc2NyaXB0aW9uIGZvciBmaXJzdC10aW1lIHVzZXJzICovfVxuICAgICAgICB7IWhhc0dlbmVyYXRlZCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dD5SZWxpdmUgeW91ciB5ZWFyIG9mIGNvZGluZyB3aXRoIENsYXVkZS48L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiV2UnbGwgY3JlYXRlIGEgcGVyc29uYWxpemVkIEFTQ0lJIGFuaW1hdGlvbiBjZWxlYnJhdGluZyB5b3VyIGpvdXJuZXkuXCJcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBNZW51ICovfVxuICAgICAgICA8U2VsZWN0XG4gICAgICAgICAgb3B0aW9ucz17b3B0aW9uc31cbiAgICAgICAgICBvbkNoYW5nZT17aGFuZGxlU2VsZWN0fVxuICAgICAgICAgIHZpc2libGVPcHRpb25Db3VudD17NX1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgIDwvRGlhbG9nPlxuICApXG59XG5cbmNvbnN0IEVESVRfUFJPTVBUID1cbiAgJ1VzZSB0aGUgU2tpbGwgdG9vbCB0byBpbnZva2UgdGhlIFwidGhpbmtiYWNrXCIgc2tpbGwgd2l0aCBtb2RlPWVkaXQgdG8gbW9kaWZ5IG15IGV4aXN0aW5nIENsYXVkZSBDb2RlIHllYXIgaW4gcmV2aWV3IGFuaW1hdGlvbi4gQXNrIG1lIHdoYXQgSSB3YW50IHRvIGNoYW5nZS4gV2hlbiB0aGUgYW5pbWF0aW9uIGlzIHJlYWR5LCB0ZWxsIHRoZSB1c2VyIHRvIHJ1biAvdGhpbmstYmFjayBhZ2FpbiB0byBwbGF5IGl0LidcblxuY29uc3QgRklYX1BST01QVCA9XG4gICdVc2UgdGhlIFNraWxsIHRvb2wgdG8gaW52b2tlIHRoZSBcInRoaW5rYmFja1wiIHNraWxsIHdpdGggbW9kZT1maXggdG8gZml4IHZhbGlkYXRpb24gb3IgcmVuZGVyaW5nIGVycm9ycyBpbiBteSBleGlzdGluZyBDbGF1ZGUgQ29kZSB5ZWFyIGluIHJldmlldyBhbmltYXRpb24uIFJ1biB0aGUgdmFsaWRhdG9yLCBpZGVudGlmeSBlcnJvcnMsIGFuZCBmaXggdGhlbS4gV2hlbiB0aGUgYW5pbWF0aW9uIGlzIHJlYWR5LCB0ZWxsIHRoZSB1c2VyIHRvIHJ1biAvdGhpbmstYmFjayBhZ2FpbiB0byBwbGF5IGl0LidcblxuY29uc3QgUkVHRU5FUkFURV9QUk9NUFQgPVxuICAnVXNlIHRoZSBTa2lsbCB0b29sIHRvIGludm9rZSB0aGUgXCJ0aGlua2JhY2tcIiBza2lsbCB3aXRoIG1vZGU9cmVnZW5lcmF0ZSB0byBjcmVhdGUgYSBjb21wbGV0ZWx5IG5ldyBDbGF1ZGUgQ29kZSB5ZWFyIGluIHJldmlldyBhbmltYXRpb24gZnJvbSBzY3JhdGNoLiBEZWxldGUgdGhlIGV4aXN0aW5nIGFuaW1hdGlvbiBhbmQgc3RhcnQgZnJlc2guIFdoZW4gdGhlIGFuaW1hdGlvbiBpcyByZWFkeSwgdGVsbCB0aGUgdXNlciB0byBydW4gL3RoaW5rLWJhY2sgYWdhaW4gdG8gcGxheSBpdC4nXG5cbmZ1bmN0aW9uIFRoaW5rYmFja0Zsb3coe1xuICBvbkRvbmUsXG59OiB7XG4gIG9uRG9uZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXk7IHNob3VsZFF1ZXJ5PzogYm9vbGVhbiB9LFxuICApID0+IHZvaWRcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbaW5zdGFsbENvbXBsZXRlLCBzZXRJbnN0YWxsQ29tcGxldGVdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtpbnN0YWxsRXJyb3IsIHNldEluc3RhbGxFcnJvcl0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCBbc2tpbGxEaXIsIHNldFNraWxsRGlyXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtoYXNHZW5lcmF0ZWQsIHNldEhhc0dlbmVyYXRlZF0gPSB1c2VTdGF0ZTxib29sZWFuIHwgbnVsbD4obnVsbClcblxuICBmdW5jdGlvbiBoYW5kbGVSZWFkeSgpOiB2b2lkIHtcbiAgICBzZXRJbnN0YWxsQ29tcGxldGUodHJ1ZSlcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZUVycm9yID0gdXNlQ2FsbGJhY2soXG4gICAgKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgc2V0SW5zdGFsbEVycm9yKG1lc3NhZ2UpXG4gICAgICAvLyBDYWxsIG9uRG9uZSB3aXRoIHRoZSBlcnJvciBtZXNzYWdlIHNvIHRoZSBtb2RlbCBjYW4gY29udGludWVcbiAgICAgIG9uRG9uZShcbiAgICAgICAgYEVycm9yIHdpdGggdGhpbmtiYWNrOiAke21lc3NhZ2V9LiBUcnkgcnVubmluZyAvcGx1Z2luIHRvIG1hbnVhbGx5IGluc3RhbGwgdGhlIHRoaW5rLWJhY2sgcGx1Z2luLmAsXG4gICAgICAgIHsgZGlzcGxheTogJ3N5c3RlbScgfSxcbiAgICAgIClcbiAgICB9LFxuICAgIFtvbkRvbmVdLFxuICApXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaW5zdGFsbENvbXBsZXRlICYmICFza2lsbERpciAmJiAhaW5zdGFsbEVycm9yKSB7XG4gICAgICAvLyBHZXQgdGhlIHNraWxsIGRpcmVjdG9yeSBhZnRlciBpbnN0YWxsYXRpb25cbiAgICAgIHZvaWQgZ2V0VGhpbmtiYWNrU2tpbGxEaXIoKS50aGVuKGRpciA9PiB7XG4gICAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYFRoaW5rYmFjayBza2lsbCBkaXJlY3Rvcnk6ICR7ZGlyfWApXG4gICAgICAgICAgc2V0U2tpbGxEaXIoZGlyKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhbmRsZUVycm9yKCdDb3VsZCBub3QgZmluZCB0aGlua2JhY2sgc2tpbGwgZGlyZWN0b3J5JylcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sIFtpbnN0YWxsQ29tcGxldGUsIHNraWxsRGlyLCBpbnN0YWxsRXJyb3IsIGhhbmRsZUVycm9yXSlcblxuICAvLyBDaGVjayBmb3IgZ2VuZXJhdGVkIGZpbGUgb25jZSB3ZSBoYXZlIHNraWxsRGlyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFza2lsbERpcikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgZGF0YVBhdGggPSBqb2luKHNraWxsRGlyLCAneWVhcl9pbl9yZXZpZXcuanMnKVxuICAgIHZvaWQgcGF0aEV4aXN0cyhkYXRhUGF0aCkudGhlbihleGlzdHMgPT4ge1xuICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICBgQ2hlY2tpbmcgZm9yICR7ZGF0YVBhdGh9OiAke2V4aXN0cyA/ICdmb3VuZCcgOiAnbm90IGZvdW5kJ31gLFxuICAgICAgKVxuICAgICAgc2V0SGFzR2VuZXJhdGVkKGV4aXN0cylcbiAgICB9KVxuICB9LCBbc2tpbGxEaXJdKVxuXG4gIGZ1bmN0aW9uIGhhbmRsZUFjdGlvbihhY3Rpb246IEdlbmVyYXRpdmVBY3Rpb24pOiB2b2lkIHtcbiAgICAvLyBTZW5kIHByb21wdCB0byBtb2RlbCBiYXNlZCBvbiBhY3Rpb25cbiAgICBjb25zdCBwcm9tcHRzOiBSZWNvcmQ8R2VuZXJhdGl2ZUFjdGlvbiwgc3RyaW5nPiA9IHtcbiAgICAgIGVkaXQ6IEVESVRfUFJPTVBULFxuICAgICAgZml4OiBGSVhfUFJPTVBULFxuICAgICAgcmVnZW5lcmF0ZTogUkVHRU5FUkFURV9QUk9NUFQsXG4gICAgfVxuICAgIG9uRG9uZShwcm9tcHRzW2FjdGlvbl0sIHsgZGlzcGxheTogJ3VzZXInLCBzaG91bGRRdWVyeTogdHJ1ZSB9KVxuICB9XG5cbiAgaWYgKGluc3RhbGxFcnJvcikge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPkVycm9yOiB7aW5zdGFsbEVycm9yfTwvVGV4dD5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgVHJ5IHJ1bm5pbmcgL3BsdWdpbiB0byBtYW51YWxseSBpbnN0YWxsIHRoZSB0aGluay1iYWNrIHBsdWdpbi5cbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKCFpbnN0YWxsQ29tcGxldGUpIHtcbiAgICByZXR1cm4gPFRoaW5rYmFja0luc3RhbGxlciBvblJlYWR5PXtoYW5kbGVSZWFkeX0gb25FcnJvcj17aGFuZGxlRXJyb3J9IC8+XG4gIH1cblxuICBpZiAoIXNraWxsRGlyIHx8IGhhc0dlbmVyYXRlZCA9PT0gbnVsbCkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94PlxuICAgICAgICA8U3Bpbm5lciAvPlxuICAgICAgICA8VGV4dD5Mb2FkaW5nIHRoaW5rYmFjayBza2lsbOKApjwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPFRoaW5rYmFja01lbnVcbiAgICAgIG9uRG9uZT17b25Eb25lfVxuICAgICAgb25BY3Rpb249e2hhbmRsZUFjdGlvbn1cbiAgICAgIHNraWxsRGlyPXtza2lsbERpcn1cbiAgICAgIGhhc0dlbmVyYXRlZD17aGFzR2VuZXJhdGVkfVxuICAgIC8+XG4gIClcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGwoXG4gIG9uRG9uZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXk7IHNob3VsZFF1ZXJ5PzogYm9vbGVhbiB9LFxuICApID0+IHZvaWQsXG4pOiBQcm9taXNlPFJlYWN0LlJlYWN0Tm9kZT4ge1xuICByZXR1cm4gPFRoaW5rYmFja0Zsb3cgb25Eb25lPXtvbkRvbmV9IC8+XG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxLQUFLLFFBQVEsT0FBTztBQUM3QixTQUFTQyxRQUFRLFFBQVEsYUFBYTtBQUN0QyxTQUFTQyxJQUFJLFFBQVEsTUFBTTtBQUMzQixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFdBQVcsRUFBRUMsU0FBUyxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUN4RCxjQUFjQyxvQkFBb0IsUUFBUSxtQkFBbUI7QUFDN0QsU0FBU0MsTUFBTSxRQUFRLHlDQUF5QztBQUNoRSxTQUFTQyxNQUFNLFFBQVEsMENBQTBDO0FBQ2pFLFNBQVNDLE9BQU8sUUFBUSw2QkFBNkI7QUFDckQsT0FBT0MsU0FBUyxNQUFNLHdCQUF3QjtBQUM5QyxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFj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