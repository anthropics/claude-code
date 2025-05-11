'use strict';
/**
 * `confirm` type prompt
 */

const chalk = require('chalk');
const { take, takeUntil } = require('rxjs/operators');
const Base = require('./base');
const observe = require('../utils/events');

class ConfirmPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    let rawDefault = true;

    Object.assign(this.opt, {
      filter(input) {
        let value = rawDefault;
        if (input != null && input !== '') {
          value = /^y(es)?/i.test(input);
        }

        return value;
      },
    });

    if (this.opt.default != null) {
      rawDefault = Boolean(this.opt.default);
    }

    this.opt.default = rawDefault ? 'Y/n' : 'y/N';
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb   Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    // Once user confirm (enter key)
    const events = observe(this.rl);
    events.keypress.pipe(takeUntil(events.line)).forEach(this.onKeypress.bind(this));

    events.line.pipe(take(1)).forEach(this.onEnd.bind(this));

    // Init
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {ConfirmPrompt} self
   */

  render(answer) {
    let message = this.getQuestion();

    if (typeof answer === 'boolean') {
      message += chalk.cyan(answer ? 'Yes' : 'No');
    } else {
      message += this.rl.line;
    }

    this.screen.render(message);

    return this;
  }

  /**
   * When user press `enter` key
   */

  onEnd(input) {
    this.status = 'answered';

    const output = this.opt.filter(input);
    this.render(output);

    this.screen.done();
    this.done(output);
  }

  /**
   * When user press a key
   */

  onKeypress() {
    this.render();
  }
}

module.exports = ConfirmPrompt;
