/**
 * Fix for Issue #11391: Filter DECSET 1004 focus events from terminal input
 *
 * Problem: Terminal focus events (ESC[I and ESC[O) are appearing as literal
 * text in Claude Code's input when switching between terminal panes/windows.
 *
 * Solution: Filter these escape sequences before they reach the readline interface.
 */

import { Interface as ReadlineInterface } from 'readline';
import { Writable } from 'stream';

/**
 * Focus event escape sequences that should be filtered:
 * - ESC[I or \x1b[I - Focus In event
 * - ESC[O or \x1b[O - Focus Out event
 *
 * Some terminals also send variations like:
 * - \x1b[0[I] - seen in some Kitty/tmux combinations
 */
const FOCUS_EVENT_REGEX = /\x1b\[(?:0)?\[?[IO]\]?/g;

/**
 * Alternative regex that's more precise for standard DECSET 1004 sequences
 */
const STRICT_FOCUS_EVENT_REGEX = /\x1b\[[IO]/g;

/**
 * Creates a transform stream that filters out terminal focus events
 * before they reach the readline interface.
 */
export class FocusEventFilter extends Writable {
  private target: Writable;

  constructor(target: Writable) {
    super();
    this.target = target;
  }

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      let data = typeof chunk === 'string' ? chunk : chunk.toString(encoding);

      // Filter out focus event escape sequences
      data = data.replace(FOCUS_EVENT_REGEX, '');

      // Also filter other common problematic sequences that shouldn't appear in input:
      // - Mouse tracking events: ESC[<...M
      // - Bracketed paste mode markers: ESC[200~ and ESC[201~
      data = data
        .replace(/\x1b\[<[^M]*M/g, '') // Mouse events
        .replace(/\x1b\[20[01]~/g, ''); // Bracketed paste markers

      if (data.length > 0) {
        this.target.write(data, encoding, callback);
      } else {
        callback();
      }
    } catch (error) {
      callback(error as Error);
    }
  }
}

/**
 * Wraps a readline interface to filter focus events from stdin.
 *
 * Usage example:
 * ```typescript
 * import * as readline from 'readline';
 *
 * const rl = readline.createInterface({
 *   input: process.stdin,
 *   output: process.stdout,
 * });
 *
 * // Apply the focus event filter
 * applyFocusEventFilter(rl);
 * ```
 */
export function applyFocusEventFilter(rl: ReadlineInterface): void {
  // Access the internal input stream
  const input = (rl as any).input;

  if (!input || typeof input.on !== 'function') {
    console.warn('Unable to apply focus event filter: invalid input stream');
    return;
  }

  // Create a filtered wrapper
  const filter = new FocusEventFilter(input);

  // Intercept data events
  const originalEmit = input.emit.bind(input);
  input.emit = function (event: string, ...args: any[]) {
    if (event === 'data') {
      const chunk = args[0];
      let data = typeof chunk === 'string' ? chunk : chunk.toString();

      // Filter focus events
      data = data.replace(FOCUS_EVENT_REGEX, '');

      if (data.length > 0) {
        return originalEmit(event, data, ...args.slice(1));
      }
      // Don't emit the event if we filtered everything
      return false;
    }
    return originalEmit(event, ...args);
  };
}

/**
 * Alternative approach: Disable focus events at the terminal level.
 * This is cleaner but may affect other tools that rely on focus events.
 */
export function disableFocusEvents(): void {
  if (process.stdout.isTTY) {
    // Send DECSET 1004 disable sequence
    process.stdout.write('\x1b[?1004l');
  }
}

/**
 * Enable focus events (if you want to re-enable them)
 */
export function enableFocusEvents(): void {
  if (process.stdout.isTTY) {
    // Send DECSET 1004 enable sequence
    process.stdout.write('\x1b[?1004h');
  }
}

/**
 * Recommended: Disable focus events on startup and re-enable on exit
 * to ensure clean terminal state without breaking other tools.
 */
export function setupFocusEventHandling(): () => void {
  disableFocusEvents();

  // Return cleanup function
  return () => {
    enableFocusEvents();
  };
}

/**
 * Additional utility: Detect if focus events are likely to cause issues
 */
export function isFocusEventEnvironment(): boolean {
  // Focus events are commonly problematic in these environments:
  return !!(
    process.env.TMUX || // tmux
    process.env.WEZTERM_EXECUTABLE || // WezTerm
    process.env.KITTY_WINDOW_ID || // Kitty
    process.env.GHOSTTY_RESOURCES_DIR || // Ghostty
    process.env.ALACRITTY_SOCKET // Alacritty
  );
}

// Export all functions for easy import
export default {
  FocusEventFilter,
  applyFocusEventFilter,
  disableFocusEvents,
  enableFocusEvents,
  setupFocusEventHandling,
  isFocusEventEnvironment,
};
