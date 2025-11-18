/*!

 diff v4.0.1

Software License Agreement (BSD License)

Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>

All rights reserved.

Redistribution and use of this software in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above
  copyright notice, this list of conditions and the
  following disclaimer.

* Redistributions in binary form must reproduce the above
  copyright notice, this list of conditions and the
  following disclaimer in the documentation and/or other
  materials provided with the distribution.

* Neither the name of Kevin Decker nor the names of its
  contributors may be used to endorse or promote products
  derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
@license
*/
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.Diff = {}));
}(this, function (exports) { 'use strict';

  function Diff() {}
  Diff.prototype = {
    diff: function diff(oldString, newString) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var callback = options.callback;

      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      this.options = options;
      var self = this;

      function done(value) {
        if (callback) {
          setTimeout(function () {
            callback(undefined, value);
          }, 0);
          return true;
        } else {
          return value;
        }
      } // Allow subclasses to massage the input prior to running


      oldString = this.castInput(oldString);
      newString = this.castInput(newString);
      oldString = this.removeEmpty(this.tokenize(oldString));
      newString = this.removeEmpty(this.tokenize(newString));
      var newLen = newString.length,
          oldLen = oldString.length;
      var editLength = 1;
      var maxEditLength = newLen + oldLen;
      var bestPath = [{
        newPos: -1,
        components: []
      }]; // Seed editLength = 0, i.e. the content starts with the same values

      var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);

      if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
        // Identity per the equality and tokenizer
        return done([{
          value: this.join(newString),
          count: newString.length
        }]);
      } // Main worker method. checks all permutations of a given edit length for acceptance.


      function execEditLength() {
        for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
          var basePath = void 0;

          var addPath = bestPath[diagonalPath - 1],
              removePath = bestPath[diagonalPath + 1],
              _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;

          if (addPath) {
            // No one else is going to attempt to use this value, clear it
            bestPath[diagonalPath - 1] = undefined;
          }

          var canAdd = addPath && addPath.newPos + 1 < newLen,
              canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen;

          if (!canAdd && !canRemove) {
            // If this path is a terminal then prune
            bestPath[diagonalPath] = undefined;
            continue;
          } // Select the diagonal that we want to branch from. We select the prior
          // path whose position in the new string is the farthest from the origin
          // and does not pass the bounds of the diff graph


          if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
            basePath = clonePath(removePath);
            self.pushComponent(basePath.components, undefined, true);
          } else {
            basePath = addPath; // No need to clone, we've pulled it from the list

            basePath.newPos++;
            self.pushComponent(basePath.components, true, undefined);
          }

          _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath); // If we have hit the end of both strings, then we are done

          if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
            return done(buildValues(self, basePath.components, newString, oldString, self.useLongestToken));
          } else {
            // Otherwise track this path as a potential candidate and continue.
            bestPath[diagonalPath] = basePath;
          }
        }

        editLength++;
      } // Performs the length of edit iteration. Is a bit fugly as this has to support the
      // sync and async mode which is never fun. Loops over execEditLength until a value
      // is produced.


      if (callback) {
        (function exec() {
          setTimeout(function () {
            // This should not happen, but we want to be safe.

            /* istanbul ignore next */
            if (editLength > maxEditLength) {
              return callback();
            }

            if (!execEditLength()) {
              exec();
            }
          }, 0);
        })();
      } else {
        while (editLength <= maxEditLength) {
          var ret = execEditLength();

          if (ret) {
            return ret;
          }
        }
      }
    },
    pushComponent: function pushComponent(components, added, removed) {
      var last = components[components.length - 1];

      if (last && last.added === added && last.removed === removed) {
        // We need to clone here as the component clone operation is just
        // as shallow array clone
        components[components.length - 1] = {
          count: last.count + 1,
          added: added,
          removed: removed
        };
      } else {
        components.push({
          count: 1,
          added: added,
          removed: removed
        });
      }
    },
    extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
      var newLen = newString.length,
          oldLen = oldString.length,
          newPos = basePath.newPos,
          oldPos = newPos - diagonalPath,
          commonCount = 0;

      while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
        newPos++;
        oldPos++;
        commonCount++;
      }

      if (commonCount) {
        basePath.components.push({
          count: commonCount
        });
      }

      basePath.newPos = newPos;
      return oldPos;
    },
    equals: function equals(left, right) {
      if (this.options.comparator) {
        return this.options.comparator(left, right);
      } else {
        return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
      }
    },
    removeEmpty: function removeEmpty(array) {
      var ret = [];

      for (var i = 0; i < array.length; i++) {
        if (array[i]) {
          ret.push(array[i]);
        }
      }

      return ret;
    },
    castInput: function castInput(value) {
      return value;
    },
    tokenize: function tokenize(value) {
      return value.split('');
    },
    join: function join(chars) {
      return chars.join('');
    }
  };

  function buildValues(diff, components, newString, oldString, useLongestToken) {
    var componentPos = 0,
        componentLen = components.length,
        newPos = 0,
        oldPos = 0;

    for (; componentPos < componentLen; componentPos++) {
      var component = components[componentPos];

      if (!component.removed) {
        if (!component.added && useLongestToken) {
          var value = newString.slice(newPos, newPos + component.count);
          value = value.map(function (value, i) {
            var oldValue = oldString[oldPos + i];
            return oldValue.length > value.length ? oldValue : value;
          });
          component.value = diff.join(value);
        } else {
          component.value = diff.join(newString.slice(newPos, newPos + component.count));
        }

        newPos += component.count; // Common case

        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = diff.join(oldString.slice(oldPos, oldPos + component.count));
        oldPos += component.count; // Reverse add and remove so removes are output first to match common convention
        // The diffing algorithm is tied to add then remove output and this is the simplest
        // route to get the desired output with minimal overhead.

        if (componentPos && components[componentPos - 1].added) {
          var tmp = components[componentPos - 1];
          components[componentPos - 1] = components[componentPos];
          components[componentPos] = tmp;
        }
      }
    } // Special case handle for when one terminal is ignored (i.e. whitespace).
    // For this case we merge the terminal into the prior string and drop the change.
    // This is only available for string mode.


    var lastComponent = components[componentLen - 1];

    if (componentLen > 1 && typeof lastComponent.value === 'string' && (lastComponent.added || lastComponent.removed) && diff.equals('', lastComponent.value)) {
      components[componentLen - 2].value += lastComponent.value;
      components.pop();
    }

    return components;
  }

  function clonePath(path) {
    return {
      newPos: path.newPos,
      components: path.components.slice(0)
    };
  }

  var characterDiff = new Diff();
  function diffChars(oldStr, newStr, options) {
    return characterDiff.diff(oldStr, newStr, options);
  }

  function generateOptions(options, defaults) {
    if (typeof options === 'function') {
      defaults.callback = options;
    } else if (options) {
      for (var name in options) {
        /* istanbul ignore else */
        if (options.hasOwnProperty(name)) {
          defaults[name] = options[name];
        }
      }
    }

    return defaults;
  }

  //
  // Ranges and exceptions:
  // Latin-1 Supplement, 0080–00FF
  //  - U+00D7  × Multiplication sign
  //  - U+00F7  ÷ Division sign
  // Latin Extended-A, 0100–017F
  // Latin Extended-B, 0180–024F
  // IPA Extensions, 0250–02AF
  // Spacing Modifier Letters, 02B0–02FF
  //  - U+02C7  ˇ &#711;  Caron
  //  - U+02D8  ˘ &#728;  Breve
  //  - U+02D9  ˙ &#729;  Dot Above
  //  - U+02DA  ˚ &#730;  Ring Above
  //  - U+02DB  ˛ &#731;  Ogonek
  //  - U+02DC  ˜ &#732;  Small Tilde
  //  - U+02DD  ˝ &#733;  Double Acute Accent
  // Latin Extended Additional, 1E00–1EFF

  var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
  var reWhitespace = /\S/;
  var wordDiff = new Diff();

  wordDiff.equals = function (left, right) {
    if (this.options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }

    return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
  };

  wordDiff.tokenize = function (value) {
    var tokens = value.split(/(\s+|[()[\]{}'"]|\b)/); // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.

    for (var i = 0; i < tokens.length - 1; i++) {
      // If we have an empty string in the next field and we have only word chars before and after, merge
      if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
        tokens[i] += tokens[i + 2];
        tokens.splice(i + 1, 2);
        i--;
      }
    }

    return tokens;
  };

  function diffWords(oldStr, newStr, options) {
    options = generateOptions(options, {
      ignoreWhitespace: true
    });
    return wordDiff.diff(oldStr, newStr, options);
  }
  function diffWordsWithSpace(oldStr, newStr, options) {
    return wordDiff.diff(oldStr, newStr, options);
  }

  var lineDiff = new Diff();

  lineDiff.tokenize = function (value) {
    var retLines = [],
        linesAndNewlines = value.split(/(\n|\r\n)/); // Ignore the final empty token that occurs if the string ends with a new line

    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
      linesAndNewlines.pop();
    } // Merge the content and line separators into single tokens


    for (var i = 0; i < linesAndNewlines.length; i++) {
      var line = linesAndNewlines[i];

      if (i % 2 && !this.options.newlineIsToken) {
        retLines[retLines.length - 1] += line;
      } else {
        if (this.options.ignoreWhitespace) {
          line = line.trim();
        }

        retLines.push(line);
      }
    }

    return retLines;
  };

  function diffLines(oldStr, newStr, callback) {
    return lineDiff.diff(oldStr, newStr, callback);
  }
  function diffTrimmedLines(oldStr, newStr, callback) {
    var options = generateOptions(callback, {
      ignoreWhitespace: true
    });
    return lineDiff.diff(oldStr, newStr, options);
  }

  var sentenceDiff = new Diff();

  sentenceDiff.tokenize = function (value) {
    return value.split(/(\S.+?[.!?])(?=\s+|$)/);
  };

  function diffSentences(oldStr, newStr, callback) {
    return sentenceDiff.diff(oldStr, newStr, callback);
  }

  var cssDiff = new Diff();

  cssDiff.tokenize = function (value) {
    return value.split(/([{}:;,]|\s+)/);
  };

  function diffCss(oldStr, newStr, callback) {
    return cssDiff.diff(oldStr, newStr, callback);
  }

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

      return arr2;
    }
  }

  function _iterableToArray(iter) {
    if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance");
  }

  var objectPrototypeToString = Object.prototype.toString;
  var jsonDiff = new Diff(); // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
  // dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:

  jsonDiff.useLongestToken = true;
  jsonDiff.tokenize = lineDiff.tokenize;

  jsonDiff.castInput = function (value) {
    var _this$options = this.options,
        undefinedReplacement = _this$options.undefinedReplacement,
        _this$options$stringi = _this$options.stringifyReplacer,
        stringifyReplacer = _this$options$stringi === void 0 ? function (k, v) {
      return typeof v === 'undefined' ? undefinedReplacement : v;
    } : _this$options$stringi;
    return typeof value === 'string' ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, '  ');
  };

  jsonDiff.equals = function (left, right) {
    return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'));
  };

  function diffJson(oldObj, newObj, options) {
    return jsonDiff.diff(oldObj, newObj, options);
  } // This function handles the presence of circular references by bailing out when encountering an
  // object that is already on the "stack" of items being processed. Accepts an optional replacer

  function canonicalize(obj, stack, replacementStack, replacer, key) {
    stack = stack || [];
    replacementStack = replacementStack || [];

    if (replacer) {
      obj = replacer(key, obj);
    }

    var i;

    for (i = 0; i < stack.length; i += 1) {
      if (stack[i] === obj) {
        return replacementStack[i];
      }
    }

    var canonicalizedObj;

    if ('[object Array]' === objectPrototypeToString.call(obj)) {
      stack.push(obj);
      canonicalizedObj = new Array(obj.length);
      replacementStack.push(canonicalizedObj);

      for (i = 0; i < obj.length; i += 1) {
        canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key);
      }

      stack.pop();
      replacementStack.pop();
      return canonicalizedObj;
    }

    if (obj && obj.toJSON) {
      obj = obj.toJSON();
    }

    if (_typeof(obj) === 'object' && obj !== null) {
      stack.push(obj);
      canonicalizedObj = {};
      replacementStack.push(canonicalizedObj);

      var sortedKeys = [],
          _key;

      for (_key in obj) {
        /* istanbul ignore else */
        if (obj.hasOwnProperty(_key)) {
          sortedKeys.push(_key);
        }
      }

      sortedKeys.sort();

      for (i = 0; i < sortedKeys.length; i += 1) {
        _key = sortedKeys[i];
        canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key);
      }

      stack.pop();
      replacementStack.pop();
    } else {
      canonicalizedObj = obj;
    }

    return canonicalizedObj;
  }

  var arrayDiff = new Diff();

  arrayDiff.tokenize = function (value) {
    return value.slice();
  };

  arrayDiff.join = arrayDiff.removeEmpty = function (value) {
    return value;
  };

  function diffArrays(oldArr, newArr, callback) {
    return arrayDiff.diff(oldArr, newArr, callback);
  }

  function parsePatch(uniDiff) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var diffstr = uniDiff.split(/\r\n|[\n\v\f\r\x85]/),
        delimiters = uniDiff.match(/\r\n|[\n\v\f\r\x85]/g) || [],
        list = [],
        i = 0;

    function parseIndex() {
      var index = {};
      list.push(index); // Parse diff metadata

      while (i < diffstr.length) {
        var line = diffstr[i]; // File header found, end parsing diff metadata

        if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
          break;
        } // Diff index


        var header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);

        if (header) {
          index.index = header[1];
        }

        i++;
      } // Parse file headers if they are defined. Unified diff requires them, but
      // there's no technical issues to have an isolated hunk without file header


      parseFileHeader(index);
      parseFileHeader(index); // Parse hunks

      index.hunks = [];

      while (i < diffstr.length) {
        var _line = diffstr[i];

        if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(_line)) {
          break;
        } else if (/^@@/.test(_line)) {
          index.hunks.push(parseHunk());
        } else if (_line && options.strict) {
          // Ignore unexpected content unless in strict mode
          throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(_line));
        } else {
          i++;
        }
      }
    } // Parses the --- and +++ headers, if none are found, no lines
    // are consumed.


    function parseFileHeader(index) {
      var fileHeader = /^(---|\+\+\+)\s+(.*)$/.exec(diffstr[i]);

      if (fileHeader) {
        var keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
        var data = fileHeader[2].split('\t', 2);
        var fileName = data[0].replace(/\\\\/g, '\\');

        if (/^".*"$/.test(fileName)) {
          fileName = fileName.substr(1, fileName.length - 2);
        }

        index[keyPrefix + 'FileName'] = fileName;
        index[keyPrefix + 'Header'] = (data[1] || '').trim();
        i++;
      }
    } // Parses a hunk
    // This assumes that we are at the start of a hunk.


    function parseHunk() {
      var chunkHeaderIndex = i,
          chunkHeaderLine = diffstr[i++],
          chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      var hunk = {
        oldStart: +chunkHeader[1],
        oldLines: +chunkHeader[2] || 1,
        newStart: +chunkHeader[3],
        newLines: +chunkHeader[4] || 1,
        lines: [],
        linedelimiters: []
      };
      var addCount = 0,
          removeCount = 0;

      for (; i < diffstr.length; i++) {
        // Lines starting with '---' could be mistaken for the "remove line" operation
        // But they could be the header for the next file. Therefore prune such cases out.
        if (diffstr[i].indexOf('--- ') === 0 && i + 2 < diffstr.length && diffstr[i + 1].indexOf('+++ ') === 0 && diffstr[i + 2].indexOf('@@') === 0) {
          break;
        }

        var operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? ' ' : diffstr[i][0];

        if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
          hunk.lines.push(diffstr[i]);
          hunk.linedelimiters.push(delimiters[i] || '\n');

          if (operation === '+') {
            addCount++;
          } else if (operation === '-') {
            removeCount++;
          } else if (operation === ' ') {
            addCount++;
            removeCount++;
          }
        } else {
          break;
        }
      } // Handle the empty block count case


      if (!addCount && hunk.newLines === 1) {
        hunk.newLines = 0;
      }

      if (!removeCount && hunk.oldLines === 1) {
        hunk.oldLines = 0;
      } // Perform optional sanity checking


      if (options.strict) {
        if (addCount !== hunk.newLines) {
          throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }

        if (removeCount !== hunk.oldLines) {
          throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }
      }

      return hunk;
    }

    while (i < diffstr.length) {
      parseIndex();
    }

    return list;
  }

  // Iterator that traverses in the range of [min, max], stepping
  // by distance from a given start position. I.e. for [0, 4], with
  // start of 2, this will iterate 2, 3, 1, 4, 0.
  function distanceIterator (start, minLine, maxLine) {
    var wantForward = true,
        backwardExhausted = false,
        forwardExhausted = false,
        localOffset = 1;
    return function iterator() {
      if (wantForward && !forwardExhausted) {
        if (backwardExhausted) {
          localOffset++;
        } else {
          wantForward = false;
        } // Check if trying to fit beyond text length, and if not, check it fits
        // after offset location (or desired location on first iteration)


        if (start + localOffset <= maxLine) {
          return localOffset;
        }

        forwardExhausted = true;
      }

      if (!backwardExhausted) {
        if (!forwardExhausted) {
          wantForward = true;
        } // Check if trying to fit before text beginning, and if not, check it fits
        // before offset location


        if (minLine <= start - localOffset) {
          return -localOffset++;
        }

        backwardExhausted = true;
        return iterator();
      } // We tried to fit hunk before text beginning and beyond text length, then
      // hunk can't fit on the text. Return undefined

    };
  }

  function applyPatch(source, uniDiff) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (typeof uniDiff === 'string') {
      uniDiff = parsePatch(uniDiff);
    }

    if (Array.isArray(uniDiff)) {
      if (uniDiff.length > 1) {
        throw new Error('applyPatch only works with a single input.');
      }

      uniDiff = uniDiff[0];
    } // Apply the diff to the input


    var lines = source.split(/\r\n|[\n\v\f\r\x85]/),
        delimiters = source.match(/\r\n|[\n\v\f\r\x85]/g) || [],
        hunks = uniDiff.hunks,
        compareLine = options.compareLine || function (lineNumber, line, operation, patchContent) {
      return line === patchContent;
    },
        errorCount = 0,
        fuzzFactor = options.fuzzFactor || 0,
        minLine = 0,
        offset = 0,
        removeEOFNL,
        addEOFNL;
    /**
     * Checks if the hunk exactly fits on the provided location
     */


    function hunkFits(hunk, toPos) {
      for (var j = 0; j < hunk.lines.length; j++) {
        var line = hunk.lines[j],
            operation = line.length > 0 ? line[0] : ' ',
            content = line.length > 0 ? line.substr(1) : line;

        if (operation === ' ' || operation === '-') {
          // Context sanity check
          if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
            errorCount++;

            if (errorCount > fuzzFactor) {
              return false;
            }
          }

          toPos++;
        }
      }

      return true;
    } // Search best fit offsets for each hunk based on the previous ones


    for (var i = 0; i < hunks.length; i++) {
      var hunk = hunks[i],
          maxLine = lines.length - hunk.oldLines,
          localOffset = 0,
          toPos = offset + hunk.oldStart - 1;
      var iterator = distanceIterator(toPos, minLine, maxLine);

      for (; localOffset !== undefined; localOffset = iterator()) {
        if (hunkFits(hunk, toPos + localOffset)) {
          hunk.offset = offset += localOffset;
          break;
        }
      }

      if (localOffset === undefined) {
        return false;
      } // Set lower text limit to end of the current hunk, so next ones don't try
      // to fit over already patched text


      minLine = hunk.offset + hunk.oldStart + hunk.oldLines;
    } // Apply patch hunks


    var diffOffset = 0;

    for (var _i = 0; _i < hunks.length; _i++) {
      var _hunk = hunks[_i],
          _toPos = _hunk.oldStart + _hunk.offset + diffOffset - 1;

      diffOffset += _hunk.newLines - _hunk.oldLines;

      if (_toPos < 0) {
        // Creating a new file
        _toPos = 0;
      }

      for (var j = 0; j < _hunk.lines.length; j++) {
        var line = _hunk.lines[j],
            operation = line.length > 0 ? line[0] : ' ',
            content = line.length > 0 ? line.substr(1) : line,
            delimiter = _hunk.linedelimiters[j];

        if (operation === ' ') {
          _toPos++;
        } else if (operation === '-') {
          lines.splice(_toPos, 1);
          delimiters.splice(_toPos, 1);
          /* istanbul ignore else */
        } else if (operation === '+') {
          lines.splice(_toPos, 0, content);
          delimiters.splice(_toPos, 0, delimiter);
          _toPos++;
        } else if (operation === '\\') {
          var previousOperation = _hunk.lines[j - 1] ? _hunk.lines[j - 1][0] : null;

          if (previousOperation === '+') {
            removeEOFNL = true;
          } else if (previousOperation === '-') {
            addEOFNL = true;
          }
        }
      }
    } // Handle EOFNL insertion/removal


    if (removeEOFNL) {
      while (!lines[lines.length - 1]) {
        lines.pop();
        delimiters.pop();
      }
    } else if (addEOFNL) {
      lines.push('');
      delimiters.push('\n');
    }

    for (var _k = 0; _k < lines.length - 1; _k++) {
      lines[_k] = lines[_k] + delimiters[_k];
    }

    return lines.join('');
  } // Wrapper that supports multiple file patches via callbacks.

  function applyPatches(uniDiff, options) {
    if (typeof uniDiff === 'string') {
      uniDiff = parsePatch(uniDiff);
    }

    var currentIndex = 0;

    function processIndex() {
      var index = uniDiff[currentIndex++];

      if (!index) {
        return options.complete();
      }

      options.loadFile(index, function (err, data) {
        if (err) {
          return options.complete(err);
        }

        var updatedContent = applyPatch(data, index, options);
        options.patched(index, updatedContent, function (err) {
          if (err) {
            return options.complete(err);
          }

          processIndex();
        });
      });
    }

    processIndex();
  }

  function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    if (!options) {
      options = {};
    }

    if (typeof options.context === 'undefined') {
      options.context = 4;
    }

    var diff = diffLines(oldStr, newStr, options);
    diff.push({
      value: '',
      lines: []
    }); // Append an empty value to make cleanup easier

    function contextLines(lines) {
      return lines.map(function (entry) {
        return ' ' + entry;
      });
    }

    var hunks = [];
    var oldRangeStart = 0,
        newRangeStart = 0,
        curRange = [],
        oldLine = 1,
        newLine = 1;

    var _loop = function _loop(i) {
      var current = diff[i],
          lines = current.lines || current.value.replace(/\n$/, '').split('\n');
      current.lines = lines;

      if (current.added || current.removed) {
        var _curRange;

        // If we have previous context, start with that
        if (!oldRangeStart) {
          var prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;

          if (prev) {
            curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        } // Output our changes


        (_curRange = curRange).push.apply(_curRange, _toConsumableArray(lines.map(function (entry) {
          return (current.added ? '+' : '-') + entry;
        }))); // Track the updated file position


        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        // Identical context lines. Track line changes
        if (oldRangeStart) {
          // Close out any changes that have been output (or join overlapping)
          if (lines.length <= options.context * 2 && i < diff.length - 2) {
            var _curRange2;

            // Overlapping
            (_curRange2 = curRange).push.apply(_curRange2, _toConsumableArray(contextLines(lines)));
          } else {
            var _curRange3;

            // end the range and output
            var contextSize = Math.min(lines.length, options.context);

            (_curRange3 = curRange).push.apply(_curRange3, _toConsumableArray(contextLines(lines.slice(0, contextSize))));

            var hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };

            if (i >= diff.length - 2 && lines.length <= options.context) {
              // EOF is inside this hunk
              var oldEOFNewline = /\n$/.test(oldStr);
              var newEOFNewline = /\n$/.test(newStr);
              var noNlBeforeAdds = lines.length == 0 && curRange.length > hunk.oldLines;

              if (!oldEOFNewline && noNlBeforeAdds) {
                // special case: old has no eol and no trailing context; no-nl can end up before adds
                curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file');
              }

              if (!oldEOFNewline && !noNlBeforeAdds || !newEOFNewline) {
                curRange.push('\\ No newline at end of file');
              }
            }

            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }

        oldLine += lines.length;
        newLine += lines.length;
      }
    };

    for (var i = 0; i < diff.length; i++) {
      _loop(i);
    }

    return {
      oldFileName: oldFileName,
      newFileName: newFileName,
      oldHeader: oldHeader,
      newHeader: newHeader,
      hunks: hunks
    };
  }
  function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    var diff = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);
    var ret = [];

    if (oldFileName == newFileName) {
      ret.push('Index: ' + oldFileName);
    }

    ret.push('===================================================================');
    ret.push('--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader));
    ret.push('+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader));

    for (var i = 0; i < diff.hunks.length; i++) {
      var hunk = diff.hunks[i];
      ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
      ret.push.apply(ret, hunk.lines);
    }

    return ret.join('\n') + '\n';
  }
  function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
    return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
  }

  function arrayEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    return arrayStartsWith(a, b);
  }
  function arrayStartsWith(array, start) {
    if (start.length > array.length) {
      return false;
    }

    for (var i = 0; i < start.length; i++) {
      if (start[i] !== array[i]) {
        return false;
      }
    }

    return true;
  }

  function calcLineCount(hunk) {
    var _calcOldNewLineCount = calcOldNewLineCount(hunk.lines),
        oldLines = _calcOldNewLineCount.oldLines,
        newLines = _calcOldNewLineCount.newLines;

    if (oldLines !== undefined) {
      hunk.oldLines = oldLines;
    } else {
      delete hunk.oldLines;
    }

    if (newLines !== undefined) {
      hunk.newLines = newLines;
    } else {
      delete hunk.newLines;
    }
  }
  function merge(mine, theirs, base) {
    mine = loadPatch(mine, base);
    theirs = loadPatch(theirs, base);
    var ret = {}; // For index we just let it pass through as it doesn't have any necessary meaning.
    // Leaving sanity checks on this to the API consumer that may know more about the
    // meaning in their own context.

    if (mine.index || theirs.index) {
      ret.index = mine.index || theirs.index;
    }

    if (mine.newFileName || theirs.newFileName) {
      if (!fileNameChanged(mine)) {
        // No header or no change in ours, use theirs (and ours if theirs does not exist)
        ret.oldFileName = theirs.oldFileName || mine.oldFileName;
        ret.newFileName = theirs.newFileName || mine.newFileName;
        ret.oldHeader = theirs.oldHeader || mine.oldHeader;
        ret.newHeader = theirs.newHeader || mine.newHeader;
      } else if (!fileNameChanged(theirs)) {
        // No header or no change in theirs, use ours
        ret.oldFileName = mine.oldFileName;
        ret.newFileName = mine.newFileName;
        ret.oldHeader = mine.oldHeader;
        ret.newHeader = mine.newHeader;
      } else {
        // Both changed... figure it out
        ret.oldFileName = selectField(ret, mine.oldFileName, theirs.oldFileName);
        ret.newFileName = selectField(ret, mine.newFileName, theirs.newFileName);
        ret.oldHeader = selectField(ret, mine.oldHeader, theirs.oldHeader);
        ret.newHeader = selectField(ret, mine.newHeader, theirs.newHeader);
      }
    }

    ret.hunks = [];
    var mineIndex = 0,
        theirsIndex = 0,
        mineOffset = 0,
        theirsOffset = 0;

    while (mineIndex < mine.hunks.length || theirsIndex < theirs.hunks.length) {
      var mineCurrent = mine.hunks[mineIndex] || {
        oldStart: Infinity
      },
          theirsCurrent = theirs.hunks[theirsIndex] || {
        oldStart: Infinity
      };

      if (hunkBefore(mineCurrent, theirsCurrent)) {
        // This patch does not overlap with any of the others, yay.
        ret.hunks.push(cloneHunk(mineCurrent, mineOffset));
        mineIndex++;
        theirsOffset += mineCurrent.newLines - mineCurrent.oldLines;
      } else if (hunkBefore(theirsCurrent, mineCurrent)) {
        // This patch does not overlap with any of the others, yay.
        ret.hunks.push(cloneHunk(theirsCurrent, theirsOffset));
        theirsIndex++;
        mineOffset += theirsCurrent.newLines - theirsCurrent.oldLines;
      } else {
        // Overlap, merge as best we can
        var mergedHunk = {
          oldStart: Math.min(mineCurrent.oldStart, theirsCurrent.oldStart),
          oldLines: 0,
          newStart: Math.min(mineCurrent.newStart + mineOffset, theirsCurrent.oldStart + theirsOffset),
          newLines: 0,
          lines: []
        };
        mergeLines(mergedHunk, mineCurrent.oldStart, mineCurrent.lines, theirsCurrent.oldStart, theirsCurrent.lines);
        theirsIndex++;
        mineIndex++;
        ret.hunks.push(mergedHunk);
      }
    }

    return ret;
  }

  function loadPatch(param, base) {
    if (typeof param === 'string') {
      if (/^@@/m.test(param) || /^Index:/m.test(param)) {
        return parsePatch(param)[0];
      }

      if (!base) {
        throw new Error('Must provide a base reference or pass in a patch');
      }

      return structuredPatch(undefined, undefined, base, param);
    }

    return param;
  }

  function fileNameChanged(patch) {
    return patch.newFileName && patch.newFileName !== patch.oldFileName;
  }

  function selectField(index, mine, theirs) {
    if (mine === theirs) {
      return mine;
    } else {
      index.conflict = true;
      return {
        mine: mine,
        theirs: theirs
      };
    }
  }

  function hunkBefore(test, check) {
    return test.oldStart < check.oldStart && test.oldStart + test.oldLines < check.oldStart;
  }

  function cloneHunk(hunk, offset) {
    return {
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart + offset,
      newLines: hunk.newLines,
      lines: hunk.lines
    };
  }

  function mergeLines(hunk, mineOffset, mineLines, theirOffset, theirLines) {
    // This will generally result in a conflicted hunk, but there are cases where the context
    // is the only overlap where we can successfully merge the content here.
    var mine = {
      offset: mineOffset,
      lines: mineLines,
      index: 0
    },
        their = {
      offset: theirOffset,
      lines: theirLines,
      index: 0
    }; // Handle any leading content

    insertLeading(hunk, mine, their);
    insertLeading(hunk, their, mine); // Now in the overlap content. Scan through and select the best changes from each.

    while (mine.index < mine.lines.length && their.index < their.lines.length) {
      var mineCurrent = mine.lines[mine.index],
          theirCurrent = their.lines[their.index];

      if ((mineCurrent[0] === '-' || mineCurrent[0] === '+') && (theirCurrent[0] === '-' || theirCurrent[0] === '+')) {
        // Both modified ...
        mutualChange(hunk, mine, their);
      } else if (mineCurrent[0] === '+' && theirCurrent[0] === ' ') {
        var _hunk$lines;

        // Mine inserted
        (_hunk$lines = hunk.lines).push.apply(_hunk$lines, _toConsumableArray(collectChange(mine)));
      } else if (theirCurrent[0] === '+' && mineCurrent[0] === ' ') {
        var _hunk$lines2;

        // Theirs inserted
        (_hunk$lines2 = hunk.lines).push.apply(_hunk$lines2, _toConsumableArray(collectChange(their)));
      } else if (mineCurrent[0] === '-' && theirCurrent[0] === ' ') {
        // Mine removed or edited
        removal(hunk, mine, their);
      } else if (theirCurrent[0] === '-' && mineCurrent[0] === ' ') {
        // Their removed or edited
        removal(hunk, their, mine, true);
      } else if (mineCurrent === theirCurrent) {
        // Context identity
        hunk.lines.push(mineCurrent);
        mine.index++;
        their.index++;
      } else {
        // Context mismatch
        conflict(hunk, collectChange(mine), collectChange(their));
      }
    } // Now push anything that may be remaining


    insertTrailing(hunk, mine);
    insertTrailing(hunk, their);
    calcLineCount(hunk);
  }

  function mutualChange(hunk, mine, their) {
    var myChanges = collectChange(mine),
        theirChanges = collectChange(their);

    if (allRemoves(myChanges) && allRemoves(theirChanges)) {
      // Special case for remove changes that are supersets of one another
      if (arrayStartsWith(myChanges, theirChanges) && skipRemoveSuperset(their, myChanges, myChanges.length - theirChanges.length)) {
        var _hunk$lines3;

        (_hunk$lines3 = hunk.lines).push.apply(_hunk$lines3, _toConsumableArray(myChanges));

        return;
      } else if (arrayStartsWith(theirChanges, myChanges) && skipRemoveSuperset(mine, theirChanges, theirChanges.length - myChanges.length)) {
        var _hunk$lines4;

        (_hunk$lines4 = hunk.lines).push.apply(_hunk$lines4, _toConsumableArray(theirChanges));

        return;
      }
    } else if (arrayEqual(myChanges, theirChanges)) {
      var _hunk$lines5;

      (_hunk$lines5 = hunk.lines).push.apply(_hunk$lines5, _toConsumableArray(myChanges));

      return;
    }

    conflict(hunk, myChanges, theirChanges);
  }

  function removal(hunk, mine, their, swap) {
    var myChanges = collectChange(mine),
        theirChanges = collectContext(their, myChanges);

    if (theirChanges.merged) {
      var _hunk$lines6;

      (_hunk$lines6 = hunk.lines).push.apply(_hunk$lines6, _toConsumableArray(theirChanges.merged));
    } else {
      conflict(hunk, swap ? theirChanges : myChanges, swap ? myChanges : theirChanges);
    }
  }

  function conflict(hunk, mine, their) {
    hunk.conflict = true;
    hunk.lines.push({
      conflict: true,
      mine: mine,
      theirs: their
    });
  }

  function insertLeading(hunk, insert, their) {
    while (insert.offset < their.offset && insert.index < insert.lines.length) {
      var line = insert.lines[insert.index++];
      hunk.lines.push(line);
      insert.offset++;
    }
  }

  function insertTrailing(hunk, insert) {
    while (insert.index < insert.lines.length) {
      var line = insert.lines[insert.index++];
      hunk.lines.push(line);
    }
  }

  function collectChange(state) {
    var ret = [],
        operation = state.lines[state.index][0];

    while (state.index < state.lines.length) {
      var line = state.lines[state.index]; // Group additions that are immediately after subtractions and treat them as one "atomic" modify change.

      if (operation === '-' && line[0] === '+') {
        operation = '+';
      }

      if (operation === line[0]) {
        ret.push(line);
        state.index++;
      } else {
        break;
      }
    }

    return ret;
  }

  function collectContext(state, matchChanges) {
    var changes = [],
        merged = [],
        matchIndex = 0,
        contextChanges = false,
        conflicted = false;

    while (matchIndex < matchChanges.length && state.index < state.lines.length) {
      var change = state.lines[state.index],
          match = matchChanges[matchIndex]; // Once we've hit our add, then we are done

      if (match[0] === '+') {
        break;
      }

      contextChanges = contextChanges || change[0] !== ' ';
      merged.push(match);
      matchIndex++; // Consume any additions in the other block as a conflict to attempt
      // to pull in the remaining context after this

      if (change[0] === '+') {
        conflicted = true;

        while (change[0] === '+') {
          changes.push(change);
          change = state.lines[++state.index];
        }
      }

      if (match.substr(1) === change.substr(1)) {
        changes.push(change);
        state.index++;
      } else {
        conflicted = true;
      }
    }

    if ((matchChanges[matchIndex] || '')[0] === '+' && contextChanges) {
      conflicted = true;
    }

    if (conflicted) {
      return changes;
    }

    while (matchIndex < matchChanges.length) {
      merged.push(matchChanges[matchIndex++]);
    }

    return {
      merged: merged,
      changes: changes
    };
  }

  function allRemoves(changes) {
    return changes.reduce(function (prev, change) {
      return prev && change[0] === '-';
    }, true);
  }

  function skipRemoveSuperset(state, removeChanges, delta) {
    for (var i = 0; i < delta; i++) {
      var changeContent = removeChanges[removeChanges.length - delta + i].substr(1);

      if (state.lines[state.index + i] !== ' ' + changeContent) {
        return false;
      }
    }

    state.index += delta;
    return true;
  }

  function calcOldNewLineCount(lines) {
    var oldLines = 0;
    var newLines = 0;
    lines.forEach(function (line) {
      if (typeof line !== 'string') {
        var myCount = calcOldNewLineCount(line.mine);
        var theirCount = calcOldNewLineCount(line.theirs);

        if (oldLines !== undefined) {
          if (myCount.oldLines === theirCount.oldLines) {
            oldLines += myCount.oldLines;
          } else {
            oldLines = undefined;
          }
        }

        if (newLines !== undefined) {
          if (myCount.newLines === theirCount.newLines) {
            newLines += myCount.newLines;
          } else {
            newLines = undefined;
          }
        }
      } else {
        if (newLines !== undefined && (line[0] === '+' || line[0] === ' ')) {
          newLines++;
        }

        if (oldLines !== undefined && (line[0] === '-' || line[0] === ' ')) {
          oldLines++;
        }
      }
    });
    return {
      oldLines: oldLines,
      newLines: newLines
    };
  }

  // See: http://code.google.com/p/google-diff-match-patch/wiki/API
  function convertChangesToDMP(changes) {
    var ret = [],
        change,
        operation;

    for (var i = 0; i < changes.length; i++) {
      change = changes[i];

      if (change.added) {
        operation = 1;
      } else if (change.removed) {
        operation = -1;
      } else {
        operation = 0;
      }

      ret.push([operation, change.value]);
    }

    return ret;
  }

  function convertChangesToXML(changes) {
    var ret = [];

    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];

      if (change.added) {
        ret.push('<ins>');
      } else if (change.removed) {
        ret.push('<del>');
      }

      ret.push(escapeHTML(change.value));

      if (change.added) {
        ret.push('</ins>');
      } else if (change.removed) {
        ret.push('</del>');
      }
    }

    return ret.join('');
  }

  function escapeHTML(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');
    return n;
  }

  /* See LICENSE file for terms of use */

  exports.Diff = Diff;
  exports.diffChars = diffChars;
  exports.diffWords = diffWords;
  exports.diffWordsWithSpace = diffWordsWithSpace;
  exports.diffLines = diffLines;
  exports.diffTrimmedLines = diffTrimmedLines;
  exports.diffSentences = diffSentences;
  exports.diffCss = diffCss;
  exports.diffJson = diffJson;
  exports.diffArrays = diffArrays;
  exports.structuredPatch = structuredPatch;
  exports.createTwoFilesPatch = createTwoFilesPatch;
  exports.createPatch = createPatch;
  exports.applyPatch = applyPatch;
  exports.applyPatches = applyPatches;
  exports.parsePatch = parsePatch;
  exports.merge = merge;
  exports.convertChangesToDMP = convertChangesToDMP;
  exports.convertChangesToXML = convertChangesToXML;
  exports.canonicalize = canonicalize;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
