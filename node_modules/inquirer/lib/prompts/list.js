'use strict';
/**
 * `list` type prompt
 */

const chalk = require('chalk');
const figures = require('figures');
const cliCursor = require('cli-cursor');
const runAsync = require('run-async');
const { flatMap, map, take, takeUntil } = require('rxjs/operators');
const Base = require('./base');
const observe = require('../utils/events');
const Paginator = require('../utils/paginator');
const incrementListIndex = require('../utils/incrementListIndex');

class ListPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    if (!this.opt.choices) {
      this.throwParamError('choices');
    }

    this.firstRender = true;
    this.selected = 0;

    const def = this.opt.default;

    // If def is a Number, then use as index. Otherwise, check for value.
    if (typeof def === 'number' && def >= 0 && def < this.opt.choices.realLength) {
      this.selected = def;
    } else if (typeof def !== 'number' && def != null) {
      const index = this.opt.choices.realChoices.findIndex(({ value }) => value === def);
      this.selected = Math.max(index, 0);
    }

    // Make sure no default is set (so it won't be printed)
    this.opt.default = null;

    const shouldLoop = this.opt.loop === undefined ? true : this.opt.loop;
    this.paginator = new Paginator(this.screen, { isInfinite: shouldLoop });
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    const self = this;

    const events = observe(this.rl);
    events.normalizedUpKey.pipe(takeUntil(events.line)).forEach(this.onUpKey.bind(this));
    events.normalizedDownKey
      .pipe(takeUntil(events.line))
      .forEach(this.onDownKey.bind(this));
    events.numberKey.pipe(takeUntil(events.line)).forEach(this.onNumberKey.bind(this));
    events.line
      .pipe(
        take(1),
        map(this.getCurrentValue.bind(this)),
        flatMap((value) =>
          runAsync(self.opt.filter)(value, self.answers).catch((err) => err)
        )
      )
      .forEach(this.onSubmit.bind(this));

    // Init the prompt
    cliCursor.hide();
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {ListPrompt} self
   */

  render() {
    // Render question
    let message = this.getQuestion();

    if (this.firstRender) {
      message += chalk.dim('(Use arrow keys)');
    }

    // Render choices or answer depending on the state
    if (this.status === 'answered') {
      message += chalk.cyan(this.opt.choices.getChoice(this.selected).short);
    } else {
      const choicesStr = listRender(this.opt.choices, this.selected);
      const indexPosition = this.opt.choices.indexOf(
        this.opt.choices.getChoice(this.selected)
      );
      const realIndexPosition =
        this.opt.choices.reduce((acc, value, i) => {
          // Dont count lines past the choice we are looking at
          if (i > indexPosition) {
            return acc;
          }
          // Add line if it's a separator
          if (value.type === 'separator') {
            return acc + 1;
          }

          let l = value.name;
          // Non-strings take up one line
          if (typeof l !== 'string') {
            return acc + 1;
          }

          // Calculate lines taken up by string
          l = l.split('\n');
          return acc + l.length;
        }, 0) - 1;
      message +=
        '\n' + this.paginator.paginate(choicesStr, realIndexPosition, this.opt.pageSize);
    }

    this.firstRender = false;

    this.screen.render(message);
  }

  /**
   * When user press `enter` key
   */

  onSubmit(value) {
    this.status = 'answered';

    // Rerender prompt
    this.render();

    this.screen.done();
    cliCursor.show();
    this.done(value);
  }

  getCurrentValue() {
    return this.opt.choices.getChoice(this.selected).value;
  }

  /**
   * When user press a key
   */
  onUpKey() {
    this.selected = incrementListIndex(this.selected, 'up', this.opt);
    this.render();
  }

  onDownKey() {
    this.selected = incrementListIndex(this.selected, 'down', this.opt);
    this.render();
  }

  onNumberKey(input) {
    if (input <= this.opt.choices.realLength) {
      this.selected = input - 1;
    }

    this.render();
  }
}

/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
function listRender(choices, pointer) {
  let output = '';
  let separatorOffset = 0;

  choices.forEach((choice, i) => {
    if (choice.type === 'separator') {
      separatorOffset++;
      output += '  ' + choice + '\n';
      return;
    }

    if (choice.disabled) {
      separatorOffset++;
      output += '  - ' + choice.name;
      output += ` (${
        typeof choice.disabled === 'string' ? choice.disabled : 'Disabled'
      })`;
      output += '\n';
      return;
    }

    const isSelected = i - separatorOffset === pointer;
    let line = (isSelected ? figures.pointer + ' ' : '  ') + choice.name;
    if (isSelected) {
      line = chalk.cyan(line);
    }

    output += line + ' \n';
  });

  return output.replace(/\n$/, '');
}

module.exports = ListPrompt;
