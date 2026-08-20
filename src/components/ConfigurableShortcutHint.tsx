import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import type { KeybindingAction, KeybindingContextName } from '../keybindings/types.js';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
type Props = {
  /** The keybinding action (e.g., 'app:toggleTranscript') */
  action: KeybindingAction;
  /** The keybinding context (e.g., 'Global') */
  context: KeybindingContextName;
  /** Default shortcut if keybinding not configured */
  fallback: string;
  /** The action description text (e.g., 'expand') */
  description: string;
  /** Whether to wrap in parentheses */
  parens?: boolean;
  /** Whether to show in bold */
  bold?: boolean;
};

/**
 * KeyboardShortcutHint that displays the user-configured shortcut.
 * Falls back to default if keybinding context is not available.
 *
 * @example
 * <ConfigurableShortcutHint
 *   action="app:toggleTranscript"
 *   context="Global"
 *   fallback="ctrl+o"
 *   description="expand"
 * />
 */
export function ConfigurableShortcutHint(t0) {
  const $ = _c(5);
  const {
    action,
    context,
    fallback,
    description,
    parens,
    bold
  } = t0;
  const shortcut = useShortcutDisplay(action, context, fallback);
  let t1;
  if ($[0] !== bold || $[1] !== description || $[2] !== parens || $[3] !== shortcut) {
    t1 = <KeyboardShortcutHint shortcut={shortcut} action={description} parens={parens} bold={bold} />;
    $[0] = bold;
    $[1] = description;
    $[2] = parens;
    $[3] = shortcut;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  return t1;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIktleWJpbmRpbmdBY3Rpb24iLCJLZXliaW5kaW5nQ29udGV4dE5hbWUiLCJ1c2VTaG9ydGN1dERpc3BsYXkiLCJLZXlib2FyZFNob3J0Y3V0SGludCIsIlByb3BzIiwiYWN0aW9uIiwiY29udGV4dCIsImZhbGxiYWNrIiwiZGVzY3JpcHRpb24iLCJwYXJlbnMiLCJib2xkIiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwidDAiLCIkIiwiX2MiLCJzaG9ydGN1dCIsInQxIl0sInNvdXJjZXMiOlsiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHtcbiAgS2V5YmluZGluZ0FjdGlvbixcbiAgS2V5YmluZGluZ0NvbnRleHROYW1lLFxufSBmcm9tICcuLi9rZXliaW5kaW5ncy90eXBlcy5qcydcbmltcG9ydCB7IHVzZVNob3J0Y3V0RGlzcGxheSB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZVNob3J0Y3V0RGlzcGxheS5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICAvKiogVGhlIGtleWJpbmRpbmcgYWN0aW9uIChlLmcuLCAnYXBwOnRvZ2dsZVRyYW5zY3JpcHQnKSAqL1xuICBhY3Rpb246IEtleWJpbmRpbmdBY3Rpb25cbiAgLyoqIFRoZSBrZXliaW5kaW5nIGNvbnRleHQgKGUuZy4sICdHbG9iYWwnKSAqL1xuICBjb250ZXh0OiBLZXliaW5kaW5nQ29udGV4dE5hbWVcbiAgLyoqIERlZmF1bHQgc2hvcnRjdXQgaWYga2V5YmluZGluZyBub3QgY29uZmlndXJlZCAqL1xuICBmYWxsYmFjazogc3RyaW5nXG4gIC8qKiBUaGUgYWN0aW9uIGRlc2NyaXB0aW9uIHRleHQgKGUuZy4sICdleHBhbmQnKSAqL1xuICBkZXNjcmlwdGlvbjogc3RyaW5nXG4gIC8qKiBXaGV0aGVyIHRvIHdyYXAgaW4gcGFyZW50aGVzZXMgKi9cbiAgcGFyZW5zPzogYm9vbGVhblxuICAvKiogV2hldGhlciB0byBzaG93IGluIGJvbGQgKi9cbiAgYm9sZD86IGJvb2xlYW5cbn1cblxuLyoqXG4gKiBLZXlib2FyZFNob3J0Y3V0SGludCB0aGF0IGRpc3BsYXlzIHRoZSB1c2VyLWNvbmZpZ3VyZWQgc2hvcnRjdXQuXG4gKiBGYWxscyBiYWNrIHRvIGRlZmF1bHQgaWYga2V5YmluZGluZyBjb250ZXh0IGlzIG5vdCBhdmFpbGFibGUuXG4gKlxuICogQGV4YW1wbGVcbiAqIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAqICAgYWN0aW9uPVwiYXBwOnRvZ2dsZVRyYW5zY3JpcHRcIlxuICogICBjb250ZXh0PVwiR2xvYmFsXCJcbiAqICAgZmFsbGJhY2s9XCJjdHJsK29cIlxuICogICBkZXNjcmlwdGlvbj1cImV4cGFuZFwiXG4gKiAvPlxuICovXG5leHBvcnQgZnVuY3Rpb24gQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50KHtcbiAgYWN0aW9uLFxuICBjb250ZXh0LFxuICBmYWxsYmFjayxcbiAgZGVzY3JpcHRpb24sXG4gIHBhcmVucyxcbiAgYm9sZCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3Qgc2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoYWN0aW9uLCBjb250ZXh0LCBmYWxsYmFjaylcbiAgcmV0dXJuIChcbiAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnRcbiAgICAgIHNob3J0Y3V0PXtzaG9ydGN1dH1cbiAgICAgIGFjdGlvbj17ZGVzY3JpcHRpb259XG4gICAgICBwYXJlbnM9e3BhcmVuc31cbiAgICAgIGJvbGQ9e2JvbGR9XG4gICAgLz5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxLQUFLQSxLQUFLLE1BQU0sT0FBTztBQUM5QixjQUNFQyxnQkFBZ0IsRUFDaEJDLHFCQUFxQixRQUNoQix5QkFBeUI7QUFDaEMsU0FBU0Msa0JBQWtCLFFBQVEsc0NBQXNDO0FBQ3pFLFNBQVNDLG9CQUFvQixRQUFRLHlDQUF5QztBQUU5RSxLQUFLQyxLQUFLLEdBQUc7RUFDWDtFQUNBQyxNQUFNLEVBQUVMLGdCQUFnQjtFQUN4QjtFQUNBTSxPQUFPLEVBQUVMLHFCQUFxQjtFQUM5QjtFQUNBTSxRQUFRLEVBQUUsTUFBTTtFQUNoQjtFQUNBQyxXQUFXLEVBQUUsTUFBTTtFQUNuQjtFQUNBQyxNQUFNLENBQUMsRUFBRSxPQUFPO0VBQ2hCO0VBQ0FDLElBQUksQ0FBQyxFQUFFLE9BQU87QUFDaEIsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPLFNBQUFDLHlCQUFBQyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQWtDO0lBQUFULE1BQUE7SUFBQUMsT0FBQTtJQUFBQyxRQUFBO0lBQUFDLFdBQUE7SUFBQUMsTUFBQTtJQUFBQztFQUFBLElBQUFFLEVBT2pDO0VBQ04sTUFBQUcsUUFBQSxHQUFpQmIsa0JBQWtCLENBQUNHLE1BQU0sRUFBRUMsT0FBTyxFQUFFQyxRQUFRLENBQUM7RUFBQSxJQUFBUyxFQUFBO0VBQUEsSUFBQUgsQ0FBQSxRQUFBSCxJQUFBLElBQUFHLENBQUEsUUFBQUwsV0FBQSxJQUFBSyxDQUFBLFFBQUFKLE1BQUEsSUFBQUksQ0FBQSxRQUFBRSxRQUFBO0lBRTVEQyxFQUFBLElBQUMsb0JBQW9CLENBQ1RELFFBQVEsQ0FBUkEsU0FBTyxDQUFDLENBQ1ZQLE1BQVcsQ0FBWEEsWUFBVSxDQUFDLENBQ1hDLE1BQU0sQ0FBTkEsT0FBSyxDQUFDLENBQ1JDLElBQUksQ0FBSkEsS0FBRyxDQUFDLEdBQ1Y7SUFBQUcsQ0FBQSxNQUFBSCxJQUFBO0lBQUFHLENBQUEsTUFBQUwsV0FBQTtJQUFBSyxDQUFBLE1BQUFKLE1BQUE7SUFBQUksQ0FBQSxNQUFBRSxRQUFBO0lBQUFGLENBQUEsTUFBQUcsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUgsQ0FBQTtFQUFBO0VBQUEsT0FMRkcsRUFLRTtBQUFBIiwiaWdub3JlTGlzdCI6W119