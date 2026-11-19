import { c as _c } from "react/compiler-runtime";
import { useEffect, useRef } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { getModelDeprecationWarning } from 'src/utils/model/deprecation.js';
import { getIsRemoteMode } from '../../bootstrap/state.js';
export function useDeprecationWarningNotification(model) {
  const $ = _c(4);
  const {
    addNotification
  } = useNotifications();
  const lastWarningRef = useRef(null);
  let t0;
  let t1;
  if ($[0] !== addNotification || $[1] !== model) {
    t0 = () => {
      if (getIsRemoteMode()) {
        return;
      }
      const deprecationWarning = getModelDeprecationWarning(model);
      if (deprecationWarning && deprecationWarning !== lastWarningRef.current) {
        lastWarningRef.current = deprecationWarning;
        addNotification({
          key: "model-deprecation-warning",
          text: deprecationWarning,
          color: "warning",
          priority: "high"
        });
      }
      if (!deprecationWarning) {
        lastWarningRef.current = null;
      }
    };
    t1 = [model, addNotification];
    $[0] = addNotification;
    $[1] = model;
    $[2] = t0;
    $[3] = t1;
  } else {
    t0 = $[2];
    t1 = $[3];
  }
  useEffect(t0, t1);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VOb3RpZmljYXRpb25zIiwiZ2V0TW9kZWxEZXByZWNhdGlvbldhcm5pbmciLCJnZXRJc1JlbW90ZU1vZGUiLCJ1c2VEZXByZWNhdGlvbldhcm5pbmdOb3RpZmljYXRpb24iLCJtb2RlbCIsIiQiLCJfYyIsImFkZE5vdGlmaWNhdGlvbiIsImxhc3RXYXJuaW5nUmVmIiwidDAiLCJ0MSIsImRlcHJlY2F0aW9uV2FybmluZyIsImN1cnJlbnQiLCJrZXkiLCJ0ZXh0IiwiY29sb3IiLCJwcmlvcml0eSJdLCJzb3VyY2VzIjpbInVzZURlcHJlY2F0aW9uV2FybmluZ05vdGlmaWNhdGlvbi50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZU5vdGlmaWNhdGlvbnMgfSBmcm9tICdzcmMvY29udGV4dC9ub3RpZmljYXRpb25zLmpzJ1xuaW1wb3J0IHsgZ2V0TW9kZWxEZXByZWNhdGlvbldhcm5pbmcgfSBmcm9tICdzcmMvdXRpbHMvbW9kZWwvZGVwcmVjYXRpb24uanMnXG5pbXBvcnQgeyBnZXRJc1JlbW90ZU1vZGUgfSBmcm9tICcuLi8uLi9ib290c3RyYXAvc3RhdGUuanMnXG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VEZXByZWNhdGlvbldhcm5pbmdOb3RpZmljYXRpb24obW9kZWw6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCB7IGFkZE5vdGlmaWNhdGlvbiB9ID0gdXNlTm90aWZpY2F0aW9ucygpXG4gIGNvbnN0IGxhc3RXYXJuaW5nUmVmID0gdXNlUmVmPHN0cmluZyB8IG51bGw+KG51bGwpXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoZ2V0SXNSZW1vdGVNb2RlKCkpIHJldHVyblxuICAgIGNvbnN0IGRlcHJlY2F0aW9uV2FybmluZyA9IGdldE1vZGVsRGVwcmVjYXRpb25XYXJuaW5nKG1vZGVsKVxuXG4gICAgLy8gU2hvdyB3YXJuaW5nIGlmIG1vZGVsIGlzIGRlcHJlY2F0ZWQgYW5kIHdlIGhhdmVuJ3Qgc2hvd24gdGhpcyBleGFjdCB3YXJuaW5nIHlldFxuICAgIGlmIChkZXByZWNhdGlvbldhcm5pbmcgJiYgZGVwcmVjYXRpb25XYXJuaW5nICE9PSBsYXN0V2FybmluZ1JlZi5jdXJyZW50KSB7XG4gICAgICBsYXN0V2FybmluZ1JlZi5jdXJyZW50ID0gZGVwcmVjYXRpb25XYXJuaW5nXG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICdtb2RlbC1kZXByZWNhdGlvbi13YXJuaW5nJyxcbiAgICAgICAgdGV4dDogZGVwcmVjYXRpb25XYXJuaW5nLFxuICAgICAgICBjb2xvcjogJ3dhcm5pbmcnLFxuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBSZXNldCB0cmFja2luZyBpZiBtb2RlbCBjaGFuZ2VzIHRvIG5vbi1kZXByZWNhdGVkXG4gICAgaWYgKCFkZXByZWNhdGlvbldhcm5pbmcpIHtcbiAgICAgIGxhc3RXYXJuaW5nUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgfVxuICB9LCBbbW9kZWwsIGFkZE5vdGlmaWNhdGlvbl0pXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxTQUFTLEVBQUVDLE1BQU0sUUFBUSxPQUFPO0FBQ3pDLFNBQVNDLGdCQUFnQixRQUFRLDhCQUE4QjtBQUMvRCxTQUFTQywwQkFBMEIsUUFBUSxnQ0FBZ0M7QUFDM0UsU0FBU0MsZUFBZSxRQUFRLDBCQUEwQjtBQUUxRCxPQUFPLFNBQUFDLGtDQUFBQyxLQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQ0w7SUFBQUM7RUFBQSxJQUE0QlAsZ0JBQWdCLENBQUMsQ0FBQztFQUM5QyxNQUFBUSxjQUFBLEdBQXVCVCxNQUFNLENBQWdCLElBQUksQ0FBQztFQUFBLElBQUFVLEVBQUE7RUFBQSxJQUFBQyxFQUFBO0VBQUEsSUFBQUwsQ0FBQSxRQUFBRSxlQUFBLElBQUFGLENBQUEsUUFBQUQsS0FBQTtJQUV4Q0ssRUFBQSxHQUFBQSxDQUFBO01BQ1IsSUFBSVAsZUFBZSxDQUFDLENBQUM7UUFBQTtNQUFBO01BQ3JCLE1BQUFTLGtCQUFBLEdBQTJCViwwQkFBMEIsQ0FBQ0csS0FBSyxDQUFDO01BRzVELElBQUlPLGtCQUFtRSxJQUE3Q0Esa0JBQWtCLEtBQUtILGNBQWMsQ0FBQUksT0FBUTtRQUNyRUosY0FBYyxDQUFBSSxPQUFBLEdBQVdELGtCQUFIO1FBQ3RCSixlQUFlLENBQUM7VUFBQU0sR0FBQSxFQUNULDJCQUEyQjtVQUFBQyxJQUFBLEVBQzFCSCxrQkFBa0I7VUFBQUksS0FBQSxFQUNqQixTQUFTO1VBQUFDLFFBQUEsRUFDTjtRQUNaLENBQUMsQ0FBQztNQUFBO01BSUosSUFBSSxDQUFDTCxrQkFBa0I7UUFDckJILGNBQWMsQ0FBQUksT0FBQSxHQUFXLElBQUg7TUFBQTtJQUN2QixDQUNGO0lBQUVGLEVBQUEsSUFBQ04sS0FBSyxFQUFFRyxlQUFlLENBQUM7SUFBQUYsQ0FBQSxNQUFBRSxlQUFBO0lBQUFGLENBQUEsTUFBQUQsS0FBQTtJQUFBQyxDQUFBLE1BQUFJLEVBQUE7SUFBQUosQ0FBQSxNQUFBSyxFQUFBO0VBQUE7SUFBQUQsRUFBQSxHQUFBSixDQUFBO0lBQUFLLEVBQUEsR0FBQUwsQ0FBQTtFQUFBO0VBbkIzQlAsU0FBUyxDQUFDVyxFQW1CVCxFQUFFQyxFQUF3QixDQUFDO0FBQUEiLCJpZ25vcmVMaXN0IjpbXX0=