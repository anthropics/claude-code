/*istanbul ignore start*/
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.diffCss = diffCss;
exports.cssDiff = void 0;

/*istanbul ignore end*/
var
/*istanbul ignore start*/
_base = _interopRequireDefault(require("./base"))
/*istanbul ignore end*/
;

/*istanbul ignore start*/ function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*istanbul ignore end*/
var cssDiff = new
/*istanbul ignore start*/
_base
/*istanbul ignore end*/
.
/*istanbul ignore start*/
default
/*istanbul ignore end*/
();

/*istanbul ignore start*/
exports.cssDiff = cssDiff;

/*istanbul ignore end*/
cssDiff.tokenize = function (value) {
  return value.split(/([{}:;,]|\s+)/);
};

function diffCss(oldStr, newStr, callback) {
  return cssDiff.diff(oldStr, newStr, callback);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kaWZmL2Nzcy5qcyJdLCJuYW1lcyI6WyJjc3NEaWZmIiwiRGlmZiIsInRva2VuaXplIiwidmFsdWUiLCJzcGxpdCIsImRpZmZDc3MiLCJvbGRTdHIiLCJuZXdTdHIiLCJjYWxsYmFjayIsImRpZmYiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOzs7OztBQUVPLElBQU1BLE9BQU8sR0FBRztBQUFJQztBQUFBQTtBQUFBQTtBQUFBQTtBQUFBQTtBQUFBQTtBQUFKO0FBQUEsRUFBaEI7Ozs7OztBQUNQRCxPQUFPLENBQUNFLFFBQVIsR0FBbUIsVUFBU0MsS0FBVCxFQUFnQjtBQUNqQyxTQUFPQSxLQUFLLENBQUNDLEtBQU4sQ0FBWSxlQUFaLENBQVA7QUFDRCxDQUZEOztBQUlPLFNBQVNDLE9BQVQsQ0FBaUJDLE1BQWpCLEVBQXlCQyxNQUF6QixFQUFpQ0MsUUFBakMsRUFBMkM7QUFBRSxTQUFPUixPQUFPLENBQUNTLElBQVIsQ0FBYUgsTUFBYixFQUFxQkMsTUFBckIsRUFBNkJDLFFBQTdCLENBQVA7QUFBZ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgRGlmZiBmcm9tICcuL2Jhc2UnO1xuXG5leHBvcnQgY29uc3QgY3NzRGlmZiA9IG5ldyBEaWZmKCk7XG5jc3NEaWZmLnRva2VuaXplID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlLnNwbGl0KC8oW3t9OjssXXxcXHMrKS8pO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZDc3Mob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKSB7IHJldHVybiBjc3NEaWZmLmRpZmYob2xkU3RyLCBuZXdTdHIsIGNhbGxiYWNrKTsgfVxuIl19
