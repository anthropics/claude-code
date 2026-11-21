import { c as _c } from "react/compiler-runtime";
import React from 'react';
import { useIsInsideModal } from '../../context/modalContext.js';
import { Box } from '../../ink.js';
import type { Theme } from '../../utils/theme.js';
import { Divider } from './Divider.js';
type PaneProps = {
  children: React.ReactNode;
  /**
   * Theme color for the top border line.
   */
  color?: keyof Theme;
};

/**
 * A pane — a region of the terminal that appears below the REPL prompt,
 * bounded by a colored top line with a one-row gap above and horizontal
 * padding. Used by all slash-command screens: /config, /help, /plugins,
 * /sandbox, /stats, /permissions.
 *
 * For confirm/cancel dialogs (Esc to dismiss, Enter to confirm), use
 * `<Dialog>` instead — it registers its own keybindings. For a full
 * rounded-border card, use `<Panel>`.
 *
 * Submenus rendered inside a Pane should use `hideBorder` on their Dialog
 * so the Pane's border remains the single frame.
 *
 * @example
 * <Pane color="permission">
 *   <Tabs title="Sandbox:">...</Tabs>
 * </Pane>
 */
export function Pane(t0) {
  const $ = _c(9);
  const {
    children,
    color
  } = t0;
  if (useIsInsideModal()) {
    let t1;
    if ($[0] !== children) {
      t1 = <Box flexDirection="column" paddingX={1} flexShrink={0}>{children}</Box>;
      $[0] = children;
      $[1] = t1;
    } else {
      t1 = $[1];
    }
    return t1;
  }
  let t1;
  if ($[2] !== color) {
    t1 = <Divider color={color} />;
    $[2] = color;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  let t2;
  if ($[4] !== children) {
    t2 = <Box flexDirection="column" paddingX={2}>{children}</Box>;
    $[4] = children;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  let t3;
  if ($[6] !== t1 || $[7] !== t2) {
    t3 = <Box flexDirection="column" paddingTop={1}>{t1}{t2}</Box>;
    $[6] = t1;
    $[7] = t2;
    $[8] = t3;
  } else {
    t3 = $[8];
  }
  return t3;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUlzSW5zaWRlTW9kYWwiLCJCb3giLCJUaGVtZSIsIkRpdmlkZXIiLCJQYW5lUHJvcHMiLCJjaGlsZHJlbiIsIlJlYWN0Tm9kZSIsImNvbG9yIiwiUGFuZSIsInQwIiwiJCIsIl9jIiwidDEiLCJ0MiIsInQzIl0sInNvdXJjZXMiOlsiUGFuZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlSXNJbnNpZGVNb2RhbCB9IGZyb20gJy4uLy4uL2NvbnRleHQvbW9kYWxDb250ZXh0LmpzJ1xuaW1wb3J0IHsgQm94IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGVtZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHsgRGl2aWRlciB9IGZyb20gJy4vRGl2aWRlci5qcydcblxudHlwZSBQYW5lUHJvcHMgPSB7XG4gIGNoaWxkcmVuOiBSZWFjdC5SZWFjdE5vZGVcbiAgLyoqXG4gICAqIFRoZW1lIGNvbG9yIGZvciB0aGUgdG9wIGJvcmRlciBsaW5lLlxuICAgKi9cbiAgY29sb3I/OiBrZXlvZiBUaGVtZVxufVxuXG4vKipcbiAqIEEgcGFuZSDigJQgYSByZWdpb24gb2YgdGhlIHRlcm1pbmFsIHRoYXQgYXBwZWFycyBiZWxvdyB0aGUgUkVQTCBwcm9tcHQsXG4gKiBib3VuZGVkIGJ5IGEgY29sb3JlZCB0b3AgbGluZSB3aXRoIGEgb25lLXJvdyBnYXAgYWJvdmUgYW5kIGhvcml6b250YWxcbiAqIHBhZGRpbmcuIFVzZWQgYnkgYWxsIHNsYXNoLWNvbW1hbmQgc2NyZWVuczogL2NvbmZpZywgL2hlbHAsIC9wbHVnaW5zLFxuICogL3NhbmRib3gsIC9zdGF0cywgL3Blcm1pc3Npb25zLlxuICpcbiAqIEZvciBjb25maXJtL2NhbmNlbCBkaWFsb2dzIChFc2MgdG8gZGlzbWlzcywgRW50ZXIgdG8gY29uZmlybSksIHVzZVxuICogYDxEaWFsb2c+YCBpbnN0ZWFkIOKAlCBpdCByZWdpc3RlcnMgaXRzIG93biBrZXliaW5kaW5ncy4gRm9yIGEgZnVsbFxuICogcm91bmRlZC1ib3JkZXIgY2FyZCwgdXNlIGA8UGFuZWw+YC5cbiAqXG4gKiBTdWJtZW51cyByZW5kZXJlZCBpbnNpZGUgYSBQYW5lIHNob3VsZCB1c2UgYGhpZGVCb3JkZXJgIG9uIHRoZWlyIERpYWxvZ1xuICogc28gdGhlIFBhbmUncyBib3JkZXIgcmVtYWlucyB0aGUgc2luZ2xlIGZyYW1lLlxuICpcbiAqIEBleGFtcGxlXG4gKiA8UGFuZSBjb2xvcj1cInBlcm1pc3Npb25cIj5cbiAqICAgPFRhYnMgdGl0bGU9XCJTYW5kYm94OlwiPi4uLjwvVGFicz5cbiAqIDwvUGFuZT5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFBhbmUoeyBjaGlsZHJlbiwgY29sb3IgfTogUGFuZVByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gV2hlbiByZW5kZXJlZCBpbnNpZGUgRnVsbHNjcmVlbkxheW91dCdzIG1vZGFsIHNsb3QsIGl0cyDilpQgZGl2aWRlciBJU1xuICAvLyB0aGUgZnJhbWUuIFNraXAgb3VyIG93biBEaXZpZGVyICh3b3VsZCBkb3VibGUtZnJhbWUpIGFuZCB0aGUgZXh0cmEgdG9wXG4gIC8vIHBhZGRpbmcuIFRoaXMgbGV0cyBzbGFzaC1jb21tYW5kIHNjcmVlbnMgdGhhdCB3cmFwIGluIFBhbmUgKGUuZy5cbiAgLy8gL21vZGVsIOKGkiBNb2RlbFBpY2tlcikgcm91dGUgdGhyb3VnaCB0aGUgbW9kYWwgc2xvdCB1bmNoYW5nZWQuXG4gIGlmICh1c2VJc0luc2lkZU1vZGFsKCkpIHtcbiAgICAvLyBmbGV4U2hyaW5rPTA6IHRoZSBtb2RhbCBzbG90J3MgYWJzb2x1dGUgQm94IGhhcyBubyBleHBsaWNpdCBoZWlnaHRcbiAgICAvLyAoZ3Jvd3MgdG8gZml0LCBtYXhIZWlnaHQgY2FwKS4gV2l0aCBmbGV4R3Jvdz0xLCByZS1yZW5kZXJzIGNhdXNlXG4gICAgLy8geW9nYSB0byByZXNvbHZlIHRoaXMgQm94J3MgaGVpZ2h0IHRvIDAgYWdhaW5zdCB0aGUgdW5kZXRlcm1pbmVkXG4gICAgLy8gcGFyZW50IOKAlCAvcGVybWlzc2lvbnMgYm9keSBibGFua3Mgb24gRG93biBhcnJvdy4gU2VlICMyMzU5Mi5cbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgcGFkZGluZ1g9ezF9IGZsZXhTaHJpbms9ezB9PlxuICAgICAgICB7Y2hpbGRyZW59XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBwYWRkaW5nVG9wPXsxfT5cbiAgICAgIDxEaXZpZGVyIGNvbG9yPXtjb2xvcn0gLz5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHBhZGRpbmdYPXsyfT5cbiAgICAgICAge2NoaWxkcmVufVxuICAgICAgPC9Cb3g+XG4gICAgPC9Cb3g+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLEtBQUssTUFBTSxPQUFPO0FBQ3pCLFNBQVNDLGdCQUFnQixRQUFRLCtCQUErQjtBQUNoRSxTQUFTQyxHQUFHLFFBQVEsY0FBYztBQUNsQyxjQUFjQyxLQUFLLFFBQVEsc0JBQXNCO0FBQ2pELFNBQVNDLE9BQU8sUUFBUSxjQUFjO0FBRXRDLEtBQUtDLFNBQVMsR0FBRztFQUNmQyxRQUFRLEVBQUVOLEtBQUssQ0FBQ08sU0FBUztFQUN6QjtBQUNGO0FBQ0E7RUFDRUMsS0FBSyxDQUFDLEVBQUUsTUFBTUwsS0FBSztBQUNyQixDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sU0FBQU0sS0FBQUMsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUFjO0lBQUFOLFFBQUE7SUFBQUU7RUFBQSxJQUFBRSxFQUE4QjtFQUtqRCxJQUFJVCxnQkFBZ0IsQ0FBQyxDQUFDO0lBQUEsSUFBQVksRUFBQTtJQUFBLElBQUFGLENBQUEsUUFBQUwsUUFBQTtNQU1sQk8sRUFBQSxJQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUFXLFFBQUMsQ0FBRCxHQUFDLENBQWMsVUFBQyxDQUFELEdBQUMsQ0FDbkRQLFNBQU8sQ0FDVixFQUZDLEdBQUcsQ0FFRTtNQUFBSyxDQUFBLE1BQUFMLFFBQUE7TUFBQUssQ0FBQSxNQUFBRSxFQUFBO0lBQUE7TUFBQUEsRUFBQSxHQUFBRixDQUFBO0lBQUE7SUFBQSxPQUZORSxFQUVNO0VBQUE7RUFFVCxJQUFBQSxFQUFBO0VBQUEsSUFBQUYsQ0FBQSxRQUFBSCxLQUFBO0lBR0dLLEVBQUEsSUFBQyxPQUFPLENBQVFMLEtBQUssQ0FBTEEsTUFBSSxDQUFDLEdBQUk7SUFBQUcsQ0FBQSxNQUFBSCxLQUFBO0lBQUFHLENBQUEsTUFBQUUsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUYsQ0FBQTtFQUFBO0VBQUEsSUFBQUcsRUFBQTtFQUFBLElBQUFILENBQUEsUUFBQUwsUUFBQTtJQUN6QlEsRUFBQSxJQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUFXLFFBQUMsQ0FBRCxHQUFDLENBQ3BDUixTQUFPLENBQ1YsRUFGQyxHQUFHLENBRUU7SUFBQUssQ0FBQSxNQUFBTCxRQUFBO0lBQUFLLENBQUEsTUFBQUcsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUgsQ0FBQTtFQUFBO0VBQUEsSUFBQUksRUFBQTtFQUFBLElBQUFKLENBQUEsUUFBQUUsRUFBQSxJQUFBRixDQUFBLFFBQUFHLEVBQUE7SUFKUkMsRUFBQSxJQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUFhLFVBQUMsQ0FBRCxHQUFDLENBQ3ZDLENBQUFGLEVBQXdCLENBQ3hCLENBQUFDLEVBRUssQ0FDUCxFQUxDLEdBQUcsQ0FLRTtJQUFBSCxDQUFBLE1BQUFFLEVBQUE7SUFBQUYsQ0FBQSxNQUFBRyxFQUFBO0lBQUFILENBQUEsTUFBQUksRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUosQ0FBQTtFQUFBO0VBQUEsT0FMTkksRUFLTTtBQUFBIiwiaWdub3JlTGlzdCI6W119