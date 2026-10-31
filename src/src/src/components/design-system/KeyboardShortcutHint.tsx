import { c as _c } from "react/compiler-runtime";
import React from 'react';
import Text from '../../ink/components/Text.js';
type Props = {
  /** The key or chord to display (e.g., "ctrl+o", "Enter", "↑/↓") */
  shortcut: string;
  /** The action the key performs (e.g., "expand", "select", "navigate") */
  action: string;
  /** Whether to wrap the hint in parentheses. Default: false */
  parens?: boolean;
  /** Whether to render the shortcut in bold. Default: false */
  bold?: boolean;
};

/**
 * Renders a keyboard shortcut hint like "ctrl+o to expand" or "(tab to toggle)"
 *
 * Wrap in <Text dimColor> for the common dim styling.
 *
 * @example
 * // Simple hint wrapped in dim Text
 * <Text dimColor><KeyboardShortcutHint shortcut="esc" action="cancel" /></Text>
 *
 * // With parentheses: "(ctrl+o to expand)"
 * <Text dimColor><KeyboardShortcutHint shortcut="ctrl+o" action="expand" parens /></Text>
 *
 * // With bold shortcut: "Enter to confirm" (Enter is bold)
 * <Text dimColor><KeyboardShortcutHint shortcut="Enter" action="confirm" bold /></Text>
 *
 * // Multiple hints with middot separator - use Byline
 * <Text dimColor>
 *   <Byline>
 *     <KeyboardShortcutHint shortcut="Enter" action="confirm" />
 *     <KeyboardShortcutHint shortcut="Esc" action="cancel" />
 *   </Byline>
 * </Text>
 */
export function KeyboardShortcutHint(t0) {
  const $ = _c(9);
  const {
    shortcut,
    action,
    parens: t1,
    bold: t2
  } = t0;
  const parens = t1 === undefined ? false : t1;
  const bold = t2 === undefined ? false : t2;
  let t3;
  if ($[0] !== bold || $[1] !== shortcut) {
    t3 = bold ? <Text bold={true}>{shortcut}</Text> : shortcut;
    $[0] = bold;
    $[1] = shortcut;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  const shortcutText = t3;
  if (parens) {
    let t4;
    if ($[3] !== action || $[4] !== shortcutText) {
      t4 = <Text>({shortcutText} to {action})</Text>;
      $[3] = action;
      $[4] = shortcutText;
      $[5] = t4;
    } else {
      t4 = $[5];
    }
    return t4;
  }
  let t4;
  if ($[6] !== action || $[7] !== shortcutText) {
    t4 = <Text>{shortcutText} to {action}</Text>;
    $[6] = action;
    $[7] = shortcutText;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIlRleHQiLCJQcm9wcyIsInNob3J0Y3V0IiwiYWN0aW9uIiwicGFyZW5zIiwiYm9sZCIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwidDAiLCIkIiwiX2MiLCJ0MSIsInQyIiwidW5kZWZpbmVkIiwidDMiLCJzaG9ydGN1dFRleHQiLCJ0NCJdLCJzb3VyY2VzIjpbIktleWJvYXJkU2hvcnRjdXRIaW50LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgVGV4dCBmcm9tICcuLi8uLi9pbmsvY29tcG9uZW50cy9UZXh0LmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICAvKiogVGhlIGtleSBvciBjaG9yZCB0byBkaXNwbGF5IChlLmcuLCBcImN0cmwrb1wiLCBcIkVudGVyXCIsIFwi4oaRL+KGk1wiKSAqL1xuICBzaG9ydGN1dDogc3RyaW5nXG4gIC8qKiBUaGUgYWN0aW9uIHRoZSBrZXkgcGVyZm9ybXMgKGUuZy4sIFwiZXhwYW5kXCIsIFwic2VsZWN0XCIsIFwibmF2aWdhdGVcIikgKi9cbiAgYWN0aW9uOiBzdHJpbmdcbiAgLyoqIFdoZXRoZXIgdG8gd3JhcCB0aGUgaGludCBpbiBwYXJlbnRoZXNlcy4gRGVmYXVsdDogZmFsc2UgKi9cbiAgcGFyZW5zPzogYm9vbGVhblxuICAvKiogV2hldGhlciB0byByZW5kZXIgdGhlIHNob3J0Y3V0IGluIGJvbGQuIERlZmF1bHQ6IGZhbHNlICovXG4gIGJvbGQ/OiBib29sZWFuXG59XG5cbi8qKlxuICogUmVuZGVycyBhIGtleWJvYXJkIHNob3J0Y3V0IGhpbnQgbGlrZSBcImN0cmwrbyB0byBleHBhbmRcIiBvciBcIih0YWIgdG8gdG9nZ2xlKVwiXG4gKlxuICogV3JhcCBpbiA8VGV4dCBkaW1Db2xvcj4gZm9yIHRoZSBjb21tb24gZGltIHN0eWxpbmcuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFNpbXBsZSBoaW50IHdyYXBwZWQgaW4gZGltIFRleHRcbiAqIDxUZXh0IGRpbUNvbG9yPjxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cImVzY1wiIGFjdGlvbj1cImNhbmNlbFwiIC8+PC9UZXh0PlxuICpcbiAqIC8vIFdpdGggcGFyZW50aGVzZXM6IFwiKGN0cmwrbyB0byBleHBhbmQpXCJcbiAqIDxUZXh0IGRpbUNvbG9yPjxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cImN0cmwrb1wiIGFjdGlvbj1cImV4cGFuZFwiIHBhcmVucyAvPjwvVGV4dD5cbiAqXG4gKiAvLyBXaXRoIGJvbGQgc2hvcnRjdXQ6IFwiRW50ZXIgdG8gY29uZmlybVwiIChFbnRlciBpcyBib2xkKVxuICogPFRleHQgZGltQ29sb3I+PEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJjb25maXJtXCIgYm9sZCAvPjwvVGV4dD5cbiAqXG4gKiAvLyBNdWx0aXBsZSBoaW50cyB3aXRoIG1pZGRvdCBzZXBhcmF0b3IgLSB1c2UgQnlsaW5lXG4gKiA8VGV4dCBkaW1Db2xvcj5cbiAqICAgPEJ5bGluZT5cbiAqICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICogICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVzY1wiIGFjdGlvbj1cImNhbmNlbFwiIC8+XG4gKiAgIDwvQnlsaW5lPlxuICogPC9UZXh0PlxuICovXG5leHBvcnQgZnVuY3Rpb24gS2V5Ym9hcmRTaG9ydGN1dEhpbnQoe1xuICBzaG9ydGN1dCxcbiAgYWN0aW9uLFxuICBwYXJlbnMgPSBmYWxzZSxcbiAgYm9sZCA9IGZhbHNlLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBzaG9ydGN1dFRleHQgPSBib2xkID8gPFRleHQgYm9sZD57c2hvcnRjdXR9PC9UZXh0PiA6IHNob3J0Y3V0XG5cbiAgaWYgKHBhcmVucykge1xuICAgIHJldHVybiAoXG4gICAgICA8VGV4dD5cbiAgICAgICAgKHtzaG9ydGN1dFRleHR9IHRvIHthY3Rpb259KVxuICAgICAgPC9UZXh0PlxuICAgIClcbiAgfVxuICByZXR1cm4gKFxuICAgIDxUZXh0PlxuICAgICAge3Nob3J0Y3V0VGV4dH0gdG8ge2FjdGlvbn1cbiAgICA8L1RleHQ+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLEtBQUssTUFBTSxPQUFPO0FBQ3pCLE9BQU9DLElBQUksTUFBTSw4QkFBOEI7QUFFL0MsS0FBS0MsS0FBSyxHQUFHO0VBQ1g7RUFDQUMsUUFBUSxFQUFFLE1BQU07RUFDaEI7RUFDQUMsTUFBTSxFQUFFLE1BQU07RUFDZDtFQUNBQyxNQUFNLENBQUMsRUFBRSxPQUFPO0VBQ2hCO0VBQ0FDLElBQUksQ0FBQyxFQUFFLE9BQU87QUFDaEIsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTyxTQUFBQyxxQkFBQUMsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUE4QjtJQUFBUCxRQUFBO0lBQUFDLE1BQUE7SUFBQUMsTUFBQSxFQUFBTSxFQUFBO0lBQUFMLElBQUEsRUFBQU07RUFBQSxJQUFBSixFQUs3QjtFQUZOLE1BQUFILE1BQUEsR0FBQU0sRUFBYyxLQUFkRSxTQUFjLEdBQWQsS0FBYyxHQUFkRixFQUFjO0VBQ2QsTUFBQUwsSUFBQSxHQUFBTSxFQUFZLEtBQVpDLFNBQVksR0FBWixLQUFZLEdBQVpELEVBQVk7RUFBQSxJQUFBRSxFQUFBO0VBQUEsSUFBQUwsQ0FBQSxRQUFBSCxJQUFBLElBQUFHLENBQUEsUUFBQU4sUUFBQTtJQUVTVyxFQUFBLEdBQUFSLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUosS0FBRyxDQUFDLENBQUVILFNBQU8sQ0FBRSxFQUFwQixJQUFJLENBQWtDLEdBQTlDQSxRQUE4QztJQUFBTSxDQUFBLE1BQUFILElBQUE7SUFBQUcsQ0FBQSxNQUFBTixRQUFBO0lBQUFNLENBQUEsTUFBQUssRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUwsQ0FBQTtFQUFBO0VBQW5FLE1BQUFNLFlBQUEsR0FBcUJELEVBQThDO0VBRW5FLElBQUlULE1BQU07SUFBQSxJQUFBVyxFQUFBO0lBQUEsSUFBQVAsQ0FBQSxRQUFBTCxNQUFBLElBQUFLLENBQUEsUUFBQU0sWUFBQTtNQUVOQyxFQUFBLElBQUMsSUFBSSxDQUFDLENBQ0ZELGFBQVcsQ0FBRSxJQUFLWCxPQUFLLENBQUUsQ0FDN0IsRUFGQyxJQUFJLENBRUU7TUFBQUssQ0FBQSxNQUFBTCxNQUFBO01BQUFLLENBQUEsTUFBQU0sWUFBQTtNQUFBTixDQUFBLE1BQUFPLEVBQUE7SUFBQTtNQUFBQSxFQUFBLEdBQUFQLENBQUE7SUFBQTtJQUFBLE9BRlBPLEVBRU87RUFBQTtFQUVWLElBQUFBLEVBQUE7RUFBQSxJQUFBUCxDQUFBLFFBQUFMLE1BQUEsSUFBQUssQ0FBQSxRQUFBTSxZQUFBO0lBRUNDLEVBQUEsSUFBQyxJQUFJLENBQ0ZELGFBQVcsQ0FBRSxJQUFLWCxPQUFLLENBQzFCLEVBRkMsSUFBSSxDQUVFO0lBQUFLLENBQUEsTUFBQUwsTUFBQTtJQUFBSyxDQUFBLE1BQUFNLFlBQUE7SUFBQU4sQ0FBQSxNQUFBTyxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBUCxDQUFBO0VBQUE7RUFBQSxPQUZQTyxFQUVPO0FBQUEiLCJpZ25vcmVMaXN0IjpbXX0=