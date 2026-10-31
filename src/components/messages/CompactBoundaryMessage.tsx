import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { Box, Text } from '../../ink.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
export function CompactBoundaryMessage() {
  const $ = _c(2);
  const historyShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  let t0;
  if ($[0] !== historyShortcut) {
    t0 = <Box marginY={1}><Text dimColor={true}>✻ Conversation compacted ({historyShortcut} for history)</Text></Box>;
    $[0] = historyShortcut;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  return t0;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIkJveCIsIlRleHQiLCJ1c2VTaG9ydGN1dERpc3BsYXkiLCJDb21wYWN0Qm91bmRhcnlNZXNzYWdlIiwiJCIsIl9jIiwiaGlzdG9yeVNob3J0Y3V0IiwidDAiXSwic291cmNlcyI6WyJDb21wYWN0Qm91bmRhcnlNZXNzYWdlLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IHVzZVNob3J0Y3V0RGlzcGxheSB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZVNob3J0Y3V0RGlzcGxheS5qcydcblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBhY3RCb3VuZGFyeU1lc3NhZ2UoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgaGlzdG9yeVNob3J0Y3V0ID0gdXNlU2hvcnRjdXREaXNwbGF5KFxuICAgICdhcHA6dG9nZ2xlVHJhbnNjcmlwdCcsXG4gICAgJ0dsb2JhbCcsXG4gICAgJ2N0cmwrbycsXG4gIClcblxuICByZXR1cm4gKFxuICAgIDxCb3ggbWFyZ2luWT17MX0+XG4gICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAg4py7IENvbnZlcnNhdGlvbiBjb21wYWN0ZWQgKHtoaXN0b3J5U2hvcnRjdXR9IGZvciBoaXN0b3J5KVxuICAgICAgPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPLEtBQUtBLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLEdBQUcsRUFBRUMsSUFBSSxRQUFRLGNBQWM7QUFDeEMsU0FBU0Msa0JBQWtCLFFBQVEseUNBQXlDO0FBRTVFLE9BQU8sU0FBQUMsdUJBQUE7RUFBQSxNQUFBQyxDQUFBLEdBQUFDLEVBQUE7RUFDTCxNQUFBQyxlQUFBLEdBQXdCSixrQkFBa0IsQ0FDeEMsc0JBQXNCLEVBQ3RCLFFBQVEsRUFDUixRQUNGLENBQUM7RUFBQSxJQUFBSyxFQUFBO0VBQUEsSUFBQUgsQ0FBQSxRQUFBRSxlQUFBO0lBR0NDLEVBQUEsSUFBQyxHQUFHLENBQVUsT0FBQyxDQUFELEdBQUMsQ0FDYixDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQUMsMEJBQ2NELGdCQUFjLENBQUUsYUFDN0MsRUFGQyxJQUFJLENBR1AsRUFKQyxHQUFHLENBSUU7SUFBQUYsQ0FBQSxNQUFBRSxlQUFBO0lBQUFGLENBQUEsTUFBQUcsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUgsQ0FBQTtFQUFBO0VBQUEsT0FKTkcsRUFJTTtBQUFBIiwiaWdub3JlTGlzdCI6W119