'use strict';
/**
 * `password` type prompt
 */

const chalk = require('chalk');
const { map, takeUntil } = require('rxjs/operators');
const Base = require('./base');
const observe = require('../utils/events');

function mask(input, maskChar) {
  input = String(input);
  maskChar = typeof maskChar === 'string' ? maskChar : '*';
  if (input.length === 0) {
    return '';
  }

  return new Array(input.length + 1).join(maskChar);
}

class PasswordPrompt extends Base {
  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    const events = observe(this.rl);

    // Once user confirm (enter key)
    const submit = events.line.pipe(map(this.filterInput.bind(this)));

    const validation = this.handleSubmitEvents(submit);
    validation.success.forEach(this.onEnd.bind(this));
    validation.error.forEach(this.onError.bind(this));

    events.keypress
      .pipe(takeUntil(validation.success))
      .forEach(this.onKeypress.bind(this));

    // Init
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {PasswordPrompt} self
   */

  render(error) {
    let message = this.getQuestion();
    let bottomContent = '';

    if (this.status === 'answered') {
      message += this.getMaskedValue(this.answer);
    } else {
      message += this.getMaskedValue(this.rl.line || '');
    }

    if (error) {
      bottomContent = '\n' + chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }

  getMaskedValue(value) {
    if (this.status === 'answered') {
      return this.opt.mask
        ? chalk.cyan(mask(value, this.opt.mask))
        : chalk.italic.dim('[hidden]');
    }
    return this.opt.mask
      ? mask(value, this.opt.mask)
      : chalk.italic.dim('[input is hidden] ');
  }

  /**
   * Mask value during async filter/validation.
   */
  getSpinningValue(value) {
    return this.getMaskedValue(value);
  }

  /**
   * When user press `enter` key
   */

  filterInput(input) {
    if (!input) {
      return this.opt.default == null ? '' : this.opt.default;
    }

    return input;
  }

  onEnd(state) {
    this.status = 'answered';
    this.answer = state.value;

    // Re-render prompt
    this.render();

    this.screen.done();
    this.done(state.value);
  }

  onError(state) {
    this.render(state.isValid);
  }

  onKeypress() {
    // If user press a key, just clear the default value
    if (this.opt.default) {
      this.opt.default = undefined;
    }

    this.render();
  }
}

module.exports = PasswordPrompt;
