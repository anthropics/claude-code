import { c as _c } from "react/compiler-runtime";
import React, { createContext, type RefObject, useContext, useLayoutEffect, useMemo } from 'react';
import type { Key } from '../ink.js';
import { type ChordResolveResult, getBindingDisplayText, resolveKeyWithChordState } from './resolver.js';
import type { KeybindingContextName, ParsedBinding, ParsedKeystroke } from './types.js';

/** Handler registration for action callbacks */
type HandlerRegistration = {
  action: string;
  context: KeybindingContextName;
  handler: () => void;
};
type KeybindingContextValue = {
  /** Resolve a key input to an action name (with chord support) */
  resolve: (input: string, key: Key, activeContexts: KeybindingContextName[]) => ChordResolveResult;

  /** Update the pending chord state */
  setPendingChord: (pending: ParsedKeystroke[] | null) => void;

  /** Get display text for an action (e.g., "ctrl+t") */
  getDisplayText: (action: string, context: KeybindingContextName) => string | undefined;

  /** All parsed bindings (for help display) */
  bindings: ParsedBinding[];

  /** Current pending chord keystrokes (null if not in a chord) */
  pendingChord: ParsedKeystroke[] | null;

  /** Currently active keybinding contexts (for priority resolution) */
  activeContexts: Set<KeybindingContextName>;

  /** Register a context as active (call on mount) */
  registerActiveContext: (context: KeybindingContextName) => void;

  /** Unregister a context (call on unmount) */
  unregisterActiveContext: (context: KeybindingContextName) => void;

  /** Register a handler for an action (used by useKeybinding) */
  registerHandler: (registration: HandlerRegistration) => () => void;

  /** Invoke all handlers for an action (used by ChordInterceptor) */
  invokeAction: (action: string) => boolean;
};
const KeybindingContext = createContext<KeybindingContextValue | null>(null);
type ProviderProps = {
  bindings: ParsedBinding[];
  /** Ref for immediate access to pending chord (avoids React state delay) */
  pendingChordRef: RefObject<ParsedKeystroke[] | null>;
  /** State value for re-renders (UI updates) */
  pendingChord: ParsedKeystroke[] | null;
  setPendingChord: (pending: ParsedKeystroke[] | null) => void;
  activeContexts: Set<KeybindingContextName>;
  registerActiveContext: (context: KeybindingContextName) => void;
  unregisterActiveContext: (context: KeybindingContextName) => void;
  /** Ref to handler registry (used by ChordInterceptor) */
  handlerRegistryRef: RefObject<Map<string, Set<HandlerRegistration>>>;
  children: React.ReactNode;
};
export function KeybindingProvider(t0) {
  const $ = _c(24);
  const {
    bindings,
    pendingChordRef,
    pendingChord,
    setPendingChord,
    activeContexts,
    registerActiveContext,
    unregisterActiveContext,
    handlerRegistryRef,
    children
  } = t0;
  let t1;
  if ($[0] !== bindings) {
    t1 = (action, context) => getBindingDisplayText(action, context, bindings);
    $[0] = bindings;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const getDisplay = t1;
  let t2;
  if ($[2] !== handlerRegistryRef) {
    t2 = registration => {
      const registry = handlerRegistryRef.current;
      if (!registry) {
        return _temp;
      }
      if (!registry.has(registration.action)) {
        registry.set(registration.action, new Set());
      }
      registry.get(registration.action).add(registration);
      return () => {
        const handlers = registry.get(registration.action);
        if (handlers) {
          handlers.delete(registration);
          if (handlers.size === 0) {
            registry.delete(registration.action);
          }
        }
      };
    };
    $[2] = handlerRegistryRef;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const registerHandler = t2;
  let t3;
  if ($[4] !== activeContexts || $[5] !== handlerRegistryRef) {
    t3 = action_0 => {
      const registry_0 = handlerRegistryRef.current;
      if (!registry_0) {
        return false;
      }
      const handlers_0 = registry_0.get(action_0);
      if (!handlers_0 || handlers_0.size === 0) {
        return false;
      }
      for (const registration_0 of handlers_0) {
        if (activeContexts.has(registration_0.context)) {
          registration_0.handler();
          return true;
        }
      }
      return false;
    };
    $[4] = activeContexts;
    $[5] = handlerRegistryRef;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const invokeAction = t3;
  let t4;
  if ($[7] !== bindings || $[8] !== pendingChordRef) {
    t4 = (input, key, contexts) => resolveKeyWithChordState(input, key, contexts, bindings, pendingChordRef.current);
    $[7] = bindings;
    $[8] = pendingChordRef;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  let t5;
  if ($[10] !== activeContexts || $[11] !== bindings || $[12] !== getDisplay || $[13] !== invokeAction || $[14] !== pendingChord || $[15] !== registerActiveContext || $[16] !== registerHandler || $[17] !== setPendingChord || $[18] !== t4 || $[19] !== unregisterActiveContext) {
    t5 = {
      resolve: t4,
      setPendingChord,
      getDisplayText: getDisplay,
      bindings,
      pendingChord,
      activeContexts,
      registerActiveContext,
      unregisterActiveContext,
      registerHandler,
      invokeAction
    };
    $[10] = activeContexts;
    $[11] = bindings;
    $[12] = getDisplay;
    $[13] = invokeAction;
    $[14] = pendingChord;
    $[15] = registerActiveContext;
    $[16] = registerHandler;
    $[17] = setPendingChord;
    $[18] = t4;
    $[19] = unregisterActiveContext;
    $[20] = t5;
  } else {
    t5 = $[20];
  }
  const value = t5;
  let t6;
  if ($[21] !== children || $[22] !== value) {
    t6 = <KeybindingContext.Provider value={value}>{children}</KeybindingContext.Provider>;
    $[21] = children;
    $[22] = value;
    $[23] = t6;
  } else {
    t6 = $[23];
  }
  return t6;
}
function _temp() {}
export function useKeybindingContext() {
  const ctx = useContext(KeybindingContext);
  if (!ctx) {
    throw new Error("useKeybindingContext must be used within KeybindingProvider");
  }
  return ctx;
}

/**
 * Optional hook that returns undefined outside of KeybindingProvider.
 * Useful for components that may render before provider is available.
 */
export function useOptionalKeybindingContext() {
  return useContext(KeybindingContext);
}

/**
 * Hook to register a keybinding context as active while the component is mounted.
 *
 * When a context is registered, its keybindings take precedence over Global bindings.
 * This allows context-specific bindings (like ThemePicker's ctrl+t) to override
 * global bindings (like the todo toggle) when the context is active.
 *
 * @example
 * ```tsx
 * function ThemePicker() {
 *   useRegisterKeybindingContext('ThemePicker')
 *   // Now ThemePicker's ctrl+t binding takes precedence over Global
 * }
 * ```
 */
export function useRegisterKeybindingContext(context, t0) {
  const $ = _c(5);
  const isActive = t0 === undefined ? true : t0;
  const keybindingContext = useOptionalKeybindingContext();
  let t1;
  let t2;
  if ($[0] !== context || $[1] !== isActive || $[2] !== keybindingContext) {
    t1 = () => {
      if (!keybindingContext || !isActive) {
        return;
      }
      keybindingContext.registerActiveContext(context);
      return () => {
        keybindingContext.unregisterActiveContext(context);
      };
    };
    t2 = [context, keybindingContext, isActive];
    $[0] = context;
    $[1] = isActive;
    $[2] = keybindingContext;
    $[3] = t1;
    $[4] = t2;
  } else {
    t1 = $[3];
    t2 = $[4];
  }
  useLayoutEffect(t1, t2);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsImNyZWF0ZUNvbnRleHQiLCJSZWZPYmplY3QiLCJ1c2VDb250ZXh0IiwidXNlTGF5b3V0RWZmZWN0IiwidXNlTWVtbyIsIktleSIsIkNob3JkUmVzb2x2ZVJlc3VsdCIsImdldEJpbmRpbmdEaXNwbGF5VGV4dCIsInJlc29sdmVLZXlXaXRoQ2hvcmRTdGF0ZSIsIktleWJpbmRpbmdDb250ZXh0TmFtZSIsIlBhcnNlZEJpbmRpbmciLCJQYXJzZWRLZXlzdHJva2UiLCJIYW5kbGVyUmVnaXN0cmF0aW9uIiwiYWN0aW9uIiwiY29udGV4dCIsImhhbmRsZXIiLCJLZXliaW5kaW5nQ29udGV4dFZhbHVlIiwicmVzb2x2ZSIsImlucHV0Iiwia2V5IiwiYWN0aXZlQ29udGV4dHMiLCJzZXRQZW5kaW5nQ2hvcmQiLCJwZW5kaW5nIiwiZ2V0RGlzcGxheVRleHQiLCJiaW5kaW5ncyIsInBlbmRpbmdDaG9yZCIsIlNldCIsInJlZ2lzdGVyQWN0aXZlQ29udGV4dCIsInVucmVnaXN0ZXJBY3RpdmVDb250ZXh0IiwicmVnaXN0ZXJIYW5kbGVyIiwicmVnaXN0cmF0aW9uIiwiaW52b2tlQWN0aW9uIiwiS2V5YmluZGluZ0NvbnRleHQiLCJQcm92aWRlclByb3BzIiwicGVuZGluZ0Nob3JkUmVmIiwiaGFuZGxlclJlZ2lzdHJ5UmVmIiwiTWFwIiwiY2hpbGRyZW4iLCJSZWFjdE5vZGUiLCJLZXliaW5kaW5nUHJvdmlkZXIiLCJ0MCIsIiQiLCJfYyIsInQxIiwiZ2V0RGlzcGxheSIsInQyIiwicmVnaXN0cnkiLCJjdXJyZW50IiwiX3RlbXAiLCJoYXMiLCJzZXQiLCJnZXQiLCJhZGQiLCJoYW5kbGVycyIsImRlbGV0ZSIsInNpemUiLCJ0MyIsImFjdGlvbl8wIiwicmVnaXN0cnlfMCIsImhhbmRsZXJzXzAiLCJyZWdpc3RyYXRpb25fMCIsInQ0IiwiY29udGV4dHMiLCJ0NSIsInZhbHVlIiwidDYiLCJ1c2VLZXliaW5kaW5nQ29udGV4dCIsImN0eCIsIkVycm9yIiwidXNlT3B0aW9uYWxLZXliaW5kaW5nQ29udGV4dCIsInVzZVJlZ2lzdGVyS2V5YmluZGluZ0NvbnRleHQiLCJpc0FjdGl2ZSIsInVuZGVmaW5lZCIsImtleWJpbmRpbmdDb250ZXh0Il0sInNvdXJjZXMiOlsiS2V5YmluZGluZ0NvbnRleHQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwge1xuICBjcmVhdGVDb250ZXh0LFxuICB0eXBlIFJlZk9iamVjdCxcbiAgdXNlQ29udGV4dCxcbiAgdXNlTGF5b3V0RWZmZWN0LFxuICB1c2VNZW1vLFxufSBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgS2V5IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBDaG9yZFJlc29sdmVSZXN1bHQsXG4gIGdldEJpbmRpbmdEaXNwbGF5VGV4dCxcbiAgcmVzb2x2ZUtleVdpdGhDaG9yZFN0YXRlLFxufSBmcm9tICcuL3Jlc29sdmVyLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBLZXliaW5kaW5nQ29udGV4dE5hbWUsXG4gIFBhcnNlZEJpbmRpbmcsXG4gIFBhcnNlZEtleXN0cm9rZSxcbn0gZnJvbSAnLi90eXBlcy5qcydcblxuLyoqIEhhbmRsZXIgcmVnaXN0cmF0aW9uIGZvciBhY3Rpb24gY2FsbGJhY2tzICovXG50eXBlIEhhbmRsZXJSZWdpc3RyYXRpb24gPSB7XG4gIGFjdGlvbjogc3RyaW5nXG4gIGNvbnRleHQ6IEtleWJpbmRpbmdDb250ZXh0TmFtZVxuICBoYW5kbGVyOiAoKSA9PiB2b2lkXG59XG5cbnR5cGUgS2V5YmluZGluZ0NvbnRleHRWYWx1ZSA9IHtcbiAgLyoqIFJlc29sdmUgYSBrZXkgaW5wdXQgdG8gYW4gYWN0aW9uIG5hbWUgKHdpdGggY2hvcmQgc3VwcG9ydCkgKi9cbiAgcmVzb2x2ZTogKFxuICAgIGlucHV0OiBzdHJpbmcsXG4gICAga2V5OiBLZXksXG4gICAgYWN0aXZlQ29udGV4dHM6IEtleWJpbmRpbmdDb250ZXh0TmFtZVtdLFxuICApID0+IENob3JkUmVzb2x2ZVJlc3VsdFxuXG4gIC8qKiBVcGRhdGUgdGhlIHBlbmRpbmcgY2hvcmQgc3RhdGUgKi9cbiAgc2V0UGVuZGluZ0Nob3JkOiAocGVuZGluZzogUGFyc2VkS2V5c3Ryb2tlW10gfCBudWxsKSA9PiB2b2lkXG5cbiAgLyoqIEdldCBkaXNwbGF5IHRleHQgZm9yIGFuIGFjdGlvbiAoZS5nLiwgXCJjdHJsK3RcIikgKi9cbiAgZ2V0RGlzcGxheVRleHQ6IChcbiAgICBhY3Rpb246IHN0cmluZyxcbiAgICBjb250ZXh0OiBLZXliaW5kaW5nQ29udGV4dE5hbWUsXG4gICkgPT4gc3RyaW5nIHwgdW5kZWZpbmVkXG5cbiAgLyoqIEFsbCBwYXJzZWQgYmluZGluZ3MgKGZvciBoZWxwIGRpc3BsYXkpICovXG4gIGJpbmRpbmdzOiBQYXJzZWRCaW5kaW5nW11cblxuICAvKiogQ3VycmVudCBwZW5kaW5nIGNob3JkIGtleXN0cm9rZXMgKG51bGwgaWYgbm90IGluIGEgY2hvcmQpICovXG4gIHBlbmRpbmdDaG9yZDogUGFyc2VkS2V5c3Ryb2tlW10gfCBudWxsXG5cbiAgLyoqIEN1cnJlbnRseSBhY3RpdmUga2V5YmluZGluZyBjb250ZXh0cyAoZm9yIHByaW9yaXR5IHJlc29sdXRpb24pICovXG4gIGFjdGl2ZUNvbnRleHRzOiBTZXQ8S2V5YmluZGluZ0NvbnRleHROYW1lPlxuXG4gIC8qKiBSZWdpc3RlciBhIGNvbnRleHQgYXMgYWN0aXZlIChjYWxsIG9uIG1vdW50KSAqL1xuICByZWdpc3RlckFjdGl2ZUNvbnRleHQ6IChjb250ZXh0OiBLZXliaW5kaW5nQ29udGV4dE5hbWUpID0+IHZvaWRcblxuICAvKiogVW5yZWdpc3RlciBhIGNvbnRleHQgKGNhbGwgb24gdW5tb3VudCkgKi9cbiAgdW5yZWdpc3RlckFjdGl2ZUNvbnRleHQ6IChjb250ZXh0OiBLZXliaW5kaW5nQ29udGV4dE5hbWUpID0+IHZvaWRcblxuICAvKiogUmVnaXN0ZXIgYSBoYW5kbGVyIGZvciBhbiBhY3Rpb24gKHVzZWQgYnkgdXNlS2V5YmluZGluZykgKi9cbiAgcmVnaXN0ZXJIYW5kbGVyOiAocmVnaXN0cmF0aW9uOiBIYW5kbGVyUmVnaXN0cmF0aW9uKSA9PiAoKSA9PiB2b2lkXG5cbiAgLyoqIEludm9rZSBhbGwgaGFuZGxlcnMgZm9yIGFuIGFjdGlvbiAodXNlZCBieSBDaG9yZEludGVyY2VwdG9yKSAqL1xuICBpbnZva2VBY3Rpb246IChhY3Rpb246IHN0cmluZykgPT4gYm9vbGVhblxufVxuXG5jb25zdCBLZXliaW5kaW5nQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8S2V5YmluZGluZ0NvbnRleHRWYWx1ZSB8IG51bGw+KG51bGwpXG5cbnR5cGUgUHJvdmlkZXJQcm9wcyA9IHtcbiAgYmluZGluZ3M6IFBhcnNlZEJpbmRpbmdbXVxuICAvKiogUmVmIGZvciBpbW1lZGlhdGUgYWNjZXNzIHRvIHBlbmRpbmcgY2hvcmQgKGF2b2lkcyBSZWFjdCBzdGF0ZSBkZWxheSkgKi9cbiAgcGVuZGluZ0Nob3JkUmVmOiBSZWZPYmplY3Q8UGFyc2VkS2V5c3Ryb2tlW10gfCBudWxsPlxuICAvKiogU3RhdGUgdmFsdWUgZm9yIHJlLXJlbmRlcnMgKFVJIHVwZGF0ZXMpICovXG4gIHBlbmRpbmdDaG9yZDogUGFyc2VkS2V5c3Ryb2tlW10gfCBudWxsXG4gIHNldFBlbmRpbmdDaG9yZDogKHBlbmRpbmc6IFBhcnNlZEtleXN0cm9rZVtdIHwgbnVsbCkgPT4gdm9pZFxuICBhY3RpdmVDb250ZXh0czogU2V0PEtleWJpbmRpbmdDb250ZXh0TmFtZT5cbiAgcmVnaXN0ZXJBY3RpdmVDb250ZXh0OiAoY29udGV4dDogS2V5YmluZGluZ0NvbnRleHROYW1lKSA9PiB2b2lkXG4gIHVucmVnaXN0ZXJBY3RpdmVDb250ZXh0OiAoY29udGV4dDogS2V5YmluZGluZ0NvbnRleHROYW1lKSA9PiB2b2lkXG4gIC8qKiBSZWYgdG8gaGFuZGxlciByZWdpc3RyeSAodXNlZCBieSBDaG9yZEludGVyY2VwdG9yKSAqL1xuICBoYW5kbGVyUmVnaXN0cnlSZWY6IFJlZk9iamVjdDxNYXA8c3RyaW5nLCBTZXQ8SGFuZGxlclJlZ2lzdHJhdGlvbj4+PlxuICBjaGlsZHJlbjogUmVhY3QuUmVhY3ROb2RlXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBLZXliaW5kaW5nUHJvdmlkZXIoe1xuICBiaW5kaW5ncyxcbiAgcGVuZGluZ0Nob3JkUmVmLFxuICBwZW5kaW5nQ2hvcmQsXG4gIHNldFBlbmRpbmdDaG9yZCxcbiAgYWN0aXZlQ29udGV4dHMsXG4gIHJlZ2lzdGVyQWN0aXZlQ29udGV4dCxcbiAgdW5yZWdpc3RlckFjdGl2ZUNvbnRleHQsXG4gIGhhbmRsZXJSZWdpc3RyeVJlZixcbiAgY2hpbGRyZW4sXG59OiBQcm92aWRlclByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgdmFsdWUgPSB1c2VNZW1vPEtleWJpbmRpbmdDb250ZXh0VmFsdWU+KCgpID0+IHtcbiAgICBjb25zdCBnZXREaXNwbGF5ID0gKGFjdGlvbjogc3RyaW5nLCBjb250ZXh0OiBLZXliaW5kaW5nQ29udGV4dE5hbWUpID0+XG4gICAgICBnZXRCaW5kaW5nRGlzcGxheVRleHQoYWN0aW9uLCBjb250ZXh0LCBiaW5kaW5ncylcblxuICAgIC8vIFJlZ2lzdGVyIGEgaGFuZGxlciBmb3IgYW4gYWN0aW9uXG4gICAgY29uc3QgcmVnaXN0ZXJIYW5kbGVyID0gKHJlZ2lzdHJhdGlvbjogSGFuZGxlclJlZ2lzdHJhdGlvbikgPT4ge1xuICAgICAgY29uc3QgcmVnaXN0cnkgPSBoYW5kbGVyUmVnaXN0cnlSZWYuY3VycmVudFxuICAgICAgaWYgKCFyZWdpc3RyeSkgcmV0dXJuICgpID0+IHt9XG5cbiAgICAgIGlmICghcmVnaXN0cnkuaGFzKHJlZ2lzdHJhdGlvbi5hY3Rpb24pKSB7XG4gICAgICAgIHJlZ2lzdHJ5LnNldChyZWdpc3RyYXRpb24uYWN0aW9uLCBuZXcgU2V0KCkpXG4gICAgICB9XG4gICAgICByZWdpc3RyeS5nZXQocmVnaXN0cmF0aW9uLmFjdGlvbikhLmFkZChyZWdpc3RyYXRpb24pXG5cbiAgICAgIC8vIFJldHVybiB1bnJlZ2lzdGVyIGZ1bmN0aW9uXG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBjb25zdCBoYW5kbGVycyA9IHJlZ2lzdHJ5LmdldChyZWdpc3RyYXRpb24uYWN0aW9uKVxuICAgICAgICBpZiAoaGFuZGxlcnMpIHtcbiAgICAgICAgICBoYW5kbGVycy5kZWxldGUocmVnaXN0cmF0aW9uKVxuICAgICAgICAgIGlmIChoYW5kbGVycy5zaXplID09PSAwKSB7XG4gICAgICAgICAgICByZWdpc3RyeS5kZWxldGUocmVnaXN0cmF0aW9uLmFjdGlvbilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJbnZva2UgYWxsIGhhbmRsZXJzIGZvciBhbiBhY3Rpb25cbiAgICBjb25zdCBpbnZva2VBY3Rpb24gPSAoYWN0aW9uOiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgICAgIGNvbnN0IHJlZ2lzdHJ5ID0gaGFuZGxlclJlZ2lzdHJ5UmVmLmN1cnJlbnRcbiAgICAgIGlmICghcmVnaXN0cnkpIHJldHVybiBmYWxzZVxuXG4gICAgICBjb25zdCBoYW5kbGVycyA9IHJlZ2lzdHJ5LmdldChhY3Rpb24pXG4gICAgICBpZiAoIWhhbmRsZXJzIHx8IGhhbmRsZXJzLnNpemUgPT09IDApIHJldHVybiBmYWxzZVxuXG4gICAgICAvLyBGaW5kIGhhbmRsZXJzIHdob3NlIGNvbnRleHQgaXMgYWN0aXZlXG4gICAgICBmb3IgKGNvbnN0IHJlZ2lzdHJhdGlvbiBvZiBoYW5kbGVycykge1xuICAgICAgICBpZiAoYWN0aXZlQ29udGV4dHMuaGFzKHJlZ2lzdHJhdGlvbi5jb250ZXh0KSkge1xuICAgICAgICAgIHJlZ2lzdHJhdGlvbi5oYW5kbGVyKClcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgLy8gVXNlIHJlZiBmb3IgaW1tZWRpYXRlIGFjY2VzcyB0byBwZW5kaW5nIGNob3JkLCBhdm9pZGluZyBSZWFjdCBzdGF0ZSBkZWxheVxuICAgICAgLy8gVGhpcyBpcyBjcml0aWNhbCBmb3IgY2hvcmQgc2VxdWVuY2VzIHdoZXJlIHRoZSBzZWNvbmQga2V5IG1pZ2h0IGJlIHByZXNzZWRcbiAgICAgIC8vIGJlZm9yZSBSZWFjdCByZS1yZW5kZXJzIHdpdGggdGhlIHVwZGF0ZWQgcGVuZGluZ0Nob3JkIHN0YXRlXG4gICAgICByZXNvbHZlOiAoaW5wdXQsIGtleSwgY29udGV4dHMpID0+XG4gICAgICAgIHJlc29sdmVLZXlXaXRoQ2hvcmRTdGF0ZShcbiAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgY29udGV4dHMsXG4gICAgICAgICAgYmluZGluZ3MsXG4gICAgICAgICAgcGVuZGluZ0Nob3JkUmVmLmN1cnJlbnQsXG4gICAgICAgICksXG4gICAgICBzZXRQZW5kaW5nQ2hvcmQsXG4gICAgICBnZXREaXNwbGF5VGV4dDogZ2V0RGlzcGxheSxcbiAgICAgIGJpbmRpbmdzLFxuICAgICAgcGVuZGluZ0Nob3JkLFxuICAgICAgYWN0aXZlQ29udGV4dHMsXG4gICAgICByZWdpc3RlckFjdGl2ZUNvbnRleHQsXG4gICAgICB1bnJlZ2lzdGVyQWN0aXZlQ29udGV4dCxcbiAgICAgIHJlZ2lzdGVySGFuZGxlcixcbiAgICAgIGludm9rZUFjdGlvbixcbiAgICB9XG4gIH0sIFtcbiAgICBiaW5kaW5ncyxcbiAgICBwZW5kaW5nQ2hvcmRSZWYsXG4gICAgcGVuZGluZ0Nob3JkLFxuICAgIHNldFBlbmRpbmdDaG9yZCxcbiAgICBhY3RpdmVDb250ZXh0cyxcbiAgICByZWdpc3RlckFjdGl2ZUNvbnRleHQsXG4gICAgdW5yZWdpc3RlckFjdGl2ZUNvbnRleHQsXG4gICAgaGFuZGxlclJlZ2lzdHJ5UmVmLFxuICBdKVxuXG4gIHJldHVybiAoXG4gICAgPEtleWJpbmRpbmdDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+XG4gICAgICB7Y2hpbGRyZW59XG4gICAgPC9LZXliaW5kaW5nQ29udGV4dC5Qcm92aWRlcj5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlS2V5YmluZGluZ0NvbnRleHQoKTogS2V5YmluZGluZ0NvbnRleHRWYWx1ZSB7XG4gIGNvbnN0IGN0eCA9IHVzZUNvbnRleHQoS2V5YmluZGluZ0NvbnRleHQpXG4gIGlmICghY3R4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ3VzZUtleWJpbmRpbmdDb250ZXh0IG11c3QgYmUgdXNlZCB3aXRoaW4gS2V5YmluZGluZ1Byb3ZpZGVyJyxcbiAgICApXG4gIH1cbiAgcmV0dXJuIGN0eFxufVxuXG4vKipcbiAqIE9wdGlvbmFsIGhvb2sgdGhhdCByZXR1cm5zIHVuZGVmaW5lZCBvdXRzaWRlIG9mIEtleWJpbmRpbmdQcm92aWRlci5cbiAqIFVzZWZ1bCBmb3IgY29tcG9uZW50cyB0aGF0IG1heSByZW5kZXIgYmVmb3JlIHByb3ZpZGVyIGlzIGF2YWlsYWJsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZU9wdGlvbmFsS2V5YmluZGluZ0NvbnRleHQoKTogS2V5YmluZGluZ0NvbnRleHRWYWx1ZSB8IG51bGwge1xuICByZXR1cm4gdXNlQ29udGV4dChLZXliaW5kaW5nQ29udGV4dClcbn1cblxuLyoqXG4gKiBIb29rIHRvIHJlZ2lzdGVyIGEga2V5YmluZGluZyBjb250ZXh0IGFzIGFjdGl2ZSB3aGlsZSB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQuXG4gKlxuICogV2hlbiBhIGNvbnRleHQgaXMgcmVnaXN0ZXJlZCwgaXRzIGtleWJpbmRpbmdzIHRha2UgcHJlY2VkZW5jZSBvdmVyIEdsb2JhbCBiaW5kaW5ncy5cbiAqIFRoaXMgYWxsb3dzIGNvbnRleHQtc3BlY2lmaWMgYmluZGluZ3MgKGxpa2UgVGhlbWVQaWNrZXIncyBjdHJsK3QpIHRvIG92ZXJyaWRlXG4gKiBnbG9iYWwgYmluZGluZ3MgKGxpa2UgdGhlIHRvZG8gdG9nZ2xlKSB3aGVuIHRoZSBjb250ZXh0IGlzIGFjdGl2ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHN4XG4gKiBmdW5jdGlvbiBUaGVtZVBpY2tlcigpIHtcbiAqICAgdXNlUmVnaXN0ZXJLZXliaW5kaW5nQ29udGV4dCgnVGhlbWVQaWNrZXInKVxuICogICAvLyBOb3cgVGhlbWVQaWNrZXIncyBjdHJsK3QgYmluZGluZyB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgR2xvYmFsXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZVJlZ2lzdGVyS2V5YmluZGluZ0NvbnRleHQoXG4gIGNvbnRleHQ6IEtleWJpbmRpbmdDb250ZXh0TmFtZSxcbiAgaXNBY3RpdmU6IGJvb2xlYW4gPSB0cnVlLFxuKTogdm9pZCB7XG4gIGNvbnN0IGtleWJpbmRpbmdDb250ZXh0ID0gdXNlT3B0aW9uYWxLZXliaW5kaW5nQ29udGV4dCgpXG5cbiAgdXNlTGF5b3V0RWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWtleWJpbmRpbmdDb250ZXh0IHx8ICFpc0FjdGl2ZSkgcmV0dXJuXG5cbiAgICBrZXliaW5kaW5nQ29udGV4dC5yZWdpc3RlckFjdGl2ZUNvbnRleHQoY29udGV4dClcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAga2V5YmluZGluZ0NvbnRleHQudW5yZWdpc3RlckFjdGl2ZUNvbnRleHQoY29udGV4dClcbiAgICB9XG4gIH0sIFtjb250ZXh0LCBrZXliaW5kaW5nQ29udGV4dCwgaXNBY3RpdmVdKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsS0FBSyxJQUNWQyxhQUFhLEVBQ2IsS0FBS0MsU0FBUyxFQUNkQyxVQUFVLEVBQ1ZDLGVBQWUsRUFDZkMsT0FBTyxRQUNGLE9BQU87QUFDZCxjQUFjQyxHQUFHLFFBQVEsV0FBVztBQUNwQyxTQUNFLEtBQUtDLGtCQUFrQixFQUN2QkMscUJBQXFCLEVBQ3JCQyx3QkFBd0IsUUFDbkIsZUFBZTtBQUN0QixjQUNFQyxxQkFBcUIs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