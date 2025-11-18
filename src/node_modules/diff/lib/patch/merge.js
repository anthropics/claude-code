/*istanbul ignore start*/
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calcLineCount = calcLineCount;
exports.merge = merge;

/*istanbul ignore end*/
var
/*istanbul ignore start*/
_create = require("./create")
/*istanbul ignore end*/
;

var
/*istanbul ignore start*/
_parse = require("./parse")
/*istanbul ignore end*/
;

var
/*istanbul ignore start*/
_array = require("../util/array")
/*istanbul ignore end*/
;

/*istanbul ignore start*/ function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

/*istanbul ignore end*/
function calcLineCount(hunk) {
  /*istanbul ignore start*/
  var _calcOldNewLineCount =
  /*istanbul ignore end*/
  calcOldNewLineCount(hunk.lines),
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
      return (
        /*istanbul ignore start*/
        (0,
        /*istanbul ignore end*/

        /*istanbul ignore start*/
        _parse
        /*istanbul ignore end*/
        .
        /*istanbul ignore start*/
        parsePatch)
        /*istanbul ignore end*/
        (param)[0]
      );
    }

    if (!base) {
      throw new Error('Must provide a base reference or pass in a patch');
    }

    return (
      /*istanbul ignore start*/
      (0,
      /*istanbul ignore end*/

      /*istanbul ignore start*/
      _create
      /*istanbul ignore end*/
      .
      /*istanbul ignore start*/
      structuredPatch)
      /*istanbul ignore end*/
      (undefined, undefined, base, param)
    );
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
      /*istanbul ignore start*/
      var _hunk$lines;

      /*istanbul ignore end*/
      // Mine inserted

      /*istanbul ignore start*/
      (_hunk$lines =
      /*istanbul ignore end*/
      hunk.lines).push.
      /*istanbul ignore start*/
      apply
      /*istanbul ignore end*/
      (
      /*istanbul ignore start*/
      _hunk$lines
      /*istanbul ignore end*/
      ,
      /*istanbul ignore start*/
      _toConsumableArray(
      /*istanbul ignore end*/
      collectChange(mine)));
    } else if (theirCurrent[0] === '+' && mineCurrent[0] === ' ') {
      /*istanbul ignore start*/
      var _hunk$lines2;

      /*istanbul ignore end*/
      // Theirs inserted

      /*istanbul ignore start*/
      (_hunk$lines2 =
      /*istanbul ignore end*/
      hunk.lines).push.
      /*istanbul ignore start*/
      apply
      /*istanbul ignore end*/
      (
      /*istanbul ignore start*/
      _hunk$lines2
      /*istanbul ignore end*/
      ,
      /*istanbul ignore start*/
      _toConsumableArray(
      /*istanbul ignore end*/
      collectChange(their)));
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
    if (
    /*istanbul ignore start*/
    (0,
    /*istanbul ignore end*/

    /*istanbul ignore start*/
    _array
    /*istanbul ignore end*/
    .
    /*istanbul ignore start*/
    arrayStartsWith)
    /*istanbul ignore end*/
    (myChanges, theirChanges) && skipRemoveSuperset(their, myChanges, myChanges.length - theirChanges.length)) {
      /*istanbul ignore start*/
      var _hunk$lines3;

      /*istanbul ignore end*/

      /*istanbul ignore start*/
      (_hunk$lines3 =
      /*istanbul ignore end*/
      hunk.lines).push.
      /*istanbul ignore start*/
      apply
      /*istanbul ignore end*/
      (
      /*istanbul ignore start*/
      _hunk$lines3
      /*istanbul ignore end*/
      ,
      /*istanbul ignore start*/
      _toConsumableArray(
      /*istanbul ignore end*/
      myChanges));

      return;
    } else if (
    /*istanbul ignore start*/
    (0,
    /*istanbul ignore end*/

    /*istanbul ignore start*/
    _array
    /*istanbul ignore end*/
    .
    /*istanbul ignore start*/
    arrayStartsWith)
    /*istanbul ignore end*/
    (theirChanges, myChanges) && skipRemoveSuperset(mine, theirChanges, theirChanges.length - myChanges.length)) {
      /*istanbul ignore start*/
      var _hunk$lines4;

      /*istanbul ignore end*/

      /*istanbul ignore start*/
      (_hunk$lines4 =
      /*istanbul ignore end*/
      hunk.lines).push.
      /*istanbul ignore start*/
      apply
      /*istanbul ignore end*/
      (
      /*istanbul ignore start*/
      _hunk$lines4
      /*istanbul ignore end*/
      ,
      /*istanbul ignore start*/
      _toConsumableArray(
      /*istanbul ignore end*/
      theirChanges));

      return;
    }
  } else if (
  /*istanbul ignore start*/
  (0,
  /*istanbul ignore end*/

  /*istanbul ignore start*/
  _array
  /*istanbul ignore end*/
  .
  /*istanbul ignore start*/
  arrayEqual)
  /*istanbul ignore end*/
  (myChanges, theirChanges)) {
    /*istanbul ignore start*/
    var _hunk$lines5;

    /*istanbul ignore end*/

    /*istanbul ignore start*/
    (_hunk$lines5 =
    /*istanbul ignore end*/
    hunk.lines).push.
    /*istanbul ignore start*/
    apply
    /*istanbul ignore end*/
    (
    /*istanbul ignore start*/
    _hunk$lines5
    /*istanbul ignore end*/
    ,
    /*istanbul ignore start*/
    _toConsumableArray(
    /*istanbul ignore end*/
    myChanges));

    return;
  }

  conflict(hunk, myChanges, theirChanges);
}

function removal(hunk, mine, their, swap) {
  var myChanges = collectChange(mine),
      theirChanges = collectContext(their, myChanges);

  if (theirChanges.merged) {
    /*istanbul ignore start*/
    var _hunk$lines6;

    /*istanbul ignore end*/

    /*istanbul ignore start*/
    (_hunk$lines6 =
    /*istanbul ignore end*/
    hunk.lines).push.
    /*istanbul ignore start*/
    apply
    /*istanbul ignore end*/
    (
    /*istanbul ignore start*/
    _hunk$lines6
    /*istanbul ignore end*/
    ,
    /*istanbul ignore start*/
    _toConsumableArray(
    /*istanbul ignore end*/
    theirChanges.merged));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9wYXRjaC9tZXJnZS5qcyJdLCJuYW1lcyI6WyJjYWxjTGluZUNvdW50IiwiaHVuayIsImNhbGNPbGROZXdMaW5lQ291bnQiLCJsaW5lcyIsIm9sZExpbmVzIiwibmV3TGluZXMiLCJ1bmRlZmluZWQiLCJtZXJnZSIsIm1pbmUiLCJ0aGVpcnMiLCJiYXNlIiwibG9hZFBhdGNoIiwicmV0IiwiaW5kZXgiLCJuZXdGaWxlTmFtZSIsImZpbGVOYW1lQ2hhbmdlZCIsIm9sZEZpbGVOYW1lIiwib2xkSGVhZGVyIiwibmV3SGVhZGVyIiwic2VsZWN0RmllbGQiLCJodW5rcyIsIm1pbmVJbmRleCIsInRoZWlyc0luZGV4IiwibWluZU9mZnNldCIsInRoZWlyc09mZnNldCIsImxlbmd0aCIsIm1pbmVDdXJyZW50Iiwib2xkU3RhcnQiLCJJbmZpbml0eSIsInRoZWlyc0N1cnJlbnQiLCJodW5rQmVmb3JlIiwicHVzaCIsImNsb25lSHVuayIsIm1lcmdlZEh1bmsiLCJNYXRoIiwibWluIiwibmV3U3RhcnQiLCJtZXJnZUxpbmVzIiwicGFyYW0iLCJ0ZXN0IiwicGFyc2VQYXRjaCIsIkVycm9yIiwic3RydWN0dXJlZFBhdGNoIiwicGF0Y2giLCJjb25mbGljdCIsImNoZWNrIiwib2Zmc2V0IiwibWluZUxpbmVzIiwidGhlaXJPZmZzZXQiLCJ0aGVpckxpbmVzIiwidGhlaXIiLCJpbnNlcnRMZWFkaW5nIiwidGhlaXJDdXJyZW50IiwibXV0dWFsQ2hhbmdlIiwiY29sbGVjdENoYW5nZSIsInJlbW92YWwiLCJpbnNlcnRUcmFpbGluZyIsIm15Q2hhbmdlcyIsInRoZWlyQ2hhbmdlcyIsImFsbFJlbW92ZXMiLCJhcnJheVN0YXJ0c1dpdGgiLCJza2lwUmVtb3ZlU3VwZXJzZXQiLCJhcnJheUVxdWFsIiwic3dhcCIsImNvbGxlY3RDb250ZXh0IiwibWVyZ2VkIiwiaW5zZXJ0IiwibGluZSIsInN0YXRlIiwib3BlcmF0aW9uIiwibWF0Y2hDaGFuZ2VzIiwiY2hhbmdlcyIsIm1hdGNoSW5kZXgiLCJjb250ZXh0Q2hhbmdlcyIsImNvbmZsaWN0ZWQiLCJjaGFuZ2UiLCJtYXRjaCIsInN1YnN0ciIsInJlZHVjZSIsInByZXYiLCJyZW1vdmVDaGFuZ2VzIiwiZGVsdGEiLCJpIiwiY2hhbmdlQ29udGVudCIsImZvckVhY2giLCJteUNvdW50IiwidGhlaXJDb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7O0FBQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTs7QUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBOzs7Ozs7Ozs7OztBQUVPLFNBQVNBLGFBQVQsQ0FBdUJDLElBQXZCLEVBQTZCO0FBQUE7QUFBQTtBQUFBO0FBQ0xDLEVBQUFBLG1CQUFtQixDQUFDRCxJQUFJLENBQUNFLEtBQU4sQ0FEZDtBQUFBLE1BQzNCQyxRQUQyQix3QkFDM0JBLFFBRDJCO0FBQUEsTUFDakJDLFFBRGlCLHdCQUNqQkEsUUFEaUI7O0FBR2xDLE1BQUlELFFBQVEsS0FBS0UsU0FBakIsRUFBNEI7QUFDMUJMLElBQUFBLElBQUksQ0FBQ0csUUFBTCxHQUFnQkEsUUFBaEI7QUFDRCxHQUZELE1BRU87QUFDTCxXQUFPSCxJQUFJLENBQUNHLFFBQVo7QUFDRDs7QUFFRCxNQUFJQyxRQUFRLEtBQUtDLFNBQWpCLEVBQTRCO0FBQzFCTCxJQUFBQSxJQUFJLENBQUNJLFFBQUwsR0FBZ0JBLFFBQWhCO0FBQ0QsR0FGRCxNQUVPO0FBQ0wsV0FBT0osSUFBSSxDQUFDSSxRQUFaO0FBQ0Q7QUFDRjs7QUFFTSxTQUFTRSxLQUFULENBQWVDLElBQWYsRUFBcUJDLE1BQXJCLEVBQTZCQyxJQUE3QixFQUFtQztBQUN4Q0YsRUFBQUEsSUFBSSxHQUFHRyxTQUFTLENBQUNILElBQUQsRUFBT0UsSUFBUCxDQUFoQjtBQUNBRCxFQUFBQSxNQUFNLEdBQUdFLFNBQVMsQ0FBQ0YsTUFBRCxFQUFTQyxJQUFULENBQWxCO0FBRUEsTUFBSUUsR0FBRyxHQUFHLEVBQVYsQ0FKd0MsQ0FN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R0FBWixJQUFtQkEsSUFBSSxDQUFDLENBQUQsQ0FBSixLQUFZLEdBQTFELENBQUosRUFBb0U7QUFDbEUvRCxRQUFBQSxRQUFRO0FBQ1Q7QUFDRjtBQUNGLEdBNUJEO0FBOEJBLFNBQU87QUFBQ0EsSUFBQUEsUUFBUSxFQUFSQSxRQUFEO0FBQVdDLElBQUFBLFFBQVEsRUFBUkE7QUFBWCxHQUFQO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3N0cnVjdHVyZWRQYXRjaH0gZnJvbSAnLi9jcmVhdGUnO1xuaW1wb3J0IHtwYXJzZVBhdGNofSBmcm9tICcuL3BhcnNlJztcblxuaW1wb3J0IHthcnJheUVxdWFsLCBhcnJheVN0YXJ0c1dpdGh9IGZyb20gJy4uL3V0aWwvYXJyYXknO1xuXG5leHBvcnQgZnVuY3Rpb24gY2FsY0xpbmVDb3VudChodW5rKSB7XG4gIGNvbnN0IHtvbGRMaW5lcywgbmV3TGluZXN9ID0gY2FsY09sZE5ld0xpbmVDb3VudChodW5rLmxpbmVzKTtcblxuICBpZiAob2xkTGluZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGh1bmsub2xkTGluZXMgPSBvbGRMaW5lcztcbiAgfSBlbHNlIHtcbiAgICBkZWxldGUgaHVuay5vbGRMaW5lcztcbiAgfVxuXG4gIGlmIChuZXdMaW5lcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaHVuay5uZXdMaW5lcyA9IG5ld0xpbmVzO1xuICB9IGVsc2Uge1xuICAgIGRlbGV0ZSBodW5rLm5ld0xpbmVzO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZShtaW5lLCB0aGVpcnMsIGJhc2UpIHtcbiAgbWluZSA9IGxvYWRQYXRjaChtaW5lLCBiYXNlKTtcbiAgdGhlaXJzID0gbG9hZFBhdGNoKHRoZWlycywgYmFzZSk7XG5cbiAgbGV0IHJldCA9IHt9O1xuXG4gIC8vIEZvciBpbmRleCB3ZSBqdXN0IGxldCBpdCBwYXNzIHRocm91Z2ggYXMgaXQgZG9lc24ndCBoYXZlIGFueSBuZWNlc3NhcnkgbWVhbmluZy5cbiAgLy8gTGVhdmluZyBzYW5pdHkgY2hlY2tzIG9uIHRoaXMgdG8gdGhlIEFQSSBjb25zdW1lciB0aGF0IG1heSBrbm93IG1vcmUgYWJvdXQgdGhlXG4gIC8vIG1lYW5pbmcgaW4gdGhlaXIgb3duIGNvbnRleHQuXG4gIGlmIChtaW5lLmluZGV4IHx8IHRoZWlycy5pbmRleCkge1xuICAgIHJldC5pbmRleCA9IG1pbmUuaW5kZXggfHwgdGhlaXJzLmluZGV4O1xuICB9XG5cbiAgaWYgKG1pbmUubmV3RmlsZU5hbWUgfHwgdGhlaXJzLm5ld0ZpbGVOYW1lKSB7XG4gICAgaWYgKCFmaWxlTmFtZUNoYW5nZWQobWluZSkpIHtcbiAgICAgIC8vIE5vIGhlYWRlciBvciBubyBjaGFuZ2UgaW4gb3VycywgdXNlIHRoZWlycyAoYW5kIG91cnMgaWYgdGhlaXJzIGRvZXMgbm90IGV4aXN0KVxuICAgICAgcmV0Lm9sZEZpbGVOYW1lID0gdGhlaXJzLm9sZEZpbGVOYW1lIHx8IG1pbmUub2xkRmlsZU5hbWU7XG4gICAgICByZXQubmV3RmlsZU5hbWUgPSB0aGVpcnMubmV3RmlsZU5hbWUgfHwgbWluZS5uZXdGaWxlTmFtZTtcbiAgICAgIHJldC5vbGRIZWFkZXIgPSB0aGVpcnMub2xkSGVhZGVyIHx8IG1pbmUub2xkSGVhZGVyO1xuICAgICAgcmV0Lm5ld0hlYWRlciA9IHRoZWlycy5uZXdIZWFkZXIgfHwgbWluZS5uZXdIZWFkZXI7XG4gICAgfSBlbHNlIGlmICghZmlsZU5hbWVDaGFuZ2VkKHRoZWlycykpIHtcbiAgICAgIC8vIE5vIGhlYWRlciBvciBubyBjaGFuZ2UgaW4gdGhlaXJzLCB1c2Ugb3Vyc1xuICAgICAgcmV0Lm9sZEZpbGVOYW1lID0gbWluZS5vbGRGaWxlTmFtZTtcbiAgICAgIHJldC5uZXdGaWxlTmFtZSA9IG1pbmUubmV3RmlsZU5hbWU7XG4gICAgICByZXQub2xkSGVhZGVyID0gbWluZS5vbGRIZWFkZXI7XG4gICAgICByZXQubmV3SGVhZGVyID0gbWluZS5uZXdIZWFkZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEJvdGggY2hhbmdlZC4uLiBmaWd1cmUgaXQgb3V0XG4gICAgICByZXQub2xkRmlsZU5hbWUgPSBzZWxlY3RGaWVsZChyZXQsIG1pbmUub2xkRmlsZU5hbWUsIHRoZWlycy5vbGRGaWxlTmFtZSk7XG4gICAgICByZXQubmV3RmlsZU5hbWUgPSBzZWxlY3RGaWVsZChyZXQsIG1pbmUubmV3RmlsZU5hbWUsIHRoZWlycy5uZXdGaWxlTmFtZSk7XG4gICAgICByZXQub2xkSGVhZGVyID0gc2VsZWN0RmllbGQocmV0LCBtaW5lLm9sZEhlYWRlciwgdGhlaXJzLm9sZEhlYWRlcik7XG4gICAgICByZXQubmV3SGVhZGVyID0gc2VsZWN0RmllbGQocmV0LCBtaW5lLm5ld0hlYWRlciwgdGhlaXJzLm5ld0hlYWRlcik7XG4gICAgfVxuICB9XG5cbiAgcmV0Lmh1bmtzID0gW107XG5cbiAgbGV0IG1pbmVJbmRleCA9IDAsXG4gICAgICB0aGVpcnNJbmRleCA9IDAsXG4gICAgICBtaW5lT2Zmc2V0ID0gMCxcbiAgICAgIHRoZWlyc09mZnNldCA9IDA7XG5cbiAgd2hpbGUgKG1pbmVJbmRleCA8IG1pbmUuaHVua3MubGVuZ3RoIHx8IHRoZWlyc0luZGV4IDwgdGhlaXJzLmh1bmtzLmxlbmd0aCkge1xuICAgIGxldCBtaW5lQ3VycmVudCA9IG1pbmUuaHVua3NbbWluZUluZGV4XSB8fCB7b2xkU3RhcnQ6IEluZmluaXR5fSxcbiAgICAgICAgdGhlaXJzQ3VycmVudCA9IHRoZWlycy5odW5rc1t0aGVpcnNJbmRleF0gfHwge29sZFN0YXJ0OiBJbmZpbml0eX07XG5cbiAgICBpZiAoaHVua0JlZm9yZShtaW5lQ3VycmVudCwgdGhlaXJzQ3VycmVudCkpIHtcbiAgICAgIC8vIFRoaXMgcGF0Y2ggZG9lcyBub3Qgb3ZlcmxhcCB3aXRoIGFueSBvZiB0aGUgb3RoZXJzLCB5YXkuXG4gICAgICByZXQuaHVua3MucHVzaChjbG9uZUh1bmsobWluZUN1cnJlbnQsIG1pbmVPZmZzZXQpKTtcbiAgICAgIG1pbmVJbmRleCsrO1xuICAgICAgdGhlaXJzT2Zmc2V0ICs9IG1pbmVDdXJyZW50Lm5ld0xpbmVzIC0gbWluZUN1cnJlbnQub2xkTGluZXM7XG4gICAgfSBlbHNlIGlmIChodW5rQmVmb3JlKHRoZWlyc0N1cnJlbnQsIG1pbmVDdXJyZW50KSkge1xuICAgICAgLy8gVGhpcyBwYXRjaCBkb2VzIG5vdCBvdmVybGFwIHdpdGggYW55IG9mIHRoZSBvdGhlcnMsIHlheS5cbiAgICAgIHJldC5odW5rcy5wdXNoKGNsb25lSHVuayh0aGVpcnNDdXJyZW50LCB0aGVpcnNPZmZzZXQpKTtcbiAgICAgIHRoZWlyc0luZGV4Kys7XG4gICAgICBtaW5lT2Zmc2V0ICs9IHRoZWlyc0N1cnJlbnQubmV3TGluZXMgLSB0aGVpcnNDdXJyZW50Lm9sZExpbmVzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBPdmVybGFwLCBtZXJnZSBhcyBiZXN0IHdlIGNhblxuICAgICAgbGV0IG1lcmdlZEh1bmsgPSB7XG4gICAgICAgIG9sZFN0YXJ0OiBNYXRoLm1pbihtaW5lQ3VycmVudC5vbGRTdGFydCwgdGhlaXJzQ3VycmVudC5vbGRTdGFydCksXG4gICAgICAgIG9sZExpbmVzOiAwLFxuICAgICAgICBuZXdTdGFydDogTWF0aC5taW4obWluZUN1cnJlbnQubmV3U3RhcnQgKyBtaW5lT2Zmc2V0LCB0aGVpcnNDdXJyZW50Lm9sZFN0YXJ0ICsgdGhlaXJzT2Zmc2V0KSxcbiAgICAgICAgbmV3TGluZXM6IDAsXG4gICAgICAgIGxpbmVzOiBbXVxuICAgICAgfTtcbiAgICAgIG1lcmdlTGluZXMobWVyZ2VkSHVuaywgbWluZUN1cnJlbnQub2xkU3RhcnQsIG1pbmVDdXJyZW50LmxpbmVzLCB0aGVpcnNDdXJyZW50Lm9sZFN0YXJ0LCB0aGVpcnNDdXJyZW50LmxpbmVzKTtcbiAgICAgIHRoZWlyc0luZGV4Kys7XG4gICAgICBtaW5lSW5kZXgrKztcblxuICAgICAgcmV0Lmh1bmtzLnB1c2gobWVyZ2VkSHVuayk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gbG9hZFBhdGNoKHBhcmFtLCBiYXNlKSB7XG4gIGlmICh0eXBlb2YgcGFyYW0gPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKCgvXkBAL20pLnRlc3QocGFyYW0pIHx8ICgoL15JbmRleDovbSkudGVzdChwYXJhbSkpKSB7XG4gICAgICByZXR1cm4gcGFyc2VQYXRjaChwYXJhbSlbMF07XG4gICAgfVxuXG4gICAgaWYgKCFiYXNlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ011c3QgcHJvdmlkZSBhIGJhc2UgcmVmZXJlbmNlIG9yIHBhc3MgaW4gYSBwYXRjaCcpO1xuICAgIH1cbiAgICByZXR1cm4gc3RydWN0dXJlZFBhdGNoKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBiYXNlLCBwYXJhbSk7XG4gIH1cblxuICByZXR1cm4gcGFyYW07XG59XG5cbmZ1bmN0aW9uIGZpbGVOYW1lQ2hhbmdlZChwYXRjaCkge1xuICByZXR1cm4gcGF0Y2gubmV3RmlsZU5hbWUgJiYgcGF0Y2gubmV3RmlsZU5hbWUgIT09IHBhdGNoLm9sZEZpbGVOYW1lO1xufVxuXG5mdW5jdGlvbiBzZWxlY3RGaWVsZChpbmRleCwgbWluZSwgdGhlaXJzKSB7XG4gIGlmIChtaW5lID09PSB0aGVpcnMpIHtcbiAgICByZXR1cm4gbWluZTtcbiAgfSBlbHNlIHtcbiAgICBpbmRleC5jb25mbGljdCA9IHRydWU7XG4gICAgcmV0dXJuIHttaW5lLCB0aGVpcnN9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGh1bmtCZWZvcmUodGVzdCwgY2hlY2spIHtcbiAgcmV0dXJuIHRlc3Qub2xkU3RhcnQgPCBjaGVjay5vbGRTdGFydFxuICAgICYmICh0ZXN0Lm9sZFN0YXJ0ICsgdGVzdC5vbGRMaW5lcykgPCBjaGVjay5vbGRTdGFydDtcbn1cblxuZnVuY3Rpb24gY2xvbmVIdW5rKGh1bmssIG9mZnNldCkge1xuICByZXR1cm4ge1xuICAgIG9sZFN0YXJ0OiBodW5rLm9sZFN0YXJ0LCBvbGRMaW5lczogaHVuay5vbGRMaW5lcyxcbiAgICBuZXdTdGFydDogaHVuay5uZXdTdGFydCArIG9mZnNldCwgbmV3TGluZXM6IGh1bmsubmV3TGluZXMsXG4gICAgbGluZXM6IGh1bmsubGluZXNcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VMaW5lcyhodW5rLCBtaW5lT2Zmc2V0LCBtaW5lTGluZXMsIHRoZWlyT2Zmc2V0LCB0aGVpckxpbmVzKSB7XG4gIC8vIFRoaXMgd2lsbCBnZW5lcmFsbHkgcmVzdWx0IGluIGEgY29uZmxpY3RlZCBodW5rLCBidXQgdGhlcmUgYXJlIGNhc2VzIHdoZXJlIHRoZSBjb250ZXh0XG4gIC8vIGlzIHRoZSBvbmx5IG92ZXJsYXAgd2hlcmUgd2UgY2FuIHN1Y2Nlc3NmdWxseSBtZXJnZSB0aGUgY29udGVudCBoZXJlLlxuICBsZXQgbWluZSA9IHtvZmZzZXQ6IG1pbmVPZmZzZXQsIGxpbmVzOiBtaW5lTGluZXMsIGluZGV4OiAwfSxcbiAgICAgIHRoZWlyID0ge29mZnNldDogdGhlaXJPZmZzZXQsIGxpbmVzOiB0aGVpckxpbmVzLCBpbmRleDogMH07XG5cbiAgLy8gSGFuZGxlIGFueSBsZWFkaW5nIGNvbnRlbnRcbiAgaW5zZXJ0TGVhZGluZyhodW5rLCBtaW5lLCB0aGVpcik7XG4gIGluc2VydExlYWRpbmcoaHVuaywgdGhlaXIsIG1pbmUpO1xuXG4gIC8vIE5vdyBpbiB0aGUgb3ZlcmxhcCBjb250ZW50LiBTY2FuIHRocm91Z2ggYW5kIHNlbGVjdCB0aGUgYmVzdCBjaGFuZ2VzIGZyb20gZWFjaC5cbiAgd2hpbGUgKG1pbmUuaW5kZXggPCBtaW5lLmxpbmVzLmxlbmd0aCAmJiB0aGVpci5pbmRleCA8IHRoZWlyLmxpbmVzLmxlbmd0aCkge1xuICAgIGxldCBtaW5lQ3VycmVudCA9IG1pbmUubGluZXNbbWluZS5pbmRleF0sXG4gICAgICAgIHRoZWlyQ3VycmVudCA9IHRoZWlyLmxpbmVzW3RoZWlyLmluZGV4XTtcblxuICAgIGlmICgobWluZUN1cnJlbnRbMF0gPT09ICctJyB8fCBtaW5lQ3VycmVudFswXSA9PT0gJysnKVxuICAgICAgICAmJiAodGhlaXJDdXJyZW50WzBdID09PSAnLScgfHwgdGhlaXJDdXJyZW50WzBdID09PSAnKycpKSB7XG4gICAgICAvLyBCb3RoIG1vZGlmaWVkIC4uLlxuICAgICAgbXV0dWFsQ2hhbmdlKGh1bmssIG1pbmUsIHRoZWlyKTtcbiAgICB9IGVsc2UgaWYgKG1pbmVDdXJyZW50WzBdID09PSAnKycgJiYgdGhlaXJDdXJyZW50WzBdID09PSAnICcpIHtcbiAgICAgIC8vIE1pbmUgaW5zZXJ0ZWRcbiAgICAgIGh1bmsubGluZXMucHVzaCguLi4gY29sbGVjdENoYW5nZShtaW5lKSk7XG4gICAgfSBlbHNlIGlmICh0aGVpckN1cnJlbnRbMF0gPT09ICcrJyAmJiBtaW5lQ3VycmVudFswXSA9PT0gJyAnKSB7XG4gICAgICAvLyBUaGVpcnMgaW5zZXJ0ZWRcbiAgICAgIGh1bmsubGluZXMucHVzaCguLi4gY29sbGVjdENoYW5nZSh0aGVpcikpO1xuICAgIH0gZWxzZSBpZiAobWluZUN1cnJlbnRbMF0gPT09ICctJyAmJiB0aGVpckN1cnJlbnRbMF0gPT09ICcgJykge1xuICAgICAgLy8gTWluZSByZW1vdmVkIG9yIGVkaXRlZFxuICAgICAgcmVtb3ZhbChodW5rLCBtaW5lLCB0aGVpcik7XG4gICAgfSBlbHNlIGlmICh0aGVpckN1cnJlbnRbMF0gPT09ICctJyAmJiBtaW5lQ3VycmVudFswXSA9PT0gJyAnKSB7XG4gICAgICAvLyBUaGVpciByZW1vdmVkIG9yIGVkaXRlZFxuICAgICAgcmVtb3ZhbChodW5rLCB0aGVpciwgbWluZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChtaW5lQ3VycmVudCA9PT0gdGhlaXJDdXJyZW50KSB7XG4gICAgICAvLyBDb250ZXh0IGlkZW50aXR5XG4gICAgICBodW5rLmxpbmVzLnB1c2gobWluZUN1cnJlbnQpO1xuICAgICAgbWluZS5pbmRleCsrO1xuICAgICAgdGhlaXIuaW5kZXgrKztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ29udGV4dCBtaXNtYXRjaFxuICAgICAgY29uZmxpY3QoaHVuaywgY29sbGVjdENoYW5nZShtaW5lKSwgY29sbGVjdENoYW5nZSh0aGVpcikpO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5vdyBwdXNoIGFueXRoaW5nIHRoYXQgbWF5IGJlIHJlbWFpbmluZ1xuICBpbnNlcnRUcmFpbGluZyhodW5rLCBtaW5lKTtcbiAgaW5zZXJ0VHJhaWxpbmcoaHVuaywgdGhlaXIpO1xuXG4gIGNhbGNMaW5lQ291bnQoaHVuayk7XG59XG5cbmZ1bmN0aW9uIG11dHVhbENoYW5nZShodW5rLCBtaW5lLCB0aGVpcikge1xuICBsZXQgbXlDaGFuZ2VzID0gY29sbGVjdENoYW5nZShtaW5lKSxcbiAgICAgIHRoZWlyQ2hhbmdlcyA9IGNvbGxlY3RDaGFuZ2UodGhlaXIpO1xuXG4gIGlmIChhbGxSZW1vdmVzKG15Q2hhbmdlcykgJiYgYWxsUmVtb3Zlcyh0aGVpckNoYW5nZXMpKSB7XG4gICAgLy8gU3BlY2lhbCBjYXNlIGZvciByZW1vdmUgY2hhbmdlcyB0aGF0IGFyZSBzdXBlcnNldHMgb2Ygb25lIGFub3RoZXJcbiAgICBpZiAoYXJyYXlTdGFydHNXaXRoKG15Q2hhbmdlcywgdGhlaXJDaGFuZ2VzKVxuICAgICAgICAmJiBza2lwUmVtb3ZlU3VwZXJzZXQodGhlaXIsIG15Q2hhbmdlcywgbXlDaGFuZ2VzLmxlbmd0aCAtIHRoZWlyQ2hhbmdlcy5sZW5ndGgpKSB7XG4gICAgICBodW5rLmxpbmVzLnB1c2goLi4uIG15Q2hhbmdlcyk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChhcnJheVN0YXJ0c1dpdGgodGhlaXJDaGFuZ2VzLCBteUNoYW5nZXMpXG4gICAgICAgICYmIHNraXBSZW1vdmVTdXBlcnNldChtaW5lLCB0aGVpckNoYW5nZXMsIHRoZWlyQ2hhbmdlcy5sZW5ndGggLSBteUNoYW5nZXMubGVuZ3RoKSkge1xuICAgICAgaHVuay5saW5lcy5wdXNoKC4uLiB0aGVpckNoYW5nZXMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIGlmIChhcnJheUVxdWFsKG15Q2hhbmdlcywgdGhlaXJDaGFuZ2VzKSkge1xuICAgIGh1bmsubGluZXMucHVzaCguLi4gbXlDaGFuZ2VzKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25mbGljdChodW5rLCBteUNoYW5nZXMsIHRoZWlyQ2hhbmdlcyk7XG59XG5cbmZ1bmN0aW9uIHJlbW92YWwoaHVuaywgbWluZSwgdGhlaXIsIHN3YXApIHtcbiAgbGV0IG15Q2hhbmdlcyA9IGNvbGxlY3RDaGFuZ2UobWluZSksXG4gICAgICB0aGVpckNoYW5nZXMgPSBjb2xsZWN0Q29udGV4dCh0aGVpciwgbXlDaGFuZ2VzKTtcbiAgaWYgKHRoZWlyQ2hhbmdlcy5tZXJnZWQpIHtcbiAgICBodW5rLmxpbmVzLnB1c2goLi4uIHRoZWlyQ2hhbmdlcy5tZXJnZWQpO1xuICB9IGVsc2Uge1xuICAgIGNvbmZsaWN0KGh1bmssIHN3YXAgPyB0aGVpckNoYW5nZXMgOiBteUNoYW5nZXMsIHN3YXAgPyBteUNoYW5nZXMgOiB0aGVpckNoYW5nZXMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbmZsaWN0KGh1bmssIG1pbmUsIHRoZWlyKSB7XG4gIGh1bmsuY29uZmxpY3QgPSB0cnVlO1xuICBodW5rLmxpbmVzLnB1c2goe1xuICAgIGNvbmZsaWN0OiB0cnVlLFxuICAgIG1pbmU6IG1pbmUsXG4gICAgdGhlaXJzOiB0aGVpclxuICB9KTtcbn1cblxuZnVuY3Rpb24gaW5zZXJ0TGVhZGluZyhodW5rLCBpbnNlcnQsIHRoZWlyKSB7XG4gIHdoaWxlIChpbnNlcnQub2Zmc2V0IDwgdGhlaXIub2Zmc2V0ICYmIGluc2VydC5pbmRleCA8IGluc2VydC5saW5lcy5sZW5ndGgpIHtcbiAgICBsZXQgbGluZSA9IGluc2VydC5saW5lc1tpbnNlcnQuaW5kZXgrK107XG4gICAgaHVuay5saW5lcy5wdXNoKGxpbmUpO1xuICAgIGluc2VydC5vZmZzZXQrKztcbiAgfVxufVxuZnVuY3Rpb24gaW5zZXJ0VHJhaWxpbmcoaHVuaywgaW5zZXJ0KSB7XG4gIHdoaWxlIChpbnNlcnQuaW5kZXggPCBpbnNlcnQubGluZXMubGVuZ3RoKSB7XG4gICAgbGV0IGxpbmUgPSBpbnNlcnQubGluZXNbaW5zZXJ0LmluZGV4KytdO1xuICAgIGh1bmsubGluZXMucHVzaChsaW5lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0Q2hhbmdlKHN0YXRlKSB7XG4gIGxldCByZXQgPSBbXSxcbiAgICAgIG9wZXJhdGlvbiA9IHN0YXRlLmxpbmVzW3N0YXRlLmluZGV4XVswXTtcbiAgd2hpbGUgKHN0YXRlLmluZGV4IDwgc3RhdGUubGluZXMubGVuZ3RoKSB7XG4gICAgbGV0IGxpbmUgPSBzdGF0ZS5saW5lc1tzdGF0ZS5pbmRleF07XG5cbiAgICAvLyBHcm91cCBhZGRpdGlvbnMgdGhhdCBhcmUgaW1tZWRpYXRlbHkgYWZ0ZXIgc3VidHJhY3Rpb25zIGFuZCB0cmVhdCB0aGVtIGFzIG9uZSBcImF0b21pY1wiIG1vZGlmeSBjaGFuZ2UuXG4gICAgaWYgKG9wZXJhdGlvbiA9PT0gJy0nICYmIGxpbmVbMF0gPT09ICcrJykge1xuICAgICAgb3BlcmF0aW9uID0gJysnO1xuICAgIH1cblxuICAgIGlmIChvcGVyYXRpb24gPT09IGxpbmVbMF0pIHtcbiAgICAgIHJldC5wdXNoKGxpbmUpO1xuICAgICAgc3RhdGUuaW5kZXgrKztcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cbmZ1bmN0aW9uIGNvbGxlY3RDb250ZXh0KHN0YXRlLCBtYXRjaENoYW5nZXMpIHtcbiAgbGV0IGNoYW5nZXMgPSBbXSxcbiAgICAgIG1lcmdlZCA9IFtdLFxuICAgICAgbWF0Y2hJbmRleCA9IDAsXG4gICAgICBjb250ZXh0Q2hhbmdlcyA9IGZhbHNlLFxuICAgICAgY29uZmxpY3RlZCA9IGZhbHNlO1xuICB3aGlsZSAobWF0Y2hJbmRleCA8IG1hdGNoQ2hhbmdlcy5sZW5ndGhcbiAgICAgICAgJiYgc3RhdGUuaW5kZXggPCBzdGF0ZS5saW5lcy5sZW5ndGgpIHtcbiAgICBsZXQgY2hhbmdlID0gc3RhdGUubGluZXNbc3RhdGUuaW5kZXhdLFxuICAgICAgICBtYXRjaCA9IG1hdGNoQ2hhbmdlc1ttYXRjaEluZGV4XTtcblxuICAgIC8vIE9uY2Ugd2UndmUgaGl0IG91ciBhZGQsIHRoZW4gd2UgYXJlIGRvbmVcbiAgICBpZiAobWF0Y2hbMF0gPT09ICcrJykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY29udGV4dENoYW5nZXMgPSBjb250ZXh0Q2hhbmdlcyB8fCBjaGFuZ2VbMF0gIT09ICcgJztcblxuICAgIG1lcmdlZC5wdXNoKG1hdGNoKTtcbiAgICBtYXRjaEluZGV4Kys7XG5cbiAgICAvLyBDb25zdW1lIGFueSBhZGRpdGlvbnMgaW4gdGhlIG90aGVyIGJsb2NrIGFzIGEgY29uZmxpY3QgdG8gYXR0ZW1wdFxuICAgIC8vIHRvIHB1bGwgaW4gdGhlIHJlbWFpbmluZyBjb250ZXh0IGFmdGVyIHRoaXNcbiAgICBpZiAoY2hhbmdlWzBdID09PSAnKycpIHtcbiAgICAgIGNvbmZsaWN0ZWQgPSB0cnVlO1xuXG4gICAgICB3aGlsZSAoY2hhbmdlWzBdID09PSAnKycpIHtcbiAgICAgICAgY2hhbmdlcy5wdXNoKGNoYW5nZSk7XG4gICAgICAgIGNoYW5nZSA9IHN0YXRlLmxpbmVzWysrc3RhdGUuaW5kZXhdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXRjaC5zdWJzdHIoMSkgPT09IGNoYW5nZS5zdWJzdHIoMSkpIHtcbiAgICAgIGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuICAgICAgc3RhdGUuaW5kZXgrKztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uZmxpY3RlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKChtYXRjaENoYW5nZXNbbWF0Y2hJbmRleF0gfHwgJycpWzBdID09PSAnKydcbiAgICAgICYmIGNvbnRleHRDaGFuZ2VzKSB7XG4gICAgY29uZmxpY3RlZCA9IHRydWU7XG4gIH1cblxuICBpZiAoY29uZmxpY3RlZCkge1xuICAgIHJldHVybiBjaGFuZ2VzO1xuICB9XG5cbiAgd2hpbGUgKG1hdGNoSW5kZXggPCBtYXRjaENoYW5nZXMubGVuZ3RoKSB7XG4gICAgbWVyZ2VkLnB1c2gobWF0Y2hDaGFuZ2VzW21hdGNoSW5kZXgrK10pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtZXJnZWQsXG4gICAgY2hhbmdlc1xuICB9O1xufVxuXG5mdW5jdGlvbiBhbGxSZW1vdmVzKGNoYW5nZXMpIHtcbiAgcmV0dXJuIGNoYW5nZXMucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGNoYW5nZSkge1xuICAgIHJldHVybiBwcmV2ICYmIGNoYW5nZVswXSA9PT0gJy0nO1xuICB9LCB0cnVlKTtcbn1cbmZ1bmN0aW9uIHNraXBSZW1vdmVTdXBlcnNldChzdGF0ZSwgcmVtb3ZlQ2hhbmdlcywgZGVsdGEpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWx0YTsgaSsrKSB7XG4gICAgbGV0IGNoYW5nZUNvbnRlbnQgPSByZW1vdmVDaGFuZ2VzW3JlbW92ZUNoYW5nZXMubGVuZ3RoIC0gZGVsdGEgKyBpXS5zdWJzdHIoMSk7XG4gICAgaWYgKHN0YXRlLmxpbmVzW3N0YXRlLmluZGV4ICsgaV0gIT09ICcgJyArIGNoYW5nZUNvbnRlbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzdGF0ZS5pbmRleCArPSBkZWx0YTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGNhbGNPbGROZXdMaW5lQ291bnQobGluZXMpIHtcbiAgbGV0IG9sZExpbmVzID0gMDtcbiAgbGV0IG5ld0xpbmVzID0gMDtcblxuICBsaW5lcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICBpZiAodHlwZW9mIGxpbmUgIT09ICdzdHJpbmcnKSB7XG4gICAgICBsZXQgbXlDb3VudCA9IGNhbGNPbGROZXdMaW5lQ291bnQobGluZS5taW5lKTtcbiAgICAgIGxldCB0aGVpckNvdW50ID0gY2FsY09sZE5ld0xpbmVDb3VudChsaW5lLnRoZWlycyk7XG5cbiAgICAgIGlmIChvbGRMaW5lcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChteUNvdW50Lm9sZExpbmVzID09PSB0aGVpckNvdW50Lm9sZExpbmVzKSB7XG4gICAgICAgICAgb2xkTGluZXMgKz0gbXlDb3VudC5vbGRMaW5lcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvbGRMaW5lcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobmV3TGluZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobXlDb3VudC5uZXdMaW5lcyA9PT0gdGhlaXJDb3VudC5uZXdMaW5lcykge1xuICAgICAgICAgIG5ld0xpbmVzICs9IG15Q291bnQubmV3TGluZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3TGluZXMgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5ld0xpbmVzICE9PSB1bmRlZmluZWQgJiYgKGxpbmVbMF0gPT09ICcrJyB8fCBsaW5lWzBdID09PSAnICcpKSB7XG4gICAgICAgIG5ld0xpbmVzKys7XG4gICAgICB9XG4gICAgICBpZiAob2xkTGluZXMgIT09IHVuZGVmaW5lZCAmJiAobGluZVswXSA9PT0gJy0nIHx8IGxpbmVbMF0gPT09ICcgJykpIHtcbiAgICAgICAgb2xkTGluZXMrKztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7b2xkTGluZXMsIG5ld0xpbmVzfTtcbn1cbiJdfQ==
