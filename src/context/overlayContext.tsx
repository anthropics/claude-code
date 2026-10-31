import { c as _c } from "react/compiler-runtime";
/**
 * Overlay tracking for Escape key coordination.
 *
 * This solves the problem of escape key handling when overlays (like Select with onCancel)
 * are open. The CancelRequestHandler needs to know when an overlay is active so it doesn't
 * cancel requests when the user just wants to dismiss the overlay.
 *
 * Usage:
 * 1. Call useRegisterOverlay() in any overlay component to automatically register it
 * 2. Call useIsOverlayActive() to check if any overlay is currently active
 *
 * The hook automatically registers on mount and unregisters on unmount,
 * so no manual cleanup or state management is needed.
 */
import { useContext, useEffect, useLayoutEffect } from 'react';
import instances from '../ink/instances.js';
import { AppStoreContext, useAppState } from '../state/AppState.js';

// Non-modal overlays that shouldn't disable TextInput focus
const NON_MODAL_OVERLAYS = new Set(['autocomplete']);

/**
 * Hook to register a component as an active overlay.
 * Automatically registers on mount and unregisters on unmount.
 *
 * @param id - Unique identifier for this overlay (e.g., 'select', 'multi-select')
 * @param enabled - Whether to register (default: true). Use this to conditionally register
 *                  based on component props, e.g., only register when onCancel is provided.
 *
 * @example
 * // Conditional registration based on whether cancel is supported
 * function useSelectInput({ state }) {
 *   useRegisterOverlay('select', !!state.onCancel)
 *   // ...
 * }
 */
export function useRegisterOverlay(id, t0) {
  const $ = _c(8);
  const enabled = t0 === undefined ? true : t0;
  const store = useContext(AppStoreContext);
  const setAppState = store?.setState;
  let t1;
  let t2;
  if ($[0] !== enabled || $[1] !== id || $[2] !== setAppState) {
    t1 = () => {
      if (!enabled || !setAppState) {
        return;
      }
      setAppState(prev => {
        if (prev.activeOverlays.has(id)) {
          return prev;
        }
        const next = new Set(prev.activeOverlays);
        next.add(id);
        return {
          ...prev,
          activeOverlays: next
        };
      });
      return () => {
        setAppState(prev_0 => {
          if (!prev_0.activeOverlays.has(id)) {
            return prev_0;
          }
          const next_0 = new Set(prev_0.activeOverlays);
          next_0.delete(id);
          return {
            ...prev_0,
            activeOverlays: next_0
          };
        });
      };
    };
    t2 = [id, enabled, setAppState];
    $[0] = enabled;
    $[1] = id;
    $[2] = setAppState;
    $[3] = t1;
    $[4] = t2;
  } else {
    t1 = $[3];
    t2 = $[4];
  }
  useEffect(t1, t2);
  let t3;
  let t4;
  if ($[5] !== enabled) {
    t3 = () => {
      if (!enabled) {
        return;
      }
      return _temp;
    };
    t4 = [enabled];
    $[5] = enabled;
    $[6] = t3;
    $[7] = t4;
  } else {
    t3 = $[6];
    t4 = $[7];
  }
  useLayoutEffect(t3, t4);
}

/**
 * Hook to check if any overlay is currently active.
 * This is reactive - the component will re-render when the overlay state changes.
 *
 * @returns true if any overlay is currently active
 *
 * @example
 * function CancelRequestHandler() {
 *   const isOverlayActive = useIsOverlayActive()
 *   const isActive = !isOverlayActive && canCancelRunningTask
 *   useKeybinding('chat:cancel', handleCancel, { isActive })
 * }
 */
function _temp() {
  return instances.get(process.stdout)?.invalidatePrevFrame();
}
export function useIsOverlayActive() {
  return useAppState(_temp2);
}

/**
 * Hook to check if any modal overlay is currently active.
 * Modal overlays are overlays that should capture all input (like Select dialogs).
 * Non-modal overlays (like autocomplete) don't disable TextInput focus.
 *
 * @returns true if any modal overlay is currently active
 *
 * @example
 * // Use for TextInput focus - allows typing during autocomplete
 * focus: !isSearchingHistory && !isModalOverlayActive
 */
function _temp2(s) {
  return s.activeOverlays.size > 0;
}
export function useIsModalOverlayActive() {
  return useAppState(_temp3);
}
function _temp3(s) {
  for (const id of s.activeOverlays) {
    if (!NON_MODAL_OVERLAYS.has(id)) {
      return true;
    }
  }
  return false;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ1c2VDb250ZXh0IiwidXNlRWZmZWN0IiwidXNlTGF5b3V0RWZmZWN0IiwiaW5zdGFuY2VzIiwiQXBwU3RvcmVDb250ZXh0IiwidXNlQXBwU3RhdGUiLCJOT05fTU9EQUxfT1ZFUkxBWVMiLCJTZXQiLCJ1c2VSZWdpc3Rlck92ZXJsYXkiLCJpZCIsInQwIiwiJCIsIl9jIiwiZW5hYmxlZCIsInVuZGVmaW5lZCIsInN0b3JlIiwic2V0QXBwU3RhdGUiLCJzZXRTdGF0ZSIsInQxIiwidDIiLCJwcmV2IiwiYWN0aXZlT3ZlcmxheXMiLCJoYXMiLCJuZXh0IiwiYWRkIiwicHJldl8wIiwibmV4dF8wIiwiZGVsZXRlIiwidDMiLCJ0NCIsIl90ZW1wIiwiZ2V0IiwicHJvY2VzcyIsInN0ZG91dCIsImludmFsaWRhdGVQcmV2RnJhbWUiLCJ1c2VJc092ZXJsYXlBY3RpdmUiLCJfdGVtcDIiLCJzIiwic2l6ZSIsInVzZUlzTW9kYWxPdmVybGF5QWN0aXZlIiwiX3RlbXAzIl0sInNvdXJjZXMiOlsib3ZlcmxheUNvbnRleHQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3ZlcmxheSB0cmFja2luZyBmb3IgRXNjYXBlIGtleSBjb29yZGluYXRpb24uXG4gKlxuICogVGhpcyBzb2x2ZXMgdGhlIHByb2JsZW0gb2YgZXNjYXBlIGtleSBoYW5kbGluZyB3aGVuIG92ZXJsYXlzIChsaWtlIFNlbGVjdCB3aXRoIG9uQ2FuY2VsKVxuICogYXJlIG9wZW4uIFRoZSBDYW5jZWxSZXF1ZXN0SGFuZGxlciBuZWVkcyB0byBrbm93IHdoZW4gYW4gb3ZlcmxheSBpcyBhY3RpdmUgc28gaXQgZG9lc24ndFxuICogY2FuY2VsIHJlcXVlc3RzIHdoZW4gdGhlIHVzZXIganVzdCB3YW50cyB0byBkaXNtaXNzIHRoZSBvdmVybGF5LlxuICpcbiAqIFVzYWdlOlxuICogMS4gQ2FsbCB1c2VSZWdpc3Rlck92ZXJsYXkoKSBpbiBhbnkgb3ZlcmxheSBjb21wb25lbnQgdG8gYXV0b21hdGljYWxseSByZWdpc3RlciBpdFxuICogMi4gQ2FsbCB1c2VJc092ZXJsYXlBY3RpdmUoKSB0byBjaGVjayBpZiBhbnkgb3ZlcmxheSBpcyBjdXJyZW50bHkgYWN0aXZlXG4gKlxuICogVGhlIGhvb2sgYXV0b21hdGljYWxseSByZWdpc3RlcnMgb24gbW91bnQgYW5kIHVucmVnaXN0ZXJzIG9uIHVubW91bnQsXG4gKiBzbyBubyBtYW51YWwgY2xlYW51cCBvciBzdGF0ZSBtYW5hZ2VtZW50IGlzIG5lZWRlZC5cbiAqL1xuaW1wb3J0IHsgdXNlQ29udGV4dCwgdXNlRWZmZWN0LCB1c2VMYXlvdXRFZmZlY3QgfSBmcm9tICdyZWFjdCdcbmltcG9ydCBpbnN0YW5jZXMgZnJvbSAnLi4vaW5rL2luc3RhbmNlcy5qcydcbmltcG9ydCB7IEFwcFN0b3JlQ29udGV4dCwgdXNlQXBwU3RhdGUgfSBmcm9tICcuLi9zdGF0ZS9BcHBTdGF0ZS5qcydcblxuLy8gTm9uLW1vZGFsIG92ZXJsYXlzIHRoYXQgc2hvdWxkbid0IGRpc2FibGUgVGV4dElucHV0IGZvY3VzXG5jb25zdCBOT05fTU9EQUxfT1ZFUkxBWVMgPSBuZXcgU2V0KFsnYXV0b2NvbXBsZXRlJ10pXG5cbi8qKlxuICogSG9vayB0byByZWdpc3RlciBhIGNvbXBvbmVudCBhcyBhbiBhY3RpdmUgb3ZlcmxheS5cbiAqIEF1dG9tYXRpY2FsbHkgcmVnaXN0ZXJzIG9uIG1vdW50IGFuZCB1bnJlZ2lzdGVycyBvbiB1bm1vdW50LlxuICpcbiAqIEBwYXJhbSBpZCAtIFVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGlzIG92ZXJsYXkgKGUuZy4sICdzZWxlY3QnLCAnbXVsdGktc2VsZWN0JylcbiAqIEBwYXJhbSBlbmFibGVkIC0gV2hldGhlciB0byByZWdpc3RlciAoZGVmYXVsdDogdHJ1ZSkuIFVzZSB0aGlzIHRvIGNvbmRpdGlvbmFsbHkgcmVnaXN0ZXJcbiAqICAgICAgICAgICAgICAgICAgYmFzZWQgb24gY29tcG9uZW50IHByb3BzLCBlLmcuLCBvbmx5IHJlZ2lzdGVyIHdoZW4gb25DYW5jZWwgaXMgcHJvdmlkZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENvbmRpdGlvbmFsIHJlZ2lzdHJhdGlvbiBiYXNlZCBvbiB3aGV0aGVyIGNhbmNlbCBpcyBzdXBwb3J0ZWRcbiAqIGZ1bmN0aW9uIHVzZVNlbGVjdElucHV0KHsgc3RhdGUgfSkge1xuICogICB1c2VSZWdpc3Rlck92ZXJsYXkoJ3NlbGVjdCcsICEhc3RhdGUub25DYW5jZWwpXG4gKiAgIC8vIC4uLlxuICogfVxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlUmVnaXN0ZXJPdmVybGF5KGlkOiBzdHJpbmcsIGVuYWJsZWQgPSB0cnVlKTogdm9pZCB7XG4gIC8vIFVzZSBjb250ZXh0IGRpcmVjdGx5IHNvIHRoaXMgaXMgYSBuby1vcCB3aGVuIHJlbmRlcmVkIG91dHNpZGUgQXBwU3RhdGVQcm92aWRlclxuICAvLyAoZS5nLiwgaW4gaXNvbGF0ZWQgY29tcG9uZW50IHRlc3RzIHRoYXQgZG9uJ3QgbmVlZCB0aGUgZnVsbCBhcHAgc3RhdGUgdHJlZSkuXG4gIGNvbnN0IHN0b3JlID0gdXNlQ29udGV4dChBcHBTdG9yZUNvbnRleHQpXG4gIGNvbnN0IHNldEFwcFN0YXRlID0gc3RvcmU/LnNldFN0YXRlXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFlbmFibGVkIHx8ICFzZXRBcHBTdGF0ZSkgcmV0dXJuXG4gICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICBpZiAocHJldi5hY3RpdmVPdmVybGF5cy5oYXMoaWQpKSByZXR1cm4gcHJldlxuICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldi5hY3RpdmVPdmVybGF5cylcbiAgICAgIG5leHQuYWRkKGlkKVxuICAgICAgcmV0dXJuIHsgLi4ucHJldiwgYWN0aXZlT3ZlcmxheXM6IG5leHQgfVxuICAgIH0pXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBpZiAoIXByZXYuYWN0aXZlT3ZlcmxheXMuaGFzKGlkKSkgcmV0dXJuIHByZXZcbiAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldi5hY3RpdmVPdmVybGF5cylcbiAgICAgICAgbmV4dC5kZWxldGUoaWQpXG4gICAgICAgIHJldHVybiB7IC4uLnByZXYsIGFjdGl2ZU92ZXJsYXlzOiBuZXh0IH1cbiAgICAgIH0pXG4gICAgfVxuICB9LCBbaWQsIGVuYWJsZWQsIHNldEFwcFN0YXRlXSlcblxuICAvLyBPbiBvdmVybGF5IGNsb3NlLCBmb3JjZSB0aGUgbmV4dCByZW5kZXIgdG8gZnVsbC1kYW1hZ2UgZGlmZiBpbnN0ZWFkXG4gIC8vIG9mIGJsaXQuIEEgdGFsbCBvdmVybGF5IChlLmcuIEZ1enp5UGlja2VyIHdpdGggYSAyMC1saW5lIHByZXZpZXcpXG4gIC8vIHNocmlua3MgdGhlIEluay1tYW5hZ2VkIHJlZ2lvbiBvbiB1bm1vdW50OyB0aGUgYmxpdCBmYXN0IHBhdGggY2FuXG4gIC8vIGNvcHkgc3RhbGUgY2VsbHMgZnJvbSB0aGUgb3ZlcmxheSdzIHByZXZpb3VzIGZyYW1lIGludG8gcm93cyB0aGVcbiAgLy8gc2hvcnRlciBsYXlvdXQgbm8gbG9uZ2VyIHJlYWNoZXMsIGxlYXZpbmcgYSBnaG9zdCB0aXRsZS9kaXZpZGVyLlxuICAvLyB1c2VMYXlvdXRFZmZlY3Qgc28gY2xlYW51cCBydW5zIHN5bmNocm9ub3VzbHkgYmVmb3JlIHRoZSBtaWNyb3Rhc2stXG4gIC8vIGRlZmVycmVkIG9uUmVuZGVyIChzY2hlZHVsZVJlbmRlciBxdWV1ZXMgYSBtaWNyb3Rhc2sgZnJvbVxuICAvLyByZXNldEFmdGVyQ29tbWl0OyBwYXNzaXZlLWVmZmVjdCBjbGVhbnVwIHdvdWxkIGxhbmQgYWZ0ZXIgaXQpLlxuICB1c2VMYXlvdXRFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZW5hYmxlZCkgcmV0dXJuXG4gICAgcmV0dXJuICgpID0+IGluc3RhbmNlcy5nZXQocHJvY2Vzcy5zdGRvdXQpPy5pbnZhbGlkYXRlUHJldkZyYW1lKClcbiAgfSwgW2VuYWJsZWRdKVxufVxuXG4vKipcbiAqIEhvb2sgdG8gY2hlY2sgaWYgYW55IG92ZXJsYXkgaXMgY3VycmVudGx5IGFjdGl2ZS5cbiAqIFRoaXMgaXMgcmVhY3RpdmUgLSB0aGUgY29tcG9uZW50IHdpbGwgcmUtcmVuZGVyIHdoZW4gdGhlIG92ZXJsYXkgc3RhdGUgY2hhbmdlcy5cbiAqXG4gKiBAcmV0dXJucyB0cnVlIGlmIGFueSBvdmVybGF5IGlzIGN1cnJlbnRseSBhY3RpdmVcbiAqXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gQ2FuY2VsUmVxdWVzdEhhbmRsZXIoKSB7XG4gKiAgIGNvbnN0IGlzT3ZlcmxheUFjdGl2ZSA9IHVzZUlzT3ZlcmxheUFjdGl2ZSgpXG4gKiAgIGNvbnN0IGlzQWN0aXZlID0gIWlzT3ZlcmxheUFjdGl2ZSAmJiBjYW5DYW5jZWxSdW5uaW5nVGFza1xuICogICB1c2VLZXliaW5kaW5nKCdjaGF0OmNhbmNlbCcsIGhhbmRsZUNhbmNlbCwgeyBpc0FjdGl2ZSB9KVxuICogfVxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlSXNPdmVybGF5QWN0aXZlKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gdXNlQXBwU3RhdGUocyA9PiBzLmFjdGl2ZU92ZXJsYXlzLnNpemUgPiAwKVxufVxuXG4vKipcbiAqIEhvb2sgdG8gY2hlY2sgaWYgYW55IG1vZGFsIG92ZXJsYXkgaXMgY3VycmVudGx5IGFjdGl2ZS5cbiAqIE1vZGFsIG92ZXJsYXlzIGFyZSBvdmVybGF5cyB0aGF0IHNob3VsZCBjYXB0dXJlIGFsbCBpbnB1dCAobGlrZSBTZWxlY3QgZGlhbG9ncykuXG4gKiBOb24tbW9kYWwgb3ZlcmxheXMgKGxpa2UgYXV0b2NvbXBsZXRlKSBkb24ndCBkaXNhYmxlIFRleHRJbnB1dCBmb2N1cy5cbiAqXG4gKiBAcmV0dXJucyB0cnVlIGlmIGFueSBtb2RhbCBvdmVybGF5IGlzIGN1cnJlbnRseSBhY3RpdmVcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gVXNlIGZvciBUZXh0SW5wdXQgZm9jdXMgLSBhbGxvd3MgdHlwaW5nIGR1cmluZyBhdXRvY29tcGxldGVcbiAqIGZvY3VzOiAhaXNTZWFyY2hpbmdIaXN0b3J5ICYmICFpc01vZGFsT3ZlcmxheUFjdGl2ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUoKTogYm9vbGVhbiB7XG4gIHJldHVybiB1c2VBcHBTdGF0ZShzID0+IHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHMuYWN0aXZlT3ZlcmxheXMpIHtcbiAgICAgIGlmICghTk9OX01PREFMX09WRVJMQVlTLmhhcyhpZCkpIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9KVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxlQUFlLFFBQVEsT0FBTztBQUM5RCxPQUFPQyxTQUFTLE1BQU0scUJBQXFCO0FBQzNDLFNBQVNDLGVBQWUsRUFBRUMsV0FBVyxRQUFRLHNCQUFzQjs7QUFFbkU7QUFDQSxNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxHQUFHLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQzs7QUFFcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTyxTQUFBQyxtQkFBQUMsRUFBQSxFQUFBQyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQXdDLE1BQUFDLE9BQUEsR0FBQUgsRUFBYyxLQUFkSSxTQUFjLEdBQWQsSUFBYyxHQUFkSixFQUFjO0VBRzNELE1BQUFLLEtBQUEsR0FBY2YsVUFBVSxDQUFDSSxlQUFlLENBQUM7RUFDekMsTUFBQVksV0FBQSxHQUFvQkQsS0FBSyxFQUFBRSxRQUFVO0VBQUEsSUFBQUMsRUFBQTtFQUFBLElB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