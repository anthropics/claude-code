import { c as _c } from "react/compiler-runtime";
import React, { Children, isValidElement } from 'react';
import { Text } from '../../ink.js';
type Props = {
  /** The items to join with a middot separator */
  children: React.ReactNode;
};

/**
 * Joins children with a middot separator (" · ") for inline metadata display.
 *
 * Named after the publishing term "byline" - the line of metadata typically
 * shown below a title (e.g., "John Doe · 5 min read · Mar 12").
 *
 * Automatically filters out null/undefined/false children and only renders
 * separators between valid elements.
 *
 * @example
 * // Basic usage: "Enter to confirm · Esc to cancel"
 * <Text dimColor>
 *   <Byline>
 *     <KeyboardShortcutHint shortcut="Enter" action="confirm" />
 *     <KeyboardShortcutHint shortcut="Esc" action="cancel" />
 *   </Byline>
 * </Text>
 *
 * @example
 * // With conditional children: "Esc to cancel" (only one item shown)
 * <Text dimColor>
 *   <Byline>
 *     {showEnter && <KeyboardShortcutHint shortcut="Enter" action="confirm" />}
 *     <KeyboardShortcutHint shortcut="Esc" action="cancel" />
 *   </Byline>
 * </Text>
 *
 */
export function Byline(t0) {
  const $ = _c(5);
  const {
    children
  } = t0;
  let t1;
  let t2;
  if ($[0] !== children) {
    t2 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const validChildren = Children.toArray(children);
      if (validChildren.length === 0) {
        t2 = null;
        break bb0;
      }
      t1 = validChildren.map(_temp);
    }
    $[0] = children;
    $[1] = t1;
    $[2] = t2;
  } else {
    t1 = $[1];
    t2 = $[2];
  }
  if (t2 !== Symbol.for("react.early_return_sentinel")) {
    return t2;
  }
  let t3;
  if ($[3] !== t1) {
    t3 = <>{t1}</>;
    $[3] = t1;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  return t3;
}
function _temp(child, index) {
  return <React.Fragment key={isValidElement(child) ? child.key ?? index : index}>{index > 0 && <Text dimColor={true}> · </Text>}{child}</React.Fragment>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIkNoaWxkcmVuIiwiaXNWYWxpZEVsZW1lbnQiLCJUZXh0IiwiUHJvcHMiLCJjaGlsZHJlbiIsIlJlYWN0Tm9kZSIsIkJ5bGluZSIsInQwIiwiJCIsIl9jIiwidDEiLCJ0MiIsIlN5bWJvbCIsImZvciIsImJiMCIsInZhbGlkQ2hpbGRyZW4iLCJ0b0FycmF5IiwibGVuZ3RoIiwibWFwIiwiX3RlbXAiLCJ0MyIsImNoaWxkIiwiaW5kZXgiLCJrZXkiXSwic291cmNlcyI6WyJCeWxpbmUudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwgeyBDaGlsZHJlbiwgaXNWYWxpZEVsZW1lbnQgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIC8qKiBUaGUgaXRlbXMgdG8gam9pbiB3aXRoIGEgbWlkZG90IHNlcGFyYXRvciAqL1xuICBjaGlsZHJlbjogUmVhY3QuUmVhY3ROb2RlXG59XG5cbi8qKlxuICogSm9pbnMgY2hpbGRyZW4gd2l0aCBhIG1pZGRvdCBzZXBhcmF0b3IgKFwiIMK3IFwiKSBmb3IgaW5saW5lIG1ldGFkYXRhIGRpc3BsYXkuXG4gKlxuICogTmFtZWQgYWZ0ZXIgdGhlIHB1Ymxpc2hpbmcgdGVybSBcImJ5bGluZVwiIC0gdGhlIGxpbmUgb2YgbWV0YWRhdGEgdHlwaWNhbGx5XG4gKiBzaG93biBiZWxvdyBhIHRpdGxlIChlLmcuLCBcIkpvaG4gRG9lIMK3IDUgbWluIHJlYWQgwrcgTWFyIDEyXCIpLlxuICpcbiAqIEF1dG9tYXRpY2FsbHkgZmlsdGVycyBvdXQgbnVsbC91bmRlZmluZWQvZmFsc2UgY2hpbGRyZW4gYW5kIG9ubHkgcmVuZGVyc1xuICogc2VwYXJhdG9ycyBiZXR3ZWVuIHZhbGlkIGVsZW1lbnRzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBCYXNpYyB1c2FnZTogXCJFbnRlciB0byBjb25maXJtIMK3IEVzYyB0byBjYW5jZWxcIlxuICogPFRleHQgZGltQ29sb3I+XG4gKiAgIDxCeWxpbmU+XG4gKiAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJjb25maXJtXCIgLz5cbiAqICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFc2NcIiBhY3Rpb249XCJjYW5jZWxcIiAvPlxuICogICA8L0J5bGluZT5cbiAqIDwvVGV4dD5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gV2l0aCBjb25kaXRpb25hbCBjaGlsZHJlbjogXCJFc2MgdG8gY2FuY2VsXCIgKG9ubHkgb25lIGl0ZW0gc2hvd24pXG4gKiA8VGV4dCBkaW1Db2xvcj5cbiAqICAgPEJ5bGluZT5cbiAqICAgICB7c2hvd0VudGVyICYmIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyXCIgYWN0aW9uPVwiY29uZmlybVwiIC8+fVxuICogICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVzY1wiIGFjdGlvbj1cImNhbmNlbFwiIC8+XG4gKiAgIDwvQnlsaW5lPlxuICogPC9UZXh0PlxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIEJ5bGluZSh7IGNoaWxkcmVuIH06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gQ2hpbGRyZW4udG9BcnJheSBhbHJlYWR5IGZpbHRlcnMgb3V0IG51bGwsIHVuZGVmaW5lZCwgYW5kIGJvb2xlYW5zXG4gIGNvbnN0IHZhbGlkQ2hpbGRyZW4gPSBDaGlsZHJlbi50b0FycmF5KGNoaWxkcmVuKVxuXG4gIGlmICh2YWxpZENoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICB7dmFsaWRDaGlsZHJlbi5tYXAoKGNoaWxkLCBpbmRleCkgPT4gKFxuICAgICAgICA8UmVhY3QuRnJhZ21lbnRcbiAgICAgICAgICBrZXk9e2lzVmFsaWRFbGVtZW50KGNoaWxkKSA/IChjaGlsZC5rZXkgPz8gaW5kZXgpIDogaW5kZXh9XG4gICAgICAgID5cbiAgICAgICAgICB7aW5kZXggPiAwICYmIDxUZXh0IGRpbUNvbG9yPiDCtyA8L1RleHQ+fVxuICAgICAgICAgIHtjaGlsZH1cbiAgICAgICAgPC9SZWFjdC5GcmFnbWVudD5cbiAgICAgICkpfVxuICAgIDwvPlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxLQUFLLElBQUlDLFFBQVEsRUFBRUMsY0FBYyxRQUFRLE9BQU87QUFDdkQsU0FBU0MsSUFBSSxRQUFRLGNBQWM7QUFFbkMsS0FBS0MsS0FBSyxHQUFHO0VBQ1g7RUFDQUMsUUFBUSxFQUFFTCxLQUFLLENBQUNNLFNBQVM7QUFDM0IsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sU0FBQUMsT0FBQUMsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUFnQjtJQUFBTDtFQUFBLElBQUFHLEVBQW1CO0VBQUEsSUFBQUcsRUFBQTtFQUFBLElBQUFDLEVBQUE7RUFBQSxJQUFBSCxDQUFBLFFBQUFKLFFBQUE7SUFLL0JPLEVBQUEsR0FBQUMsTUFBSSxDQUFBQyxHQUFBLENBQUosNkJBQUcsQ0FBQztJQUFBQyxHQUFBO01BSGIsTUFBQUMsYUFBQSxHQUFzQmYsUUFBUSxDQUFBZ0IsT0FBUSxDQUFDWixRQUFRLENBQUM7TUFFaEQsSUFBSVcsYUFBYSxDQUFBRSxNQUFPLEtBQUssQ0FBQztRQUNyQk4sRUFBQSxPQUFJO1FBQUosTUFBQUcsR0FBQTtNQUFJO01BS1JKLEVBQUEsR0FBQUssYUFBYSxDQUFBRyxHQUFJLENBQUNDLEtBT2xCLENBQUM7SUFBQTtJQUFBWCxDQUFBLE1BQUFKLFFBQUE7SUFBQUksQ0FBQSxNQUFBRSxFQUFBO0lBQUFGLENBQUEsTUFBQUcsRUFBQTtFQUFBO0lBQUFELEVBQUEsR0FBQUYsQ0FBQTtJQUFBRyxFQUFBLEdBQUFILENBQUE7RUFBQTtFQUFBLElBQUFHLEVBQUEsS0FBQUMsTUFBQSxDQUFBQyxHQUFBO0lBQUEsT0FBQUYsRUFBQTtFQUFBO0VBQUEsSUFBQVMsRUFBQTtFQUFBLElBQUFaLENBQUEsUUFBQUUsRUFBQTtJQVJKVSxFQUFBLEtBQ0csQ0FBQVYsRUFPQSxDQUFDLEdBQ0Q7SUFBQUYsQ0FBQSxNQUFBRSxFQUFBO0lBQUFGLENBQUEsTUFBQVksRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQVosQ0FBQTtFQUFBO0VBQUEsT0FUSFksRUFTRztBQUFBO0FBbEJBLFNBQUFELE1BQUFFLEtBQUEsRUFBQUMsS0FBQTtFQUFBLE9BV0MsZ0JBQ08sR0FBb0QsQ0FBcEQsQ0FBQXJCLGNBQWMsQ0FBQ29CLEtBQW9DLENBQUMsR0FBM0JBLEtBQUssQ0FBQUUsR0FBYSxJQUFsQkQsS0FBMkIsR0FBcERBLEtBQW1ELENBQUMsQ0FFeEQsQ0FBQUEsS0FBSyxHQUFHLENBQThCLElBQXpCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyxHQUFHLEVBQWpCLElBQUksQ0FBbUIsQ0FDckNELE1BQUksQ0FDUCxpQkFBaUI7QUFBQSIsImlnbm9yZUxpc3QiOltdfQ==