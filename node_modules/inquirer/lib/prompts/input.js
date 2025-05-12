'use strict';
/**
 * `input` type prompt
 */

const chalk = require('chalk');
const { map, takeUntil } = require('rxjs/operators');
const Base = require('./base');
const observe = require('../utils/events');

class InputPrompt extends Base {
  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    // Once user confirm (enter key)
    const events = observe(this.rl);
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
   * @return {InputPrompt} self
   */

  render(error) {
    let bottomContent = '';
    let appendContent = '';
    let message = this.getQuestion();
    const { transformer } = this.opt;
    const isFinal = this.status === 'answered';

    if (isFinal) {
      appendContent = this.answer;
    } else {
      appendContent = this.rl.line;
    }

    if (transformer) {
      message += transformer(appendContent, this.answers, { isFinal });
    } else {
      message += isFinal ? chalk.cyan(appendContent) : appendContent;
    }

    if (error) {
      bottomContent = chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
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
    this.answer = state.value;
    this.status = 'answered';

    // Re-render prompt
    this.render();

    this.screen.done();
    this.done(state.value);
  }

  onError({ value = '', isValid }) {
    this.rl.line += value;
    this.rl.cursor += value.length;
    this.render(isValid);
  }

  /**
   * When user press a key
   */

  onKeypress() {
    this.status = 'touched';

    this.render();
  }
}

module.exports = InputPrompt;
