import { c as _c } from "react/compiler-runtime";
/**
 * Component that registers keybinding handlers for command bindings.
 *
 * Must be rendered inside KeybindingSetup to have access to the keybinding context.
 * Reads "command:*" actions from the current keybinding configuration and registers
 * handlers that invoke the corresponding slash command via onSubmit.
 *
 * Commands triggered via keybinding are treated as "immediate" - they execute right
 * away and preserve the user's existing input text (the prompt is not cleared).
 */
import { useMemo } from 'react';
import { useIsModalOverlayActive } from '../context/overlayContext.js';
import { useOptionalKeybindingContext } from '../keybindings/KeybindingContext.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import type { PromptInputHelpers } from '../utils/handlePromptSubmit.js';
type Props = {
  // onSubmit accepts additional parameters beyond what we pass here,
  // so we use a rest parameter to allow any additional args
  onSubmit: (input: string, helpers: PromptInputHelpers, ...rest: [speculationAccept?: undefined, options?: {
    fromKeybinding?: boolean;
  }]) => void;
  /** Set to false to disable command keybindings (e.g., when a dialog is open) */
  isActive?: boolean;
};
const NOOP_HELPERS: PromptInputHelpers = {
  setCursorOffset: () => {},
  clearBuffer: () => {},
  resetHistory: () => {}
};

/**
 * Registers keybinding handlers for all "command:*" actions found in the
 * user's keybinding configuration. When triggered, each handler submits
 * the corresponding slash command (e.g., "command:commit" submits "/commit").
 */
export function CommandKeybindingHandlers(t0) {
  const $ = _c(8);
  const {
    onSubmit,
    isActive: t1
  } = t0;
  const isActive = t1 === undefined ? true : t1;
  const keybindingContext = useOptionalKeybindingContext();
  const isModalOverlayActive = useIsModalOverlayActive();
  let t2;
  bb0: {
    if (!keybindingContext) {
      let t3;
      if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
        t3 = new Set();
        $[0] = t3;
      } else {
        t3 = $[0];
      }
      t2 = t3;
      break bb0;
    }
    let actions;
    if ($[1] !== keybindingContext.bindings) {
      actions = new Set();
      for (const binding of keybindingContext.bindings) {
        if (binding.action?.startsWith("command:")) {
          actions.add(binding.action);
        }
      }
      $[1] = keybindingContext.bindings;
      $[2] = actions;
    } else {
      actions = $[2];
    }
    t2 = actions;
  }
  const commandActions = t2;
  let map;
  if ($[3] !== commandActions || $[4] !== onSubmit) {
    map = {};
    for (const action of commandActions) {
      const commandName = action.slice(8);
      map[action] = () => {
        onSubmit(`/${commandName}`, NOOP_HELPERS, undefined, {
          fromKeybinding: true
        });
      };
    }
    $[3] = commandActions;
    $[4] = onSubmit;
    $[5] = map;
  } else {
    map = $[5];
  }
  const handlers = map;
  const t3 = isActive && !isModalOverlayActive;
  let t4;
  if ($[6] !== t3) {
    t4 = {
      context: "Chat",
      isActive: t3
    };
    $[6] = t3;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  useKeybindings(handlers, t4);
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ1c2VNZW1vIiwidXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUiLCJ1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0IiwidXNlS2V5YmluZGluZ3MiLCJQcm9tcHRJbnB1dEhlbHBlcnMiLCJQcm9wcyIsIm9uU3VibWl0IiwiaW5wdXQiLCJoZWxwZXJzIiwicmVzdCIsInNwZWN1bGF0aW9uQWNjZXB0Iiwib3B0aW9ucyIsImZyb21LZXliaW5kaW5nIiwiaXNBY3RpdmUiLCJOT09QX0hFTFBFUlMiLCJzZXRDdXJzb3JPZmZzZXQiLCJjbGVhckJ1ZmZlciIsInJlc2V0SGlzdG9yeSIsIkNvbW1hbmRLZXliaW5kaW5nSGFuZGxlcnMiLCJ0MCIsIiQiLCJfYyIsInQxIiwidW5kZWZpbmVkIiwia2V5YmluZGluZ0NvbnRleHQiLCJpc01vZGFsT3ZlcmxheUFjdGl2ZSIsInQyIiwiYmIwIiwidDMiLCJTeW1ib2wiLCJmb3IiLCJTZXQiLCJhY3Rpb25zIiwiYmluZGluZ3MiLCJiaW5kaW5nIiwiYWN0aW9uIiwic3RhcnRzV2l0aCIsImFkZCIsImNvbW1hbmRBY3Rpb25zIiwibWFwIiwiY29tbWFuZE5hbWUiLCJzbGljZSIsImhhbmRsZXJzIiwidDQiLCJjb250ZXh0Il0sInNvdXJjZXMiOlsidXNlQ29tbWFuZEtleWJpbmRpbmdzLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbXBvbmVudCB0aGF0IHJlZ2lzdGVycyBrZXliaW5kaW5nIGhhbmRsZXJzIGZvciBjb21tYW5kIGJpbmRpbmdzLlxuICpcbiAqIE11c3QgYmUgcmVuZGVyZWQgaW5zaWRlIEtleWJpbmRpbmdTZXR1cCB0byBoYXZlIGFjY2VzcyB0byB0aGUga2V5YmluZGluZyBjb250ZXh0LlxuICogUmVhZHMgXCJjb21tYW5kOipcIiBhY3Rpb25zIGZyb20gdGhlIGN1cnJlbnQga2V5YmluZGluZyBjb25maWd1cmF0aW9uIGFuZCByZWdpc3RlcnNcbiAqIGhhbmRsZXJzIHRoYXQgaW52b2tlIHRoZSBjb3JyZXNwb25kaW5nIHNsYXNoIGNvbW1hbmQgdmlhIG9uU3VibWl0LlxuICpcbiAqIENvbW1hbmRzIHRyaWdnZXJlZCB2aWEga2V5YmluZGluZyBhcmUgdHJlYXRlZCBhcyBcImltbWVkaWF0ZVwiIC0gdGhleSBleGVjdXRlIHJpZ2h0XG4gKiBhd2F5IGFuZCBwcmVzZXJ2ZSB0aGUgdXNlcidzIGV4aXN0aW5nIGlucHV0IHRleHQgKHRoZSBwcm9tcHQgaXMgbm90IGNsZWFyZWQpLlxuICovXG5pbXBvcnQgeyB1c2VNZW1vIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VJc01vZGFsT3ZlcmxheUFjdGl2ZSB9IGZyb20gJy4uL2NvbnRleHQvb3ZlcmxheUNvbnRleHQuanMnXG5pbXBvcnQgeyB1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0IH0gZnJvbSAnLi4va2V5YmluZGluZ3MvS2V5YmluZGluZ0NvbnRleHQuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5ncyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgdHlwZSB7IFByb21wdElucHV0SGVscGVycyB9IGZyb20gJy4uL3V0aWxzL2hhbmRsZVByb21wdFN1Ym1pdC5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgLy8gb25TdWJtaXQgYWNjZXB0cyBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgYmV5b25kIHdoYXQgd2UgcGFzcyBoZXJlLFxuICAvLyBzbyB3ZSB1c2UgYSByZXN0IHBhcmFtZXRlciB0byBhbGxvdyBhbnkgYWRkaXRpb25hbCBhcmdzXG4gIG9uU3VibWl0OiAoXG4gICAgaW5wdXQ6IHN0cmluZyxcbiAgICBoZWxwZXJzOiBQcm9tcHRJbnB1dEhlbHBlcnMsXG4gICAgLi4ucmVzdDogW1xuICAgICAgc3BlY3VsYXRpb25BY2NlcHQ/OiB1bmRlZmluZWQsXG4gICAgICBvcHRpb25zPzogeyBmcm9tS2V5YmluZGluZz86IGJvb2xlYW4gfSxcbiAgICBdXG4gICkgPT4gdm9pZFxuICAvKiogU2V0IHRvIGZhbHNlIHRvIGRpc2FibGUgY29tbWFuZCBrZXliaW5kaW5ncyAoZS5nLiwgd2hlbiBhIGRpYWxvZyBpcyBvcGVuKSAqL1xuICBpc0FjdGl2ZT86IGJvb2xlYW5cbn1cblxuY29uc3QgTk9PUF9IRUxQRVJTOiBQcm9tcHRJbnB1dEhlbHBlcnMgPSB7XG4gIHNldEN1cnNvck9mZnNldDogKCkgPT4ge30sXG4gIGNsZWFyQnVmZmVyOiAoKSA9PiB7fSxcbiAgcmVzZXRIaXN0b3J5OiAoKSA9PiB7fSxcbn1cblxuLyoqXG4gKiBSZWdpc3RlcnMga2V5YmluZGluZyBoYW5kbGVycyBmb3IgYWxsIFwiY29tbWFuZDoqXCIgYWN0aW9ucyBmb3VuZCBpbiB0aGVcbiAqIHVzZXIncyBrZXliaW5kaW5nIGNvbmZpZ3VyYXRpb24uIFdoZW4gdHJpZ2dlcmVkLCBlYWNoIGhhbmRsZXIgc3VibWl0c1xuICogdGhlIGNvcnJlc3BvbmRpbmcgc2xhc2ggY29tbWFuZCAoZS5nLiwgXCJjb21tYW5kOmNvbW1pdFwiIHN1Ym1pdHMgXCIvY29tbWl0XCIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gQ29tbWFuZEtleWJpbmRpbmdIYW5kbGVycyh7XG4gIG9uU3VibWl0LFxuICBpc0FjdGl2ZSA9IHRydWUsXG59OiBQcm9wcyk6IG51bGwge1xuICBjb25zdCBrZXliaW5kaW5nQ29udGV4dCA9IHVzZU9wdGlvbmFsS2V5YmluZGluZ0NvbnRleHQoKVxuICBjb25zdCBpc01vZGFsT3ZlcmxheUFjdGl2ZSA9IHVzZUlzTW9kYWxPdmVybGF5QWN0aXZlKClcblxuICAvLyBFeHRyYWN0IGNvbW1hbmQgYWN0aW9ucyBmcm9tIHBhcnNlZCBiaW5kaW5nc1xuICBjb25zdCBjb21tYW5kQWN0aW9ucyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICgha2V5YmluZGluZ0NvbnRleHQpIHJldHVybiBuZXcgU2V0PHN0cmluZz4oKVxuICAgIGNvbnN0IGFjdGlvbnMgPSBuZXcgU2V0PHN0cmluZz4oKVxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBrZXliaW5kaW5nQ29udGV4dC5iaW5kaW5ncykge1xuICAgICAgaWYgKGJpbmRpbmcuYWN0aW9uPy5zdGFydHNXaXRoKCdjb21tYW5kOicpKSB7XG4gICAgICAgIGFjdGlvbnMuYWRkKGJpbmRpbmcuYWN0aW9uKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWN0aW9uc1xuICB9LCBba2V5YmluZGluZ0NvbnRleHRdKVxuXG4gIC8vIEJ1aWxkIGhhbmRsZXIgbWFwIGZvciBhbGwgY29tbWFuZCBhY3Rpb25zXG4gIGNvbnN0IGhhbmRsZXJzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCAoKSA9PiB2b2lkPiA9IHt9XG4gICAgZm9yIChjb25zdCBhY3Rpb24gb2YgY29tbWFuZEFjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGNvbW1hbmROYW1lID0gYWN0aW9uLnNsaWNlKCdjb21tYW5kOicubGVuZ3RoKVxuICAgICAgbWFwW2FjdGlvbl0gPSAoKSA9PiB7XG4gICAgICAgIG9uU3VibWl0KGAvJHtjb21tYW5kTmFtZX1gLCBOT09QX0hFTFBFUlMsIHVuZGVmaW5lZCwge1xuICAgICAgICAgIGZyb21LZXliaW5kaW5nOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWFwXG4gIH0sIFtjb21tYW5kQWN0aW9ucywgb25TdWJtaXRdKVxuXG4gIHVzZUtleWJpbmRpbmdzKGhhbmRsZXJzLCB7XG4gICAgY29udGV4dDogJ0NoYXQnLFxuICAgIGlzQWN0aXZlOiBpc0FjdGl2ZSAmJiAhaXNNb2RhbE92ZXJsYXlBY3RpdmUsXG4gIH0pXG5cbiAgcmV0dXJuIG51bGxcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0EsT0FBTyxRQUFRLE9BQU87QUFDL0IsU0FBU0MsdUJBQXVCLFFBQVEsOEJBQThCO0FBQ3RFLFNBQVND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