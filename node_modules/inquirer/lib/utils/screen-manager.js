'use strict';
const util = require('./readline');
const cliWidth = require('cli-width');
const wrapAnsi = require('wrap-ansi');
const stripAnsi = require('strip-ansi');
const stringWidth = require('string-width');
const ora = require('ora');

function height(content) {
  return content.split('\n').length;
}

/** @param {string} content */
function lastLine(content) {
  return content.split('\n').pop();
}

class ScreenManager {
  constructor(rl) {
    // These variables are keeping information to allow correct prompt re-rendering
    this.height = 0;
    this.extraLinesUnderPrompt = 0;

    this.rl = rl;
  }

  renderWithSpinner(content, bottomContent) {
    if (this.spinnerId) {
      clearInterval(this.spinnerId);
    }

    let spinner;
    let contentFunc;
    let bottomContentFunc;

    if (bottomContent) {
      spinner = ora(bottomContent);
      contentFunc = () => content;
      bottomContentFunc = () => spinner.frame();
    } else {
      spinner = ora(content);
      contentFunc = () => spinner.frame();
      bottomContentFunc = () => '';
    }

    this.spinnerId = setInterval(
      () => this.render(contentFunc(), bottomContentFunc(), true),
      spinner.interval
    );
  }

  render(content, bottomContent, spinning = false) {
    if (this.spinnerId && !spinning) {
      clearInterval(this.spinnerId);
    }

    this.rl.output.unmute();
    this.clean(this.extraLinesUnderPrompt);

    /**
     * Write message to screen and setPrompt to control backspace
     */

    const promptLine = lastLine(content);
    const rawPromptLine = stripAnsi(promptLine);

    // Remove the rl.line from our prompt. We can't rely on the content of
    // rl.line (mainly because of the password prompt), so just rely on it's
    // length.
    let prompt = rawPromptLine;
    if (this.rl.line.length) {
      prompt = prompt.slice(0, -this.rl.line.length);
    }

    this.rl.setPrompt(prompt);

    // SetPrompt will change cursor position, now we can get correct value
    const cursorPos = this.rl._getCursorPos();
    const width = this.normalizedCliWidth();

    content = this.forceLineReturn(content, width);
    if (bottomContent) {
      bottomContent = this.forceLineReturn(bottomContent, width);
    }

    // Manually insert an extra line if we're at the end of the line.
    // This prevent the cursor from appearing at the beginning of the
    // current line.
    if (rawPromptLine.length % width === 0) {
      content += '\n';
    }

    const fullContent = content + (bottomContent ? '\n' + bottomContent : '');
    this.rl.output.write(fullContent);

    /**
     * Re-adjust the cursor at the correct position.
     */

    // We need to consider parts of the prompt under the cursor as part of the bottom
    // content in order to correctly cleanup and re-render.
    const promptLineUpDiff = Math.floor(rawPromptLine.length / width) - cursorPos.rows;
    const bottomContentHeight =
      promptLineUpDiff + (bottomContent ? height(bottomContent) : 0);
    if (bottomContentHeight > 0) {
      util.up(this.rl, bottomContentHeight);
    }

    // Reset cursor at the beginning of the line
    util.left(this.rl, stringWidth(lastLine(fullContent)));

    // Adjust cursor on the right
    if (cursorPos.cols > 0) {
      util.right(this.rl, cursorPos.cols);
    }

    /**
     * Set up state for next re-rendering
     */
    this.extraLinesUnderPrompt = bottomContentHeight;
    this.height = height(fullContent);

    this.rl.output.mute();
  }

  clean(extraLines) {
    if (extraLines > 0) {
      util.down(this.rl, extraLines);
    }

    util.clearLine(this.rl, this.height);
  }

  done() {
    this.rl.setPrompt('');
    this.rl.output.unmute();
    this.rl.output.write('\n');
  }

  releaseCursor() {
    if (this.extraLinesUnderPrompt > 0) {
      util.down(this.rl, this.extraLinesUnderPrompt);
    }
  }

  normalizedCliWidth() {
    const width = cliWidth({
      defaultWidth: 80,
      output: this.rl.output,
    });
    return width;
  }

  /**
   * @param {string[]} lines
   */
  breakLines(lines, width = this.normalizedCliWidth()) {
    // Break lines who're longer than the cli width so we can normalize the natural line
    // returns behavior across terminals.
    // re: trim: false; by default, `wrap-ansi` trims whitespace, which
    // is not what we want.
    // re: hard: true; by default', `wrap-ansi` does soft wrapping
    return lines.map((line) =>
      wrapAnsi(line, width, { trim: false, hard: true }).split('\n')
    );
  }

  /**
   * @param {string} content
   */
  forceLineReturn(content, width = this.normalizedCliWidth()) {
    return this.breakLines(content.split('\n'), width).flat().join('\n');
  }
}

module.exports = ScreenManager;
