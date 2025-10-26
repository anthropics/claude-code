/**
 * Terminal Spinner Fix - Prevents screen flickering by using line-specific updates
 * 
 * This implementation demonstrates how to properly update a terminal spinner/status indicator
 * without causing the entire terminal buffer to redraw, which causes flickering and
 * accessibility issues.
 */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let currentFrame = 0;
let startTime: number;
let spinnerInterval: NodeJS.Timeout | null = null;


export function startSpinner(message: string): void {
  startTime = Date.now();
  currentFrame = 0;
  
  // Clear any existing spinner
  if (spinnerInterval) {
    stopSpinner();
  }
  
  spinnerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const frame = SPINNER_FRAMES[currentFrame % SPINNER_FRAMES.length];
    
    // FIX: Use \r to return to start of line and overwrite, instead of clearing entire buffer
    // This prevents flickering by only updating the status line
    process.stdout.write(`\r${frame} ${message} (${elapsed}s)`);
    
    currentFrame++;
  }, 80); // Update every 80ms for smooth animation
}

/**
 * Stop the spinner and optionally show a completion message
 */
export function stopSpinner(completionMessage?: string): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  
  if (completionMessage) {

    process.stdout.write(`\r${completionMessage}\n`);
  } else {
    // Clear the spinner line
    process.stdout.write('\r\x1b[K'); // \x1b[K clears from cursor to end of line
  }
}


export function updateSpinnerMessage(newMessage: string): void {
  if (!spinnerInterval) {
    return;
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const frame = SPINNER_FRAMES[currentFrame % SPINNER_FRAMES.length];
  

  process.stdout.write(`\r${frame} ${newMessage} (${elapsed}s)`);
}

/**
 * Example usage demonstrating no flickering during long operations
 */
export async function exampleUsage(): Promise<void> {
  console.log('Starting a long operation...');
  
  startSpinner('Processing files');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  updateSpinnerMessage('Compiling code');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  stopSpinner('✓ Operation completed successfully');
  
  console.log('Other terminal output remains stable');
  console.log('No flickering occurred!');
}

/**
 * WRONG APPROACH - This is what causes flickering (DO NOT USE)
 */
export function badSpinnerImplementation(message: string): void {
  setInterval(() => {
    // BAD: console.clear() causes the entire terminal buffer to redraw
    // This creates flickering and destroys scrollback
    console.clear();
    console.log(`Loading ${message}...`);
  }, 100);
}


export const ANSI = {
  // Cursor movement
  cursorUp: (lines: number) => `\x1b[${lines}A`,
  cursorDown: (lines: number) => `\x1b[${lines}B`,
  cursorForward: (cols: number) => `\x1b[${cols}C`,
  cursorBack: (cols: number) => `\x1b[${cols}D`,
  
  // Line clearing
  clearLine: '\x1b[2K',           // Clear entire line
  clearLineRight: '\x1b[K',        // Clear from cursor to end of line
  clearLineLeft: '\x1b[1K',        // Clear from cursor to start of line
  
  // Save/restore cursor position
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  
  // Hide/show cursor
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

/**
 * Enhanced spinner with cursor hiding for cleaner display
 */
export class TerminalSpinner {
  private interval: NodeJS.Timeout | null = null;
  private frame = 0;
  private startTime = 0;
  private message = '';
  
  start(message: string): void {
    this.message = message;
    this.startTime = Date.now();
    this.frame = 0;
    
    // Hide cursor for cleaner display
    process.stdout.write(ANSI.hideCursor);
    
    this.interval = setInterval(() => {
      this.render();
    }, 80);
  }
  
  private render(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const frame = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
    
    // FIX: Line-specific update using \r - no flickering
    process.stdout.write(`\r${ANSI.clearLineRight}${frame} ${this.message} (${elapsed}s)`);
    
    this.frame++;
  }
  
  stop(completionMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    // Show cursor again
    process.stdout.write(ANSI.showCursor);
    
    if (completionMessage) {
      process.stdout.write(`\r${ANSI.clearLineRight}${completionMessage}\n`);
    } else {
      process.stdout.write(`\r${ANSI.clearLineRight}`);
    }
  }
  
  updateMessage(message: string): void {
    this.message = message;
    if (this.interval) {
      this.render();
    }
  }
}

// Export for use in other modules
export default {
  startSpinner,
  stopSpinner,
  updateSpinnerMessage,
  TerminalSpinner,
  ANSI,
};
