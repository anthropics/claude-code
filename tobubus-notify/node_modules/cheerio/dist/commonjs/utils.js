"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCheerio = isCheerio;
exports.camelCase = camelCase;
exports.cssCase = cssCase;
exports.domEach = domEach;
exports.isHtml = isHtml;
/**
 * Checks if an object is a Cheerio instance.
 *
 * @category Utils
 * @param maybeCheerio - The object to check.
 * @returns Whether the object is a Cheerio instance.
 */
function isCheerio(maybeCheerio) {
    return maybeCheerio.cheerio != null;
}
/**
 * Convert a string to camel case notation.
 *
 * @private
 * @category Utils
 * @param str - The string to be converted.
 * @returns String in camel case notation.
 */
function camelCase(str) {
    return str.replace(/[._-](\w|$)/g, (_, x) => x.toUpperCase());
}
/**
 * Convert a string from camel case to "CSS case", where word boundaries are
 * described by hyphens ("-") and all characters are lower-case.
 *
 * @private
 * @category Utils
 * @param str - The string to be converted.
 * @returns String in "CSS case".
 */
function cssCase(str) {
    return str.replace(/[A-Z]/g, '-$&').toLowerCase();
}
/**
 * Iterate over each DOM element without creating intermediary Cheerio
 * instances.
 *
 * This is indented for use internally to avoid otherwise unnecessary memory
 * pressure introduced by _make.
 *
 * @category Utils
 * @param array - The array to iterate over.
 * @param fn - Function to call.
 * @returns The original instance.
 */
function domEach(array, fn) {
    const len = array.length;
    for (let i = 0; i < len; i++)
        fn(array[i], i);
    return array;
}
var CharacterCode;
(function (CharacterCode) {
    CharacterCode[CharacterCode["LowerA"] = 97] = "LowerA";
    CharacterCode[CharacterCode["LowerZ"] = 122] = "LowerZ";
    CharacterCode[CharacterCode["UpperA"] = 65] = "UpperA";
    CharacterCode[CharacterCode["UpperZ"] = 90] = "UpperZ";
    CharacterCode[CharacterCode["Exclamation"] = 33] = "Exclamation";
})(CharacterCode || (CharacterCode = {}));
/**
 * Check if string is HTML.
 *
 * Tests for a `<` within a string, immediate followed by a letter and
 * eventually followed by a `>`.
 *
 * @private
 * @category Utils
 * @param str - The string to check.
 * @returns Indicates if `str` is HTML.
 */
function isHtml(str) {
    if (typeof str !== 'string') {
        return false;
    }
    const tagStart = str.indexOf('<');
    if (tagStart === -1 || tagStart > str.length - 3)
        return false;
    const tagChar = str.charCodeAt(tagStart + 1);
    return (((tagChar >= CharacterCode.LowerA && tagChar <= CharacterCode.LowerZ) ||
        (tagChar >= CharacterCode.UpperA && tagChar <= CharacterCode.UpperZ) ||
        tagChar === CharacterCode.Exclamation) &&
        str.includes('>', tagStart + 2));
}
//# sourceMappingURL=utils.js.map