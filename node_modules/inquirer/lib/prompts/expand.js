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

class ExpandPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    if (!this.opt.choices) {
      this.throwParamError('choices');
    }

    this.validateChoices(this.opt.choices);

    // Add the default `help` (/expand) option
    this.opt.choices.push({
      key: 'h',
      name: 'Help, list all options',
      value: 'help',
    });

    this.opt.validate = (choice) => {
      if (choice == null) {
        return 'Please enter a valid command';
      }

      return choice !== 'help';
    };

    // Setup the default string (capitalize the default key)
    this.opt.default = this.generateChoicesString(this.opt.choices, this.opt.default);

    this.paginator = new Paginator(this.screen);
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    // Save user answer and update prompt to show selected option.
    const events = observe(this.rl);
    const validation = this.handleSubmitEvents(
      events.line.pipe(map(this.getCurrentValue.bind(this)))
    );
    validation.success.forEach(this.onSubmit.bind(this));
    validation.error.forEach(this.onError.bind(this));
    this.keypressObs = events.keypress
      .pipe(takeUntil(validation.success))
      .forEach(this.onKeypress.bind(this));

    // Init the prompt
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {ExpandPrompt} self
   */

  render(error, hint) {
    let message = this.getQuestion();
    let bottomContent = '';

    if (this.status === 'answered') {
      message += chalk.cyan(this.answer);
    } else if (this.status === 'expanded') {
      const choicesStr = renderChoices(this.opt.choices, this.selectedKey);
      message += this.paginator.paginate(choicesStr, this.selectedKey, this.opt.pageSize);
      message += '\n  Answer: ';
    }

    message += this.rl.line;

    if (error) {
      bottomContent = chalk.red('>> ') + error;
    }

    if (hint) {
      bottomContent = chalk.cyan('>> ') + hint;
    }

    this.screen.render(message, bottomContent);
  }

  getCurrentValue(input) {
    if (!input) {
      input = this.rawDefault;
    }

    const selected = this.opt.choices.where({ key: input.toLowerCase().trim() })[0];
    if (!selected) {
      return null;
    }

    return selected.value;
  }

  /**
   * Generate the prompt choices string
   * @return {String}  Choices string
   */

  getChoices() {
    let output = '';

    this.opt.choices.forEach((choice) => {
      output += '\n  ';

      if (choice.type === 'separator') {
        output += ' ' + choice;
        return;
      }

      let choiceStr = choice.key + ') ' + choice.name;
      if (this.selectedKey === choice.key) {
        choiceStr = chalk.cyan(choiceStr);
      }

      output += choiceStr;
    });

    return output;
  }

  onError(state) {
    if (state.value === 'help') {
      this.selectedKey = '';
      this.status = 'expanded';
      this.render();
      return;
    }

    this.render(state.isValid);
  }

  /**
   * When user press `enter` key
   */

  onSubmit(state) {
    this.status = 'answered';
    const choice = this.opt.choices.where({ value: state.value })[0];
    this.answer = choice.short || choice.name;

    // Re-render prompt
    this.render();
    this.screen.done();
    this.done(state.value);
  }

  /**
   * When user press a key
   */

  onKeypress() {
    this.selectedKey = this.rl.line.toLowerCase();
    const selected = this.opt.choices.where({ key: this.selectedKey })[0];
    if (this.status === 'expanded') {
      this.render();
    } else {
      this.render(null, selected ? selected.name : null);
    }
  }

  /**
   * Validate the choices
   * @param {Array} choices
   */

  validateChoices(choices) {
    let formatError;
    const errors = [];
    const keymap = {};
    choices.filter(Separator.exclude).forEach((choice) => {
      if (!choice.key || choice.key.length !== 1) {
        formatError = true;
      }

      choice.key = String(choice.key).toLowerCase();

      if (keymap[choice.key]) {
        errors.push(choice.key);
      }

      keymap[choice.key] = true;
    });

    if (formatError) {
      throw new Error(
        'Format error: `key` param must be a single letter and is required.'
      );
    }

    if (keymap.h) {
      throw new Error(
        'Reserved key error: `key` param cannot be `h` - this value is reserved.'
      );
    }

    if (errors.length) {
      throw new Error(
        'Duplicate key error: `key` param must be unique. Duplicates: ' +
          [...new Set(errors)].join(',')
      );
    }
  }

  /**
   * Generate a string out of the choices keys
   * @param  {Array}  choices
   * @param  {Number|String} default - the choice index or name to capitalize
   * @return {String} The rendered choices key string
   */
  generateChoicesString(choices, defaultChoice) {
    let defIndex = choices.realLength - 1;
    if (typeof defaultChoice === 'number' && this.opt.choices.getChoice(defaultChoice)) {
      defIndex = defaultChoice;
    } else if (typeof defaultChoice === 'string') {
      const index = choices.realChoices.findIndex(({ value }) => value === defaultChoice);
      defIndex = index === -1 ? defIndex : index;
    }

    const defStr = this.opt.choices.pluck('key');
    this.rawDefault = defStr[defIndex];
    defStr[defIndex] = String(defStr[defIndex]).toUpperCase();
    return defStr.join('');
  }
}

/**
 * Function for rendering checkbox choices
 * @param  {String} pointer Selected key
 * @return {String}         Rendered content
 */

function renderChoices(choices, pointer) {
  let output = '';

  choices.forEach((choice) => {
    output += '\n  ';

    if (choice.type === 'separator') {
      output += ' ' + choice;
      return;
    }

    let choiceStr = choice.key + ') ' + choice.name;
    if (pointer === choice.key) {
      choiceStr = chalk.cyan(choiceStr);
    }

    output += choiceStr;
  });

  return output;
}

module.exports = ExpandPrompt;
