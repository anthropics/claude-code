import chalk from 'chalk';
import { randomBytes } from 'crypto';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { homedir, platform } from 'os';
import { dirname, join } from 'path';
import type { ThemeName } from 'src/utils/theme.js';
import { pathToFileURL } from 'url';
import { supportsHyperlinks } from '../../ink/supports-hyperlinks.js';
import { color } from '../../ink.js';
import { maybeMarkProjectOnboardingComplete } from '../../projectOnboardingState.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { backupTerminalPreferences, checkAndRestoreTerminalBackup, getTerminalPlistPath, markTerminalSetupComplete } from '../../utils/appleTerminalBackup.js';
import { setupShellCompletion } from '../../utils/completionCache.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { env } from '../../utils/env.js';
import { isFsInaccessible } from '../../utils/errors.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { addItemToJSONCArray, safeParseJSONC } from '../../utils/json.js';
import { logError } from '../../utils/log.js';
import { getPlatform } from '../../utils/platform.js';
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js';
const EOL = '\n';

// Terminals that natively support CSI u / Kitty keyboard protocol
const NATIVE_CSIU_TERMINALS: Record<string, string> = {
  ghostty: 'Ghostty',
  kitty: 'Kitty',
  'iTerm.app': 'iTerm2',
  WezTerm: 'WezTerm',
  WarpTerminal: 'Warp'
};

/**
 * Detect if we're running in a VSCode Remote SSH session.
 * In this case, keybindings need to be installed on the LOCAL machine,
 * not the remote server where Claude is running.
 */
function isVSCodeRemoteSSH(): boolean {
  const askpassMain = process.env.VSCODE_GIT_ASKPASS_MAIN ?? '';
  const path = process.env.PATH ?? '';

  // Check both env vars - VSCODE_GIT_ASKPASS_MAIN is more reliable when git extension
  // is active, and PATH is a fallback. Omit path separator for Windows compatibility.
  return askpassMain.includes('.vscode-server') || askpassMain.includes('.cursor-server') || askpassMain.includes('.windsurf-server') || path.includes('.vscode-server') || path.includes('.cursor-server') || path.includes('.windsurf-server');
}
export function getNativeCSIuTerminalDisplayName(): string | null {
  if (!env.terminal || !(env.terminal in NATIVE_CSIU_TERMINALS)) {
    return null;
  }
  return NATIVE_CSIU_TERMINALS[env.terminal] ?? null;
}

/**
 * Format a file path as a clickable hyperlink.
 *
 * Paths containing spaces (e.g., "Application Support") are not clickable
 * in most terminals - they get split at the space. OSC 8 hyperlinks solve
 * this by embedding a file:// URL that the terminal can open on click,
 * while displaying the clean path to the user.
 *
 * Unlike createHyperlink(), this doesn't apply any color styling so the
 * path inherits the parent's styling (e.g., chalk.dim).
 */
function formatPathLink(filePath: string): string {
  if (!supportsHyperlinks()) {
    return filePath;
  }
  const fileUrl = pathToFileURL(filePath).href;
  // OSC 8 hyperlink: \e]8;;URL\a TEXT \e]8;;\a
  return `\x1b]8;;${fileUrl}\x07${filePath}\x1b]8;;\x07`;
}
export function shouldOfferTerminalSetup(): boolean {
  // iTerm2, WezTerm, Ghostty, Kitty, and Warp natively support CSI u / Kitty
  // keyboard protocol, which Claude Code already parses. No setup needed for
  // these terminals.
  return platform() === 'darwin' && env.terminal === 'Apple_Terminal' || env.terminal === 'vscode' || env.terminal === 'cursor' || env.terminal === 'windsurf' || env.terminal === 'alacritty' || env.terminal === 'zed';
}
export async function setupTerminal(theme: ThemeName): Promise<string> {
  let result = '';
  switch (env.terminal) {
    case 'Apple_Terminal':
      result = await enableOptionAsMetaForTerminal(theme);
      break;
    case 'vscode':
      result = await installBindingsForVSCodeTerminal('VSCode', theme);
      break;
    case 'cursor':
      result = await installBindingsForVSCodeTerminal('Cursor', theme);
      break;
    case 'windsurf':
      result = await installBindingsForVSCodeTerminal('Windsurf', theme);
      break;
    case 'alacritty':
      result = await installBindingsForAlacritty(theme);
      break;
    case 'zed':
      result = await installBindingsForZed(theme);
      break;
    case null:
      break;
  }
  saveGlobalConfig(current => {
    if (['vscode', 'cursor', 'windsurf', 'alacritty', 'zed'].includes(env.terminal ?? '')) {
      if (current.shiftEnterKeyBindingInstalled === true) return current;
      return {
        ...current,
        shiftEnterKeyBindingInstalled: true
      };
    } else if (env.terminal === 'Apple_Terminal') {
      if (current.optionAsMetaKeyInstalled === true) return current;
      return {
        ...current,
        optionAsMetaKeyInstalled: true
      };
    }
    return current;
  });
  maybeMarkProjectOnboardingComplete();

  // Install shell completions (ant-only, since the completion command is ant-only)
  if ("external" === 'ant') {
    result += await setupShellCompletion(theme);
  }
  return result;
}
export function isShiftEnterKeyBindingInstalled(): boolean {
  return getGlobalConfig().shiftEnterKeyBindingInstalled === true;
}
export function hasUsedBackslashReturn(): boolean {
  return getGlobalConfig().hasUsedBackslashReturn === true;
}
export function markBackslashReturnUsed(): void {
  const config = getGlobalConfig();
  if (!config.hasUsedBackslashReturn) {
    saveGlobalConfig(current => ({
      ...current,
      hasUsedBackslashReturn: true
    }));
  }
}
export async function call(onDone: LocalJSXCommandOnDone, context: ToolUseContext & LocalJSXCommandContext, _args: string): Promise<null> {
  if (env.terminal && env.terminal in NATIVE_CSIU_TERMINALS) {
    const message = `Shift+Enter is natively supported in ${NATIVE_CSIU_TERMINALS[env.terminal]}.

No configuration needed. Just use Shift+Enter to add newlines.`;
    onDone(message);
    return null;
  }

  // Check if terminal is supported
  if (!shouldOfferTerminalSetup()) {
    const terminalName = env.terminal || 'your current terminal';
    const currentPlatform = getPlatform();

    // Build platform-specific terminal suggestions
    let platformTerminals = '';
    if (currentPlatform === 'macos') {
      platformTerminals = '   • macOS: Apple Terminal\n';
    } else if (currentPlatform === 'windows') {
      platformTerminals = '   • Windows: Windows Terminal\n';
    }
    // For Linux and other platforms, we don't show native terminal options
    // since they're not currently supported

    const message = `Terminal setup cannot be run from ${terminalName}.

This command configures a convenient Shift+Enter shortcut for multi-line prompts.
${chalk.dim('Note: You can already use backslash (\\\\) + return to add newlines.')}

To set up the shortcut (optional):
1. Exit tmux/screen temporarily
2. Run /terminal-setup directly in one of these terminals:
${platformTerminals}   • IDE: VSCode, Cursor, Windsurf, Zed
   • Other: Alacritty
3. Return to tmux/screen - settings will persist

${chalk.dim('Note: iTerm2, WezTerm, Ghostty, Kitty, and Warp support Shift+Enter natively.')}`;
    onDone(message);
    return null;
  }
  const result = await setupTerminal(context.options.theme);
  onDone(result);
  return null;
}
type VSCodeKeybinding = {
  key: string;
  command: string;
  args: {
    text: string;
  };
  when: string;
};
async function installBindingsForVSCodeTerminal(editor: 'VSCode' | 'Cursor' | 'Windsurf' = 'VSCode', theme: ThemeName): Promise<string> {
  // Check if we're running in a VSCode Remote SSH session
  // In this case, keybindings need to be installed on the LOCAL machine
  if (isVSCodeRemoteSSH()) {
    return `${color('warning', theme)(`Cannot install keybindings from a remote ${editor} session.`)}${EOL}${EOL}${editor} keybindings must be installed on your local machine, not the remote server.${EOL}${EOL}To install the Shift+Enter keybinding:${EOL}1. Open ${editor} on your local machine (not connected to remote)${EOL}2. Open the Command Palette (Cmd/Ctrl+Shift+P) → "Preferences: Open Keyboard Shortcuts (JSON)"${EOL}3. Add this keybinding (the file must be a JSON array):${EOL}${EOL}${chalk.dim(`[
  {
    "key": "shift+enter",
    "command": "workbench.action.terminal.sendSequence",
    "args": { "text": "\\u001b\\r" },
    "when": "terminalFocus"
  }
]`)}${EOL}`;
  }
  const editorDir = editor === 'VSCode' ? 'Code' : editor;
  const userDirPath = join(homedir(), platform() === 'win32' ? join('AppData', 'Roaming', editorDir, 'User') : platform() === 'darwin' ? join('Library', 'Application Support', editorDir, 'User') : join('.config', editorDir, 'User'));
  const keybindingsPath = join(userDirPath, 'keybindings.json');
  try {
    // Ensure user directory exists (idempotent with recursive)
    await mkdir(userDirPath, {
      recursive: true
    });

    // Read existing keybindings file, or default to empty array if it doesn't exist
    let content = '[]';
    let keybindings: VSCodeKeybinding[] = [];
    let fileExists = false;
    try {
      content = await readFile(keybindingsPath, {
        encoding: 'utf-8'
      });
      fileExists = true;
      keybindings = safeParseJSONC(content) as VSCodeKeybinding[] ?? [];
    } catch (e: unknown) {
      if (!isFsInaccessible(e)) throw e;
    }

    // Backup the existing file before modifying it
    if (fileExists) {
      const randomSha = randomBytes(4).toString('hex');
      const backupPath = `${keybindingsPath}.${randomSha}.bak`;
      try {
        await copyFile(keybindingsPath, backupPath);
      } catch {
        return `${color('warning', theme)(`Error backing up existing ${editor} terminal keybindings. Bailing out.`)}${EOL}${chalk.dim(`See ${formatPathLink(keybindingsPath)}`)}${EOL}${chalk.dim(`Backup path: ${formatPathLink(backupPath)}`)}${EOL}`;
      }
    }

    // Check if keybinding already exists
    const existingBinding = keybindings.find(binding => binding.key === 'shift+enter' && binding.command === 'workbench.action.terminal.sendSequence' && binding.when === 'terminalFocus');
    if (existingBinding) {
      return `${color('warning', theme)(`Found existing ${editor} terminal Shift+Enter key binding. Remove it to continue.`)}${EOL}${chalk.dim(`See ${formatPathLink(keybindingsPath)}`)}${EOL}`;
    }

    // Create the new keybinding
    const newKeybinding: VSCodeKeybinding = {
      key: 'shift+enter',
      command: 'workbench.action.terminal.sendSequence',
      args: {
        text: '\u001b\r'
      },
      when: 'terminalFocus'
    };

    // Modify the content by adding the new keybinding while preserving comments and formatting
    const updatedContent = addItemToJSONCArray(content, newKeybinding);

    // Write the updated content back to the file
    await writeFile(keybindingsPath, updatedContent, {
      encoding: 'utf-8'
    });
    return `${color('success', theme)(`Installed ${editor} terminal Shift+Enter key binding`)}${EOL}${chalk.dim(`See ${formatPathLink(keybindingsPath)}`)}${EOL}`;
  } catch (error) {
    logError(error);
    throw new Error(`Failed to install ${editor} terminal Shift+Enter key binding`);
  }
}
async function enableOptionAsMetaForProfile(profileName: string): Promise<boolean> {
  // First try to add the property (in case it doesn't exist)
  // Quote the profile name to handle names with spaces (e.g., "Man Page", "Red Sands")
  const {
    code: addCode
  } = await execFileNoThrow('/usr/libexec/PlistBuddy', ['-c', `Add :'Window Settings':'${profileName}':useOptionAsMetaKey bool true`, getTerminalPlistPath()]);

  // If adding fails (likely because it already exists), try setting it instead
  if (addCode !== 0) {
    const {
      code: setCode
    } = await execFileNoThrow('/usr/libexec/PlistBuddy', ['-c', `Set :'Window Settings':'${profileName}':useOptionAsMetaKey true`, getTerminalPlistPath()]);
    if (setCode !== 0) {
      logError(new Error(`Failed to enable Option as Meta key for Terminal.app profile: ${profileName}`));
      return false;
    }
  }
  return true;
}
async function disableAudioBellForProfile(profileName: string): Promise<boolean> {
  // First try to add the property (in case it doesn't exist)
  // Quote the profile name to handle names with spaces (e.g., "Man Page", "Red Sands")
  const {
    code: addCode
  } = await execFileNoThrow('/usr/libexec/PlistBuddy', ['-c', `Add :'Window Settings':'${profileName}':Bell bool false`, getTerminalPlistPath()]);

  // If adding fails (likely because it already exists), try setting it instead
  if (addCode !== 0) {
    const {
      code: setCode
    } = await execFileNoThrow('/usr/libexec/PlistBuddy', ['-c', `Set :'Window Settings':'${profileName}':Bell false`, getTerminalPlistPath()]);
    if (setCode !== 0) {
      logError(new Error(`Failed to disable audio bell for Terminal.app profile: ${profileName}`));
      return false;
    }
  }
  return true;
}

// Enable Option as Meta key for Terminal.app
async function enableOptionAsMetaForTerminal(theme: ThemeName): Promise<string> {
  try {
    // Create a backup of the current plist file
    const backupPath = await backupTerminalPreferences();
    if (!backupPath) {
      throw new Error('Failed to create backup of Terminal.app preferences, bailing out');
    }

    // Read the current default profile from the plist
    const {
      stdout: defaultProfile,
      code: readCode
    } = await execFileNoThrow('defaults', ['read', 'com.apple.Terminal', 'Default Window Settings']);
    if (readCode !== 0 || !defaultProfile.trim()) {
      throw new Error('Failed to read default Terminal.app profile');
    }
    const {
      stdout: startupProfile,
      code: startupCode
    } = await execFileNoThrow('defaults', ['read', 'com.apple.Terminal', 'Startup Window Settings']);
    if (startupCode !== 0 || !startupProfile.trim()) {
      throw new Error('Failed to read startup Terminal.app profile');
    }
    let wasAnyProfileUpdated = false;
    const defaultProfileName = defaultProfile.trim();
    const optionAsMetaEnabled = await enableOptionAsMetaForProfile(defaultProfileName);
    const audioBellDisabled = await disableAudioBellForProfile(defaultProfileName);
    if (optionAsMetaEnabled || audioBellDisabled) {
      wasAnyProfileUpdated = true;
    }
    const startupProfileName = startupProfile.trim();

    // Only proceed if the startup profile is different from the default profile
    if (startupProfileName !== defaultProfileName) {
      const startupOptionAsMetaEnabled = await enableOptionAsMetaForProfile(startupProfileName);
      const startupAudioBellDisabled = await disableAudioBellForProfile(startupProfileName);
      if (startupOptionAsMetaEnabled || startupAudioBellDisabled) {
        wasAnyProfileUpdated = true;
      }
    }
    if (!wasAnyProfileUpdated) {
      throw new Error('Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile');
    }

    // Flush the preferences cache
    await execFileNoThrow('killall', ['cfprefsd']);
    markTerminalSetupComplete();
    return `${color('success', theme)(`Configured Terminal.app settings:`)}${EOL}${color('success', theme)('- Enabled "Use Option as Meta key"')}${EOL}${color('success', theme)('- Switched to visual bell')}${EOL}${chalk.dim('Option+Enter will now enter a newline.')}${EOL}${chalk.dim('You must restart Terminal.app for changes to take effect.', theme)}${EOL}`;
  } catch (error) {
    logError(error);

    // Attempt to restore from backup
    const restoreResult = await checkAndRestoreTerminalBackup();
    const errorMessage = 'Failed to enable Option as Meta key for Terminal.app.';
    if (restoreResult.status === 'restored') {
      throw new Error(`${errorMessage} Your settings have been restored from backup.`);
    } else if (restoreResult.status === 'failed') {
      throw new Error(`${errorMessage} Restoring from backup failed, try manually with: defaults import com.apple.Terminal ${restoreResult.backupPath}`);
    } else {
      throw new Error(`${errorMessage} No backup was available to restore from.`);
    }
  }
}
async function installBindingsForAlacritty(theme: ThemeName): Promise<string> {
  const ALACRITTY_KEYBINDING = `[[keyboard.bindings]]
key = "Return"
mods = "Shift"
chars = "\\u001B\\r"`;

  // Get Alacritty config file paths in order of preference
  const configPaths: string[] = [];

  // XDG config path (Linux and macOS)
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    configPaths.push(join(xdgConfigHome, 'alacritty', 'alacritty.toml'));
  } else {
    configPaths.push(join(homedir(), '.config', 'alacritty', 'alacritty.toml'));
  }

  // Windows-specific path
  if (platform() === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      configPaths.push(join(appData, 'alacritty', 'alacritty.toml'));
    }
  }

  // Find existing config file by attempting to read it, or use first preferred path
  let configPath: string | null = null;
  let configContent = '';
  let configExists = false;
  for (const path of configPaths) {
    try {
      configContent = await readFile(path, {
        encoding: 'utf-8'
      });
      configPath = path;
      configExists = true;
      break;
    } catch (e: unknown) {
      if (!isFsInaccessible(e)) throw e;
      // File missing or inaccessible — try next config path
    }
  }

  // If no config exists, use the first path (XDG/default location)
  if (!configPath) {
    configPath = configPaths[0] ?? null;
  }
  if (!configPath) {
    throw new Error('No valid config path found for Alacritty');
  }
  try {
    if (configExists) {
      // Check if keybinding already exists (look for Shift+Return binding)
      if (configContent.includes('mods = "Shift"') && configContent.includes('key = "Return"')) {
        return `${color('warning', theme)('Found existing Alacritty Shift+Enter key binding. Remove it to continue.')}${EOL}${chalk.dim(`See ${formatPathLink(configPath)}`)}${EOL}`;
      }

      // Create backup
      const randomSha = randomBytes(4).toString('hex');
      const backupPath = `${configPath}.${randomSha}.bak`;
      try {
        await copyFile(configPath, backupPath);
      } catch {
        return `${color('warning', theme)('Error backing up existing Alacritty config. Bailing out.')}${EOL}${chalk.dim(`See ${formatPathLink(configPath)}`)}${EOL}${chalk.dim(`Backup path: ${formatPathLink(backupPath)}`)}${EOL}`;
      }
    } else {
      // Ensure config directory exists (idempotent with recursive)
      await mkdir(dirname(configPath), {
        recursive: true
      });
    }

    // Add the keybinding to the config
    let updatedContent = configContent;
    if (configContent && !configContent.endsWith('\n')) {
      updatedContent += '\n';
    }
    updatedContent += '\n' + ALACRITTY_KEYBINDING + '\n';

    // Write the updated config
    await writeFile(configPath, updatedContent, {
      encoding: 'utf-8'
    });
    return `${color('success', theme)('Installed Alacritty Shift+Enter key binding')}${EOL}${color('success', theme)('You may need to restart Alacritty for changes to take effect')}${EOL}${chalk.dim(`See ${formatPathLink(configPath)}`)}${EOL}`;
  } catch (error) {
    logError(error);
    throw new Error('Failed to install Alacritty Shift+Enter key binding');
  }
}
async function installBindingsForZed(theme: ThemeName): Promise<string> {
  // Zed uses JSON keybindings similar to VSCode
  const zedDir = join(homedir(), '.config', 'zed');
  const keymapPath = join(zedDir, 'keymap.json');
  try {
    // Ensure zed directory exists (idempotent with recursive)
    await mkdir(zedDir, {
      recursive: true
    });

    // Read existing keymap file, or default to empty array if it doesn't exist
    let keymapContent = '[]';
    let fileExists = false;
    try {
      keymapContent = await readFile(keymapPath, {
        encoding: 'utf-8'
      });
      fileExists = true;
    } catch (e: unknown) {
      if (!isFsInaccessible(e)) throw e;
    }
    if (fileExists) {
      // Check if keybinding already exists
      if (keymapContent.includes('shift-enter')) {
        return `${color('warning', theme)('Found existing Zed Shift+Enter key binding. Remove it to continue.')}${EOL}${chalk.dim(`See ${formatPathLink(keymapPath)}`)}${EOL}`;
      }

      // Create backup
      const randomSha = randomBytes(4).toString('hex');
      const backupPath = `${keymapPath}.${randomSha}.bak`;
      try {
        await copyFile(keymapPath, backupPath);
      } catch {
        return `${color('warning', theme)('Error backing up existing Zed keymap. Bailing out.')}${EOL}${chalk.dim(`See ${formatPathLink(keymapPath)}`)}${EOL}${chalk.dim(`Backup path: ${formatPathLink(backupPath)}`)}${EOL}`;
      }
    }

    // Parse and modify the keymap
    let keymap: Array<{
      context?: string;
      bindings: Record<string, string | string[]>;
    }>;
    try {
      keymap = jsonParse(keymapContent);
      if (!Array.isArray(keymap)) {
        keymap = [];
      }
    } catch {
      keymap = [];
    }

    // Add the new keybinding for terminal context
    keymap.push({
      context: 'Terminal',
      bindings: {
        'shift-enter': ['terminal::SendText', '\u001b\r']
      }
    });

    // Write the updated keymap
    await writeFile(keymapPath, jsonStringify(keymap, null, 2) + '\n', {
      encoding: 'utf-8'
    });
    return `${color('success', theme)('Installed Zed Shift+Enter key binding')}${EOL}${chalk.dim(`See ${formatPathLink(keymapPath)}`)}${EOL}`;
  } catch (error) {
    logError(error);
    throw new Error('Failed to install Zed Shift+Enter key binding');
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjaGFsayIsInJhbmRvbUJ5dGVzIiwiY29weUZpbGUiLCJta2RpciIsInJlYWRGaWxlIiwid3JpdGVGaWxlIiwiaG9tZWRpciIsInBsYXRmb3JtIiwiZGlybmFtZSIsImpvaW4iLCJUaGVtZU5hbWUiLCJwYXRoVG9GaWxlVVJMIiwic3VwcG9ydHNIeXBlcmxpbmtzIiwiY29sb3IiLCJtYXliZU1hcmtQcm9qZWN0T25ib2FyZGluZ0NvbXBsZXRlIiwiVG9vbFVzZUNvbnRleHQiLCJMb2NhbEpTWENvbW1hbmRDb250ZXh0IiwiTG9jYWxKU1hDb21tYW5kT25Eb25lIiwiYmFja3VwVGVybWluYWxQcmVmZXJlbmNlcyIsImNoZWNrQW5kUmVzdG9yZVRlcm1pbmFsQmFja3VwIiwiZ2V0VGVybWluYWxQbGlzdFBhdGgiLCJtYXJrVGVybWluYWxTZXR1cENvbXBsZXRlIiwic2V0dXBTaGVsbENvbXBsZXRpb24iLCJnZXRHbG9iYWxDb25maWciLCJzYXZlR2xvYmFsQ29uZmlnIiwiZW52IiwiaXNGc0luYWNjZXNzaWJsZSIsImV4ZWNGaWxlTm9UaHJvdyIsImFkZEl0ZW1Ub0pTT05DQXJyYXkiLCJzYWZlUGFyc2VKU09OQyIsImxvZ0Vycm9yIiwiZ2V0UGxhdGZvcm0iLCJqc29uUGFyc2UiLCJqc29uU3RyaW5naWZ5IiwiRU9MIiwiTkFUSVZFX0NTSVVfVEVSTUlOQUxTIiwiUmVjb3JkIiwiZ2hvc3R0eSIsImtpdHR5IiwiV2V6VGVybSIsIldhcnBUZXJtaW5hbCIsImlzVlNDb2RlUmVtb3RlU1NIIiwiYXNrcGFzc01haW4iLCJwcm9jZXNzIiwiVlNDT0RFX0dJVF9BU0tQQVNTX01BSU4iLCJwYXRoIiwiUEFUSCIsImluY2x1ZGVzIiwiZ2V0TmF0aXZlQ1NJdVRlcm1pbmFsRGlzcGxheU5hbWUiLCJ0ZXJtaW5hbCIsImZvcm1hdFBhdGhMaW5rIiwiZmlsZVBhdGgiLCJmaWxlVXJsIiwiaHJlZiIsInNob3VsZE9mZmVyVGVybWluYWxTZXR1cCIsInNldHVwVGVybWluYWwiLCJ0aGVtZSIsIlByb21pc2UiLCJyZXN1bHQiLCJlbmFibGVPcHRpb25Bc01ldGFGb3JUZXJtaW5hbCIsImluc3RhbGxCaW5kaW5nc0ZvclZTQ29kZVRlcm1pbmFsIiwiaW5zdGFsbEJpbmRpbmdzRm9yQWxhY3JpdHR5IiwiaW5zdGFsbEJpbmRpbmdzRm9yWmVkIiwiY3VycmVudCIsInNoaWZ0RW50ZXJLZXlCaW5kaW5nSW5zdGFsbGVkIiwib3B0aW9uQXNNZXRhS2V5SW5zdGFsbGVkIiwiaXNTaGlmdEVudGVyS2V5QmluZGluZ0luc3RhbGxlZCIsImhhc1VzZWRCYWNrc2xhc2hSZXR1cm4iLCJtYXJrQmFja3NsYXNoUmV0dXJuVXNlZCIsImNvbmZpZyIsImNhbGwiLCJvbkRvbmUiLCJjb250ZXh0IiwiX2FyZ3MiLCJtZXNzYWdlIiwidGVybWluYWxOYW1lIiwiY3VycmVudFBsYXRmb3JtIiwicGxhdGZvcm1UZXJtaW5hbHMiLCJkaW0iLCJvcHRpb25zIiwiVlNDb2RlS2V5YmluZGluZyIsImtleSIsImNvbW1hbmQiLCJhcmdzIiwidGV4dCIsIndoZW4iLCJlZGl0b3IiLCJlZGl0b3JEaXIiLCJ1c2VyRGlyUGF0aCIsImtleWJpbmRpbmdzUGF0aCIsInJlY3Vyc2l2ZSIsImNvbnRlbnQiLCJrZXliaW5kaW5ncyIsImZpbGVFeGlzdHMiLCJlbmNvZGluZyIsImUiLCJyYW5kb21TaGEiLCJ0b1N0cmluZyIsImJhY2t1cFBhdGgiLCJleGlzdGluZ0JpbmRpbmciLCJmaW5kIiwiYmluZGluZyIsIm5ld0tleWJpbmRpbmciLCJ1cGRhdGVkQ29udGVudCIsImVycm9yIiwiRXJyb3IiLCJlbmFibGVPcHRpb25Bc01ldGFGb3JQcm9maWxlIiwicHJvZmlsZU5hbWUiLCJjb2RlIiwiYWRkQ29kZSIsInNldENvZGUiLCJkaXNhYmxlQXVkaW9CZWxsRm9yUHJvZmlsZSIsInN0ZG91dCIsImRlZmF1bHRQcm9maWxlIiwicmVhZENvZGUiLCJ0cmltIiwic3RhcnR1cFByb2ZpbGUiLCJzdGFydHVwQ29kZSIsIndhc0FueVByb2ZpbGVVcGRhdGVkIiwiZGVmYXVsdFByb2ZpbGVOYW1lIiwib3B0aW9uQXNNZXRhRW5hYmxlZCIsImF1ZGlvQmVsbERpc2FibGVkIiwic3RhcnR1cFByb2ZpbGVOYW1lIiwic3RhcnR1cE9wdGlvbkFzTWV0YUVuYWJsZWQiLCJzdGFydHVwQXVkaW9CZWxsRGlzYWJsZWQiLCJyZXN0b3JlUmVzdWx0IiwiZXJyb3JNZXNzYWdlIiwic3RhdHVzIiwiQUxBQ1JJVFRZX0tFWUJJTkRJTkciLCJjb25maWdQYXRocyIsInhkZ0NvbmZpZ0hvbWUiLCJYREdfQ09ORklHX0hPTUUiLCJwdXNoIiwiYXBwRGF0YSIsIkFQUERBVEEiLCJjb25maWdQYXRoIiwiY29uZmlnQ29udGVudCIsImNvbmZpZ0V4aXN0cyIsImVuZHNXaXRoIiwiemVkRGlyIiwia2V5bWFwUGF0aCIsImtleW1hcENvbnRlbnQiLCJrZXltYXAiLCJBcnJheSIsImJpbmRpbmdzIiwiaXNBcnJheSJdLCJzb3VyY2VzIjpbInRlcm1pbmFsU2V0dXAudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBjaGFsayBmcm9tICdjaGFsaydcbmltcG9ydCB7IHJhbmRvbUJ5dGVzIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHsgY29weUZpbGUsIG1rZGlyLCByZWFkRmlsZSwgd3JpdGVGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnXG5pbXBvcnQgeyBob21lZGlyLCBwbGF0Zm9ybSB9IGZyb20gJ29zJ1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgdHlwZSB7IFRoZW1lTmFtZSB9IGZyb20gJ3NyYy91dGlscy90aGVtZS5qcydcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnXG5pbXBvcnQgeyBzdXBwb3J0c0h5cGVybGlua3MgfSBmcm9tICcuLi8uLi9pbmsvc3VwcG9ydHMtaHlwZXJsaW5rcy5qcydcbmltcG9ydCB7IGNvbG9yIH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgbWF5YmVNYXJrUHJvamVjdE9uYm9hcmRpbmdDb21wbGV0ZSB9IGZyb20gJy4uLy4uL3Byb2plY3RPbmJvYXJkaW5nU3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IFRvb2xVc2VDb250ZXh0IH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB0eXBlIHtcbiAgTG9jYWxKU1hDb21tYW5kQ29udGV4dCxcbiAgTG9jYWxKU1hDb21tYW5kT25Eb25lLFxufSBmcm9tICcuLi8uLi90eXBlcy9jb21tYW5kLmpzJ1xuaW1wb3J0IHtcbiAgYmFja3VwVGVybWluYWxQcmVmZXJlbmNlcyxcbiAgY2hlY2tBbmRSZXN0b3JlVGVybWluYWxCYWNrdXAsXG4gIGdldFRlcm1pbmFsUGxpc3RQYXRoLFxuICBtYXJrVGVybWluYWxTZXR1cENvbXBsZXRlLFxufSBmcm9tICcuLi8uLi91dGlscy9hcHBsZVRlcm1pbmFsQmFja3VwLmpzJ1xuaW1wb3J0IHsgc2V0dXBTaGVsbENvbXBsZXRpb24gfSBmcm9tICcuLi8uLi91dGlscy9jb21wbGV0aW9uQ2FjaGUuanMnXG5pbXBvcnQgeyBnZXRHbG9iYWxDb25maWcsIHNhdmVHbG9iYWxDb25maWcgfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgeyBlbnYgfSBmcm9tICcuLi8uLi91dGlscy9lbnYuanMnXG5pbXBvcnQgeyBpc0ZzSW5hY2Nlc3NpYmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgZXhlY0ZpbGVOb1Rocm93IH0gZnJvbSAnLi4vLi4vdXRpbHMvZXhlY0ZpbGVOb1Rocm93LmpzJ1xuaW1wb3J0IHsgYWRkSXRlbVRvSlNPTkNBcnJheSwgc2FmZVBhcnNlSlNPTkMgfSBmcm9tICcuLi8uLi91dGlscy9qc29uLmpzJ1xuaW1wb3J0IHsgbG9nRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9sb2cuanMnXG5pbXBvcnQgeyBnZXRQbGF0Zm9ybSB9IGZyb20gJy4uLy4uL3V0aWxzL3BsYXRmb3JtLmpzJ1xuaW1wb3J0IHsganNvblBhcnNlLCBqc29uU3RyaW5naWZ5IH0gZnJvbSAnLi4vLi4vdXRpbHMvc2xvd09wZXJhdGlvbnMuanMnXG5cbmNvbnN0IEVPTCA9ICdcXG4nXG5cbi8vIFRlcm1pbmFscyB0aGF0IG5hdGl2ZWx5IHN1cHBvcnQgQ1NJIHUgLyBLaXR0eSBrZXlib2FyZCBwcm90b2NvbFxuY29uc3QgTkFUSVZFX0NTSVVfVEVSTUlOQUxTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBnaG9zdHR5OiAnR2hvc3R0eScsXG4gIGtpdHR5OiAnS2l0dHknLFxuICAnaVRlcm0uYXBwJzogJ2lUZXJtMicsXG4gIFdlelRlcm06ICdXZXpUZXJtJyxcbiAgV2FycFRlcm1pbmFsOiAnV2FycCcsXG59XG5cbi8qKlxuICogRGV0ZWN0IGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBWU0NvZGUgUmVtb3RlIFNTSCBzZXNzaW9uLlxuICogSW4gdGhpcyBjYXNlLCBrZXliaW5kaW5ncyBuZWVkIHRvIGJlIGluc3RhbGxlZCBvbiB0aGUgTE9DQUwgbWFjaGluZSxcbiAqIG5vdCB0aGUgcmVtb3RlIHNlcnZlciB3aGVyZSBDbGF1ZGUgaXMgcnVubmluZy5cbiAqL1xuZnVuY3Rpb24gaXNWU0NvZGVSZW1vdGVTU0goKTogYm9vbGVhbiB7XG4gIGNvbnN0IGFza3Bhc3NNYWluID0gcHJvY2Vzcy5lbnYuVlNDT0RFX0dJVF9BU0tQQVNTX01BSU4gPz8gJydcbiAgY29uc3QgcGF0aCA9IHByb2Nlc3MuZW52LlBBVEggPz8gJydcblxuICAvLyBDaGVjayBib3RoIGVudiB2YXJzIC0gVlNDT0RFX0dJVF9BU0tQQVNTX01BSU4gaXMgbW9yZSByZWxpYWJsZSB3aGVuIGdpdCBleHRlbnNpb25cbiAgLy8gaXMgYWN0aXZlLCBhbmQgUEFUSCBpcyBhIGZhbGxiYWNrLiBPbWl0IHBhdGggc2VwYXJhdG9yIGZvciBXaW5kb3dzIGNvbXBhdGliaWxpdHkuXG4gIHJldHVybiAoXG4gICAgYXNrcGFzc01haW4uaW5jbHVkZXMoJy52c2NvZGUtc2VydmVyJykgfHxcbiAgICBhc2twYXNzTWFpbi5pbmNsdWRlcygnLmN1cnNvci1zZXJ2ZXInKSB8fFxuICAgIGFza3Bhc3NNYWluLmluY2x1ZGVzKCcud2luZHN1cmYtc2VydmVyJykgfHxcbiAgICBwYXRoLmluY2x1ZGVzKCcudnNjb2RlLXNlcnZlcicpIHx8XG4gICAgcGF0aC5pbmNsdWRlcygnLmN1cnNvci1zZXJ2ZXInKSB8fFxuICAgIHBhdGguaW5jbHVkZXMoJy53aW5kc3VyZi1zZXJ2ZXInKVxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROYXRpdmVDU0l1VGVybWluYWxEaXNwbGF5TmFtZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFlbnYudGVybWluYWwgfHwgIShlbnYudGVybWluYWwgaW4gTkFUSVZFX0NTSVVfVEVSTUlOQUxTKSkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgcmV0dXJuIE5BVElWRV9DU0lVX1RFUk1JTkFMU1tlbnYudGVybWluYWxdID8/IG51bGxcbn1cblxuLyoqXG4gKiBGb3JtYXQgYSBmaWxlIHBhdGggYXMgYSBjbGlja2FibGUgaHlwZXJsaW5rLlxuICpcbiAqIFBhdGhzIGNvbnRhaW5pbmcgc3BhY2VzIChlLmcuLCBcIkFwcGxpY2F0aW9uIFN1cHBvcnRcIikgYXJlIG5vdCBjbGlja2FibGVcbiAqIGluIG1vc3QgdGVybWluYWxzIC0gdGhleSBnZXQgc3BsaXQgYXQgdGhlIHNwYWNlLiBPU0MgOCBoeXBlcmxpbmtzIHNvbHZlXG4gKiB0aGlzIGJ5IGVtYmVkZGluZyBhIGZpbGU6Ly8gVVJMIHRoYXQgdGhlIHRlcm1pbmFsIGNhbiBvcGVuIG9uIGNsaWNrLFxuICogd2hpbGUgZGlzcGxheWluZyB0aGUgY2xlYW4gcGF0aCB0byB0aGUgdXNlci5cbiAqXG4gKiBVbmxpa2UgY3JlYXRlSHlwZXJsaW5rKCksIHRoaXMgZG9lc24ndCBhcHBseSBhbnkgY29sb3Igc3R5bGluZyBzbyB0aGVcbiAqIHBhdGggaW5oZXJpdHMgdGhlIHBhcmVudCdzIHN0eWxpbmcgKGUuZy4sIGNoYWxrLmRpbSkuXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFBhdGhMaW5rKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXN1cHBvcnRzSHlwZXJsaW5rcygpKSB7XG4gICAgcmV0dXJuIGZpbGVQYXRoXG4gIH1cbiAgY29uc3QgZmlsZVVybCA9IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLmhyZWZcbiAgLy8gT1NDIDggaHlwZXJsaW5rOiBcXGVdODs7VVJMXFxhIFRFWFQgXFxlXTg7O1xcYVxuICByZXR1cm4gYFxceDFiXTg7OyR7ZmlsZVVybH1cXHgwNyR7ZmlsZVBhdGh9XFx4MWJdODs7XFx4MDdgXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG91bGRPZmZlclRlcm1pbmFsU2V0dXAoKTogYm9vbGVhbiB7XG4gIC8vIGlUZXJtMiwgV2V6VGVybSwgR2hvc3R0eSwgS2l0dHksIGFuZCBXYXJwIG5hdGl2ZWx5IHN1cHBvcnQgQ1NJIHUgLyBLaXR0eVxuICAvLyBrZXlib2FyZCBwcm90b2NvbCwgd2hpY2ggQ2xhdWRlIENvZGUgYWxyZWFkeSBwYXJzZXMuIE5vIHNldHVwIG5lZWRlZCBmb3JcbiAgLy8gdGhlc2UgdGVybWluYWxzLlxuICByZXR1cm4gKFxuICAgIChwbGF0Zm9ybSgpID09PSAnZGFyd2luJyAmJiBlbnYudGVybWluYWwgPT09ICdBcHBsZV9UZXJtaW5hbCcpIHx8XG4gICAgZW52LnRlcm1pbmFsID09PSAndnNjb2RlJyB8fFxuICAgIGVudi50ZXJtaW5hbCA9PT0gJ2N1cnNvcicgfHxcbiAgICBlbnYudGVybWluYWwgPT09ICd3aW5kc3VyZicgfHxcbiAgICBlbnYudGVybWluYWwgPT09ICdhbGFjcml0dHknIHx8XG4gICAgZW52LnRlcm1pbmFsID09PSAnemVkJ1xuICApXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFRlcm1pbmFsKHRoZW1lOiBUaGVtZU5hbWUpOiBQcm9taXNlPHN0cmluZz4ge1xuICBsZXQgcmVzdWx0ID0gJydcblxuICBzd2l0Y2ggKGVudi50ZXJtaW5hbCkge1xuICAgIGNhc2UgJ0FwcGxlX1Rlcm1pbmFsJzpcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGVuYWJsZU9wdGlvbkFzTWV0YUZvclRlcm1pbmFsKHRoZW1lKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd2c2NvZGUnOlxuICAgICAgcmVzdWx0ID0gYXdhaXQgaW5zdGFsbEJpbmRpbmdzRm9yVlNDb2RlVGVybWluYWwoJ1ZTQ29kZScsIHRoZW1lKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdjdXJzb3InOlxuICAgICAgcmVzdWx0ID0gYXdhaXQgaW5zdGFsbEJpbmRpbmdzRm9yVlNDb2RlVGVybWluYWwoJ0N1cnNvcicsIHRoZW1lKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd3aW5kc3VyZic6XG4gICAgICByZXN1bHQgPSBhd2FpdCBpbnN0YWxsQmluZGluZ3NGb3JWU0NvZGVUZXJtaW5hbCgnV2luZHN1cmYnLCB0aGVtZSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYWxhY3JpdHR5JzpcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGluc3RhbGxCaW5kaW5nc0ZvckFsYWNyaXR0eSh0aGVtZSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnemVkJzpcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGluc3RhbGxCaW5kaW5nc0ZvclplZCh0aGVtZSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBudWxsOlxuICAgICAgYnJlYWtcbiAgfVxuXG4gIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiB7XG4gICAgaWYgKFxuICAgICAgWyd2c2NvZGUnLCAnY3Vyc29yJywgJ3dpbmRzdXJmJywgJ2FsYWNyaXR0eScsICd6ZWQnXS5pbmNsdWRlcyhcbiAgICAgICAgZW52LnRlcm1pbmFsID8/ICcnLFxuICAgICAgKVxuICAgICkge1xuICAgICAgaWYgKGN1cnJlbnQuc2hpZnRFbnRlcktleUJpbmRpbmdJbnN0YWxsZWQgPT09IHRydWUpIHJldHVybiBjdXJyZW50XG4gICAgICByZXR1cm4geyAuLi5jdXJyZW50LCBzaGlmdEVudGVyS2V5QmluZGluZ0luc3RhbGxlZDogdHJ1ZSB9XG4gICAgfSBlbHNlIGlmIChlbnYudGVybWluYWwgPT09ICdBcHBsZV9UZXJtaW5hbCcpIHtcbiAgICAgIGlmIChjdXJyZW50Lm9wdGlvbkFzTWV0YUtleUluc3RhbGxlZCA9PT0gdHJ1ZSkgcmV0dXJuIGN1cnJlbnRcbiAgICAgIHJldHVybiB7IC4uLmN1cnJlbnQsIG9wdGlvbkFzTWV0YUtleUluc3RhbGxlZDogdHJ1ZSB9XG4gICAgfVxuICAgIHJldHVybiBjdXJyZW50XG4gIH0pXG5cbiAgbWF5YmVNYXJrUHJvamVjdE9uYm9hcmRpbmdDb21wbGV0ZSgpXG5cbiAgLy8gSW5zdGFsbCBzaGVsbCBjb21wbGV0aW9ucyAoYW50LW9ubHksIHNpbmNlIHRoZSBjb21wbGV0aW9uIGNvbW1hbmQgaXMgYW50LW9ubHkpXG4gIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgcmVzdWx0ICs9IGF3YWl0IHNldHVwU2hlbGxDb21wbGV0aW9uKHRoZW1lKVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaGlmdEVudGVyS2V5QmluZGluZ0luc3RhbGxlZCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldEdsb2JhbENvbmZpZygpLnNoaWZ0RW50ZXJLZXlCaW5kaW5nSW5zdGFsbGVkID09PSB0cnVlXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNVc2VkQmFja3NsYXNoUmV0dXJuKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0R2xvYmFsQ29uZmlnKCkuaGFzVXNlZEJhY2tzbGFzaFJldHVybiA9PT0gdHJ1ZVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFya0JhY2tzbGFzaFJldHVyblVzZWQoKTogdm9pZCB7XG4gIGNvbnN0IGNvbmZpZyA9IGdldEdsb2JhbENvbmZpZygpXG4gIGlmICghY29uZmlnLmhhc1VzZWRCYWNrc2xhc2hSZXR1cm4pIHtcbiAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgIC4uLmN1cnJlbnQsXG4gICAgICBoYXNVc2VkQmFja3NsYXNoUmV0dXJuOiB0cnVlLFxuICAgIH0pKVxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxsKFxuICBvbkRvbmU6IExvY2FsSlNYQ29tbWFuZE9uRG9uZSxcbiAgY29udGV4dDogVG9vbFVzZUNvbnRleHQgJiBMb2NhbEpTWENvbW1hbmRDb250ZXh0LFxuICBfYXJnczogc3RyaW5nLFxuKTogUHJvbWlzZTxudWxsPiB7XG4gIGlmIChlbnYudGVybWluYWwgJiYgZW52LnRlcm1pbmFsIGluIE5BVElWRV9DU0lVX1RFUk1JTkFMUykge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBgU2hpZnQrRW50ZXIgaXMgbmF0aXZlbHkgc3VwcG9ydGVkIGluICR7TkFUSVZFX0NTSVVfVEVSTUlOQUxTW2Vudi50ZXJtaW5hbF19LlxuXG5ObyBjb25maWd1cmF0aW9uIG5lZWRlZC4gSnVzdCB1c2UgU2hpZnQrRW50ZXIgdG8gYWRkIG5ld2xpbmVzLmBcbiAgICBvbkRvbmUobWVzc2FnZSlcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgLy8gQ2hlY2sgaWYgdGVybWluYWwgaXMgc3VwcG9ydGVkXG4gIGlmICghc2hvdWxkT2ZmZXJUZXJtaW5hbFNldHVwKCkpIHtcbiAgICBjb25zdCB0ZXJtaW5hbE5hbWUgPSBlbnYudGVybWluYWwgfHwgJ3lvdXIgY3VycmVudCB0ZXJtaW5hbCdcbiAgICBjb25zdCBjdXJyZW50UGxhdGZvcm0gPSBnZXRQbGF0Zm9ybSgpXG5cbiAgICAvLyBCdWlsZCBwbGF0Zm9ybS1zcGVjaWZpYyB0ZXJtaW5hbCBzdWdnZXN0aW9uc1xuICAgIGxldCBwbGF0Zm9ybVRlcm1pbmFscyA9ICcnXG4gICAgaWYgKGN1cnJlbnRQbGF0Zm9ybSA9PT0gJ21hY29zJykge1xuICAgICAgcGxhdGZvcm1UZXJtaW5hbHMgPSAnICAg4oCiIG1hY09TOiBBcHBsZSBUZXJtaW5hbFxcbidcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRQbGF0Zm9ybSA9PT0gJ3dpbmRvd3MnKSB7XG4gICAgICBwbGF0Zm9ybVRlcm1pbmFscyA9ICcgICDigKIgV2luZG93czogV2luZG93cyBUZXJtaW5hbFxcbidcbiAgICB9XG4gICAgLy8gRm9yIExpbnV4IGFuZCBvdGhlciBwbGF0Zm9ybXMsIHdlIGRvbid0IHNob3cgbmF0aXZlIHRlcm1pbmFsIG9wdGlvbnNcbiAgICAvLyBzaW5jZSB0aGV5J3JlIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkXG5cbiAgICBjb25zdCBtZXNzYWdlID0gYFRlcm1pbmFsIHNldHVwIGNhbm5vdCBiZSBydW4gZnJvbSAke3Rlcm1pbmFsTmFtZX0uXG5cblRoaXMgY29tbWFuZCBjb25maWd1cmVzIGEgY29udmVuaWVudCBTaGlmdCtFbnRlciBzaG9ydGN1dCBmb3IgbXVsdGktbGluZSBwcm9tcHRzLlxuJHtjaGFsay5kaW0oJ05vdGU6IFlvdSBjYW4gYWxyZWFkeSB1c2UgYmFja3NsYXNoIChcXFxcXFxcXCkgKyByZXR1cm4gdG8gYWRkIG5ld2xpbmVzLicpfVxuXG5UbyBzZXQgdXAgdGhlIHNob3J0Y3V0IChvcHRpb25hbCk6XG4xLiBFeGl0IHRtdXgvc2NyZWVuIHRlbXBvcmFyaWx5XG4yLiBSdW4gL3Rlcm1pbmFsLXNldHVwIGRpcmVjdGx5IGluIG9uZSBvZiB0aGVzZSB0ZXJtaW5hbHM6XG4ke3BsYXRmb3JtVGVybWluYWxzfSAgIOKAoiBJREU6IFZTQ29kZSwgQ3Vyc29yLCBXaW5kc3VyZiwgWmVkXG4gICDigKIgT3RoZXI6IEFsYWNyaXR0eVxuMy4gUmV0dXJuIHRvIHRtdXgvc2NyZWVuIC0gc2V0dGluZ3Mgd2lsbCBwZXJzaXN0XG5cbiR7Y2hhbGsuZGltKCdOb3RlOiBpVGVybTIsIFdlelRlcm0sIEdob3N0dHksIEtpdHR5LCBhbmQgV2FycCBzdXBwb3J0IFNoaWZ0K0VudGVyIG5hdGl2ZWx5LicpfWBcbiAgICBvbkRvbmUobWVzc2FnZSlcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2V0dXBUZXJtaW5hbChjb250ZXh0Lm9wdGlvbnMudGhlbWUpXG4gIG9uRG9uZShyZXN1bHQpXG4gIHJldHVybiBudWxsXG59XG5cbnR5cGUgVlNDb2RlS2V5YmluZGluZyA9IHtcbiAga2V5OiBzdHJpbmdcbiAgY29tbWFuZDogc3RyaW5nXG4gIGFyZ3M6IHsgdGV4dDogc3RyaW5nIH1cbiAgd2hlbjogc3RyaW5nXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGluc3RhbGxCaW5kaW5nc0ZvclZTQ29kZVRlcm1pbmFsKFxuICBlZGl0b3I6ICdWU0NvZGUnIHwgJ0N1cnNvcicgfCAnV2luZHN1cmYnID0gJ1ZTQ29kZScsXG4gIHRoZW1lOiBUaGVtZU5hbWUsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAvLyBDaGVjayBpZiB3ZSdyZSBydW5uaW5nIGluIGEgVlNDb2RlIFJlbW90ZSBTU0ggc2Vzc2lvblxuICAvLyBJbiB0aGlzIGNhc2UsIGtleWJpbmRpbmdzIG5lZWQgdG8gYmUgaW5zdGFsbGVkIG9uIHRoZSBMT0NBTCBtYWNoaW5lXG4gIGlmIChpc1ZTQ29kZVJlbW90ZVNTSCgpKSB7XG4gICAgcmV0dXJuIGAke2NvbG9yKFxuICAgICAgJ3dhcm5pbmcnLFxuICAgICAgdGhlbWUsXG4gICAgKShcbiAgICAgIGBDYW5ub3QgaW5zdGFsbCBrZXliaW5kaW5ncyBmcm9tIGEgcmVtb3RlICR7ZWRpdG9yfSBzZXNzaW9uLmAsXG4gICAgKX0ke0VPTH0ke0VPTH0ke2VkaXRvcn0ga2V5YmluZGluZ3MgbXVzdCBiZSBpbnN0YWxsZWQgb24geW91ciBsb2NhbCBtYWNoaW5lLCBub3QgdGhlIHJlbW90ZSBzZXJ2ZXIuJHtFT0x9JHtFT0x9VG8gaW5zdGFsbCB0aGUgU2hpZnQrRW50ZXIga2V5YmluZGluZzoke0VPTH0xLiBPcGVuICR7ZWRpdG9yfSBvbiB5b3VyIGxvY2FsIG1hY2hpbmUgKG5vdCBjb25uZWN0ZWQgdG8gcmVtb3RlKSR7RU9MfTIuIE9wZW4gdGhlIENvbW1hbmQgUGFsZXR0ZSAoQ21kL0N0cmwrU2hpZnQrUCkg4oaSIFwiUHJlZmVyZW5jZXM6IE9wZW4gS2V5Ym9hcmQgU2hvcnRjdXRzIChKU09OKVwiJHtFT0x9My4gQWRkIHRoaXMga2V5YmluZGluZyAodGhlIGZpbGUgbXVzdCBiZSBhIEpTT04gYXJyYXkpOiR7RU9MfSR7RU9MfSR7Y2hhbGsuZGltKGBbXG4gIHtcbiAgICBcImtleVwiOiBcInNoaWZ0K2VudGVyXCIsXG4gICAgXCJjb21tYW5kXCI6IFwid29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZW5kU2VxdWVuY2VcIixcbiAgICBcImFyZ3NcIjogeyBcInRleHRcIjogXCJcXFxcdTAwMWJcXFxcclwiIH0sXG4gICAgXCJ3aGVuXCI6IFwidGVybWluYWxGb2N1c1wiXG4gIH1cbl1gKX0ke0VPTH1gXG4gIH1cblxuICBjb25zdCBlZGl0b3JEaXIgPSBlZGl0b3IgPT09ICdWU0NvZGUnID8gJ0NvZGUnIDogZWRpdG9yXG4gIGNvbnN0IHVzZXJEaXJQYXRoID0gam9pbihcbiAgICBob21lZGlyKCksXG4gICAgcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJ1xuICAgICAgPyBqb2luKCdBcHBEYXRhJywgJ1JvYW1pbmcnLCBlZGl0b3JEaXIsICdVc2VyJylcbiAgICAgIDogcGxhdGZvcm0oKSA9PT0gJ2RhcndpbidcbiAgICAgICAgPyBqb2luKCdMaWJyYXJ5JywgJ0FwcGxpY2F0aW9uIFN1cHBvcnQnLCBlZGl0b3JEaXIsICdVc2VyJylcbiAgICAgICAgOiBqb2luKCcuY29uZmlnJywgZWRpdG9yRGlyLCAnVXNlcicpLFxuICApXG4gIGNvbnN0IGtleWJpbmRpbmdzUGF0aCA9IGpvaW4odXNlckRpclBhdGgsICdrZXliaW5kaW5ncy5qc29uJylcblxuICB0cnkge1xuICAgIC8vIEVuc3VyZSB1c2VyIGRpcmVjdG9yeSBleGlzdHMgKGlkZW1wb3RlbnQgd2l0aCByZWN1cnNpdmUpXG4gICAgYXdhaXQgbWtkaXIodXNlckRpclBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG5cbiAgICAvLyBSZWFkIGV4aXN0aW5nIGtleWJpbmRpbmdzIGZpbGUsIG9yIGRlZmF1bHQgdG8gZW1wdHkgYXJyYXkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgIGxldCBjb250ZW50ID0gJ1tdJ1xuICAgIGxldCBrZXliaW5kaW5nczogVlNDb2RlS2V5YmluZGluZ1tdID0gW11cbiAgICBsZXQgZmlsZUV4aXN0cyA9IGZhbHNlXG4gICAgdHJ5IHtcbiAgICAgIGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZShrZXliaW5kaW5nc1BhdGgsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSlcbiAgICAgIGZpbGVFeGlzdHMgPSB0cnVlXG4gICAgICBrZXliaW5kaW5ncyA9IChzYWZlUGFyc2VKU09OQyhjb250ZW50KSBhcyBWU0NvZGVLZXliaW5kaW5nW10pID8/IFtdXG4gICAgfSBjYXRjaCAoZTogdW5rbm93bikge1xuICAgICAgaWYgKCFpc0ZzSW5hY2Nlc3NpYmxlKGUpKSB0aHJvdyBlXG4gICAgfVxuXG4gICAgLy8gQmFja3VwIHRoZSBleGlzdGluZyBmaWxlIGJlZm9yZSBtb2RpZnlpbmcgaXRcbiAgICBpZiAoZmlsZUV4aXN0cykge1xuICAgICAgY29uc3QgcmFuZG9tU2hhID0gcmFuZG9tQnl0ZXMoNCkudG9TdHJpbmcoJ2hleCcpXG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gYCR7a2V5YmluZGluZ3NQYXRofS4ke3JhbmRvbVNoYX0uYmFrYFxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY29weUZpbGUoa2V5YmluZGluZ3NQYXRoLCBiYWNrdXBQYXRoKVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBgJHtjb2xvcihcbiAgICAgICAgICAnd2FybmluZycsXG4gICAgICAgICAgdGhlbWUsXG4gICAgICAgICkoXG4gICAgICAgICAgYEVycm9yIGJhY2tpbmcgdXAgZXhpc3RpbmcgJHtlZGl0b3J9IHRlcm1pbmFsIGtleWJpbmRpbmdzLiBCYWlsaW5nIG91dC5gLFxuICAgICAgICApfSR7RU9MfSR7Y2hhbGsuZGltKGBTZWUgJHtmb3JtYXRQYXRoTGluayhrZXliaW5kaW5nc1BhdGgpfWApfSR7RU9MfSR7Y2hhbGsuZGltKGBCYWNrdXAgcGF0aDogJHtmb3JtYXRQYXRoTGluayhiYWNrdXBQYXRoKX1gKX0ke0VPTH1gXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYga2V5YmluZGluZyBhbHJlYWR5IGV4aXN0c1xuICAgIGNvbnN0IGV4aXN0aW5nQmluZGluZyA9IGtleWJpbmRpbmdzLmZpbmQoXG4gICAgICBiaW5kaW5nID0+XG4gICAgICAgIGJpbmRpbmcua2V5ID09PSAnc2hpZnQrZW50ZXInICYmXG4gICAgICAgIGJpbmRpbmcuY29tbWFuZCA9PT0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VuZFNlcXVlbmNlJyAmJlxuICAgICAgICBiaW5kaW5nLndoZW4gPT09ICd0ZXJtaW5hbEZvY3VzJyxcbiAgICApXG4gICAgaWYgKGV4aXN0aW5nQmluZGluZykge1xuICAgICAgcmV0dXJuIGAke2NvbG9yKFxuICAgICAgICAnd2FybmluZycsXG4gICAgICAgIHRoZW1lLFxuICAgICAgKShcbiAgICAgICAgYEZvdW5kIGV4aXN0aW5nICR7ZWRpdG9yfSB0ZXJtaW5hbCBTaGlmdCtFbnRlciBrZXkgYmluZGluZy4gUmVtb3ZlIGl0IHRvIGNvbnRpbnVlLmAsXG4gICAgICApfSR7RU9MfSR7Y2hhbGsuZGltKGBTZWUgJHtmb3JtYXRQYXRoTGluayhrZXliaW5kaW5nc1BhdGgpfWApfSR7RU9MfWBcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIG5ldyBrZXliaW5kaW5nXG4gICAgY29uc3QgbmV3S2V5YmluZGluZzogVlNDb2RlS2V5YmluZGluZyA9IHtcbiAgICAgIGtleTogJ3NoaWZ0K2VudGVyJyxcbiAgICAgIGNvbW1hbmQ6ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbmRTZXF1ZW5jZScsXG4gICAgICBhcmdzOiB7IHRleHQ6ICdcXHUwMDFiXFxyJyB9LFxuICAgICAgd2hlbjogJ3Rlcm1pbmFsRm9jdXMnLFxuICAgIH1cblxuICAgIC8vIE1vZGlmeSB0aGUgY29udGVudCBieSBhZGRpbmcgdGhlIG5ldyBrZXliaW5kaW5nIHdoaWxlIHByZXNlcnZpbmcgY29tbWVudHMgYW5kIGZvcm1hdHRpbmdcbiAgICBjb25zdCB1cGRhdGVkQ29udGVudCA9IGFkZEl0ZW1Ub0pTT05DQXJyYXkoY29udGVudCwgbmV3S2V5YmluZGluZylcblxuICAgIC8vIFdyaXRlIHRoZSB1cGRhdGVkIGNvbnRlbnQgYmFjayB0byB0aGUgZmlsZVxuICAgIGF3YWl0IHdyaXRlRmlsZShrZXliaW5kaW5nc1BhdGgsIHVwZGF0ZWRDb250ZW50LCB7IGVuY29kaW5nOiAndXRmLTgnIH0pXG5cbiAgICByZXR1cm4gYCR7Y29sb3IoXG4gICAgICAnc3VjY2VzcycsXG4gICAgICB0aGVtZSxcbiAgICApKFxuICAgICAgYEluc3RhbGxlZCAke2VkaXRvcn0gdGVybWluYWwgU2hpZnQrRW50ZXIga2V5IGJpbmRpbmdgLFxuICAgICl9JHtFT0x9JHtjaGFsay5kaW0oYFNlZSAke2Zvcm1hdFBhdGhMaW5rKGtleWJpbmRpbmdzUGF0aCl9YCl9JHtFT0x9YFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBGYWlsZWQgdG8gaW5zdGFsbCAke2VkaXRvcn0gdGVybWluYWwgU2hpZnQrRW50ZXIga2V5IGJpbmRpbmdgLFxuICAgIClcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBlbmFibGVPcHRpb25Bc01ldGFGb3JQcm9maWxlKFxuICBwcm9maWxlTmFtZTogc3RyaW5nLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIC8vIEZpcnN0IHRyeSB0byBhZGQgdGhlIHByb3BlcnR5IChpbiBjYXNlIGl0IGRvZXNuJ3QgZXhpc3QpXG4gIC8vIFF1b3RlIHRoZSBwcm9maWxlIG5hbWUgdG8gaGFuZGxlIG5hbWVzIHdpdGggc3BhY2VzIChlLmcuLCBcIk1hbiBQYWdlXCIsIFwiUmVkIFNhbmRzXCIpXG4gIGNvbnN0IHsgY29kZTogYWRkQ29kZSB9ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCcvdXNyL2xpYmV4ZWMvUGxpc3RCdWRkeScsIFtcbiAgICAnLWMnLFxuICAgIGBBZGQgOidXaW5kb3cgU2V0dGluZ3MnOicke3Byb2ZpbGVOYW1lfSc6dXNlT3B0aW9uQXNNZXRhS2V5IGJvb2wgdHJ1ZWAsXG4gICAgZ2V0VGVybWluYWxQbGlzdFBhdGgoKSxcbiAgXSlcblxuICAvLyBJZiBhZGRpbmcgZmFpbHMgKGxpa2VseSBiZWNhdXNlIGl0IGFscmVhZHkgZXhpc3RzKSwgdHJ5IHNldHRpbmcgaXQgaW5zdGVhZFxuICBpZiAoYWRkQ29kZSAhPT0gMCkge1xuICAgIGNvbnN0IHsgY29kZTogc2V0Q29kZSB9ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCcvdXNyL2xpYmV4ZWMvUGxpc3RCdWRkeScsIFtcbiAgICAgICctYycsXG4gICAgICBgU2V0IDonV2luZG93IFNldHRpbmdzJzonJHtwcm9maWxlTmFtZX0nOnVzZU9wdGlvbkFzTWV0YUtleSB0cnVlYCxcbiAgICAgIGdldFRlcm1pbmFsUGxpc3RQYXRoKCksXG4gICAgXSlcblxuICAgIGlmIChzZXRDb2RlICE9PSAwKSB7XG4gICAgICBsb2dFcnJvcihcbiAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgIGBGYWlsZWQgdG8gZW5hYmxlIE9wdGlvbiBhcyBNZXRhIGtleSBmb3IgVGVybWluYWwuYXBwIHByb2ZpbGU6ICR7cHJvZmlsZU5hbWV9YCxcbiAgICAgICAgKSxcbiAgICAgIClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRpc2FibGVBdWRpb0JlbGxGb3JQcm9maWxlKFxuICBwcm9maWxlTmFtZTogc3RyaW5nLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIC8vIEZpcnN0IHRyeSB0byBhZGQgdGhlIHByb3BlcnR5IChpbiBjYXNlIGl0IGRvZXNuJ3QgZXhpc3QpXG4gIC8vIFF1b3RlIHRoZSBwcm9maWxlIG5hbWUgdG8gaGFuZGxlIG5hbWVzIHdpdGggc3BhY2VzIChlLmcuLCBcIk1hbiBQYWdlXCIsIFwiUmVkIFNhbmRzXCIpXG4gIGNvbnN0IHsgY29kZTogYWRkQ29kZSB9ID0gYXdhaXQgZXhlY0ZpbGVOb1Rocm93KCcvdXNyL2xpYmV4ZWMvUGxpc3RCdWRkeScsIFtcbiAgICAnLWMnLFxuICAgIGBBZGQgOidXaW5kb3cgU2V0dGluZ3MnOicke3Byb2ZpbGVOYW1lfSc6QmVsbCBib29sIGZhbHNlYCxcbiAgICBnZXRUZXJtaW5hbFBsaXN0UGF0aCgpLFxuICBdKVxuXG4gIC8vIElmIGFkZGluZyBmYWlscyAobGlrZWx5IGJlY2F1c2UgaXQgYWxyZWFkeSBleGlzdHMpLCB0cnkgc2V0dGluZyBpdCBpbnN0ZWFkXG4gIGlmIChhZGRDb2RlICE9PSAwKSB7XG4gICAgY29uc3QgeyBjb2RlOiBzZXRDb2RlIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coJy91c3IvbGliZXhlYy9QbGlzdEJ1ZGR5JywgW1xuICAgICAgJy1jJyxcbiAgICAgIGBTZXQgOidXaW5kb3cgU2V0dGluZ3MnOicke3Byb2ZpbGVOYW1lfSc6QmVsbCBmYWxzZWAsXG4gICAgICBnZXRUZXJtaW5hbFBsaXN0UGF0aCgpLFxuICAgIF0pXG5cbiAgICBpZiAoc2V0Q29kZSAhPT0gMCkge1xuICAgICAgbG9nRXJyb3IoXG4gICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICBgRmFpbGVkIHRvIGRpc2FibGUgYXVkaW8gYmVsbCBmb3IgVGVybWluYWwuYXBwIHByb2ZpbGU6ICR7cHJvZmlsZU5hbWV9YCxcbiAgICAgICAgKSxcbiAgICAgIClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlXG59XG5cbi8vIEVuYWJsZSBPcHRpb24gYXMgTWV0YSBrZXkgZm9yIFRlcm1pbmFsLmFwcFxuYXN5bmMgZnVuY3Rpb24gZW5hYmxlT3B0aW9uQXNNZXRhRm9yVGVybWluYWwoXG4gIHRoZW1lOiBUaGVtZU5hbWUsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICB0cnkge1xuICAgIC8vIENyZWF0ZSBhIGJhY2t1cCBvZiB0aGUgY3VycmVudCBwbGlzdCBmaWxlXG4gICAgY29uc3QgYmFja3VwUGF0aCA9IGF3YWl0IGJhY2t1cFRlcm1pbmFsUHJlZmVyZW5jZXMoKVxuICAgIGlmICghYmFja3VwUGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnRmFpbGVkIHRvIGNyZWF0ZSBiYWNrdXAgb2YgVGVybWluYWwuYXBwIHByZWZlcmVuY2VzLCBiYWlsaW5nIG91dCcsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gUmVhZCB0aGUgY3VycmVudCBkZWZhdWx0IHByb2ZpbGUgZnJvbSB0aGUgcGxpc3RcbiAgICBjb25zdCB7IHN0ZG91dDogZGVmYXVsdFByb2ZpbGUsIGNvZGU6IHJlYWRDb2RlIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coXG4gICAgICAnZGVmYXVsdHMnLFxuICAgICAgWydyZWFkJywgJ2NvbS5hcHBsZS5UZXJtaW5hbCcsICdEZWZhdWx0IFdpbmRvdyBTZXR0aW5ncyddLFxuICAgIClcblxuICAgIGlmIChyZWFkQ29kZSAhPT0gMCB8fCAhZGVmYXVsdFByb2ZpbGUudHJpbSgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIGRlZmF1bHQgVGVybWluYWwuYXBwIHByb2ZpbGUnKVxuICAgIH1cblxuICAgIGNvbnN0IHsgc3Rkb3V0OiBzdGFydHVwUHJvZmlsZSwgY29kZTogc3RhcnR1cENvZGUgfSA9IGF3YWl0IGV4ZWNGaWxlTm9UaHJvdyhcbiAgICAgICdkZWZhdWx0cycsXG4gICAgICBbJ3JlYWQnLCAnY29tLmFwcGxlLlRlcm1pbmFsJywgJ1N0YXJ0dXAgV2luZG93IFNldHRpbmdzJ10sXG4gICAgKVxuICAgIGlmIChzdGFydHVwQ29kZSAhPT0gMCB8fCAhc3RhcnR1cFByb2ZpbGUudHJpbSgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHN0YXJ0dXAgVGVybWluYWwuYXBwIHByb2ZpbGUnKVxuICAgIH1cblxuICAgIGxldCB3YXNBbnlQcm9maWxlVXBkYXRlZCA9IGZhbHNlXG5cbiAgICBjb25zdCBkZWZhdWx0UHJvZmlsZU5hbWUgPSBkZWZhdWx0UHJvZmlsZS50cmltKClcbiAgICBjb25zdCBvcHRpb25Bc01ldGFFbmFibGVkID1cbiAgICAgIGF3YWl0IGVuYWJsZU9wdGlvbkFzTWV0YUZvclByb2ZpbGUoZGVmYXVsdFByb2ZpbGVOYW1lKVxuICAgIGNvbnN0IGF1ZGlvQmVsbERpc2FibGVkID1cbiAgICAgIGF3YWl0IGRpc2FibGVBdWRpb0JlbGxGb3JQcm9maWxlKGRlZmF1bHRQcm9maWxlTmFtZSlcblxuICAgIGlmIChvcHRpb25Bc01ldGFFbmFibGVkIHx8IGF1ZGlvQmVsbERpc2FibGVkKSB7XG4gICAgICB3YXNBbnlQcm9maWxlVXBkYXRlZCA9IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBzdGFydHVwUHJvZmlsZU5hbWUgPSBzdGFydHVwUHJvZmlsZS50cmltKClcblxuICAgIC8vIE9ubHkgcHJvY2VlZCBpZiB0aGUgc3RhcnR1cCBwcm9maWxlIGlzIGRpZmZlcmVudCBmcm9tIHRoZSBkZWZhdWx0IHByb2ZpbGVcbiAgICBpZiAoc3RhcnR1cFByb2ZpbGVOYW1lICE9PSBkZWZhdWx0UHJvZmlsZU5hbWUpIHtcbiAgICAgIGNvbnN0IHN0YXJ0dXBPcHRpb25Bc01ldGFFbmFibGVkID1cbiAgICAgICAgYXdhaXQgZW5hYmxlT3B0aW9uQXNNZXRhRm9yUHJvZmlsZShzdGFydHVwUHJvZmlsZU5hbWUpXG4gICAgICBjb25zdCBzdGFydHVwQXVkaW9CZWxsRGlzYWJsZWQgPVxuICAgICAgICBhd2FpdCBkaXNhYmxlQXVkaW9CZWxsRm9yUHJvZmlsZShzdGFydHVwUHJvZmlsZU5hbWUpXG5cbiAgICAgIGlmIChzdGFydHVwT3B0aW9uQXNNZXRhRW5hYmxlZCB8fCBzdGFydHVwQXVkaW9CZWxsRGlzYWJsZWQpIHtcbiAgICAgICAgd2FzQW55UHJvZmlsZVVwZGF0ZWQgPSB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF3YXNBbnlQcm9maWxlVXBkYXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnRmFpbGVkIHRvIGVuYWJsZSBPcHRpb24gYXMgTWV0YSBrZXkgb3IgZGlzYWJsZSBhdWRpbyBiZWxsIGZvciBhbnkgVGVybWluYWwuYXBwIHByb2ZpbGUnLFxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIEZsdXNoIHRoZSBwcmVmZXJlbmNlcyBjYWNoZVxuICAgIGF3YWl0IGV4ZWNGaWxlTm9UaHJvdygna2lsbGFsbCcsIFsnY2ZwcmVmc2QnXSlcblxuICAgIG1hcmtUZXJtaW5hbFNldHVwQ29tcGxldGUoKVxuXG4gICAgcmV0dXJuIGAke2NvbG9yKFxuICAgICAgJ3N1Y2Nlc3MnLFxuICAgICAgdGhlbWUsXG4gICAgKShcbiAgICAgIGBDb25maWd1cmVkIFRlcm1pbmFsLmFwcCBzZXR0aW5nczpgLFxuICAgICl9JHtFT0x9JHtjb2xvcignc3VjY2VzcycsIHRoZW1lKSgnLSBFbmFibGVkIFwiVXNlIE9wdGlvbiBhcyBNZXRhIGtleVwiJyl9JHtFT0x9JHtjb2xvcignc3VjY2VzcycsIHRoZW1lKSgnLSBTd2l0Y2hlZCB0byB2aXN1YWwgYmVsbCcpfSR7RU9MfSR7Y2hhbGsuZGltKCdPcHRpb24rRW50ZXIgd2lsbCBub3cgZW50ZXIgYSBuZXdsaW5lLicpfSR7RU9MfSR7Y2hhbGsuZGltKCdZb3UgbXVzdCByZXN0YXJ0IFRlcm1pbmFsLmFwcCBmb3IgY2hhbmdlcyB0byB0YWtlIGVmZmVjdC4nLCB0aGVtZSl9JHtFT0x9YFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKGVycm9yKVxuXG4gICAgLy8gQXR0ZW1wdCB0byByZXN0b3JlIGZyb20gYmFja3VwXG4gICAgY29uc3QgcmVzdG9yZVJlc3VsdCA9IGF3YWl0IGNoZWNrQW5kUmVzdG9yZVRlcm1pbmFsQmFja3VwKClcblxuICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9ICdGYWlsZWQgdG8gZW5hYmxlIE9wdGlvbiBhcyBNZXRhIGtleSBmb3IgVGVybWluYWwuYXBwLidcbiAgICBpZiAocmVzdG9yZVJlc3VsdC5zdGF0dXMgPT09ICdyZXN0b3JlZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYCR7ZXJyb3JNZXNzYWdlfSBZb3VyIHNldHRpbmdzIGhhdmUgYmVlbiByZXN0b3JlZCBmcm9tIGJhY2t1cC5gLFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAocmVzdG9yZVJlc3VsdC5zdGF0dXMgPT09ICdmYWlsZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGAke2Vycm9yTWVzc2FnZX0gUmVzdG9yaW5nIGZyb20gYmFja3VwIGZhaWxlZCwgdHJ5IG1hbnVhbGx5IHdpdGg6IGRlZmF1bHRzIGltcG9ydCBjb20uYXBwbGUuVGVybWluYWwgJHtyZXN0b3JlUmVzdWx0LmJhY2t1cFBhdGh9YCxcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgJHtlcnJvck1lc3NhZ2V9IE5vIGJhY2t1cCB3YXMgYXZhaWxhYmxlIHRvIHJlc3RvcmUgZnJvbS5gLFxuICAgICAgKVxuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbnN0YWxsQmluZGluZ3NGb3JBbGFjcml0dHkodGhlbWU6IFRoZW1lTmFtZSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IEFMQUNSSVRUWV9LRVlCSU5ESU5HID0gYFtba2V5Ym9hcmQuYmluZGluZ3NdXVxua2V5ID0gXCJSZXR1cm5cIlxubW9kcyA9IFwiU2hpZnRcIlxuY2hhcnMgPSBcIlxcXFx1MDAxQlxcXFxyXCJgXG5cbiAgLy8gR2V0IEFsYWNyaXR0eSBjb25maWcgZmlsZSBwYXRocyBpbiBvcmRlciBvZiBwcmVmZXJlbmNlXG4gIGNvbnN0IGNvbmZpZ1BhdGhzOiBzdHJpbmdbXSA9IFtdXG5cbiAgLy8gWERHIGNvbmZpZyBwYXRoIChMaW51eCBhbmQgbWFjT1MpXG4gIGNvbnN0IHhkZ0NvbmZpZ0hvbWUgPSBwcm9jZXNzLmVudi5YREdfQ09ORklHX0hPTUVcbiAgaWYgKHhkZ0NvbmZpZ0hvbWUpIHtcbiAgICBjb25maWdQYXRocy5wdXNoKGpvaW4oeGRnQ29uZmlnSG9tZSwgJ2FsYWNyaXR0eScsICdhbGFjcml0dHkudG9tbCcpKVxuICB9IGVsc2Uge1xuICAgIGNvbmZpZ1BhdGhzLnB1c2goam9pbihob21lZGlyKCksICcuY29uZmlnJywgJ2FsYWNyaXR0eScsICdhbGFjcml0dHkudG9tbCcpKVxuICB9XG5cbiAgLy8gV2luZG93cy1zcGVjaWZpYyBwYXRoXG4gIGlmIChwbGF0Zm9ybSgpID09PSAnd2luMzInKSB7XG4gICAgY29uc3QgYXBwRGF0YSA9IHByb2Nlc3MuZW52LkFQUERBVEFcbiAgICBpZiAoYXBwRGF0YSkge1xuICAgICAgY29uZmlnUGF0aHMucHVzaChqb2luKGFwcERhdGEsICdhbGFjcml0dHknLCAnYWxhY3JpdHR5LnRvbWwnKSlcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIGV4aXN0aW5nIGNvbmZpZyBmaWxlIGJ5IGF0dGVtcHRpbmcgdG8gcmVhZCBpdCwgb3IgdXNlIGZpcnN0IHByZWZlcnJlZCBwYXRoXG4gIGxldCBjb25maWdQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBsZXQgY29uZmlnQ29udGVudCA9ICcnXG4gIGxldCBjb25maWdFeGlzdHMgPSBmYWxzZVxuXG4gIGZvciAoY29uc3QgcGF0aCBvZiBjb25maWdQYXRocykge1xuICAgIHRyeSB7XG4gICAgICBjb25maWdDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUocGF0aCwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KVxuICAgICAgY29uZmlnUGF0aCA9IHBhdGhcbiAgICAgIGNvbmZpZ0V4aXN0cyA9IHRydWVcbiAgICAgIGJyZWFrXG4gICAgfSBjYXRjaCAoZTogdW5rbm93bikge1xuICAgICAgaWYgKCFpc0ZzSW5hY2Nlc3NpYmxlKGUpKSB0aHJvdyBlXG4gICAgICAvLyBGaWxlIG1pc3Npbmcgb3IgaW5hY2Nlc3NpYmxlIOKAlCB0cnkgbmV4dCBjb25maWcgcGF0aFxuICAgIH1cbiAgfVxuXG4gIC8vIElmIG5vIGNvbmZpZyBleGlzdHMsIHVzZSB0aGUgZmlyc3QgcGF0aCAoWERHL2RlZmF1bHQgbG9jYXRpb24pXG4gIGlmICghY29uZmlnUGF0aCkge1xuICAgIGNvbmZpZ1BhdGggPSBjb25maWdQYXRoc1swXSA/PyBudWxsXG4gIH1cblxuICBpZiAoIWNvbmZpZ1BhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHZhbGlkIGNvbmZpZyBwYXRoIGZvdW5kIGZvciBBbGFjcml0dHknKVxuICB9XG5cbiAgdHJ5IHtcbiAgICBpZiAoY29uZmlnRXhpc3RzKSB7XG4gICAgICAvLyBDaGVjayBpZiBrZXliaW5kaW5nIGFscmVhZHkgZXhpc3RzIChsb29rIGZvciBTaGlmdCtSZXR1cm4gYmluZGluZylcbiAgICAgIGlmIChcbiAgICAgICAgY29uZmlnQ29udGVudC5pbmNsdWRlcygnbW9kcyA9IFwiU2hpZnRcIicpICYmXG4gICAgICAgIGNvbmZpZ0NvbnRlbnQuaW5jbHVkZXMoJ2tleSA9IFwiUmV0dXJuXCInKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiBgJHtjb2xvcihcbiAgICAgICAgICAnd2FybmluZycsXG4gICAgICAgICAgdGhlbWUsXG4gICAgICAgICkoXG4gICAgICAgICAgJ0ZvdW5kIGV4aXN0aW5nIEFsYWNyaXR0eSBTaGlmdCtFbnRlciBrZXkgYmluZGluZy4gUmVtb3ZlIGl0IHRvIGNvbnRpbnVlLicsXG4gICAgICAgICl9JHtFT0x9JHtjaGFsay5kaW0oYFNlZSAke2Zvcm1hdFBhdGhMaW5rKGNvbmZpZ1BhdGgpfWApfSR7RU9MfWBcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIGJhY2t1cFxuICAgICAgY29uc3QgcmFuZG9tU2hhID0gcmFuZG9tQnl0ZXMoNCkudG9TdHJpbmcoJ2hleCcpXG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gYCR7Y29uZmlnUGF0aH0uJHtyYW5kb21TaGF9LmJha2BcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGNvcHlGaWxlKGNvbmZpZ1BhdGgsIGJhY2t1cFBhdGgpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGAke2NvbG9yKFxuICAgICAgICAgICd3YXJuaW5nJyxcbiAgICAgICAgICB0aGVtZSxcbiAgICAgICAgKShcbiAgICAgICAgICAnRXJyb3IgYmFja2luZyB1cCBleGlzdGluZyBBbGFjcml0dHkgY29uZmlnLiBCYWlsaW5nIG91dC4nLFxuICAgICAgICApfSR7RU9MfSR7Y2hhbGsuZGltKGBTZWUgJHtmb3JtYXRQYXRoTGluayhjb25maWdQYXRoKX1gKX0ke0VPTH0ke2NoYWxrLmRpbShgQmFja3VwIHBhdGg6ICR7Zm9ybWF0UGF0aExpbmsoYmFja3VwUGF0aCl9YCl9JHtFT0x9YFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBFbnN1cmUgY29uZmlnIGRpcmVjdG9yeSBleGlzdHMgKGlkZW1wb3RlbnQgd2l0aCByZWN1cnNpdmUpXG4gICAgICBhd2FpdCBta2RpcihkaXJuYW1lKGNvbmZpZ1BhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICAgIH1cblxuICAgIC8vIEFkZCB0aGUga2V5YmluZGluZyB0byB0aGUgY29uZmlnXG4gICAgbGV0IHVwZGF0ZWRDb250ZW50ID0gY29uZmlnQ29udGVudFxuICAgIGlmIChjb25maWdDb250ZW50ICYmICFjb25maWdDb250ZW50LmVuZHNXaXRoKCdcXG4nKSkge1xuICAgICAgdXBkYXRlZENvbnRlbnQgKz0gJ1xcbidcbiAgICB9XG4gICAgdXBkYXRlZENvbnRlbnQgKz0gJ1xcbicgKyBBTEFDUklUVFlfS0VZQklORElORyArICdcXG4nXG5cbiAgICAvLyBXcml0ZSB0aGUgdXBkYXRlZCBjb25maWdcbiAgICBhd2FpdCB3cml0ZUZpbGUoY29uZmlnUGF0aCwgdXBkYXRlZENvbnRlbnQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSlcblxuICAgIHJldHVybiBgJHtjb2xvcihcbiAgICAgICdzdWNjZXNzJyxcbiAgICAgIHRoZW1lLFxuICAgICkoJ0luc3RhbGxlZCBBbGFjcml0dHkgU2hpZnQrRW50ZXIga2V5IGJpbmRpbmcnKX0ke0VPTH0ke2NvbG9yKFxuICAgICAgJ3N1Y2Nlc3MnLFxuICAgICAgdGhlbWUsXG4gICAgKShcbiAgICAgICdZb3UgbWF5IG5lZWQgdG8gcmVzdGFydCBBbGFjcml0dHkgZm9yIGNoYW5nZXMgdG8gdGFrZSBlZmZlY3QnLFxuICAgICl9JHtFT0x9JHtjaGFsay5kaW0oYFNlZSAke2Zvcm1hdFBhdGhMaW5rKGNvbmZpZ1BhdGgpfWApfSR7RU9MfWBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihlcnJvcilcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBpbnN0YWxsIEFsYWNyaXR0eSBTaGlmdCtFbnRlciBrZXkgYmluZGluZycpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5zdGFsbEJpbmRpbmdzRm9yWmVkKHRoZW1lOiBUaGVtZU5hbWUpOiBQcm9taXNlPHN0cmluZz4ge1xuICAvLyBaZWQgdXNlcyBKU09OIGtleWJpbmRpbmdzIHNpbWlsYXIgdG8gVlNDb2RlXG4gIGNvbnN0IHplZERpciA9IGpvaW4oaG9tZWRpcigpLCAnLmNvbmZpZycsICd6ZWQnKVxuICBjb25zdCBrZXltYXBQYXRoID0gam9pbih6ZWREaXIsICdrZXltYXAuanNvbicpXG5cbiAgdHJ5IHtcbiAgICAvLyBFbnN1cmUgemVkIGRpcmVjdG9yeSBleGlzdHMgKGlkZW1wb3RlbnQgd2l0aCByZWN1cnNpdmUpXG4gICAgYXdhaXQgbWtkaXIoemVkRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuXG4gICAgLy8gUmVhZCBleGlzdGluZyBrZXltYXAgZmlsZSwgb3IgZGVmYXVsdCB0byBlbXB0eSBhcnJheSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgbGV0IGtleW1hcENvbnRlbnQgPSAnW10nXG4gICAgbGV0IGZpbGVFeGlzdHMgPSBmYWxzZVxuICAgIHRyeSB7XG4gICAgICBrZXltYXBDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUoa2V5bWFwUGF0aCwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KVxuICAgICAgZmlsZUV4aXN0cyA9IHRydWVcbiAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICBpZiAoIWlzRnNJbmFjY2Vzc2libGUoZSkpIHRocm93IGVcbiAgICB9XG5cbiAgICBpZiAoZmlsZUV4aXN0cykge1xuICAgICAgLy8gQ2hlY2sgaWYga2V5YmluZGluZyBhbHJlYWR5IGV4aXN0c1xuICAgICAgaWYgKGtleW1hcENvbnRlbnQuaW5jbHVkZXMoJ3NoaWZ0LWVudGVyJykpIHtcbiAgICAgICAgcmV0dXJuIGAke2NvbG9yKFxuICAgICAgICAgICd3YXJuaW5nJyxcbiAgICAgICAgICB0aGVtZSxcbiAgICAgICAgKShcbiAgICAgICAgICAnRm91bmQgZXhpc3RpbmcgWmVkIFNoaWZ0K0VudGVyIGtleSBiaW5kaW5nLiBSZW1vdmUgaXQgdG8gY29udGludWUuJyxcbiAgICAgICAgKX0ke0VPTH0ke2NoYWxrLmRpbShgU2VlICR7Zm9ybWF0UGF0aExpbmsoa2V5bWFwUGF0aCl9YCl9JHtFT0x9YFxuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgYmFja3VwXG4gICAgICBjb25zdCByYW5kb21TaGEgPSByYW5kb21CeXRlcyg0KS50b1N0cmluZygnaGV4JylcbiAgICAgIGNvbnN0IGJhY2t1cFBhdGggPSBgJHtrZXltYXBQYXRofS4ke3JhbmRvbVNoYX0uYmFrYFxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY29weUZpbGUoa2V5bWFwUGF0aCwgYmFja3VwUGF0aClcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gYCR7Y29sb3IoXG4gICAgICAgICAgJ3dhcm5pbmcnLFxuICAgICAgICAgIHRoZW1lLFxuICAgICAgICApKFxuICAgICAgICAgICdFcnJvciBiYWNraW5nIHVwIGV4aXN0aW5nIFplZCBrZXltYXAuIEJhaWxpbmcgb3V0LicsXG4gICAgICAgICl9JHtFT0x9JHtjaGFsay5kaW0oYFNlZSAke2Zvcm1hdFBhdGhMaW5rKGtleW1hcFBhdGgpfWApfSR7RU9MfSR7Y2hhbGsuZGltKGBCYWNrdXAgcGF0aDogJHtmb3JtYXRQYXRoTGluayhiYWNrdXBQYXRoKX1gKX0ke0VPTH1gXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgYW5kIG1vZGlmeSB0aGUga2V5bWFwXG4gICAgbGV0IGtleW1hcDogQXJyYXk8e1xuICAgICAgY29udGV4dD86IHN0cmluZ1xuICAgICAgYmluZGluZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdPlxuICAgIH0+XG4gICAgdHJ5IHtcbiAgICAgIGtleW1hcCA9IGpzb25QYXJzZShrZXltYXBDb250ZW50KVxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGtleW1hcCkpIHtcbiAgICAgICAga2V5bWFwID0gW11cbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIGtleW1hcCA9IFtdXG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBuZXcga2V5YmluZGluZyBmb3IgdGVybWluYWwgY29udGV4dFxuICAgIGtleW1hcC5wdXNoKHtcbiAgICAgIGNvbnRleHQ6ICdUZXJtaW5hbCcsXG4gICAgICBiaW5kaW5nczoge1xuICAgICAgICAnc2hpZnQtZW50ZXInOiBbJ3Rlcm1pbmFsOjpTZW5kVGV4dCcsICdcXHUwMDFiXFxyJ10sXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBXcml0ZSB0aGUgdXBkYXRlZCBrZXltYXBcbiAgICBhd2FpdCB3cml0ZUZpbGUoa2V5bWFwUGF0aCwganNvblN0cmluZ2lmeShrZXltYXAsIG51bGwsIDIpICsgJ1xcbicsIHtcbiAgICAgIGVuY29kaW5nOiAndXRmLTgnLFxuICAgIH0pXG5cbiAgICByZXR1cm4gYCR7Y29sb3IoXG4gICAgICAnc3VjY2VzcycsXG4gICAgICB0aGVtZSxcbiAgICApKFxuICAgICAgJ0luc3RhbGxlZCBaZWQgU2hpZnQrRW50ZXIga2V5IGJpbmRpbmcnLFxuICAgICl9JHtFT0x9JHtjaGFsay5kaW0oYFNlZSAke2Zvcm1hdFBhdGhMaW5rKGtleW1hcFBhdGgpfWApfSR7RU9MfWBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihlcnJvcilcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBpbnN0YWxsIFplZCBTaGlmdCtFbnRlciBrZXkgYmluZGluZycpXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsT0FBT0EsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsV0FBVyxRQUFRLFFBQVE7QUFDcEMsU0FBU0MsUUFBUSxFQUFFQyxLQUFLLEVBQUVDLFFBQVEsRUFBRUMsU0FBUyxRQUFRLGFBQWE7QUFDbEUsU0FBU0MsT0FBTyxFQUFFQyxRQUFRLFFBQVEsSUFBSTtBQUN0QyxTQUFTQyxPQUFPLEVBQUVDLElBQUksUUFBUSxNQUFNO0FBQ3BDLGNBQWNDLFNBQVMsUUFBUSxvQkFBb0I7QUFDbkQsU0FBU0MsYUFBYSxRQUFRLEtBQUs7QUFDbkMsU0FBU0Msa0JBQWtCLFFBQVEsa0NBQWtDO0FBQ3JFLFNBQVNDLEtBQUssUUFBUSxjQUFjO0FBQ3BDLFNBQVNDLGtDQUFrQyxRQUFRLGlDQUFpQztBQUNwRixjQUFjQyxjQUFjLFFBQVEsZUFBZTtBQUNuRCxjQUNFQyxzQkFBc0IsRUFDdEJDLHFCQUFxQixRQUNoQix3QkFBd0I7QUFDL0IsU0FDRUMseUJBQXlCLEVBQ3pCQyw2QkFBNkIsRUFDN0JDLG9CQUFvQixFQUNwQkMseUJBQXlCLFFBQ3BCLG9DQUFvQztBQUMzQyxTQUFTQyxvQkFBb0IsUUFBUSxnQ0FB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