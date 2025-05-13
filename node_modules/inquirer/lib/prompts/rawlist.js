'use strict';
/**
 * `rawlist` type prompt
 */

const chalk = require('chalk');
const { map, takeUntil } = require('rxjs/operators');
const Base = require('./base');
const Separator = require('../objects/separator');
const observe = require('../utils/events');
const Paginator = require('../utils/paginator');
const incrementListIndex = require('../utils/incrementListIndex');

class RawListPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    this.hiddenLine = '';
    this.lastKey = '';

    if (!this.opt.choices) {
      this.throwParamError('choices');
    }

    this.opt.validChoices = this.opt.choices.filter(Separator.exclude);

    this.selected = 0;
    this.rawDefault = 0;

    Object.assign(this.opt, {
      validate(val) {
        return val != null;
      },
    });

    const def = this.opt.default;
    if (typeof def === 'number' && def >= 0 && def < this.opt.choices.realLength) {
      this.selected = def;
      this.rawDefault = def;
    } else if (typeof def !== 'number' && def != null) {
      const index = this.opt.choices.realChoices.findIndex(({ value }) => value === def);
      const safeIndex = Math.max(index, 0);
      this.selected = safeIndex;
      this.rawDefault = safeIndex;
    }

    // Make sure no default is set (so it won't be printed)
    this.opt.default = null;

    const shouldLoop = this.opt.loop === undefined ? true : this.opt.loop;
    this.paginator = new Paginator(undefined, { isInfinite: shouldLoop });
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    // Once user confirm (enter key)
    const events = observe(this.rl);
    const submit = events.line.pipe(map(this.getCurrentValue.bind(this)));

    const validation = this.handleSubmitEvents(submit);
    validation.success.forEach(this.onEnd.bind(this));
    validation.error.forEach(this.onError.bind(this));

    events.normalizedUpKey
      .pipe(takeUntil(validation.success))
      .forEach(this.onUpKey.bind(this));
    events.normalizedDownKey
      .pipe(takeUntil(validation.success))
      .forEach(this.onDownKey.bind(this));
    events.keypress
      .pipe(takeUntil(validation.success))
      .forEach(this.onKeypress.bind(this));
    // Init the prompt
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {RawListPrompt} self
   */

  render(error) {
    // Render question
    let message = this.getQuestion();
    let bottomContent = '';

    if (this.status === 'answered') {
      message += chalk.cyan(this.opt.choices.getChoice(this.selected).short);
    } else {
      const choicesStr = renderChoices(this.opt.choices, this.selected);
      message +=
        '\n' + this.paginator.paginate(choicesStr, this.selected, this.opt.pageSize);
      message += '\n  Answer: ';
    }
    message += this.rl.line;

    if (error) {
      bottomContent = '\n' + chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }

  /**
   * When user press `enter` key
   */

  getCurrentValue(index) {
    if (index == null) {
      index = this.rawDefault;
    } else if (index === '') {
      this.selected = this.selected === undefined ? -1 : this.selected;
      index = this.selected;
    } else {
      index -= 1;
    }

    const choice = this.opt.choices.getChoice(index);
    return choice ? choice.value : null;
  }

  onEnd(state) {
    this.status = 'answered';
    this.answer = state.value;

    // Re-render prompt
    this.render();

    this.screen.done();
    this.done(state.value);
  }

  onError() {
    this.render('Please enter a valid index');
  }

  /**
   * When user press a key
   */

  onKeypress() {
    let index;

    if (this.lastKey === 'arrow') {
      index = this.hiddenLine.length ? Number(this.hiddenLine) - 1 : 0;
    } else {
      index = this.rl.line.length ? Number(this.rl.line) - 1 : 0;
    }
    this.lastKey = '';

    if (this.opt.choices.getChoice(index)) {
      this.selected = index;
    } else {
      this.selected = undefined;
    }
    this.render();
  }

  /**
   * When user press up key
   */

  onUpKey() {
    this.onArrowKey('up');
  }

  /**
   * When user press down key
   */

  onDownKey() {
    this.onArrowKey('down');
  }

  /**
   * When user press up or down key
   * @param {String} type Arrow type: up or down
   */

  onArrowKey(type) {
    this.selected = incrementListIndex(this.selected, type, this.opt) || 0;
    this.hiddenLine = String(this.selected + 1);
    this.rl.line = '';
    this.lastKey = 'arrow';
  }
}

/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */

function renderChoices(choices, pointer) {
  let output = '';
  let separatorOffset = 0;

  choices.forEach((choice, i) => {
    output += output ? '\n  ' : '  ';

    if (choice.type === 'separator') {
      separatorOffset++;
      output += ' ' + choice;
      return;
    }

    const index = i - separatorOffset;
    let display = index + 1 + ') ' + choice.name;
    if (index === pointer) {
      display = chalk.cyan(display);
    }

    output += display;
  });

  return output;
}

module.exports = RawListPrompt;
