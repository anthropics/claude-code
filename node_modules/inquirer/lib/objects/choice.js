'use strict';

/**
 * Choice object
 * Normalize input as choice object
 * @constructor
 * @param {Number|String|Object} val  Choice value. If an object is passed, it should contains
 *                                    at least one of `value` or `name` property
 */

module.exports = class Choice {
  constructor(val, answers) {
    // Don't process Choice and Separator object
    if (val instanceof Choice || val.type === 'separator') {
      // eslint-disable-next-line no-constructor-return
      return val;
    }

    if (typeof val === 'string' || typeof val === 'number') {
      this.name = String(val);
      this.value = val;
      this.short = String(val);
    } else {
      Object.assign(this, val, {
        name: val.name || val.value,
        value: 'value' in val ? val.value : val.name,
        short: val.short || val.name || val.value,
      });
    }

    if (typeof val.disabled === 'function') {
      this.disabled = val.disabled(answers);
    } else {
      this.disabled = val.disabled;
    }
  }
};
