import type { Facts } from '../../facts'
import { JETBRAINS_IDES } from './jetbrains-ides'

/**
 * The row's `terminal` as the CLI names the terminal it runs in, read off
 * the same variables in the same order.
 *
 * The IDE hosts first, then TERM and TERM_PROGRAM, the multiplexers, the
 * Linux and Windows terminals, WSL, an ssh session, and what TERM still
 * tells; `non-interactive` with no person at the prompt, else `unknown`.
 *
 * @param facts the variables as read once for the session
 * @param platform the row's platform (the JetBrains check differs on darwin)
 * @param isInteractive whether a person is at the prompt
 * @returns the terminal's name
 */
export function terminalOf(
  facts: Facts,
  platform: string,
  isInteractive: boolean,
) {
  const askpass = (facts.vscodeGitAskpassMain ?? '').toLowerCase()
  const bundle = (facts.bundleIdentifier ?? '').toLowerCase()
  const term = facts.term ?? ''
  const termProgram = facts.termProgram ?? ''
  const isJediTerm = facts.terminalEmulator === 'JetBrains-JediTerm'
  const jetbrains = JETBRAINS_IDES.find(ide => bundle.includes(ide))

  const candidates: readonly (readonly [boolean, string])[] = [
    [isJediTerm && platform !== 'darwin', 'pycharm'],
    [facts.hasCursorTraceId || askpass.includes('cursor'), 'cursor'],
    [askpass.includes('windsurf'), 'windsurf'],
    [askpass.includes('antigravity'), 'antigravity'],
    [bundle.includes('vscodium'), 'codium'],
    [bundle.includes('windsurf') || bundle.includes('devin'), 'windsurf'],
    [bundle.includes('com.google.android.studio'), 'androidstudio'],
    [jetbrains !== undefined, jetbrains ?? ''],
    [facts.hasVisualStudioVersion, 'visualstudio'],
    [isJediTerm, 'pycharm'],
    [term === 'xterm-ghostty', 'ghostty'],
    [term.includes('kitty'), 'kitty'],
    [/^devin([ -]desktop)?$/i.test(termProgram), 'windsurf'],
    [termProgram !== '', termProgram],
    [facts.hasTmux, 'tmux'],
    [facts.hasSty, 'screen'],
    [facts.hasKonsoleVersion, 'konsole'],
    [facts.hasGnomeTerminalService, 'gnome-terminal'],
    [facts.hasXtermVersion, 'xterm'],
    [facts.hasVteVersion, 'vte-based'],
    [facts.hasTerminatorUuid, 'terminator'],
    [facts.hasKittyWindowId, 'kitty'],
    [facts.hasAlacrittyLog, 'alacritty'],
    [facts.hasTilixId, 'tilix'],
    [facts.hasWtSession, 'windows-terminal'],
    [facts.hasSessionName && term === 'cygwin', 'cygwin'],
    [facts.msystem !== undefined, (facts.msystem ?? '').toLowerCase()],
    [
      facts.hasConEmuAnsi || facts.hasConEmuPid || facts.hasConEmuTask,
      'conemu',
    ],
    [facts.wslDistroName !== undefined, `wsl-${facts.wslDistroName}`],
    [
      facts.hasSshConnection || facts.hasSshClient || facts.hasSshTty,
      'ssh-session',
    ],
    [term.includes('alacritty'), 'alacritty'],
    [term.includes('rxvt'), 'rxvt'],
    [term.includes('termite'), 'termite'],
    [term !== '', term],
    [!isInteractive, 'non-interactive'],
  ]

  return candidates.find(([isHeld]) => isHeld)?.[1] ?? 'unknown'
}
