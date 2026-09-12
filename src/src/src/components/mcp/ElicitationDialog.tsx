import { c as _c } from "react/compiler-runtime";
import type { ElicitRequestFormParams, ElicitRequestURLParams, ElicitResult, PrimitiveSchemaDefinition } from '@modelcontextprotocol/sdk/types.js';
import figures from 'figures';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import { useNotifyAfterTimeout } from '../../hooks/useNotifyAfterTimeout.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw text input for elicitation form
import { Box, Text, useInput } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import type { ElicitationRequestEvent } from '../../services/mcp/elicitationHandler.js';
import { openBrowser } from '../../utils/browser.js';
import { getEnumLabel, getEnumValues, getMultiSelectLabel, getMultiSelectValues, isDateTimeSchema, isEnumSchema, isMultiSelectEnumSchema, validateElicitationInput, validateElicitationInputAsync } from '../../utils/mcp/elicitationValidation.js';
import { plural } from '../../utils/stringUtils.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import TextInput from '../TextInput.js';
type Props = {
  event: ElicitationRequestEvent;
  onResponse: (action: ElicitResult['action'], content?: ElicitResult['content']) => void;
  /** Called when the phase 2 waiting state is dismissed (URL elicitations only). */
  onWaitingDismiss?: (action: 'dismiss' | 'retry' | 'cancel') => void;
};
const isTextField = (s: PrimitiveSchemaDefinition) => ['string', 'number', 'integer'].includes(s.type);
const RESOLVING_SPINNER_CHARS = '\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F';
const advanceSpinnerFrame = (f: number) => (f + 1) % RESOLVING_SPINNER_CHARS.length;

/** Timer callback for enumTypeaheadRef — module-scope to avoid closure capture. */
function resetTypeahead(ta: {
  buffer: string;
  timer: ReturnType<typeof setTimeout> | undefined;
}): void {
  ta.buffer = '';
  ta.timer = undefined;
}

/**
 * Isolated spinner glyph for a field that is being resolved asynchronously.
 * Owns its own 80ms animation timer so ticks only re-render this tiny leaf,
 * not the entire ElicitationFormDialog (~1200 lines + renderFormFields).
 * Mounted/unmounted by the parent via the `isResolving` condition.
 *
 * Not using the shared <Spinner /> from ../Spinner.js: that one renders in a
 * <Box width={2}> with color="text", which would break the 1-col checkbox
 * column alignment here (other checkbox states are width-1 glyphs).
 */
function ResolvingSpinner() {
  const $ = _c(4);
  const [frame, setFrame] = useState(0);
  let t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = () => {
      const timer = setInterval(setFrame, 80, advanceSpinnerFrame);
      return () => clearInterval(timer);
    };
    t1 = [];
    $[0] = t0;
    $[1] = t1;
  } else {
    t0 = $[0];
    t1 = $[1];
  }
  useEffect(t0, t1);
  const t2 = RESOLVING_SPINNER_CHARS[frame];
  let t3;
  if ($[2] !== t2) {
    t3 = <Text color="warning">{t2}</Text>;
    $[2] = t2;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  return t3;
}

/** Format an ISO date/datetime for display, keeping the ISO value for submission. */
function formatDateDisplay(isoValue: string, schema: PrimitiveSchemaDefinition): string {
  try {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return isoValue;
    const format = 'format' in schema ? schema.format : undefined;
    if (format === 'date-time') {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    }
    // date-only: parse as local date to avoid timezone shift
    const parts = isoValue.split('-');
    if (parts.length === 3) {
      const local = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return local.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return isoValue;
  } catch {
    return isoValue;
  }
}
export function ElicitationDialog(t0) {
  const $ = _c(7);
  const {
    event,
    onResponse,
    onWaitingDismiss
  } = t0;
  if (event.params.mode === "url") {
    let t1;
    if ($[0] !== event || $[1] !== onResponse || $[2] !== onWaitingDismiss) {
      t1 = <ElicitationURLDialog event={event} onResponse={onResponse} onWaitingDismiss={onWaitingDismiss} />;
      $[0] = event;
      $[1] = onResponse;
      $[2] = onWaitingDismiss;
      $[3] = t1;
    } else {
      t1 = $[3];
    }
    return t1;
  }
  let t1;
  if ($[4] !== event || $[5] !== onResponse) {
    t1 = <ElicitationFormDialog event={event} onResponse={onResponse} />;
    $[4] = event;
    $[5] = onResponse;
    $[6] = t1;
  } else {
    t1 = $[6];
  }
  return t1;
}
function ElicitationFormDialog({
  event,
  onResponse
}: {
  event: ElicitationRequestEvent;
  onResponse: Props['onResponse'];
}): React.ReactNode {
  const {
    serverName,
    signal
  } = event;
  const request = event.params as ElicitRequestFormParams;
  const {
    message,
    requestedSchema
  } = request;
  const hasFields = Object.keys(requestedSchema.properties).length > 0;
  const [focusedButton, setFocusedButton] = useState<'accept' | 'decline' | null>(hasFields ? null : 'accept');
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean | string[]>>(() => {
    const initialValues: Record<string, string | number | boolean | string[]> = {};
    if (requestedSchema.properties) {
      for (const [propName, propSchema] of Object.entries(requestedSchema.properties)) {
        if (typeof propSchema === 'object' && propSchema !== null) {
          if (propSchema.default !== undefined) {
            initialValues[propName] = propSchema.default;
          }
        }
      }
    }
    return initialValues;
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>(() => {
    const initialErrors: Record<string, string> = {};
    for (const [propName_0, propSchema_0] of Object.entries(requestedSchema.properties)) {
      if (isTextField(propSchema_0) && propSchema_0?.default !== undefined) {
        const validation = validateElicitationInput(String(propSchema_0.default), propSchema_0);
        if (!validation.isValid && validation.error) {
          initialErrors[propName_0] = validation.error;
        }
      }
    }
    return initialErrors;
  });
  useEffect(() => {
    if (!signal) return;
    const handleAbort = () => {
      onResponse('cancel');
    };
    if (signal.aborted) {
      handleAbort();
      return;
    }
    signal.addEventListener('abort', handleAbort);
    return () => {
      signal.removeEventListener('abort', handleAbort);
    };
  }, [signal, onResponse]);
  const schemaFields = useMemo(() => {
    const requiredFields = requestedSchema.required ?? [];
    return Object.entries(requestedSchema.properties).map(([name, schema]) => ({
      name,
      schema,
      isRequired: requiredFields.includes(name)
    }));
  }, [requestedSchema]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState<number | undefined>(hasFields ? 0 : undefined);
  const [textInputValue, setTextInputValue] = useState(() => {
    // Initialize from the first field's value if it's a text field
    const firstField = schemaFields[0];
    if (firstField && isTextField(firstField.schema)) {
      const val = formValues[firstField.name];
      if (val === undefined) return '';
      return String(val);
    }
    return '';
  });
  const [textInputCursorOffset, setTextInputCursorOffset] = useState(textInputValue.length);
  const [resolvingFields, setResolvingFields] = useState<Set<string>>(() => new Set());
  // Accordion state (shared by multi-select and single-select enum)
  const [expandedAccordion, setExpandedAccordion] = useState<string | undefined>();
  const [accordionOptionIndex, setAccordionOptionIndex] = useState(0);
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resolveAbortRef = useRef<Map<string, AbortController>>(new Map());
  const enumTypeaheadRef = useRef({
    buffer: '',
    timer: undefined as ReturnType<typeof setTimeout> | undefined
  });

  // Clear pending debounce/typeahead timers and abort in-flight async
  // validations on unmount so they don't fire against an unmounted component
  // (e.g. dialog dismissed mid-debounce or mid-resolve).
  useEffect(() => () => {
    if (dateDebounceRef.current !== undefined) {
      clearTimeout(dateDebounceRef.current);
    }
    const ta = enumTypeaheadRef.current;
    if (ta.timer !== undefined) {
      clearTimeout(ta.timer);
    }
    for (const controller of resolveAbortRef.current.values()) {
      controller.abort();
    }
    resolveAbortRef.current.clear();
  }, []);
  const {
    columns,
    rows
  } = useTerminalSize();
  const currentField = currentFieldIndex !== undefined ? schemaFields[currentFieldIndex] : undefined;
  const currentFieldIsText = currentField !== undefined && isTextField(currentField.schema) && !isEnumSchema(currentField.schema);

  // Text fields are always in edit mode when focused — no Enter-to-edit step.
  const isEditingTextField = currentFieldIsText && !focusedButton;
  useRegisterOverlay('elicitation');
  useNotifyAfterTimeout('Claude Code needs your input', 'elicitation_dialog');

  // Sync textInputValue when the focused field changes
  const syncTextInput = useCallback((fieldIndex: number | undefined) => {
    if (fieldIndex === undefined) {
      setTextInputValue('');
      setTextInputCursorOffset(0);
      return;
    }
    const field = schemaFields[fieldIndex];
    if (field && isTextField(field.schema) && !isEnumSchema(field.schema)) {
      const val_0 = formValues[field.name];
      const text = val_0 !== undefined ? String(val_0) : '';
      setTextInputValue(text);
      setTextInputCursorOffset(text.length);
    }
  }, [schemaFields, formValues]);
  function validateMultiSelect(fieldName: string, schema_0: PrimitiveSchemaDefinition) {
    if (!isMultiSelectEnumSchema(schema_0)) return;
    const selected = formValues[fieldName] as string[] | undefined ?? [];
    const fieldRequired = schemaFields.find(f => f.name === fieldName)?.isRequired ?? false;
    const min = schema_0.minItems;
    const max = schema_0.maxItems;
    // Skip minItems check when field is optional and unset
    if (min !== undefined && selected.length < min && (selected.length > 0 || fieldRequired)) {
      updateValidationError(fieldName, `Select at least ${min} ${plural(min, 'item')}`);
    } else if (max !== undefined && selected.length > max) {
      updateValidationError(fieldName, `Select at most ${max} ${plural(max, 'item')}`);
    } else {
      updateValidationError(fieldName);
    }
  }
  function handleNavigation(direction: 'up' | 'down'): void {
    // Collapse accordion and validate on navigate away
    if (currentField && isMultiSelectEnumSchema(currentField.schema)) {
      validateMultiSelect(currentField.name, currentField.schema);
      setExpandedAccordion(undefined);
    } else if (currentField && isEnumSchema(currentField.schema)) {
      setExpandedAccordion(undefined);
    }

    // Commit current text field before navigating away
    if (isEditingTextField && currentField) {
      commitTextField(currentField.name, currentField.schema, textInputValue);

      // Cancel any pending debounce — we're resolving now on navigate-away
      if (dateDebounceRef.current !== undefined) {
        clearTimeout(dateDebounceRef.current);
        dateDebounceRef.current = undefined;
      }

      // For date/datetime fields that failed sync validation, try async NL parsing
      if (isDateTimeSchema(currentField.schema) && textInputValue.trim() !== '' && validationErrors[currentField.name]) {
        resolveFieldAsync(currentField.name, currentField.schema, textInputValue);
      }
    }

    // Fields + accept + decline
    const itemCount = schemaFields.length + 2;
    const index = currentFieldIndex ?? (focusedButton === 'accept' ? schemaFields.length : focusedButton === 'decline' ? schemaFields.length + 1 : undefined);
    const nextIndex = index !== undefined ? (index + (direction === 'up' ? itemCount - 1 : 1)) % itemCount : 0;
    if (nextIndex < schemaFields.length) {
      setCurrentFieldIndex(nextIndex);
      setFocusedButton(null);
      syncTextInput(nextIndex);
    } else {
      setCurrentFieldIndex(undefined);
      setFocusedButton(nextIndex === schemaFields.length ? 'accept' : 'decline');
      setTextInputValue('');
    }
  }
  function setField(fieldName_0: string, value: number | string | boolean | string[] | undefined) {
    setFormValues(prev => {
      const next = {
        ...prev
      };
      if (value === undefined) {
        delete next[fieldName_0];
      } else {
        next[fieldName_0] = value;
      }
      return next;
    });
    // Clear "required" error when a value is provided
    if (value !== undefined && validationErrors[fieldName_0] === 'This field is required') {
      updateValidationError(fieldName_0);
    }
  }
  function updateValidationError(fieldName_1: string, error?: string) {
    setValidationErrors(prev_0 => {
      const next_0 = {
        ...prev_0
      };
      if (error) {
        next_0[fieldName_1] = error;
      } else {
        delete next_0[fieldName_1];
      }
      return next_0;
    });
  }
  function unsetField(fieldName_2: string) {
    if (!fieldName_2) return;
    setField(fieldName_2, undefined);
    updateValidationError(fieldName_2);
    setTextInputValue('');
    setTextInputCursorOffset(0);
  }
  function commitTextField(fieldName_3: string, schema_1: PrimitiveSchemaDefinition, value_0: string) {
    const trimmedValue = value_0.trim();

    // Empty input for non-plain-string types means unset
    if (trimmedValue === '' && (schema_1.type !== 'string' || 'format' in schema_1 && schema_1.format !== undefined)) {
      unsetField(fieldName_3);
      return;
    }
    if (trimmedValue === '') {
      // Empty plain string — keep or unset depending on whether it was set
      if (formValues[fieldName_3] !== undefined) {
        setField(fieldName_3, '');
      }
      return;
    }
    const validation_0 = validateElicitationInput(value_0, schema_1);
    setField(fieldName_3, validation_0.isValid ? validation_0.value : value_0);
    updateValidationError(fieldName_3, validation_0.isValid ? undefined : validation_0.error);
  }
  function resolveFieldAsync(fieldName_4: string, schema_2: PrimitiveSchemaDefinition, rawValue: string) {
    if (!signal) return;

    // Abort any existing resolution for this field
    const existing = resolveAbortRef.current.get(fieldName_4);
    if (existing) {
      existing.abort();
    }
    const controller_0 = new AbortController();
    resolveAbortRef.current.set(fieldName_4, controller_0);
    setResolvingFields(prev_1 => new Set(prev_1).add(fieldName_4));
    void validateElicitationInputAsync(rawValue, schema_2, controller_0.signal).then(result => {
      resolveAbortRef.current.delete(fieldName_4);
      setResolvingFields(prev_2 => {
        const next_1 = new Set(prev_2);
        next_1.delete(fieldName_4);
        return next_1;
      });
      if (controller_0.signal.aborted) return;
      if (result.isValid) {
        setField(fieldName_4, result.value);
        updateValidationError(fieldName_4);
        // Update the text input if we're still on this field
        const isoText = String(result.value);
        setTextInputValue(prev_3 => {
          // Only replace if the field is still showing the raw input
          if (prev_3 === rawValue) {
            setTextInputCursorOffset(isoText.length);
            return isoText;
          }
          return prev_3;
        });
      } else {
        // Keep raw text, show validation error
        updateValidationError(fieldName_4, result.error);
      }
    }, () => {
      resolveAbortRef.current.delete(fieldName_4);
      setResolvingFields(prev_4 => {
        const next_2 = new Set(prev_4);
        next_2.delete(fieldName_4);
        return next_2;
      });
    });
  }
  function handleTextInputChange(newValue: string) {
    setTextInputValue(newValue);
    // Commit immediately on each keystroke (sync validation)
    if (currentField) {
      commitTextField(currentField.name, currentField.schema, newValue);

      // For date/datetime fields, debounce async NL parsing after 2s of inactivity
      if (dateDebounceRef.current !== undefined) {
        clearTimeout(dateDebounceRef.current);
        dateDebounceRef.current = undefined;
      }
      if (isDateTimeSchema(currentField.schema) && newValue.trim() !== '' && validationErrors[currentField.name]) {
        const fieldName_5 = currentField.name;
        const schema_3 = currentField.schema;
        dateDebounceRef.current = setTimeout((dateDebounceRef_0, resolveFieldAsync_0, fieldName_6, schema_4, newValue_0) => {
          dateDebounceRef_0.current = undefined;
          resolveFieldAsync_0(fieldName_6, schema_4, newValue_0);
        }, 2000, dateDebounceRef, resolveFieldAsync, fieldName_5, schema_3, newValue);
      }
    }
  }
  function handleTextInputSubmit() {
    handleNavigation('down');
  }

  /**
   * Append a keystroke to the typeahead buffer (reset after 2s idle) and
   * call `onMatch` with the index of the first label that prefix-matches.
   * Shared by boolean y/n, enum accordion, and multi-select accordion.
   */
  function runTypeahead(char: string, labels: string[], onMatch: (index: number) => void) {
    const ta_0 = enumTypeaheadRef.current;
    if (ta_0.timer !== undefined) clearTimeout(ta_0.timer);
    ta_0.buffer += char.toLowerCase();
    ta_0.timer = setTimeout(resetTypeahead, 2000, ta_0);
    const match = labels.findIndex(l => l.startsWith(ta_0.buffer));
    if (match !== -1) onMatch(match);
  }

  // Esc while a field is focused: cancel the dialog.
  // Uses Settings context (escape-only, no 'n' key) since Dialog's
  // Confirmation-context cancel is suppressed when a field is focused.
  useKeybinding('confirm:no', () => {
    // For text fields, revert uncommitted changes first
    if (isEditingTextField && currentField) {
      const val_1 = formValues[currentField.name];
      setTextInputValue(val_1 !== undefined ? String(val_1) : '');
      setTextInputCursorOffset(0);
    }
    onResponse('cancel');
  }, {
    context: 'Settings',
    isActive: !!currentField && !focusedButton && !expandedAccordion
  });
  useInput((_input, key) => {
    // Text fields handle their own character input; we only intercept
    // navigation keys and backspace-on-empty here.
    if (isEditingTextField && !key.upArrow && !key.downArrow && !key.return && !key.backspace) {
      return;
    }

    // Expanded multi-select accordion
    if (expandedAccordion && currentField && isMultiSelectEnumSchema(currentField.schema)) {
      const msSchema = currentField.schema;
      const msValues = getMultiSelectValues(msSchema);
      const selected_0 = formValues[currentField.name] as string[] ?? [];
      if (key.leftArrow || key.escape) {
        setExpandedAccordion(undefined);
        validateMultiSelect(currentField.name, msSchema);
        return;
      }
      if (key.upArrow) {
        if (accordionOptionIndex === 0) {
          setExpandedAccordion(undefined);
          validateMultiSelect(currentField.name, msSchema);
        } else {
          setAccordionOptionIndex(accordionOptionIndex - 1);
        }
        return;
      }
      if (key.downArrow) {
        if (accordionOptionIndex >= msValues.length - 1) {
          setExpandedAccordion(undefined);
          handleNavigation('down');
        } else {
          setAccordionOptionIndex(accordionOptionIndex + 1);
        }
        return;
      }
      if (_input === ' ') {
        const optionValue = msValues[accordionOptionIndex];
        if (optionValue !== undefined) {
          const newSelected = selected_0.includes(optionValue) ? selected_0.filter(v => v !== optionValue) : [...selected_0, optionValue];
          const newValue_1 = newSelected.length > 0 ? newSelected : undefined;
          setField(currentField.name, newValue_1);
          const min_0 = msSchema.minItems;
          const max_0 = msSchema.maxItems;
          if (min_0 !== undefined && newSelected.length < min_0 && (newSelected.length > 0 || currentField.isRequired)) {
            updateValidationError(currentField.name, `Select at least ${min_0} ${plural(min_0, 'item')}`);
          } else if (max_0 !== undefined && newSelected.length > max_0) {
            updateValidationError(currentField.name, `Select at most ${max_0} ${plural(max_0, 'item')}`);
          } else {
            updateValidationError(currentField.name);
          }
        }
        return;
      }
      if (key.return) {
        // Check (not toggle) the focused item, then collapse and advance
        const optionValue_0 = msValues[accordionOptionIndex];
        if (optionValue_0 !== undefined && !selected_0.includes(optionValue_0)) {
          setField(currentField.name, [...selected_0, optionValue_0]);
        }
        setExpandedAccordion(undefined);
        handleNavigation('down');
        return;
      }
      if (_input) {
        const labels_0 = msValues.map(v_0 => getMultiSelectLabel(msSchema, v_0).toLowerCase());
        runTypeahead(_input, labels_0, setAccordionOptionIndex);
        return;
      }
      return;
    }

    // Expanded single-select enum accordion
    if (expandedAccordion && currentField && isEnumSchema(currentField.schema)) {
      const enumSchema = currentField.schema;
      const enumValues = getEnumValues(enumSchema);
      if (key.leftArrow || key.escape) {
        setExpandedAccordion(undefined);
        return;
      }
      if (key.upArrow) {
        if (accordionOptionIndex === 0) {
          setExpandedAccordion(undefined);
        } else {
          setAccordionOptionIndex(accordionOptionIndex - 1);
        }
        return;
      }
      if (key.downArrow) {
        if (accordionOptionIndex >= enumValues.length - 1) {
          setExpandedAccordion(undefined);
          handleNavigation('down');
        } else {
          setAccordionOptionIndex(accordionOptionIndex + 1);
        }
        return;
      }
      // Space: select and collapse
      if (_input === ' ') {
        const optionValue_1 = enumValues[accordionOptionIndex];
        if (optionValue_1 !== undefined) {
          setField(currentField.name, optionValue_1);
        }
        setExpandedAccordion(undefined);
        return;
      }
      // Enter: select, collapse, and move to next field
      if (key.return) {
        const optionValue_2 = enumValues[accordionOptionIndex];
        if (optionValue_2 !== undefined) {
          setField(currentField.name, optionValue_2);
        }
        setExpandedAccordion(undefined);
        handleNavigation('down');
        return;
      }
      if (_input) {
        const labels_1 = enumValues.map(v_1 => getEnumLabel(enumSchema, v_1).toLowerCase());
        runTypeahead(_input, labels_1, setAccordionOptionIndex);
        return;
      }
      return;
    }

    // Accept / Decline buttons
    if (key.return && focusedButton === 'accept') {
      if (validateRequired() && Object.keys(validationErrors).length === 0) {
        onResponse('accept', formValues);
      } else {
        // Show "required" validation errors on missing fields
        const requiredFields_0 = requestedSchema.required || [];
        for (const fieldName_7 of requiredFields_0) {
          if (formValues[fieldName_7] === undefined) {
            updateValidationError(fieldName_7, 'This field is required');
          }
        }
        const firstBadIndex = schemaFields.findIndex(f_0 => requiredFields_0.includes(f_0.name) && formValues[f_0.name] === undefined || validationErrors[f_0.name] !== undefined);
        if (firstBadIndex !== -1) {
          setCurrentFieldIndex(firstBadIndex);
          setFocusedButton(null);
          syncTextInput(firstBadIndex);
        }
      }
      return;
    }
    if (key.return && focusedButton === 'decline') {
      onResponse('decline');
      return;
    }

    // Up/Down navigation
    if (key.upArrow || key.downArrow) {
      // Reset enum typeahead when leaving a field
      const ta_1 = enumTypeaheadRef.current;
      ta_1.buffer = '';
      if (ta_1.timer !== undefined) {
        clearTimeout(ta_1.timer);
        ta_1.timer = undefined;
      }
      handleNavigation(key.upArrow ? 'up' : 'down');
      return;
    }

    // Left/Right to switch between Accept and Decline buttons
    if (focusedButton && (key.leftArrow || key.rightArrow)) {
      setFocusedButton(focusedButton === 'accept' ? 'decline' : 'accept');
      return;
    }
    if (!currentField) return;
    const {
      schema: schema_5,
      name: name_0
    } = currentField;
    const value_1 = formValues[name_0];

    // Boolean: Space to toggle, Enter to move on
    if (schema_5.type === 'boolean') {
      if (_input === ' ') {
        setField(name_0, value_1 === undefined ? true : !value_1);
        return;
      }
      if (key.return) {
        handleNavigation('down');
        return;
      }
      if (key.backspace && value_1 !== undefined) {
        unsetField(name_0);
        return;
      }
      // y/n typeahead
      if (_input && !key.return) {
        runTypeahead(_input, ['yes', 'no'], i => setField(name_0, i === 0));
        return;
      }
      return;
    }

    // Enum or multi-select (collapsed) — accordion style
    if (isEnumSchema(schema_5) || isMultiSelectEnumSchema(schema_5)) {
      if (key.return) {
        handleNavigation('down');
        return;
      }
      if (key.backspace && value_1 !== undefined) {
        unsetField(name_0);
        return;
      }
      // Compute option labels + initial focus index for rightArrow expand.
      // Single-select focuses on the current value; multi-select starts at 0.
      let labels_2: string[];
      let startIdx = 0;
      if (isEnumSchema(schema_5)) {
        const vals = getEnumValues(schema_5);
        labels_2 = vals.map(v_2 => getEnumLabel(schema_5, v_2).toLowerCase());
        if (value_1 !== undefined) {
          startIdx = Math.max(0, vals.indexOf(value_1 as string));
        }
      } else {
        const vals_0 = getMultiSelectValues(schema_5);
        labels_2 = vals_0.map(v_3 => getMultiSelectLabel(schema_5, v_3).toLowerCase());
      }
      if (key.rightArrow) {
        setExpandedAccordion(name_0);
        setAccordionOptionIndex(startIdx);
        return;
      }
      // Typeahead: expand and jump to matching option
      if (_input && !key.leftArrow) {
        runTypeahead(_input, labels_2, i_0 => {
          setExpandedAccordion(name_0);
          setAccordionOptionIndex(i_0);
        });
        return;
      }
      return;
    }

    // Backspace: text fields when empty
    if (key.backspace) {
      if (isEditingTextField && textInputValue === '') {
        unsetField(name_0);
        return;
      }
    }

    // Text field Enter is handled by TextInput's onSubmit
  }, {
    isActive: true
  });
  function validateRequired(): boolean {
    const requiredFields_1 = requestedSchema.required || [];
    for (const fieldName_8 of requiredFields_1) {
      const value_2 = formValues[fieldName_8];
      if (value_2 === undefined || value_2 === null || value_2 === '') {
        return false;
      }
      if (Array.isArray(value_2) && value_2.length === 0) {
        return false;
      }
    }
    return true;
  }

  // Scroll windowing: compute visible field range
  // Overhead: ~9 lines (dialog chrome, buttons, footer).
  // Each field: ~3 lines (label + description + validation spacer).
  // NOTE(v2): Multi-select accordion expands to N+3 lines when open.
  // For now we assume 3 lines per field; an expanded accordion may
  // temporarily push content off-screen (terminal scrollback handles it).
  // To generalize: track per-field height (3 for collapsed, N+3 for
  // expanded multi-select) and compute a pixel-budget window instead
  // of a simple item-count window.
  const LINES_PER_FIELD = 3;
  const DIALOG_OVERHEAD = 14;
  const maxVisibleFields = Math.max(2, Math.floor((rows - DIALOG_OVERHEAD) / LINES_PER_FIELD));
  const scrollWindow = useMemo(() => {
    const total = schemaFields.length;
    if (total <= maxVisibleFields) {
      return {
        start: 0,
        end: total
      };
    }
    // When buttons are focused (currentFieldIndex undefined), pin to end
    const focusIdx = currentFieldIndex ?? total - 1;
    let start = Math.max(0, focusIdx - Math.floor(maxVisibleFields / 2));
    const end = Math.min(start + maxVisibleFields, total);
    // Adjust start if we hit the bottom
    start = Math.max(0, end - maxVisibleFields);
    return {
      start,
      end
    };
  }, [schemaFields.length, maxVisibleFields, currentFieldIndex]);
  const hasFieldsAbove = scrollWindow.start > 0;
  const hasFieldsBelow = scrollWindow.end < schemaFields.length;
  function renderFormFields(): React.ReactNode {
    if (!schemaFields.length) return null;
    return <Box flexDirection="column">
        {hasFieldsAbove && <Box marginLeft={2}>
            <Text dimColor>
              {figures.arrowUp} {scrollWindow.start} more above
            </Text>
          </Box>}
        {schemaFields.slice(scrollWindow.start, scrollWindow.end).map((field_0, visibleIdx) => {
        const index_0 = scrollWindow.start + visibleIdx;
        const {
          name: name_1,
          schema: schema_6,
          isRequired
        } = field_0;
        const isActive = index_0 === currentFieldIndex && !focusedButton;
        const value_3 = formValues[name_1];
        const hasValue = value_3 !== undefined && (!Array.isArray(value_3) || value_3.length > 0);
        const error_0 = validationErrors[name_1];

        // Checkbox: spinner → ⚠ error → ✔ set → * required → space
        const isResolving = resolvingFields.has(name_1);
        const checkbox = isResolving ? <ResolvingSpinner /> : error_0 ? <Text color="error">{figures.warning}</Text> : hasValue ? <Text color="success" dimColor={!isActive}>
                {figures.tick}
              </Text> : isRequired ? <Text color="error">*</Text> : <Text> </Text>;

        // Selection color matches field status
        const selectionColor = error_0 ? 'error' : hasValue ? 'success' : isRequired ? 'error' : 'suggestion';
        const activeColor = isActive ? selectionColor : undefined;
        const label = <Text color={activeColor} bold={isActive}>
                {schema_6.title || name_1}
              </Text>;

        // Render the value portion based on field type
        let valueContent: React.ReactNode;
        let accordionContent: React.ReactNode = null;
        if (isMultiSelectEnumSchema(schema_6)) {
          const msValues_0 = getMultiSelectValues(schema_6);
          const selected_1 = value_3 as string[] | undefined ?? [];
          const isExpanded = expandedAccordion === name_1 && isActive;
          if (isExpanded) {
            valueContent = <Text dimColor>{figures.triangleDownSmall}</Text>;
            accordionContent = <Box flexDirection="column" marginLeft={6}>
                    {msValues_0.map((optVal, optIdx) => {
                const optLabel = getMultiSelectLabel(schema_6, optVal);
                const isChecked = selected_1.includes(optVal);
                const isFocused = optIdx === accordionOptionIndex;
                return <Box key={optVal} gap={1}>
                          <Text color="suggestion">
                            {isFocused ? figures.pointer : ' '}
                          </Text>
                          <Text color={isChecked ? 'success' : undefined}>
                            {isChecked ? figures.checkboxOn : figures.checkboxOff}
                          </Text>
                          <Text color={isFocused ? 'suggestion' : undefined} bold={isFocused}>
                            {optLabel}
                          </Text>
                        </Box>;
              })}
                  </Box>;
          } else {
            // Collapsed: ▸ arrow then comma-joined selected items
            const arrow = isActive ? <Text dimColor>{figures.triangleRightSmall} </Text> : null;
            if (selected_1.length > 0) {
              const displayLabels = selected_1.map(v_4 => getMultiSelectLabel(schema_6, v_4));
              valueContent = <Text>
                      {arrow}
                      <Text color={activeColor} bold={isActive}>
                        {displayLabels.join(', ')}
                      </Text>
                    </Text>;
            } else {
              valueContent = <Text>
                      {arrow}
                      <Text dimColor italic>
                        not set
                      </Text>
                    </Text>;
            }
          }
        } else if (isEnumSchema(schema_6)) {
          const enumValues_0 = getEnumValues(schema_6);
          const isExpanded_0 = expandedAccordion === name_1 && isActive;
          if (isExpanded_0) {
            valueContent = <Text dimColor>{figures.triangleDownSmall}</Text>;
            accordionContent = <Box flexDirection="column" marginLeft={6}>
                    {enumValues_0.map((optVal_0, optIdx_0) => {
                const optLabel_0 = getEnumLabel(schema_6, optVal_0);
                const isSelected = value_3 === optVal_0;
                const isFocused_0 = optIdx_0 === accordionOptionIndex;
                return <Box key={optVal_0} gap={1}>
                          <Text color="suggestion">
                            {isFocused_0 ? figures.pointer : ' '}
                          </Text>
                          <Text color={isSelected ? 'success' : undefined}>
                            {isSelected ? figures.radioOn : figures.radioOff}
                          </Text>
                          <Text color={isFocused_0 ? 'suggestion' : undefined} bold={isFocused_0}>
                            {optLabel_0}
                          </Text>
                        </Box>;
              })}
                  </Box>;
          } else {
            // Collapsed: ▸ arrow then current value
            const arrow_0 = isActive ? <Text dimColor>{figures.triangleRightSmall} </Text> : null;
            if (hasValue) {
              valueContent = <Text>
                      {arrow_0}
                      <Text color={activeColor} bold={isActive}>
                        {getEnumLabel(schema_6, value_3 as string)}
                      </Text>
                    </Text>;
            } else {
              valueContent = <Text>
                      {arrow_0}
                      <Text dimColor italic>
                        not set
                      </Text>
                    </Text>;
            }
          }
        } else if (schema_6.type === 'boolean') {
          if (isActive) {
            valueContent = hasValue ? <Text color={activeColor} bold>
                    {value_3 ? figures.checkboxOn : figures.checkboxOff}
                  </Text> : <Text dimColor>{figures.checkboxOff}</Text>;
          } else {
            valueContent = hasValue ? <Text>
                    {value_3 ? figures.checkboxOn : figures.checkboxOff}
                  </Text> : <Text dimColor italic>
                    not set
                  </Text>;
          }
        } else if (isTextField(schema_6)) {
          if (isActive) {
            valueContent = <TextInput value={textInputValue} onChange={handleTextInputChange} onSubmit={handleTextInputSubmit} placeholder={`Type something\u{2026}`} columns={Math.min(columns - 20, 60)} cursorOffset={textInputCursorOffset} onChangeCursorOffset={setTextInputCursorOffset} focus showCursor />;
          } else {
            const displayValue = hasValue && isDateTimeSchema(schema_6) ? formatDateDisplay(String(value_3), schema_6) : String(value_3);
            valueContent = hasValue ? <Text>{displayValue}</Text> : <Text dimColor italic>
                    not set
                  </Text>;
          }
        } else {
          valueContent = hasValue ? <Text>{String(value_3)}</Text> : <Text dimColor italic>
                  not set
                </Text>;
        }
        return <Box key={name_1} flexDirection="column">
                <Box gap={1}>
                  <Text color={selectionColor}>
                    {isActive ? figures.pointer : ' '}
                  </Text>
                  {checkbox}
                  <Box>
                    {label}
                    <Text color={activeColor}>: </Text>
                    {valueContent}
                  </Box>
                </Box>
                {accordionContent}
                {schema_6.description && <Box marginLeft={6}>
                    <Text dimColor>{schema_6.description}</Text>
                  </Box>}
                <Box marginLeft={6} height={1}>
                  {error_0 ? <Text color="error" italic>
                      {error_0}
                    </Text> : <Text> </Text>}
                </Box>
              </Box>;
      })}
        {hasFieldsBelow && <Box marginLeft={2}>
            <Text dimColor>
              {figures.arrowDown} {schemaFields.length - scrollWindow.end} more
              below
            </Text>
          </Box>}
      </Box>;
  }
  return <Dialog title={`MCP server \u201c${serverName}\u201d requests your input`} subtitle={`\n${message}`} color="permission" onCancel={() => onResponse('cancel')} isCancelActive={(!currentField || !!focusedButton) && !expandedAccordion} inputGuide={exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            <KeyboardShortcutHint shortcut="↑↓" action="navigate" />
            {currentField && <KeyboardShortcutHint shortcut="Backspace" action="unset" />}
            {currentField && currentField.schema.type === 'boolean' && <KeyboardShortcutHint shortcut="Space" action="toggle" />}
            {currentField && isEnumSchema(currentField.schema) && (expandedAccordion ? <KeyboardShortcutHint shortcut="Space" action="select" /> : <KeyboardShortcutHint shortcut="→" action="expand" />)}
            {currentField && isMultiSelectEnumSchema(currentField.schema) && (expandedAccordion ? <KeyboardShortcutHint shortcut="Space" action="toggle" /> : <KeyboardShortcutHint shortcut="→" action="expand" />)}
          </Byline>}>
      <Box flexDirection="column">
        {renderFormFields()}
        <Box>
          <Text color="success">
            {focusedButton === 'accept' ? figures.pointer : ' '}
          </Text>
          <Text bold={focusedButton === 'accept'} color={focusedButton === 'accept' ? 'success' : undefined} dimColor={focusedButton !== 'accept'}>
            {' Accept  '}
          </Text>
          <Text color="error">
            {focusedButton === 'decline' ? figures.pointer : ' '}
          </Text>
          <Text bold={focusedButton === 'decline'} color={focusedButton === 'decline' ? 'error' : undefined} dimColor={focusedButton !== 'decline'}>
            {' Decline'}
          </Text>
        </Box>
      </Box>
    </Dialog>;
}
function ElicitationURLDialog({
  event,
  onResponse,
  onWaitingDismiss
}: {
  event: ElicitationRequestEvent;
  onResponse: Props['onResponse'];
  onWaitingDismiss: Props['onWaitingDismiss'];
}): React.ReactNode {
  const {
    serverName,
    signal,
    waitingState
  } = event;
  const urlParams = event.params as ElicitRequestURLParams;
  const {
    message,
    url
  } = urlParams;
  const [phase, setPhase] = useState<'prompt' | 'waiting'>('prompt');
  const phaseRef = useRef<'prompt' | 'waiting'>('prompt');
  const [focusedButton, setFocusedButton] = useState<'accept' | 'decline' | 'open' | 'action' | 'cancel'>('accept');
  const showCancel = waitingState?.showCancel ?? false;
  useNotifyAfterTimeout('Claude Code needs your input', 'elicitation_url_dialog');
  useRegisterOverlay('elicitation-url');

  // Keep refs in sync for use in abort handler (avoids re-registering listener)
  phaseRef.current = phase;
  const onWaitingDismissRef = useRef(onWaitingDismiss);
  onWaitingDismissRef.current = onWaitingDismiss;
  useEffect(() => {
    const handleAbort = () => {
      if (phaseRef.current === 'waiting') {
        onWaitingDismissRef.current?.('cancel');
      } else {
        onResponse('cancel');
      }
    };
    if (signal.aborted) {
      handleAbort();
      return;
    }
    signal.addEventListener('abort', handleAbort);
    return () => signal.removeEventListener('abort', handleAbort);
  }, [signal, onResponse]);

  // Parse URL to highlight the domain
  let domain = '';
  let urlBeforeDomain = '';
  let urlAfterDomain = '';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    const domainStart = url.indexOf(domain);
    urlBeforeDomain = url.slice(0, domainStart);
    urlAfterDomain = url.slice(domainStart + domain.length);
  } catch {
    domain = url;
  }

  // Auto-dismiss when the server sends a completion notification (sets completed flag)
  useEffect(() => {
    if (phase === 'waiting' && event.completed) {
      onWaitingDismiss?.(showCancel ? 'retry' : 'dismiss');
    }
  }, [phase, event.completed, onWaitingDismiss, showCancel]);
  const handleAccept = useCallback(() => {
    void openBrowser(url);
    onResponse('accept');
    setPhase('waiting');
    phaseRef.current = 'waiting';
    setFocusedButton('open');
  }, [onResponse, url]);

  // eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw input for button navigation
  useInput((_input, key) => {
    if (phase === 'prompt') {
      if (key.leftArrow || key.rightArrow) {
        setFocusedButton(prev => prev === 'accept' ? 'decline' : 'accept');
        return;
      }
      if (key.return) {
        if (focusedButton === 'accept') {
          handleAccept();
        } else {
          onResponse('decline');
        }
      }
    } else {
      // waiting phase — cycle through buttons
      type ButtonName = 'accept' | 'decline' | 'open' | 'action' | 'cancel';
      const waitingButtons: readonly ButtonName[] = showCancel ? ['open', 'action', 'cancel'] : ['open', 'action'];
      if (key.leftArrow || key.rightArrow) {
        setFocusedButton(prev_0 => {
          const idx = waitingButtons.indexOf(prev_0);
          const delta = key.rightArrow ? 1 : -1;
          return waitingButtons[(idx + delta + waitingButtons.length) % waitingButtons.length]!;
        });
        return;
      }
      if (key.return) {
        if (focusedButton === 'open') {
          void openBrowser(url);
        } else if (focusedButton === 'cancel') {
          onWaitingDismiss?.('cancel');
        } else {
          onWaitingDismiss?.(showCancel ? 'retry' : 'dismiss');
        }
      }
    }
  });
  if (phase === 'waiting') {
    const actionLabel = waitingState?.actionLabel ?? 'Continue without waiting';
    return <Dialog title={`MCP server \u201c${serverName}\u201d \u2014 waiting for completion`} subtitle={`\n${message}`} color="permission" onCancel={() => onWaitingDismiss?.('cancel')} isCancelActive inputGuide={exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
              <KeyboardShortcutHint shortcut="\u2190\u2192" action="switch" />
            </Byline>}>
        <Box flexDirection="column">
          <Box marginBottom={1} flexDirection="column">
            <Text>
              {urlBeforeDomain}
              <Text bold>{domain}</Text>
              {urlAfterDomain}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor italic>
              Waiting for the server to confirm completion…
            </Text>
          </Box>
          <Box>
            <Text color="success">
              {focusedButton === 'open' ? figures.pointer : ' '}
            </Text>
            <Text bold={focusedButton === 'open'} color={focusedButton === 'open' ? 'success' : undefined} dimColor={focusedButton !== 'open'}>
              {' Reopen URL  '}
            </Text>
            <Text color="success">
              {focusedButton === 'action' ? figures.pointer : ' '}
            </Text>
            <Text bold={focusedButton === 'action'} color={focusedButton === 'action' ? 'success' : undefined} dimColor={focusedButton !== 'action'}>
              {` ${actionLabel}`}
            </Text>
            {showCancel && <>
                <Text> </Text>
                <Text color="error">
                  {focusedButton === 'cancel' ? figures.pointer : ' '}
                </Text>
                <Text bold={focusedButton === 'cancel'} color={focusedButton === 'cancel' ? 'error' : undefined} dimColor={focusedButton !== 'cancel'}>
                  {' Cancel'}
                </Text>
              </>}
          </Box>
        </Box>
      </Dialog>;
  }
  return <Dialog title={`MCP server \u201c${serverName}\u201d wants to open a URL`} subtitle={`\n${message}`} color="permission" onCancel={() => onResponse('cancel')} isCancelActive inputGuide={exitState_0 => exitState_0.pending ? <Text>Press {exitState_0.keyName} again to exit</Text> : <Byline>
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            <KeyboardShortcutHint shortcut="\u2190\u2192" action="switch" />
          </Byline>}>
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text>
            {urlBeforeDomain}
            <Text bold>{domain}</Text>
            {urlAfterDomain}
          </Text>
        </Box>
        <Box>
          <Text color="success">
            {focusedButton === 'accept' ? figures.pointer : ' '}
          </Text>
          <Text bold={focusedButton === 'accept'} color={focusedButton === 'accept' ? 'success' : undefined} dimColor={focusedButton !== 'accept'}>
            {' Accept  '}
          </Text>
          <Text color="error">
            {focusedButton === 'decline' ? figures.pointer : ' '}
          </Text>
          <Text bold={focusedButton === 'decline'} color={focusedButton === 'decline' ? 'error' : undefined} dimColor={focusedButton !== 'decline'}>
            {' Decline'}
          </Text>
        </Box>
      </Box>
    </Dialog>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJFbGljaXRSZXF1ZXN0Rm9ybVBhcmFtcyIsIkVsaWNpdFJlcXVlc3RVUkxQYXJhbXMiLCJFbGljaXRSZXN1bHQiLCJQcmltaXRpdmVTY2hlbWFEZWZpbml0aW9uIiwiZmlndXJlcyIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJ1c2VSZWdpc3Rlck92ZXJsYXkiLCJ1c2VOb3RpZnlBZnRlclRpbWVvdXQiLCJ1c2VUZXJtaW5hbFNpemUiLCJCb3giLCJUZXh0IiwidXNlSW5wdXQiLCJ1c2VLZXliaW5kaW5nIiwiRWxpY2l0YXRpb25SZXF1ZXN0RXZlbnQiLCJvcGVuQnJvd3NlciIsImdldEVudW1MYWJlbCIsImdldEVudW1WYWx1ZXMiLCJnZXRNdWx0aVNlbGVjdExhYmVsIiwiZ2V0TXVsdGlTZWxlY3RWYWx1ZXMiLCJpc0RhdGVUaW1lU2NoZW1hIiwiaXNFbnVtU2NoZW1hIiwiaXNNdWx0aVNlbGVjdEVudW1TY2hlbWEiLCJ2YWxpZGF0ZUVsaWNpdGF0aW9uSW5wdXQiLCJ2YWxpZGF0ZUVsaWNpdGF0aW9uSW5wdXRBc3luYyIsInBsdXJhbCIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIkRpYWxvZyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiVGV4dElucHV0IiwiUHJvcHMiLCJldmVudCIsIm9uUmVzcG9uc2UiLCJhY3Rpb24iLCJjb250ZW50Iiwib25XYWl0aW5nRGlzbWlzcyIsImlzVGV4dEZpZWxkIiwicyIsImluY2x1ZGVzIiwidHlwZSIsIlJFU09MVklOR19TUElOTkVSX0NIQVJTIiwiYWR2YW5jZVNwaW5uZXJGcmFtZSIsImYiLCJsZW5ndGgiLCJyZXNldFR5cGVhaGVhZCIsInRhIiwiYnVmZmVyIiwidGltZXIiLCJSZXR1cm5UeXBlIiwic2V0VGltZW91dCIsInVuZGVmaW5lZCIsIlJlc29sdmluZ1NwaW5uZXIiLCIkIiwiX2MiLCJmcmFtZSIsInNldEZyYW1lIiwidDAiLCJ0MSIsIlN5bWJvbCIsImZvciIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInQyIiwidDMiLCJmb3JtYXREYXRlRGlzcGxheSIsImlzb1ZhbHVlIiwic2NoZW1hIiwiZGF0ZSIsIkRhdGUiLCJOdW1iZXIiLCJpc05hTiIsImdldFRpbWUiLCJmb3JtYXQiLCJ0b0xvY2FsZURhdGVTdHJpbmciLCJ3ZWVrZGF5IiwieWVhciIsIm1vbnRoIiwiZGF5IiwiaG91ciIsIm1pbnV0ZSIsInRpbWVab25lTmFtZSIsInBhcnRzIiwic3BsaXQiLCJsb2NhbCIsIkVsaWNpdGF0aW9uRGlhbG9nIiwicGFyYW1zIiwibW9kZSIsIkVsaWNpdGF0aW9uRm9ybURpYWxvZyIsIlJlYWN0Tm9kZSIsInNlcnZlck5hbWUiLCJzaWduYWwiLCJyZXF1ZXN0IiwibWVzc2FnZSIsInJlcXVlc3RlZFNjaGVtYSIsImhhc0ZpZWxkcyIsIk9iamVjdCIsImtleXMiLCJwcm9wZXJ0aWVzIiwiZm9jdXNlZEJ1dHRvbiIsInNldEZvY3VzZWRCdXR0b24iLCJmb3JtVmFsdWVzIiwic2V0Rm9ybVZhbHVlcyIsIlJlY29yZCIsImluaXRpYWxWYWx1ZXMiLCJwcm9wTmFtZSIsInByb3BTY2hlbWEiLCJlbnRyaWVzIiwiZGVmYXVsdCIsInZhbGlkYXRpb25FcnJvcnMiLCJzZXRWYWxpZGF0aW9uRXJyb3JzIiwiaW5pdGlhbEVycm9ycyIsInZhbGlkYXRpb24iLCJTdHJpbmciLCJpc1ZhbGlkIiwiZXJyb3IiLCJoYW5kbGVBYm9ydCIsImFib3J0ZWQiLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInNjaGVtYUZpZWxkcyIsInJlcXVpcmVkRmllbGRzIiwicmVxdWlyZWQiLCJtYXAiLCJuYW1lIiwiaXNSZXF1aXJlZCIsImN1cnJlbnRGaWVsZEluZGV4Iiwic2V0Q3VycmVudEZpZWxkSW5kZXgiLCJ0ZXh0SW5wdXRWYWx1ZSIsInNldFRleHRJbnB1dFZhbHVlIiwiZmlyc3RGaWVsZCIsInZhbCIsInRleHRJbnB1dEN1cnNvck9mZnNldCIsInNldFRleHRJbnB1dEN1cnNvck9mZnNldCIsInJlc29sdmluZ0ZpZWxkcyIsInNldFJlc29sdmluZ0ZpZWxkcyIsIlNldCIsImV4cGFuZGVkQWNjb3JkaW9uIiwic2V0RXhwYW5kZWRBY2NvcmRpb24iLCJhY2NvcmRpb25PcHRpb25JbmRleCIsInNldEFjY29yZGlvbk9wdGlvbkluZGV4IiwiZGF0ZURlYm91bmNlUmVmIiwicmVzb2x2ZUFib3J0UmVmIiwiTWFwIiwiQWJvcnRDb250cm9sbGVyIiwiZW51bVR5cGVhaGVhZFJlZiIsImN1cnJlbnQiLCJjbGVhclRpbWVvdXQiLCJjb250cm9sbGVyIiwidmFsdWVzIiwiYWJvcnQiLCJjbGVhciIsImNvbHVtbnMiLCJyb3dzIiwiY3VycmVudEZpZWxkIiwiY3VycmVudEZpZWxkSXNUZXh0IiwiaXNFZGl0aW5nVGV4dEZpZWxkIiwic3luY1RleHRJbnB1dCIsImZpZWxkSW5kZXgiLCJmaWVsZCIsInRleHQiLCJ2YWxpZGF0ZU11bHRpU2VsZWN0IiwiZmllbGROYW1lIiwic2VsZWN0ZWQiLCJmaWVsZFJlcXVpcmVkIiwiZmluZCIsIm1pbiIsIm1pbkl0ZW1zIiwibWF4IiwibWF4SXRlbXMiLCJ1cGRhdGVWYWxpZGF0aW9uRXJyb3IiLCJoYW5kbGVOYXZpZ2F0aW9uIiwiZGlyZWN0aW9uIiwiY29tbWl0VGV4dEZpZWxkIiwidHJpbSIsInJlc29sdmVGaWVsZEFzeW5jIiwiaXRlbUNvdW50IiwiaW5kZXgiLCJuZXh0SW5kZXgiLCJzZXRGaWVsZCIsInZhbHVlIiwicHJldiIsIm5leHQiLCJ1bnNldEZpZWxkIiwidHJpbW1lZFZhbHVlIiwicmF3VmFsdWUiLCJleGlzdGluZyIsImdldCIsInNldCIsImFkZCIsInRoZW4iLCJyZXN1bHQiLCJkZWxldGUiLCJpc29UZXh0IiwiaGFuZGxlVGV4dElucHV0Q2hhbmdlIiwibmV3VmFsdWUiLCJoYW5kbGVUZXh0SW5wdXRTdWJtaXQiLCJydW5UeXBlYWhlYWQiLCJjaGFyIiwibGFiZWxzIiwib25NYXRjaCIsInRvTG93ZXJDYXNlIiwibWF0Y2giLCJmaW5kSW5kZXgiLCJsIiwic3RhcnRzV2l0aCIsImNvbnRleHQiLCJpc0FjdGl2ZSIsIl9pbnB1dCIsImtleSIsInVwQXJyb3ciLCJkb3duQXJyb3ciLCJyZXR1cm4iLCJiYWNrc3BhY2UiLCJtc1NjaGVtYSIsIm1zVmFsdWVzIiwibGVmdEFycm93IiwiZXNjYXBlIiwib3B0aW9uVmFsdWUiLCJuZXdTZWxlY3RlZCIsImZpbHRlciIsInYiLCJlbnVtU2NoZW1hIiwiZW51bVZhbHVlcyIsInZhbGlkYXRlUmVxdWlyZWQiLCJmaXJzdEJhZEluZGV4IiwicmlnaHRBcnJvdyIsImkiLCJzdGFydElkeCIsInZhbHMiLCJNYXRoIiwiaW5kZXhPZiIsIkFycmF5IiwiaXNBcnJheSIsIkxJTkVTX1BFUl9GSUVMRCIsIkRJQUxPR19PVkVSSEVBRCIsIm1heFZpc2libGVGaWVsZHMiLCJmbG9vciIsInNjcm9sbFdpbmRvdyIsInRvdGFsIiwic3RhcnQiLCJlbmQiLCJmb2N1c0lkeCIsImhhc0ZpZWxkc0Fib3ZlIiwiaGFzRmllbGRzQmVsb3ciLCJyZW5kZXJGb3JtRmllbGRzIiwiYXJyb3dVcCIsInNsaWNlIiwidmlzaWJsZUlkeCIsImhhc1ZhbHVlIiwiaXNSZXNvbHZpbmciLCJoYXMiLCJjaGVja2JveCIsIndhcm5pbmciLCJ0aWNrIiwic2VsZWN0aW9uQ29sb3IiLCJhY3RpdmVDb2xvciIsImxhYmVsIiwidGl0bGUiLCJ2YWx1ZUNvbnRlbnQiLCJhY2NvcmRpb25Db250ZW50IiwiaXNFeHBhbmRlZCIsInRyaWFuZ2xlRG93blNtYWxsIiwib3B0VmFsIiwib3B0SWR4Iiwib3B0TGFiZWwiLCJpc0NoZWNrZWQiLCJpc0ZvY3VzZWQiLCJwb2ludGVyIiwiY2hlY2tib3hPbiIsImNoZWNrYm94T2ZmIiwiYXJyb3ciLCJ0cmlhbmdsZVJpZ2h0U21hbGwiLCJkaXNwbGF5TGFiZWxzIiwiam9pbiIsImlzU2VsZWN0ZWQiLCJyYWRpb09uIiwicmFkaW9PZmYiLCJkaXNwbGF5VmFsdWUiLCJkZXNjcmlwdGlvbiIsImFycm93RG93biIsImV4aXRTdGF0ZSIsInBlbmRpbmciLCJrZXlOYW1lIiwiRWxpY2l0YXRpb25VUkxEaWFsb2ciLCJ3YWl0aW5nU3RhdGUiLCJ1cmxQYXJhbXMiLCJ1cmwiLCJwaGFzZSIsInNldFBoYXNlIiwicGhhc2VSZWYiLCJzaG93Q2FuY2VsIiwib25XYWl0aW5nRGlzbWlzc1JlZiIsImRvbWFpbiIsInVybEJlZm9yZURvbWFpbiIsInVybEFmdGVyRG9tYWluIiwicGFyc2VkIiwiVVJMIiwiaG9zdG5hbWUiLCJkb21haW5TdGFydCIsImNvbXBsZXRlZCIsImhhbmRsZUFjY2VwdCIsIkJ1dHRvbk5hbWUiLCJ3YWl0aW5nQnV0dG9ucyIsImlkeCIsImRlbHRhIiwiYWN0aW9uTGFiZWwiXSwic291cmNlcyI6WyJFbGljaXRhdGlvbkRpYWxvZy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUge1xuICBFbGljaXRSZXF1ZXN0Rm9ybVBhcmFtcyxcbiAgRWxpY2l0UmVxdWVzdFVSTFBhcmFtcyxcbiAgRWxpY2l0UmVzdWx0LFxuICBQcmltaXRpdmVTY2hlbWFEZWZpbml0aW9uLFxufSBmcm9tICdAbW9kZWxjb250ZXh0cHJvdG9jb2wvc2RrL3R5cGVzLmpzJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VSZWdpc3Rlck92ZXJsYXkgfSBmcm9tICcuLi8uLi9jb250ZXh0L292ZXJsYXlDb250ZXh0LmpzJ1xuaW1wb3J0IHsgdXNlTm90aWZ5QWZ0ZXJUaW1lb3V0IH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlTm90aWZ5QWZ0ZXJUaW1lb3V0LmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIHJhdyB0ZXh0IGlucHV0IGZvciBlbGljaXRhdGlvbiBmb3JtXG5pbXBvcnQgeyBCb3gsIFRleHQsIHVzZUlucHV0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZyB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgdHlwZSB7IEVsaWNpdGF0aW9uUmVxdWVzdEV2ZW50IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWNwL2VsaWNpdGF0aW9uSGFuZGxlci5qcydcbmltcG9ydCB7IG9wZW5Ccm93c2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnJvd3Nlci5qcydcbmltcG9ydCB7XG4gIGdldEVudW1MYWJlbCxcbiAgZ2V0RW51bVZhbHVlcyxcbiAgZ2V0TXVsdGlTZWxlY3RMYWJlbCxcbiAgZ2V0TXVsdGlTZWxlY3RWYWx1ZXMsXG4gIGlzRGF0ZVRpbWVTY2hlbWEsXG4gIGlzRW51bVNjaGVtYSxcbiAgaXNNdWx0aVNlbGVjdEVudW1TY2hlbWEsXG4gIHZhbGlkYXRlRWxpY2l0YXRpb25JbnB1dCxcbiAgdmFsaWRhdGVFbGljaXRhdGlvbklucHV0QXN5bmMsXG59IGZyb20gJy4uLy4uL3V0aWxzL21jcC9lbGljaXRhdGlvblZhbGlkYXRpb24uanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi8uLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCB9IGZyb20gJy4uL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBLZXlib2FyZFNob3J0Y3V0SGludCB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vS2V5Ym9hcmRTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgVGV4dElucHV0IGZyb20gJy4uL1RleHRJbnB1dC5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgZXZlbnQ6IEVsaWNpdGF0aW9uUmVxdWVzdEV2ZW50XG4gIG9uUmVzcG9uc2U6IChcbiAgICBhY3Rpb246IEVsaWNpdFJlc3VsdFsnYWN0aW9uJ10sXG4gICAgY29udGVudD86IEVsaWNpdFJlc3VsdFsnY29udGVudCddLFxuICApID0+IHZvaWRcbiAgLyoqIENhbGxlZCB3aGVuIHRoZSBwaGFzZSAyIHdhaXRpbmcgc3RhdGUgaXMgZGlzbWlzc2VkIChVUkwgZWxpY2l0YXRpb25zIG9ubHkpLiAqL1xuICBvbldhaXRpbmdEaXNtaXNzPzogKGFjdGlvbjogJ2Rpc21pc3MnIHwgJ3JldHJ5JyB8ICdjYW5jZWwnKSA9PiB2b2lkXG59XG5cbmNvbnN0IGlzVGV4dEZpZWxkID0gKHM6IFByaW1pdGl2ZVNjaGVtYURlZmluaXRpb24pID0+XG4gIFsnc3RyaW5nJywgJ251bWJlcicsICdpbnRlZ2VyJ10uaW5jbHVkZXMocy50eXBlKVxuXG5jb25zdCBSRVNPTFZJTkdfU1BJTk5FUl9DSEFSUyA9XG4gICdcXHUyODBCXFx1MjgxOVxcdTI4MzlcXHUyODM4XFx1MjgzQ1xcdTI4MzRcXHUyODI2XFx1MjgyN1xcdTI4MDdcXHUyODBGJ1xuY29uc3QgYWR2YW5jZVNwaW5uZXJGcmFtZSA9IChmOiBudW1iZXIpID0+XG4gIChmICsgMSkgJSBSRVNPTFZJTkdfU1BJTk5FUl9DSEFSUy5sZW5ndGhcblxuLyoqIFRpbWVyIGNhbGxiYWNrIGZvciBlbnVtVHlwZWFoZWFkUmVmIOKAlCBtb2R1bGUtc2NvcGUgdG8gYXZvaWQgY2xvc3VyZSBjYXB0dXJlLiAqL1xuZnVuY3Rpb24gcmVzZXRUeXBlYWhlYWQodGE6IHtcbiAgYnVmZmVyOiBzdHJpbmdcbiAgdGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkXG59KTogdm9pZCB7XG4gIHRhLmJ1ZmZlciA9ICcnXG4gIHRhLnRpbWVyID0gdW5kZWZpbmVkXG59XG5cbi8qKlxuICogSXNvbGF0ZWQgc3Bpbm5lciBnbHlwaCBmb3IgYSBmaWVsZCB0aGF0IGlzIGJlaW5nIHJlc29sdmVkIGFzeW5jaHJvbm91c2x5LlxuICogT3ducyBpdHMgb3duIDgwbXMgYW5pbWF0aW9uIHRpbWVyIHNvIHRpY2tzIG9ubHkgcmUtcmVuZGVyIHRoaXMgdGlueSBsZWFmLFxuICogbm90IHRoZSBlbnRpcmUgRWxpY2l0YXRpb25Gb3JtRGlhbG9nICh+MTIwMCBsaW5lcyArIHJlbmRlckZvcm1GaWVsZHMpLlxuICogTW91bnRlZC91bm1vdW50ZWQgYnkgdGhlIHBhcmVudCB2aWEgdGhlIGBpc1Jlc29sdmluZ2AgY29uZGl0aW9uLlxuICpcbiAqIE5vdCB1c2luZyB0aGUgc2hhcmVkIDxTcGlubmVyIC8+IGZyb20gLi4vU3Bpbm5lci5qczogdGhhdCBvbmUgcmVuZGVycyBpbiBhXG4gKiA8Qm94IHdpZHRoPXsyfT4gd2l0aCBjb2xvcj1cInRleHRcIiwgd2hpY2ggd291bGQgYnJlYWsgdGhlIDEtY29sIGNoZWNrYm94XG4gKiBjb2x1bW4gYWxpZ25tZW50IGhlcmUgKG90aGVyIGNoZWNrYm94IHN0YXRlcyBhcmUgd2lkdGgtMSBnbHlwaHMpLlxuICovXG5mdW5jdGlvbiBSZXNvbHZpbmdTcGlubmVyKCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtmcmFtZSwgc2V0RnJhbWVdID0gdXNlU3RhdGUoMClcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCB0aW1lciA9IHNldEludGVydmFsKHNldEZyYW1lLCA4MCwgYWR2YW5jZVNwaW5uZXJGcmFtZSlcbiAgICByZXR1cm4gKCkgPT4gY2xlYXJJbnRlcnZhbCh0aW1lcilcbiAgfSwgW10pXG4gIHJldHVybiA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj57UkVTT0xWSU5HX1NQSU5ORVJfQ0hBUlNbZnJhbWVdfTwvVGV4dD5cbn1cblxuLyoqIEZvcm1hdCBhbiBJU08gZGF0ZS9kYXRldGltZSBmb3IgZGlzcGxheSwga2VlcGluZyB0aGUgSVNPIHZhbHVlIGZvciBzdWJtaXNzaW9uLiAqL1xuZnVuY3Rpb24gZm9ybWF0RGF0ZURpc3BsYXkoXG4gIGlzb1ZhbHVlOiBzdHJpbmcsXG4gIHNjaGVtYTogUHJpbWl0aXZlU2NoZW1hRGVmaW5pdGlvbixcbik6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGlzb1ZhbHVlKVxuICAgIGlmIChOdW1iZXIuaXNOYU4oZGF0ZS5nZXRUaW1lKCkpKSByZXR1cm4gaXNvVmFsdWVcbiAgICBjb25zdCBmb3JtYXQgPSAnZm9ybWF0JyBpbiBzY2hlbWEgPyBzY2hlbWEuZm9ybWF0IDogdW5kZWZpbmVkXG4gICAgaWYgKGZvcm1hdCA9PT0gJ2RhdGUtdGltZScpIHtcbiAgICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tVVMnLCB7XG4gICAgICAgIHdlZWtkYXk6ICdzaG9ydCcsXG4gICAgICAgIHllYXI6ICdudW1lcmljJyxcbiAgICAgICAgbW9udGg6ICdzaG9ydCcsXG4gICAgICAgIGRheTogJ251bWVyaWMnLFxuICAgICAgICBob3VyOiAnbnVtZXJpYycsXG4gICAgICAgIG1pbnV0ZTogJzItZGlnaXQnLFxuICAgICAgICB0aW1lWm9uZU5hbWU6ICdzaG9ydCcsXG4gICAgICB9KVxuICAgIH1cbiAgICAvLyBkYXRlLW9ubHk6IHBhcnNlIGFzIGxvY2FsIGRhdGUgdG8gYXZvaWQgdGltZXpvbmUgc2hpZnRcbiAgICBjb25zdCBwYXJ0cyA9IGlzb1ZhbHVlLnNwbGl0KCctJylcbiAgICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XG4gICAgICBjb25zdCBsb2NhbCA9IG5ldyBEYXRlKFxuICAgICAgICBOdW1iZXIocGFydHNbMF0pLFxuICAgICAgICBOdW1iZXIocGFydHNbMV0pIC0gMSxcbiAgICAgICAgTnVtYmVyKHBhcnRzWzJdKSxcbiAgICAgIClcbiAgICAgIHJldHVybiBsb2NhbC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLVVTJywge1xuICAgICAgICB3ZWVrZGF5OiAnc2hvcnQnLFxuICAgICAgICB5ZWFyOiAnbnVtZXJpYycsXG4gICAgICAgIG1vbnRoOiAnc2hvcnQnLFxuICAgICAgICBkYXk6ICdudW1lcmljJyxcbiAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiBpc29WYWx1ZVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gaXNvVmFsdWVcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gRWxpY2l0YXRpb25EaWFsb2coe1xuICBldmVudCxcbiAgb25SZXNwb25zZSxcbiAgb25XYWl0aW5nRGlzbWlzcyxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgaWYgKGV2ZW50LnBhcmFtcy5tb2RlID09PSAndXJsJykge1xuICAgIHJldHVybiAoXG4gICAgICA8RWxpY2l0YXRpb25VUkxEaWFsb2dcbiAgICAgICAgZXZlbnQ9e2V2ZW50fVxuICAgICAgICBvblJlc3BvbnNlPXtvblJlc3BvbnNlfVxuICAgICAgICBvbldhaXRpbmdEaXNtaXNzPXtvbldhaXRpbmdEaXNtaXNzfVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICByZXR1cm4gPEVsaWNpdGF0aW9uRm9ybURpYWxvZyBldmVudD17ZXZlbnR9IG9uUmVzcG9uc2U9e29uUmVzcG9uc2V9IC8+XG59XG5cbmZ1bmN0aW9uIEVsaWNpdGF0aW9uRm9ybURpYWxvZyh7XG4gIGV2ZW50LFxuICBvblJlc3BvbnNlLFxufToge1xuICBldmVudDogRWxpY2l0YXRpb25SZXF1ZXN0RXZlbnRcbiAgb25SZXNwb25zZTogUHJvcHNbJ29uUmVzcG9uc2UnXVxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgc2VydmVyTmFtZSwgc2lnbmFsIH0gPSBldmVudFxuICBjb25zdCByZXF1ZXN0ID0gZXZlbnQucGFyYW1zIGFzIEVsaWNpdFJlcXVlc3RGb3JtUGFyYW1zXG4gIGNvbnN0IHsgbWVzc2FnZSwgcmVxdWVzdGVkU2NoZW1hIH0gPSByZXF1ZXN0XG4gIGNvbnN0IGhhc0ZpZWxkcyA9IE9iamVjdC5rZXlzKHJlcXVlc3RlZFNjaGVtYS5wcm9wZXJ0aWVzKS5sZW5ndGggPiAwXG4gIGNvbnN0IFtmb2N1c2VkQnV0dG9uLCBzZXRGb2N1c2VkQnV0dG9uXSA9IHVzZVN0YXRlPFxuICAgICdhY2NlcHQnIHwgJ2RlY2xpbmUnIHwgbnVsbFxuICA+KGhhc0ZpZWxkcyA/IG51bGwgOiAnYWNjZXB0JylcbiAgY29uc3QgW2Zvcm1WYWx1ZXMsIHNldEZvcm1WYWx1ZXNdID0gdXNlU3RhdGU8XG4gICAgUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB8IHN0cmluZ1tdPlxuICA+KCgpID0+IHtcbiAgICBjb25zdCBpbml0aWFsVmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHwgc3RyaW5nW10+ID1cbiAgICAgIHt9XG4gICAgaWYgKHJlcXVlc3RlZFNjaGVtYS5wcm9wZXJ0aWVzKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwcm9wTmFtZSwgcHJvcFNjaGVtYV0gb2YgT2JqZWN0LmVudHJpZXMoXG4gICAgICAgIHJlcXVlc3RlZFNjaGVtYS5wcm9wZXJ0aWVzLFxuICAgICAgKSkge1xuICAgICAgICBpZiAodHlwZW9mIHByb3BTY2hlbWEgPT09ICdvYmplY3QnICYmIHByb3BTY2hlbWEgIT09IG51bGwpIHtcbiAgICAgICAgICBpZiAocHJvcFNjaGVtYS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGluaXRpYWxWYWx1ZXNbcHJvcE5hbWVdID0gcHJvcFNjaGVtYS5kZWZhdWx0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbml0aWFsVmFsdWVzXG4gIH0pXG5cbiAgY29uc3QgW3ZhbGlkYXRpb25FcnJvcnMsIHNldFZhbGlkYXRpb25FcnJvcnNdID0gdXNlU3RhdGU8XG4gICAgUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICA+KCgpID0+IHtcbiAgICBjb25zdCBpbml0aWFsRXJyb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICBmb3IgKGNvbnN0IFtwcm9wTmFtZSwgcHJvcFNjaGVtYV0gb2YgT2JqZWN0LmVudHJpZXMoXG4gICAgICByZXF1ZXN0ZWRTY2hlbWEucHJvcGVydGllcyxcbiAgICApKSB7XG4gICAgICBpZiAoaXNUZXh0RmllbGQocHJvcFNjaGVtYSkgJiYgcHJvcFNjaGVtYT8uZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb24gPSB2YWxpZGF0ZUVsaWNpdGF0aW9uSW5wdXQoXG4gICAgICAgICAgU3RyaW5nKHByb3BTY2hlbWEuZGVmYXVsdCksXG4gICAgICAgICAgcHJvcFNjaGVtYSxcbiAgICAgICAgKVxuICAgICAgICBpZiAoIXZhbGlkYXRpb24uaXNWYWxpZCAmJiB2YWxpZGF0aW9uLmVycm9yKSB7XG4gICAgICAgICAgaW5pdGlhbEVycm9yc1twcm9wTmFtZV0gPSB2YWxpZGF0aW9uLmVycm9yXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluaXRpYWxFcnJvcnNcbiAgfSlcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghc2lnbmFsKSByZXR1cm5cblxuICAgIGNvbnN0IGhhbmRsZUFib3J0ID0gKCkgPT4ge1xuICAgICAgb25SZXNwb25zZSgnY2FuY2VsJylcbiAgICB9XG5cbiAgICBpZiAoc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgIGhhbmRsZUFib3J0KClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGhhbmRsZUFib3J0KVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBoYW5kbGVBYm9ydClcbiAgICB9XG4gIH0sIFtzaWduYWwsIG9uUmVzcG9uc2VdKVxuXG4gIGNvbnN0IHNjaGVtYUZpZWxkcyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHJlcXVpcmVkRmllbGRzID0gcmVxdWVzdGVkU2NoZW1hLnJlcXVpcmVkID8/IFtdXG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHJlcXVlc3RlZFNjaGVtYS5wcm9wZXJ0aWVzKS5tYXAoKFtuYW1lLCBzY2hlbWFdKSA9PiAoe1xuICAgICAgbmFtZSxcbiAgICAgIHNjaGVtYSxcbiAgICAgIGlzUmVxdWlyZWQ6IHJlcXVpcmVkRmllbGRzLmluY2x1ZGVzKG5hbWUpLFxuICAgIH0pKVxuICB9LCBbcmVxdWVzdGVkU2NoZW1hXSlcblxuICBjb25zdCBbY3VycmVudEZpZWxkSW5kZXgsIHNldEN1cnJlbnRGaWVsZEluZGV4XSA9IHVzZVN0YXRlPFxuICAgIG51bWJlciB8IHVuZGVmaW5lZFxuICA+KGhhc0ZpZWxkcyA/IDAgOiB1bmRlZmluZWQpXG4gIGNvbnN0IFt0ZXh0SW5wdXRWYWx1ZSwgc2V0VGV4dElucHV0VmFsdWVdID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIC8vIEluaXRpYWxpemUgZnJvbSB0aGUgZmlyc3QgZmllbGQncyB2YWx1ZSBpZiBpdCdzIGEgdGV4dCBmaWVsZFxuICAgIGNvbnN0IGZpcnN0RmllbGQgPSBzY2hlbWFGaWVsZHNbMF1cbiAgICBpZiAoZmlyc3RGaWVsZCAmJiBpc1RleHRGaWVsZChmaXJzdEZpZWxkLnNjaGVtYSkpIHtcbiAgICAgIGNvbnN0IHZhbCA9IGZvcm1WYWx1ZXNbZmlyc3RGaWVsZC5uYW1lXVxuICAgICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJydcbiAgICAgIHJldHVybiBTdHJpbmcodmFsKVxuICAgIH1cbiAgICByZXR1cm4gJydcbiAgfSlcbiAgY29uc3QgW3RleHRJbnB1dEN1cnNvck9mZnNldCwgc2V0VGV4dElucHV0Q3Vyc29yT2Zmc2V0XSA9IHVzZVN0YXRlKFxuICAgIHRleHRJbnB1dFZhbHVlLmxlbmd0aCxcbiAgKVxuICBjb25zdCBbcmVzb2x2aW5nRmllbGRzLCBzZXRSZXNvbHZpbmdGaWVsZHNdID0gdXNlU3RhdGU8U2V0PHN0cmluZz4+KFxuICAgICgpID0+IG5ldyBTZXQoKSxcbiAgKVxuICAvLyBBY2NvcmRpb24gc3RhdGUgKHNoYXJlZCBieSBtdWx0aS1zZWxlY3QgYW5kIHNpbmdsZS1zZWxlY3QgZW51bSlcbiAgY29uc3QgW2V4cGFuZGVkQWNjb3JkaW9uLCBzZXRFeHBhbmRlZEFjY29yZGlvbl0gPSB1c2VTdGF0ZTxcbiAgICBzdHJpbmcgfCB1bmRlZmluZWRcbiAgPigpXG4gIGNvbnN0IFthY2NvcmRpb25PcHRpb25JbmRleCwgc2V0QWNjb3JkaW9uT3B0aW9uSW5kZXhdID0gdXNlU3RhdGUoMClcblxuICBjb25zdCBkYXRlRGVib3VuY2VSZWYgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQ+KFxuICAgIHVuZGVmaW5lZCxcbiAgKVxuICBjb25zdCByZXNvbHZlQWJvcnRSZWYgPSB1c2VSZWY8TWFwPHN0cmluZywgQWJvcnRDb250cm9sbGVyPj4obmV3IE1hcCgpKVxuICBjb25zdCBlbnVtVHlwZWFoZWFkUmVmID0gdXNlUmVmKHtcbiAgICBidWZmZXI6ICcnLFxuICAgIHRpbWVyOiB1bmRlZmluZWQgYXMgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQsXG4gIH0pXG5cbiAgLy8gQ2xlYXIgcGVuZGluZyBkZWJvdW5jZS90eXBlYWhlYWQgdGltZXJzIGFuZCBhYm9ydCBpbi1mbGlnaHQgYXN5bmNcbiAgLy8gdmFsaWRhdGlvbnMgb24gdW5tb3VudCBzbyB0aGV5IGRvbid0IGZpcmUgYWdhaW5zdCBhbiB1bm1vdW50ZWQgY29tcG9uZW50XG4gIC8vIChlLmcuIGRpYWxvZyBkaXNtaXNzZWQgbWlkLWRlYm91bmNlIG9yIG1pZC1yZXNvbHZlKS5cbiAgdXNlRWZmZWN0KFxuICAgICgpID0+ICgpID0+IHtcbiAgICAgIGlmIChkYXRlRGVib3VuY2VSZWYuY3VycmVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChkYXRlRGVib3VuY2VSZWYuY3VycmVudClcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhID0gZW51bVR5cGVhaGVhZFJlZi5jdXJyZW50XG4gICAgICBpZiAodGEudGltZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGEudGltZXIpXG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNvbnRyb2xsZXIgb2YgcmVzb2x2ZUFib3J0UmVmLmN1cnJlbnQudmFsdWVzKCkpIHtcbiAgICAgICAgY29udHJvbGxlci5hYm9ydCgpXG4gICAgICB9XG4gICAgICByZXNvbHZlQWJvcnRSZWYuY3VycmVudC5jbGVhcigpXG4gICAgfSxcbiAgICBbXSxcbiAgKVxuXG4gIGNvbnN0IHsgY29sdW1ucywgcm93cyB9ID0gdXNlVGVybWluYWxTaXplKClcblxuICBjb25zdCBjdXJyZW50RmllbGQgPVxuICAgIGN1cnJlbnRGaWVsZEluZGV4ICE9PSB1bmRlZmluZWRcbiAgICAgID8gc2NoZW1hRmllbGRzW2N1cnJlbnRGaWVsZEluZGV4XVxuICAgICAgOiB1bmRlZmluZWRcbiAgY29uc3QgY3VycmVudEZpZWxkSXNUZXh0ID1cbiAgICBjdXJyZW50RmllbGQgIT09IHVuZGVmaW5lZCAmJlxuICAgIGlzVGV4dEZpZWxkKGN1cnJlbnRGaWVsZC5zY2hlbWEpICYmXG4gICAgIWlzRW51bVNjaGVtYShjdXJyZW50RmllbGQuc2NoZW1hKVxuXG4gIC8vIFRleHQgZmllbGRzIGFyZSBhbHdheXMgaW4gZWRpdCBtb2RlIHdoZW4gZm9jdXNlZCDigJQgbm8gRW50ZXItdG8tZWRpdCBzdGVwLlxuICBjb25zdCBpc0VkaXRpbmdUZXh0RmllbGQgPSBjdXJyZW50RmllbGRJc1RleHQgJiYgIWZvY3VzZWRCdXR0b25cblxuICB1c2VSZWdpc3Rlck92ZXJsYXkoJ2VsaWNpdGF0aW9uJylcbiAgdXNlTm90aWZ5QWZ0ZXJUaW1lb3V0KCdDbGF1ZGUgQ29kZSBuZWVkcyB5b3VyIGlucHV0JywgJ2VsaWNpdGF0aW9uX2RpYWxvZycpXG5cbiAgLy8gU3luYyB0ZXh0SW5wdXRWYWx1ZSB3aGVuIHRoZSBmb2N1c2VkIGZpZWxkIGNoYW5nZXNcbiAgY29uc3Qgc3luY1RleHRJbnB1dCA9IHVzZUNhbGxiYWNrKFxuICAgIChmaWVsZEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgIGlmIChmaWVsZEluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2V0VGV4dElucHV0VmFsdWUoJycpXG4gICAgICAgIHNldFRleHRJbnB1dEN1cnNvck9mZnNldCgwKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGNvbnN0IGZpZWxkID0gc2NoZW1hRmllbGRzW2ZpZWxkSW5kZXhdXG4gICAgICBpZiAoZmllbGQgJiYgaXNUZXh0RmllbGQoZmllbGQuc2NoZW1hKSAmJiAhaXNFbnVtU2NoZW1hKGZpZWxkLnNjaGVtYSkpIHtcbiAgICAgICAgY29uc3QgdmFsID0gZm9ybVZhbHVlc1tmaWVsZC5uYW1lXVxuICAgICAgICBjb25zdCB0ZXh0ID0gdmFsICE9PSB1bmRlZmluZWQgPyBTdHJpbmcodmFsKSA6ICcnXG4gICAgICAgIHNldFRleHRJbnB1dFZhbHVlKHRleHQpXG4gICAgICAgIHNldFRleHRJbnB1dEN1cnNvck9mZnNldCh0ZXh0Lmxlbmd0aClcbiAgICAgIH1cbiAgICB9LFxuICAgIFtzY2hlbWFGaWVsZHMsIGZvcm1WYWx1ZXNdLFxuICApXG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVNdWx0aVNlbGVjdChcbiAgICBmaWVsZE5hbWU6IHN0cmluZyxcbiAgICBzY2hlbWE6IFByaW1pdGl2ZVNjaGVtYURlZmluaXRpb24sXG4gICkge1xuICAgIGlmICghaXNNdWx0aVNlbGVjdEVudW1TY2hlbWEoc2NoZW1hKSkgcmV0dXJuXG4gICAgY29uc3Qgc2VsZWN0ZWQgPSAoZm9ybVZhbHVlc1tmaWVsZE5hbWVdIGFzIHN0cmluZ1tdIHwgdW5kZWZpbmVkKSA/PyBbXVxuICAgIGNvbnN0IGZpZWxkUmVxdWlyZWQgPVxuICAgICAgc2NoZW1hRmllbGRzLmZpbmQoZiA9PiBmLm5hbWUgPT09IGZpZWxkTmFtZSk/LmlzUmVxdWlyZWQgPz8gZmFsc2VcbiAgICBjb25zdCBtaW4gPSBzY2hlbWEubWluSXRlbXNcbiAgICBjb25zdCBtYXggPSBzY2hlbWEubWF4SXRlbXNcbiAgICAvLyBTa2lwIG1pbkl0ZW1zIGNoZWNrIHdoZW4gZmllbGQgaXMgb3B0aW9uYWwgYW5kIHVuc2V0XG4gICAgaWYgKFxuICAgICAgbWluICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHNlbGVjdGVkLmxlbmd0aCA8IG1pbiAmJlxuICAgICAgKHNlbGVjdGVkLmxlbmd0aCA+IDAgfHwgZmllbGRSZXF1aXJlZClcbiAgICApIHtcbiAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgZmllbGROYW1lLFxuICAgICAgICBgU2VsZWN0IGF0IGxlYXN0ICR7bWlufSAke3BsdXJhbChtaW4sICdpdGVtJyl9YCxcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKG1heCAhPT0gdW5kZWZpbmVkICYmIHNlbGVjdGVkLmxlbmd0aCA+IG1heCkge1xuICAgICAgdXBkYXRlVmFsaWRhdGlvbkVycm9yKFxuICAgICAgICBmaWVsZE5hbWUsXG4gICAgICAgIGBTZWxlY3QgYXQgbW9zdCAke21heH0gJHtwbHVyYWwobWF4LCAnaXRlbScpfWAsXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihmaWVsZE5hbWUpXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlTmF2aWdhdGlvbihkaXJlY3Rpb246ICd1cCcgfCAnZG93bicpOiB2b2lkIHtcbiAgICAvLyBDb2xsYXBzZSBhY2NvcmRpb24gYW5kIHZhbGlkYXRlIG9uIG5hdmlnYXRlIGF3YXlcbiAgICBpZiAoY3VycmVudEZpZWxkICYmIGlzTXVsdGlTZWxlY3RFbnVtU2NoZW1hKGN1cnJlbnRGaWVsZC5zY2hlbWEpKSB7XG4gICAgICB2YWxpZGF0ZU11bHRpU2VsZWN0KGN1cnJlbnRGaWVsZC5uYW1lLCBjdXJyZW50RmllbGQuc2NoZW1hKVxuICAgICAgc2V0RXhwYW5kZWRBY2NvcmRpb24odW5kZWZpbmVkKVxuICAgIH0gZWxzZSBpZiAoY3VycmVudEZpZWxkICYmIGlzRW51bVNjaGVtYShjdXJyZW50RmllbGQuc2NoZW1hKSkge1xuICAgICAgc2V0RXhwYW5kZWRBY2NvcmRpb24odW5kZWZpbmVkKVxuICAgIH1cblxuICAgIC8vIENvbW1pdCBjdXJyZW50IHRleHQgZmllbGQgYmVmb3JlIG5hdmlnYXRpbmcgYXdheVxuICAgIGlmIChpc0VkaXRpbmdUZXh0RmllbGQgJiYgY3VycmVudEZpZWxkKSB7XG4gICAgICBjb21taXRUZXh0RmllbGQoY3VycmVudEZpZWxkLm5hbWUsIGN1cnJlbnRGaWVsZC5zY2hlbWEsIHRleHRJbnB1dFZhbHVlKVxuXG4gICAgICAvLyBDYW5jZWwgYW55IHBlbmRpbmcgZGVib3VuY2Ug4oCUIHdlJ3JlIHJlc29sdmluZyBub3cgb24gbmF2aWdhdGUtYXdheVxuICAgICAgaWYgKGRhdGVEZWJvdW5jZVJlZi5jdXJyZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGRhdGVEZWJvdW5jZVJlZi5jdXJyZW50KVxuICAgICAgICBkYXRlRGVib3VuY2VSZWYuY3VycmVudCA9IHVuZGVmaW5lZFxuICAgICAgfVxuXG4gICAgICAvLyBGb3IgZGF0ZS9kYXRldGltZSBmaWVsZHMgdGhhdCBmYWlsZWQgc3luYyB2YWxpZGF0aW9uLCB0cnkgYXN5bmMgTkwgcGFyc2luZ1xuICAgICAgaWYgKFxuICAgICAgICBpc0RhdGVUaW1lU2NoZW1hKGN1cnJlbnRGaWVsZC5zY2hlbWEpICYmXG4gICAgICAgIHRleHRJbnB1dFZhbHVlLnRyaW0oKSAhPT0gJycgJiZcbiAgICAgICAgdmFsaWRhdGlvbkVycm9yc1tjdXJyZW50RmllbGQubmFtZV1cbiAgICAgICkge1xuICAgICAgICByZXNvbHZlRmllbGRBc3luYyhcbiAgICAgICAgICBjdXJyZW50RmllbGQubmFtZSxcbiAgICAgICAgICBjdXJyZW50RmllbGQuc2NoZW1hLFxuICAgICAgICAgIHRleHRJbnB1dFZhbHVlLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmllbGRzICsgYWNjZXB0ICsgZGVjbGluZVxuICAgIGNvbnN0IGl0ZW1Db3VudCA9IHNjaGVtYUZpZWxkcy5sZW5ndGggKyAyXG4gICAgY29uc3QgaW5kZXggPVxuICAgICAgY3VycmVudEZpZWxkSW5kZXggPz9cbiAgICAgIChmb2N1c2VkQnV0dG9uID09PSAnYWNjZXB0J1xuICAgICAgICA/IHNjaGVtYUZpZWxkcy5sZW5ndGhcbiAgICAgICAgOiBmb2N1c2VkQnV0dG9uID09PSAnZGVjbGluZSdcbiAgICAgICAgICA/IHNjaGVtYUZpZWxkcy5sZW5ndGggKyAxXG4gICAgICAgICAgOiB1bmRlZmluZWQpXG4gICAgY29uc3QgbmV4dEluZGV4ID1cbiAgICAgIGluZGV4ICE9PSB1bmRlZmluZWRcbiAgICAgICAgPyAoaW5kZXggKyAoZGlyZWN0aW9uID09PSAndXAnID8gaXRlbUNvdW50IC0gMSA6IDEpKSAlIGl0ZW1Db3VudFxuICAgICAgICA6IDBcbiAgICBpZiAobmV4dEluZGV4IDwgc2NoZW1hRmllbGRzLmxlbmd0aCkge1xuICAgICAgc2V0Q3VycmVudEZpZWxkSW5kZXgobmV4dEluZGV4KVxuICAgICAgc2V0Rm9jdXNlZEJ1dHRvbihudWxsKVxuICAgICAgc3luY1RleHRJbnB1dChuZXh0SW5kZXgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHNldEN1cnJlbnRGaWVsZEluZGV4KHVuZGVmaW5lZClcbiAgICAgIHNldEZvY3VzZWRCdXR0b24obmV4dEluZGV4ID09PSBzY2hlbWFGaWVsZHMubGVuZ3RoID8gJ2FjY2VwdCcgOiAnZGVjbGluZScpXG4gICAgICBzZXRUZXh0SW5wdXRWYWx1ZSgnJylcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXRGaWVsZChcbiAgICBmaWVsZE5hbWU6IHN0cmluZyxcbiAgICB2YWx1ZTogbnVtYmVyIHwgc3RyaW5nIHwgYm9vbGVhbiB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuICApIHtcbiAgICBzZXRGb3JtVmFsdWVzKHByZXYgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IHsgLi4ucHJldiB9XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkZWxldGUgbmV4dFtmaWVsZE5hbWVdXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0W2ZpZWxkTmFtZV0gPSB2YWx1ZVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9KVxuICAgIC8vIENsZWFyIFwicmVxdWlyZWRcIiBlcnJvciB3aGVuIGEgdmFsdWUgaXMgcHJvdmlkZWRcbiAgICBpZiAoXG4gICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB2YWxpZGF0aW9uRXJyb3JzW2ZpZWxkTmFtZV0gPT09ICdUaGlzIGZpZWxkIGlzIHJlcXVpcmVkJ1xuICAgICkge1xuICAgICAgdXBkYXRlVmFsaWRhdGlvbkVycm9yKGZpZWxkTmFtZSlcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVWYWxpZGF0aW9uRXJyb3IoZmllbGROYW1lOiBzdHJpbmcsIGVycm9yPzogc3RyaW5nKSB7XG4gICAgc2V0VmFsaWRhdGlvbkVycm9ycyhwcmV2ID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSB7IC4uLnByZXYgfVxuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIG5leHRbZmllbGROYW1lXSA9IGVycm9yXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgbmV4dFtmaWVsZE5hbWVdXG4gICAgICB9XG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiB1bnNldEZpZWxkKGZpZWxkTmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKCFmaWVsZE5hbWUpIHJldHVyblxuICAgIHNldEZpZWxkKGZpZWxkTmFtZSwgdW5kZWZpbmVkKVxuICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihmaWVsZE5hbWUpXG4gICAgc2V0VGV4dElucHV0VmFsdWUoJycpXG4gICAgc2V0VGV4dElucHV0Q3Vyc29yT2Zmc2V0KDApXG4gIH1cblxuICBmdW5jdGlvbiBjb21taXRUZXh0RmllbGQoXG4gICAgZmllbGROYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBQcmltaXRpdmVTY2hlbWFEZWZpbml0aW9uLFxuICAgIHZhbHVlOiBzdHJpbmcsXG4gICkge1xuICAgIGNvbnN0IHRyaW1tZWRWYWx1ZSA9IHZhbHVlLnRyaW0oKVxuXG4gICAgLy8gRW1wdHkgaW5wdXQgZm9yIG5vbi1wbGFpbi1zdHJpbmcgdHlwZXMgbWVhbnMgdW5zZXRcbiAgICBpZiAoXG4gICAgICB0cmltbWVkVmFsdWUgPT09ICcnICYmXG4gICAgICAoc2NoZW1hLnR5cGUgIT09ICdzdHJpbmcnIHx8XG4gICAgICAgICgnZm9ybWF0JyBpbiBzY2hlbWEgJiYgc2NoZW1hLmZvcm1hdCAhPT0gdW5kZWZpbmVkKSlcbiAgICApIHtcbiAgICAgIHVuc2V0RmllbGQoZmllbGROYW1lKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHRyaW1tZWRWYWx1ZSA9PT0gJycpIHtcbiAgICAgIC8vIEVtcHR5IHBsYWluIHN0cmluZyDigJQga2VlcCBvciB1bnNldCBkZXBlbmRpbmcgb24gd2hldGhlciBpdCB3YXMgc2V0XG4gICAgICBpZiAoZm9ybVZhbHVlc1tmaWVsZE5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2V0RmllbGQoZmllbGROYW1lLCAnJylcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHZhbGlkYXRpb24gPSB2YWxpZGF0ZUVsaWNpdGF0aW9uSW5wdXQodmFsdWUsIHNjaGVtYSlcbiAgICBzZXRGaWVsZChmaWVsZE5hbWUsIHZhbGlkYXRpb24uaXNWYWxpZCA/IHZhbGlkYXRpb24udmFsdWUgOiB2YWx1ZSlcbiAgICB1cGRhdGVWYWxpZGF0aW9uRXJyb3IoXG4gICAgICBmaWVsZE5hbWUsXG4gICAgICB2YWxpZGF0aW9uLmlzVmFsaWQgPyB1bmRlZmluZWQgOiB2YWxpZGF0aW9uLmVycm9yLFxuICAgIClcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVGaWVsZEFzeW5jKFxuICAgIGZpZWxkTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogUHJpbWl0aXZlU2NoZW1hRGVmaW5pdGlvbixcbiAgICByYXdWYWx1ZTogc3RyaW5nLFxuICApIHtcbiAgICBpZiAoIXNpZ25hbCkgcmV0dXJuXG5cbiAgICAvLyBBYm9ydCBhbnkgZXhpc3RpbmcgcmVzb2x1dGlvbiBmb3IgdGhpcyBmaWVsZFxuICAgIGNvbnN0IGV4aXN0aW5nID0gcmVzb2x2ZUFib3J0UmVmLmN1cnJlbnQuZ2V0KGZpZWxkTmFtZSlcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGV4aXN0aW5nLmFib3J0KClcbiAgICB9XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG4gICAgcmVzb2x2ZUFib3J0UmVmLmN1cnJlbnQuc2V0KGZpZWxkTmFtZSwgY29udHJvbGxlcilcblxuICAgIHNldFJlc29sdmluZ0ZpZWxkcyhwcmV2ID0+IG5ldyBTZXQocHJldikuYWRkKGZpZWxkTmFtZSkpXG5cbiAgICB2b2lkIHZhbGlkYXRlRWxpY2l0YXRpb25JbnB1dEFzeW5jKFxuICAgICAgcmF3VmFsdWUsXG4gICAgICBzY2hlbWEsXG4gICAgICBjb250cm9sbGVyLnNpZ25hbCxcbiAgICApLnRoZW4oXG4gICAgICByZXN1bHQgPT4ge1xuICAgICAgICByZXNvbHZlQWJvcnRSZWYuY3VycmVudC5kZWxldGUoZmllbGROYW1lKVxuICAgICAgICBzZXRSZXNvbHZpbmdGaWVsZHMocHJldiA9PiB7XG4gICAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgICBuZXh0LmRlbGV0ZShmaWVsZE5hbWUpXG4gICAgICAgICAgcmV0dXJuIG5leHRcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVyblxuXG4gICAgICAgIGlmIChyZXN1bHQuaXNWYWxpZCkge1xuICAgICAgICAgIHNldEZpZWxkKGZpZWxkTmFtZSwgcmVzdWx0LnZhbHVlKVxuICAgICAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihmaWVsZE5hbWUpXG4gICAgICAgICAgLy8gVXBkYXRlIHRoZSB0ZXh0IGlucHV0IGlmIHdlJ3JlIHN0aWxsIG9uIHRoaXMgZmllbGRcbiAgICAgICAgICBjb25zdCBpc29UZXh0ID0gU3RyaW5nKHJlc3VsdC52YWx1ZSlcbiAgICAgICAgICBzZXRUZXh0SW5wdXRWYWx1ZShwcmV2ID0+IHtcbiAgICAgICAgICAgIC8vIE9ubHkgcmVwbGFjZSBpZiB0aGUgZmllbGQgaXMgc3RpbGwgc2hvd2luZyB0aGUgcmF3IGlucHV0XG4gICAgICAgICAgICBpZiAocHJldiA9PT0gcmF3VmFsdWUpIHtcbiAgICAgICAgICAgICAgc2V0VGV4dElucHV0Q3Vyc29yT2Zmc2V0KGlzb1RleHQubGVuZ3RoKVxuICAgICAgICAgICAgICByZXR1cm4gaXNvVGV4dFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByZXZcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEtlZXAgcmF3IHRleHQsIHNob3cgdmFsaWRhdGlvbiBlcnJvclxuICAgICAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihmaWVsZE5hbWUsIHJlc3VsdC5lcnJvcilcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZUFib3J0UmVmLmN1cnJlbnQuZGVsZXRlKGZpZWxkTmFtZSlcbiAgICAgICAgc2V0UmVzb2x2aW5nRmllbGRzKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICAgICAgbmV4dC5kZWxldGUoZmllbGROYW1lKVxuICAgICAgICAgIHJldHVybiBuZXh0XG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIClcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZVRleHRJbnB1dENoYW5nZShuZXdWYWx1ZTogc3RyaW5nKSB7XG4gICAgc2V0VGV4dElucHV0VmFsdWUobmV3VmFsdWUpXG4gICAgLy8gQ29tbWl0IGltbWVkaWF0ZWx5IG9uIGVhY2gga2V5c3Ryb2tlIChzeW5jIHZhbGlkYXRpb24pXG4gICAgaWYgKGN1cnJlbnRGaWVsZCkge1xuICAgICAgY29tbWl0VGV4dEZpZWxkKGN1cnJlbnRGaWVsZC5uYW1lLCBjdXJyZW50RmllbGQuc2NoZW1hLCBuZXdWYWx1ZSlcblxuICAgICAgLy8gRm9yIGRhdGUvZGF0ZXRpbWUgZmllbGRzLCBkZWJvdW5jZSBhc3luYyBOTCBwYXJzaW5nIGFmdGVyIDJzIG9mIGluYWN0aXZpdHlcbiAgICAgIGlmIChkYXRlRGVib3VuY2VSZWYuY3VycmVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChkYXRlRGVib3VuY2VSZWYuY3VycmVudClcbiAgICAgICAgZGF0ZURlYm91bmNlUmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgaXNEYXRlVGltZVNjaGVtYShjdXJyZW50RmllbGQuc2NoZW1hKSAmJlxuICAgICAgICBuZXdWYWx1ZS50cmltKCkgIT09ICcnICYmXG4gICAgICAgIHZhbGlkYXRpb25FcnJvcnNbY3VycmVudEZpZWxkLm5hbWVdXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgZmllbGROYW1lID0gY3VycmVudEZpZWxkLm5hbWVcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gY3VycmVudEZpZWxkLnNjaGVtYVxuICAgICAgICBkYXRlRGVib3VuY2VSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgKGRhdGVEZWJvdW5jZVJlZiwgcmVzb2x2ZUZpZWxkQXN5bmMsIGZpZWxkTmFtZSwgc2NoZW1hLCBuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgZGF0ZURlYm91bmNlUmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgICAgICAgIHJlc29sdmVGaWVsZEFzeW5jKGZpZWxkTmFtZSwgc2NoZW1hLCBuZXdWYWx1ZSlcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIwMDAsXG4gICAgICAgICAgZGF0ZURlYm91bmNlUmVmLFxuICAgICAgICAgIHJlc29sdmVGaWVsZEFzeW5jLFxuICAgICAgICAgIGZpZWxkTmFtZSxcbiAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVUZXh0SW5wdXRTdWJtaXQoKSB7XG4gICAgaGFuZGxlTmF2aWdhdGlvbignZG93bicpXG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kIGEga2V5c3Ryb2tlIHRvIHRoZSB0eXBlYWhlYWQgYnVmZmVyIChyZXNldCBhZnRlciAycyBpZGxlKSBhbmRcbiAgICogY2FsbCBgb25NYXRjaGAgd2l0aCB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IGxhYmVsIHRoYXQgcHJlZml4LW1hdGNoZXMuXG4gICAqIFNoYXJlZCBieSBib29sZWFuIHkvbiwgZW51bSBhY2NvcmRpb24sIGFuZCBtdWx0aS1zZWxlY3QgYWNjb3JkaW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gcnVuVHlwZWFoZWFkKFxuICAgIGNoYXI6IHN0cmluZyxcbiAgICBsYWJlbHM6IHN0cmluZ1tdLFxuICAgIG9uTWF0Y2g6IChpbmRleDogbnVtYmVyKSA9PiB2b2lkLFxuICApIHtcbiAgICBjb25zdCB0YSA9IGVudW1UeXBlYWhlYWRSZWYuY3VycmVudFxuICAgIGlmICh0YS50aW1lciAhPT0gdW5kZWZpbmVkKSBjbGVhclRpbWVvdXQodGEudGltZXIpXG4gICAgdGEuYnVmZmVyICs9IGNoYXIudG9Mb3dlckNhc2UoKVxuICAgIHRhLnRpbWVyID0gc2V0VGltZW91dChyZXNldFR5cGVhaGVhZCwgMjAwMCwgdGEpXG4gICAgY29uc3QgbWF0Y2ggPSBsYWJlbHMuZmluZEluZGV4KGwgPT4gbC5zdGFydHNXaXRoKHRhLmJ1ZmZlcikpXG4gICAgaWYgKG1hdGNoICE9PSAtMSkgb25NYXRjaChtYXRjaClcbiAgfVxuXG4gIC8vIEVzYyB3aGlsZSBhIGZpZWxkIGlzIGZvY3VzZWQ6IGNhbmNlbCB0aGUgZGlhbG9nLlxuICAvLyBVc2VzIFNldHRpbmdzIGNvbnRleHQgKGVzY2FwZS1vbmx5LCBubyAnbicga2V5KSBzaW5jZSBEaWFsb2cnc1xuICAvLyBDb25maXJtYXRpb24tY29udGV4dCBjYW5jZWwgaXMgc3VwcHJlc3NlZCB3aGVuIGEgZmllbGQgaXMgZm9jdXNlZC5cbiAgdXNlS2V5YmluZGluZyhcbiAgICAnY29uZmlybTpubycsXG4gICAgKCkgPT4ge1xuICAgICAgLy8gRm9yIHRleHQgZmllbGRzLCByZXZlcnQgdW5jb21taXR0ZWQgY2hhbmdlcyBmaXJzdFxuICAgICAgaWYgKGlzRWRpdGluZ1RleHRGaWVsZCAmJiBjdXJyZW50RmllbGQpIHtcbiAgICAgICAgY29uc3QgdmFsID0gZm9ybVZhbHVlc1tjdXJyZW50RmllbGQubmFtZV1cbiAgICAgICAgc2V0VGV4dElucHV0VmFsdWUodmFsICE9PSB1bmRlZmluZWQgPyBTdHJpbmcodmFsKSA6ICcnKVxuICAgICAgICBzZXRUZXh0SW5wdXRDdXJzb3JPZmZzZXQoMClcbiAgICAgIH1cbiAgICAgIG9uUmVzcG9uc2UoJ2NhbmNlbCcpXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2V0dGluZ3MnLFxuICAgICAgaXNBY3RpdmU6ICEhY3VycmVudEZpZWxkICYmICFmb2N1c2VkQnV0dG9uICYmICFleHBhbmRlZEFjY29yZGlvbixcbiAgICB9LFxuICApXG5cbiAgdXNlSW5wdXQoXG4gICAgKF9pbnB1dCwga2V5KSA9PiB7XG4gICAgICAvLyBUZXh0IGZpZWxkcyBoYW5kbGUgdGhlaXIgb3duIGNoYXJhY3RlciBpbnB1dDsgd2Ugb25seSBpbnRlcmNlcHRcbiAgICAgIC8vIG5hdmlnYXRpb24ga2V5cyBhbmQgYmFja3NwYWNlLW9uLWVtcHR5IGhlcmUuXG4gICAgICBpZiAoXG4gICAgICAgIGlzRWRpdGluZ1RleHRGaWVsZCAmJlxuICAgICAgICAha2V5LnVwQXJyb3cgJiZcbiAgICAgICAgIWtleS5kb3duQXJyb3cgJiZcbiAgICAgICAgIWtleS5yZXR1cm4gJiZcbiAgICAgICAgIWtleS5iYWNrc3BhY2VcbiAgICAgICkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gRXhwYW5kZWQgbXVsdGktc2VsZWN0IGFjY29yZGlvblxuICAgICAgaWYgKFxuICAgICAgICBleHBhbmRlZEFjY29yZGlvbiAmJlxuICAgICAgICBjdXJyZW50RmllbGQgJiZcbiAgICAgICAgaXNNdWx0aVNlbGVjdEVudW1TY2hlbWEoY3VycmVudEZpZWxkLnNjaGVtYSlcbiAgICAgICkge1xuICAgICAgICBjb25zdCBtc1NjaGVtYSA9IGN1cnJlbnRGaWVsZC5zY2hlbWFcbiAgICAgICAgY29uc3QgbXNWYWx1ZXMgPSBnZXRNdWx0aVNlbGVjdFZhbHVlcyhtc1NjaGVtYSlcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSAoZm9ybVZhbHVlc1tjdXJyZW50RmllbGQubmFtZV0gYXMgc3RyaW5nW10pID8/IFtdXG5cbiAgICAgICAgaWYgKGtleS5sZWZ0QXJyb3cgfHwga2V5LmVzY2FwZSkge1xuICAgICAgICAgIHNldEV4cGFuZGVkQWNjb3JkaW9uKHVuZGVmaW5lZClcbiAgICAgICAgICB2YWxpZGF0ZU11bHRpU2VsZWN0KGN1cnJlbnRGaWVsZC5uYW1lLCBtc1NjaGVtYSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5LnVwQXJyb3cpIHtcbiAgICAgICAgICBpZiAoYWNjb3JkaW9uT3B0aW9uSW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIHNldEV4cGFuZGVkQWNjb3JkaW9uKHVuZGVmaW5lZClcbiAgICAgICAgICAgIHZhbGlkYXRlTXVsdGlTZWxlY3QoY3VycmVudEZpZWxkLm5hbWUsIG1zU2NoZW1hKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRBY2NvcmRpb25PcHRpb25JbmRleChhY2NvcmRpb25PcHRpb25JbmRleCAtIDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGlmIChrZXkuZG93bkFycm93KSB7XG4gICAgICAgICAgaWYgKGFjY29yZGlvbk9wdGlvbkluZGV4ID49IG1zVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHNldEV4cGFuZGVkQWNjb3JkaW9uKHVuZGVmaW5lZClcbiAgICAgICAgICAgIGhhbmRsZU5hdmlnYXRpb24oJ2Rvd24nKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRBY2NvcmRpb25PcHRpb25JbmRleChhY2NvcmRpb25PcHRpb25JbmRleCArIDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGlmIChfaW5wdXQgPT09ICcgJykge1xuICAgICAgICAgIGNvbnN0IG9wdGlvblZhbHVlID0gbXNWYWx1ZXNbYWNjb3JkaW9uT3B0aW9uSW5kZXhdXG4gICAgICAgICAgaWYgKG9wdGlvblZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NlbGVjdGVkID0gc2VsZWN0ZWQuaW5jbHVkZXMob3B0aW9uVmFsdWUpXG4gICAgICAgICAgICAgID8gc2VsZWN0ZWQuZmlsdGVyKHYgPT4gdiAhPT0gb3B0aW9uVmFsdWUpXG4gICAgICAgICAgICAgIDogWy4uLnNlbGVjdGVkLCBvcHRpb25WYWx1ZV1cbiAgICAgICAgICAgIGNvbnN0IG5ld1ZhbHVlID0gbmV3U2VsZWN0ZWQubGVuZ3RoID4gMCA/IG5ld1NlbGVjdGVkIDogdW5kZWZpbmVkXG4gICAgICAgICAgICBzZXRGaWVsZChjdXJyZW50RmllbGQubmFtZSwgbmV3VmFsdWUpXG4gICAgICAgICAgICBjb25zdCBtaW4gPSBtc1NjaGVtYS5taW5JdGVtc1xuICAgICAgICAgICAgY29uc3QgbWF4ID0gbXNTY2hlbWEubWF4SXRlbXNcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgbWluICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgbmV3U2VsZWN0ZWQubGVuZ3RoIDwgbWluICYmXG4gICAgICAgICAgICAgIChuZXdTZWxlY3RlZC5sZW5ndGggPiAwIHx8IGN1cnJlbnRGaWVsZC5pc1JlcXVpcmVkKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgICAgICAgICBjdXJyZW50RmllbGQubmFtZSxcbiAgICAgICAgICAgICAgICBgU2VsZWN0IGF0IGxlYXN0ICR7bWlufSAke3BsdXJhbChtaW4sICdpdGVtJyl9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChtYXggIT09IHVuZGVmaW5lZCAmJiBuZXdTZWxlY3RlZC5sZW5ndGggPiBtYXgpIHtcbiAgICAgICAgICAgICAgdXBkYXRlVmFsaWRhdGlvbkVycm9yKFxuICAgICAgICAgICAgICAgIGN1cnJlbnRGaWVsZC5uYW1lLFxuICAgICAgICAgICAgICAgIGBTZWxlY3QgYXQgbW9zdCAke21heH0gJHtwbHVyYWwobWF4LCAnaXRlbScpfWAsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihjdXJyZW50RmllbGQubmFtZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleS5yZXR1cm4pIHtcbiAgICAgICAgICAvLyBDaGVjayAobm90IHRvZ2dsZSkgdGhlIGZvY3VzZWQgaXRlbSwgdGhlbiBjb2xsYXBzZSBhbmQgYWR2YW5jZVxuICAgICAgICAgIGNvbnN0IG9wdGlvblZhbHVlID0gbXNWYWx1ZXNbYWNjb3JkaW9uT3B0aW9uSW5kZXhdXG4gICAgICAgICAgaWYgKG9wdGlvblZhbHVlICE9PSB1bmRlZmluZWQgJiYgIXNlbGVjdGVkLmluY2x1ZGVzKG9wdGlvblZhbHVlKSkge1xuICAgICAgICAgICAgc2V0RmllbGQoY3VycmVudEZpZWxkLm5hbWUsIFsuLi5zZWxlY3RlZCwgb3B0aW9uVmFsdWVdKVxuICAgICAgICAgIH1cbiAgICAgICAgICBzZXRFeHBhbmRlZEFjY29yZGlvbih1bmRlZmluZWQpXG4gICAgICAgICAgaGFuZGxlTmF2aWdhdGlvbignZG93bicpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKF9pbnB1dCkge1xuICAgICAgICAgIGNvbnN0IGxhYmVscyA9IG1zVmFsdWVzLm1hcCh2ID0+XG4gICAgICAgICAgICBnZXRNdWx0aVNlbGVjdExhYmVsKG1zU2NoZW1hLCB2KS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgIClcbiAgICAgICAgICBydW5UeXBlYWhlYWQoX2lucHV0LCBsYWJlbHMsIHNldEFjY29yZGlvbk9wdGlvbkluZGV4KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBFeHBhbmRlZCBzaW5nbGUtc2VsZWN0IGVudW0gYWNjb3JkaW9uXG4gICAgICBpZiAoXG4gICAgICAgIGV4cGFuZGVkQWNjb3JkaW9uICYmXG4gICAgICAgIGN1cnJlbnRGaWVsZCAmJlxuICAgICAgICBpc0VudW1TY2hlbWEoY3VycmVudEZpZWxkLnNjaGVtYSlcbiAgICAgICkge1xuICAgICAgICBjb25zdCBlbnVtU2NoZW1hID0gY3VycmVudEZpZWxkLnNjaGVtYVxuICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0gZ2V0RW51bVZhbHVlcyhlbnVtU2NoZW1hKVxuXG4gICAgICAgIGlmIChrZXkubGVmdEFycm93IHx8IGtleS5lc2NhcGUpIHtcbiAgICAgICAgICBzZXRFeHBhbmRlZEFjY29yZGlvbih1bmRlZmluZWQpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleS51cEFycm93KSB7XG4gICAgICAgICAgaWYgKGFjY29yZGlvbk9wdGlvbkluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICBzZXRFeHBhbmRlZEFjY29yZGlvbih1bmRlZmluZWQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldEFjY29yZGlvbk9wdGlvbkluZGV4KGFjY29yZGlvbk9wdGlvbkluZGV4IC0gMSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleS5kb3duQXJyb3cpIHtcbiAgICAgICAgICBpZiAoYWNjb3JkaW9uT3B0aW9uSW5kZXggPj0gZW51bVZhbHVlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBzZXRFeHBhbmRlZEFjY29yZGlvbih1bmRlZmluZWQpXG4gICAgICAgICAgICBoYW5kbGVOYXZpZ2F0aW9uKCdkb3duJylcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0QWNjb3JkaW9uT3B0aW9uSW5kZXgoYWNjb3JkaW9uT3B0aW9uSW5kZXggKyAxKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICAvLyBTcGFjZTogc2VsZWN0IGFuZCBjb2xsYXBzZVxuICAgICAgICBpZiAoX2lucHV0ID09PSAnICcpIHtcbiAgICAgICAgICBjb25zdCBvcHRpb25WYWx1ZSA9IGVudW1WYWx1ZXNbYWNjb3JkaW9uT3B0aW9uSW5kZXhdXG4gICAgICAgICAgaWYgKG9wdGlvblZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNldEZpZWxkKGN1cnJlbnRGaWVsZC5uYW1lLCBvcHRpb25WYWx1ZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0RXhwYW5kZWRBY2NvcmRpb24odW5kZWZpbmVkKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIEVudGVyOiBzZWxlY3QsIGNvbGxhcHNlLCBhbmQgbW92ZSB0byBuZXh0IGZpZWxkXG4gICAgICAgIGlmIChrZXkucmV0dXJuKSB7XG4gICAgICAgICAgY29uc3Qgb3B0aW9uVmFsdWUgPSBlbnVtVmFsdWVzW2FjY29yZGlvbk9wdGlvbkluZGV4XVxuICAgICAgICAgIGlmIChvcHRpb25WYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzZXRGaWVsZChjdXJyZW50RmllbGQubmFtZSwgb3B0aW9uVmFsdWUpXG4gICAgICAgICAgfVxuICAgICAgICAgIHNldEV4cGFuZGVkQWNjb3JkaW9uKHVuZGVmaW5lZClcbiAgICAgICAgICBoYW5kbGVOYXZpZ2F0aW9uKCdkb3duJylcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBpZiAoX2lucHV0KSB7XG4gICAgICAgICAgY29uc3QgbGFiZWxzID0gZW51bVZhbHVlcy5tYXAodiA9PlxuICAgICAgICAgICAgZ2V0RW51bUxhYmVsKGVudW1TY2hlbWEsIHYpLnRvTG93ZXJDYXNlKCksXG4gICAgICAgICAgKVxuICAgICAgICAgIHJ1blR5cGVhaGVhZChfaW5wdXQsIGxhYmVscywgc2V0QWNjb3JkaW9uT3B0aW9uSW5kZXgpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEFjY2VwdCAvIERlY2xpbmUgYnV0dG9uc1xuICAgICAgaWYgKGtleS5yZXR1cm4gJiYgZm9jdXNlZEJ1dHRvbiA9PT0gJ2FjY2VwdCcpIHtcbiAgICAgICAgaWYgKHZhbGlkYXRlUmVxdWlyZWQoKSAmJiBPYmplY3Qua2V5cyh2YWxpZGF0aW9uRXJyb3JzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBvblJlc3BvbnNlKCdhY2NlcHQnLCBmb3JtVmFsdWVzKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFNob3cgXCJyZXF1aXJlZFwiIHZhbGlkYXRpb24gZXJyb3JzIG9uIG1pc3NpbmcgZmllbGRzXG4gICAgICAgICAgY29uc3QgcmVxdWlyZWRGaWVsZHMgPSByZXF1ZXN0ZWRTY2hlbWEucmVxdWlyZWQgfHwgW11cbiAgICAgICAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBvZiByZXF1aXJlZEZpZWxkcykge1xuICAgICAgICAgICAgaWYgKGZvcm1WYWx1ZXNbZmllbGROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHVwZGF0ZVZhbGlkYXRpb25FcnJvcihmaWVsZE5hbWUsICdUaGlzIGZpZWxkIGlzIHJlcXVpcmVkJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZmlyc3RCYWRJbmRleCA9IHNjaGVtYUZpZWxkcy5maW5kSW5kZXgoXG4gICAgICAgICAgICBmID0+XG4gICAgICAgICAgICAgIChyZXF1aXJlZEZpZWxkcy5pbmNsdWRlcyhmLm5hbWUpICYmXG4gICAgICAgICAgICAgICAgZm9ybVZhbHVlc1tmLm5hbWVdID09PSB1bmRlZmluZWQpIHx8XG4gICAgICAgICAgICAgIHZhbGlkYXRpb25FcnJvcnNbZi5uYW1lXSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoZmlyc3RCYWRJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHNldEN1cnJlbnRGaWVsZEluZGV4KGZpcnN0QmFkSW5kZXgpXG4gICAgICAgICAgICBzZXRGb2N1c2VkQnV0dG9uKG51bGwpXG4gICAgICAgICAgICBzeW5jVGV4dElucHV0KGZpcnN0QmFkSW5kZXgpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAoa2V5LnJldHVybiAmJiBmb2N1c2VkQnV0dG9uID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgb25SZXNwb25zZSgnZGVjbGluZScpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBVcC9Eb3duIG5hdmlnYXRpb25cbiAgICAgIGlmIChrZXkudXBBcnJvdyB8fCBrZXkuZG93bkFycm93KSB7XG4gICAgICAgIC8vIFJlc2V0IGVudW0gdHlwZWFoZWFkIHdoZW4gbGVhdmluZyBhIGZpZWxkXG4gICAgICAgIGNvbnN0IHRhID0gZW51bVR5cGVhaGVhZFJlZi5jdXJyZW50XG4gICAgICAgIHRhLmJ1ZmZlciA9ICcnXG4gICAgICAgIGlmICh0YS50aW1lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRhLnRpbWVyKVxuICAgICAgICAgIHRhLnRpbWVyID0gdW5kZWZpbmVkXG4gICAgICAgIH1cbiAgICAgICAgaGFuZGxlTmF2aWdhdGlvbihrZXkudXBBcnJvdyA/ICd1cCcgOiAnZG93bicpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBMZWZ0L1JpZ2h0IHRvIHN3aXRjaCBiZXR3ZWVuIEFjY2VwdCBhbmQgRGVjbGluZSBidXR0b25zXG4gICAgICBpZiAoZm9jdXNlZEJ1dHRvbiAmJiAoa2V5LmxlZnRBcnJvdyB8fCBrZXkucmlnaHRBcnJvdykpIHtcbiAgICAgICAgc2V0Rm9jdXNlZEJ1dHRvbihmb2N1c2VkQnV0dG9uID09PSAnYWNjZXB0JyA/ICdkZWNsaW5lJyA6ICdhY2NlcHQnKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgaWYgKCFjdXJyZW50RmllbGQpIHJldHVyblxuICAgICAgY29uc3QgeyBzY2hlbWEsIG5hbWUgfSA9IGN1cnJlbnRGaWVsZFxuICAgICAgY29uc3QgdmFsdWUgPSBmb3JtVmFsdWVzW25hbWVdXG5cbiAgICAgIC8vIEJvb2xlYW46IFNwYWNlIHRvIHRvZ2dsZSwgRW50ZXIgdG8gbW92ZSBvblxuICAgICAgaWYgKHNjaGVtYS50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgaWYgKF9pbnB1dCA9PT0gJyAnKSB7XG4gICAgICAgICAgc2V0RmllbGQobmFtZSwgdmFsdWUgPT09IHVuZGVmaW5lZCA/IHRydWUgOiAhdmFsdWUpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleS5yZXR1cm4pIHtcbiAgICAgICAgICBoYW5kbGVOYXZpZ2F0aW9uKCdkb3duJylcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5LmJhY2tzcGFjZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdW5zZXRGaWVsZChuYW1lKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIHkvbiB0eXBlYWhlYWRcbiAgICAgICAgaWYgKF9pbnB1dCAmJiAha2V5LnJldHVybikge1xuICAgICAgICAgIHJ1blR5cGVhaGVhZChfaW5wdXQsIFsneWVzJywgJ25vJ10sIGkgPT4gc2V0RmllbGQobmFtZSwgaSA9PT0gMCkpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEVudW0gb3IgbXVsdGktc2VsZWN0IChjb2xsYXBzZWQpIOKAlCBhY2NvcmRpb24gc3R5bGVcbiAgICAgIGlmIChpc0VudW1TY2hlbWEoc2NoZW1hKSB8fCBpc011bHRpU2VsZWN0RW51bVNjaGVtYShzY2hlbWEpKSB7XG4gICAgICAgIGlmIChrZXkucmV0dXJuKSB7XG4gICAgICAgICAgaGFuZGxlTmF2aWdhdGlvbignZG93bicpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleS5iYWNrc3BhY2UgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHVuc2V0RmllbGQobmFtZSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICAvLyBDb21wdXRlIG9wdGlvbiBsYWJlbHMgKyBpbml0aWFsIGZvY3VzIGluZGV4IGZvciByaWdodEFycm93IGV4cGFuZC5cbiAgICAgICAgLy8gU2luZ2xlLXNlbGVjdCBmb2N1c2VzIG9uIHRoZSBjdXJyZW50IHZhbHVlOyBtdWx0aS1zZWxlY3Qgc3RhcnRzIGF0IDAuXG4gICAgICAgIGxldCBsYWJlbHM6IHN0cmluZ1tdXG4gICAgICAgIGxldCBzdGFydElkeCA9IDBcbiAgICAgICAgaWYgKGlzRW51bVNjaGVtYShzY2hlbWEpKSB7XG4gICAgICAgICAgY29uc3QgdmFscyA9IGdldEVudW1WYWx1ZXMoc2NoZW1hKVxuICAgICAgICAgIGxhYmVscyA9IHZhbHMubWFwKHYgPT4gZ2V0RW51bUxhYmVsKHNjaGVtYSwgdikudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhcnRJZHggPSBNYXRoLm1heCgwLCB2YWxzLmluZGV4T2YodmFsdWUgYXMgc3RyaW5nKSlcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdmFscyA9IGdldE11bHRpU2VsZWN0VmFsdWVzKHNjaGVtYSlcbiAgICAgICAgICBsYWJlbHMgPSB2YWxzLm1hcCh2ID0+IGdldE11bHRpU2VsZWN0TGFiZWwoc2NoZW1hLCB2KS50b0xvd2VyQ2FzZSgpKVxuICAgICAgICB9XG4gICAgICAgIGlmIChrZXkucmlnaHRBcnJvdykge1xuICAgICAgICAgIHNldEV4cGFuZGVkQWNjb3JkaW9uKG5hbWUpXG4gICAgICAgICAgc2V0QWNjb3JkaW9uT3B0aW9uSW5kZXgoc3RhcnRJZHgpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgLy8gVHlwZWFoZWFkOiBleHBhbmQgYW5kIGp1bXAgdG8gbWF0Y2hpbmcgb3B0aW9uXG4gICAgICAgIGlmIChfaW5wdXQgJiYgIWtleS5sZWZ0QXJyb3cpIHtcbiAgICAgICAgICBydW5UeXBlYWhlYWQoX2lucHV0LCBsYWJlbHMsIGkgPT4ge1xuICAgICAgICAgICAgc2V0RXhwYW5kZWRBY2NvcmRpb24obmFtZSlcbiAgICAgICAgICAgIHNldEFjY29yZGlvbk9wdGlvbkluZGV4KGkpXG4gICAgICAgICAgfSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gQmFja3NwYWNlOiB0ZXh0IGZpZWxkcyB3aGVuIGVtcHR5XG4gICAgICBpZiAoa2V5LmJhY2tzcGFjZSkge1xuICAgICAgICBpZiAoaXNFZGl0aW5nVGV4dEZpZWxkICYmIHRleHRJbnB1dFZhbHVlID09PSAnJykge1xuICAgICAgICAgIHVuc2V0RmllbGQobmFtZSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUZXh0IGZpZWxkIEVudGVyIGlzIGhhbmRsZWQgYnkgVGV4dElucHV0J3Mgb25TdWJtaXRcbiAgICB9LFxuICAgIHsgaXNBY3RpdmU6IHRydWUgfSxcbiAgKVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlUmVxdWlyZWQoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcmVxdWlyZWRGaWVsZHMgPSByZXF1ZXN0ZWRTY2hlbWEucmVxdWlyZWQgfHwgW11cbiAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBvZiByZXF1aXJlZEZpZWxkcykge1xuICAgICAgY29uc3QgdmFsdWUgPSBmb3JtVmFsdWVzW2ZpZWxkTmFtZV1cbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSAnJykge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICAvLyBTY3JvbGwgd2luZG93aW5nOiBjb21wdXRlIHZpc2libGUgZmllbGQgcmFuZ2VcbiAgLy8gT3ZlcmhlYWQ6IH45IGxpbmVzIChkaWFsb2cgY2hyb21lLCBidXR0b25zLCBmb290ZXIpLlxuICAvLyBFYWNoIGZpZWxkOiB+MyBsaW5lcyAobGFiZWwgKyBkZXNjcmlwdGlvbiArIHZhbGlkYXRpb24gc3BhY2VyKS5cbiAgLy8gTk9URSh2Mik6IE11bHRpLXNlbGVjdCBhY2NvcmRpb24gZXhwYW5kcyB0byBOKzMgbGluZXMgd2hlbiBvcGVuLlxuICAvLyBGb3Igbm93IHdlIGFzc3VtZSAzIGxpbmVzIHBlciBmaWVsZDsgYW4gZXhwYW5kZWQgYWNjb3JkaW9uIG1heVxuICAvLyB0ZW1wb3JhcmlseSBwdXNoIGNvbnRlbnQgb2ZmLXNjcmVlbiAodGVybWluYWwgc2Nyb2xsYmFjayBoYW5kbGVzIGl0KS5cbiAgLy8gVG8gZ2VuZXJhbGl6ZTogdHJhY2sgcGVyLWZpZWxkIGhlaWdodCAoMyBmb3IgY29sbGFwc2VkLCBOKzMgZm9yXG4gIC8vIGV4cGFuZGVkIG11bHRpLXNlbGVjdCkgYW5kIGNvbXB1dGUgYSBwaXhlbC1idWRnZXQgd2luZG93IGluc3RlYWRcbiAgLy8gb2YgYSBzaW1wbGUgaXRlbS1jb3VudCB3aW5kb3cuXG4gIGNvbnN0IExJTkVTX1BFUl9GSUVMRCA9IDNcbiAgY29uc3QgRElBTE9HX09WRVJIRUFEID0gMTRcbiAgY29uc3QgbWF4VmlzaWJsZUZpZWxkcyA9IE1hdGgubWF4KFxuICAgIDIsXG4gICAgTWF0aC5mbG9vcigocm93cyAtIERJQUxPR19PVkVSSEVBRCkgLyBMSU5FU19QRVJfRklFTEQpLFxuICApXG5cbiAgY29uc3Qgc2Nyb2xsV2luZG93ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgdG90YWwgPSBzY2hlbWFGaWVsZHMubGVuZ3RoXG4gICAgaWYgKHRvdGFsIDw9IG1heFZpc2libGVGaWVsZHMpIHtcbiAgICAgIHJldHVybiB7IHN0YXJ0OiAwLCBlbmQ6IHRvdGFsIH1cbiAgICB9XG4gICAgLy8gV2hlbiBidXR0b25zIGFyZSBmb2N1c2VkIChjdXJyZW50RmllbGRJbmRleCB1bmRlZmluZWQpLCBwaW4gdG8gZW5kXG4gICAgY29uc3QgZm9jdXNJZHggPSBjdXJyZW50RmllbGRJbmRleCA/PyB0b3RhbCAtIDFcbiAgICBsZXQgc3RhcnQgPSBNYXRoLm1heCgwLCBmb2N1c0lkeCAtIE1hdGguZmxvb3IobWF4VmlzaWJsZUZpZWxkcyAvIDIpKVxuICAgIGNvbnN0IGVuZCA9IE1hdGgubWluKHN0YXJ0ICsgbWF4VmlzaWJsZUZpZWxkcywgdG90YWwpXG4gICAgLy8gQWRqdXN0IHN0YXJ0IGlmIHdlIGhpdCB0aGUgYm90dG9tXG4gICAgc3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSBtYXhWaXNpYmxlRmllbGRzKVxuICAgIHJldHVybiB7IHN0YXJ0LCBlbmQgfVxuICB9LCBbc2NoZW1hRmllbGRzLmxlbmd0aCwgbWF4VmlzaWJsZUZpZWxkcywgY3VycmVudEZpZWxkSW5kZXhdKVxuXG4gIGNvbnN0IGhhc0ZpZWxkc0Fib3ZlID0gc2Nyb2xsV2luZG93LnN0YXJ0ID4gMFxuICBjb25zdCBoYXNGaWVsZHNCZWxvdyA9IHNjcm9sbFdpbmRvdy5lbmQgPCBzY2hlbWFGaWVsZHMubGVuZ3RoXG5cbiAgZnVuY3Rpb24gcmVuZGVyRm9ybUZpZWxkcygpOiBSZWFjdC5SZWFjdE5vZGUge1xuICAgIGlmICghc2NoZW1hRmllbGRzLmxlbmd0aCkgcmV0dXJuIG51bGxcblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAge2hhc0ZpZWxkc0Fib3ZlICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezJ9PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIHtmaWd1cmVzLmFycm93VXB9IHtzY3JvbGxXaW5kb3cuc3RhcnR9IG1vcmUgYWJvdmVcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAge3NjaGVtYUZpZWxkc1xuICAgICAgICAgIC5zbGljZShzY3JvbGxXaW5kb3cuc3RhcnQsIHNjcm9sbFdpbmRvdy5lbmQpXG4gICAgICAgICAgLm1hcCgoZmllbGQsIHZpc2libGVJZHgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gc2Nyb2xsV2luZG93LnN0YXJ0ICsgdmlzaWJsZUlkeFxuICAgICAgICAgICAgY29uc3QgeyBuYW1lLCBzY2hlbWEsIGlzUmVxdWlyZWQgfSA9IGZpZWxkXG4gICAgICAgICAgICBjb25zdCBpc0FjdGl2ZSA9IGluZGV4ID09PSBjdXJyZW50RmllbGRJbmRleCAmJiAhZm9jdXNlZEJ1dHRvblxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBmb3JtVmFsdWVzW25hbWVdXG4gICAgICAgICAgICBjb25zdCBoYXNWYWx1ZSA9XG4gICAgICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSB2YWxpZGF0aW9uRXJyb3JzW25hbWVdXG5cbiAgICAgICAgICAgIC8vIENoZWNrYm94OiBzcGlubmVyIOKGkiDimqAgZXJyb3Ig4oaSIOKclCBzZXQg4oaSICogcmVxdWlyZWQg4oaSIHNwYWNlXG4gICAgICAgICAgICBjb25zdCBpc1Jlc29sdmluZyA9IHJlc29sdmluZ0ZpZWxkcy5oYXMobmFtZSlcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrYm94ID0gaXNSZXNvbHZpbmcgPyAoXG4gICAgICAgICAgICAgIDxSZXNvbHZpbmdTcGlubmVyIC8+XG4gICAgICAgICAgICApIDogZXJyb3IgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj57ZmlndXJlcy53YXJuaW5nfTwvVGV4dD5cbiAgICAgICAgICAgICkgOiBoYXNWYWx1ZSA/IChcbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCIgZGltQ29sb3I9eyFpc0FjdGl2ZX0+XG4gICAgICAgICAgICAgICAge2ZpZ3VyZXMudGlja31cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSA6IGlzUmVxdWlyZWQgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj4qPC9UZXh0PlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgLy8gU2VsZWN0aW9uIGNvbG9yIG1hdGNoZXMgZmllbGQgc3RhdHVzXG4gICAgICAgICAgICBjb25zdCBzZWxlY3Rpb25Db2xvciA9IGVycm9yXG4gICAgICAgICAgICAgID8gJ2Vycm9yJ1xuICAgICAgICAgICAgICA6IGhhc1ZhbHVlXG4gICAgICAgICAgICAgICAgPyAnc3VjY2VzcydcbiAgICAgICAgICAgICAgICA6IGlzUmVxdWlyZWRcbiAgICAgICAgICAgICAgICAgID8gJ2Vycm9yJ1xuICAgICAgICAgICAgICAgICAgOiAnc3VnZ2VzdGlvbidcblxuICAgICAgICAgICAgY29uc3QgYWN0aXZlQ29sb3IgPSBpc0FjdGl2ZSA/IHNlbGVjdGlvbkNvbG9yIDogdW5kZWZpbmVkXG5cbiAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gKFxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17YWN0aXZlQ29sb3J9IGJvbGQ9e2lzQWN0aXZlfT5cbiAgICAgICAgICAgICAgICB7c2NoZW1hLnRpdGxlIHx8IG5hbWV9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgLy8gUmVuZGVyIHRoZSB2YWx1ZSBwb3J0aW9uIGJhc2VkIG9uIGZpZWxkIHR5cGVcbiAgICAgICAgICAgIGxldCB2YWx1ZUNvbnRlbnQ6IFJlYWN0LlJlYWN0Tm9kZVxuICAgICAgICAgICAgbGV0IGFjY29yZGlvbkNvbnRlbnQ6IFJlYWN0LlJlYWN0Tm9kZSA9IG51bGxcblxuICAgICAgICAgICAgaWYgKGlzTXVsdGlTZWxlY3RFbnVtU2NoZW1hKHNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgbXNWYWx1ZXMgPSBnZXRNdWx0aVNlbGVjdFZhbHVlcyhzY2hlbWEpXG4gICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkID0gKHZhbHVlIGFzIHN0cmluZ1tdIHwgdW5kZWZpbmVkKSA/PyBbXVxuICAgICAgICAgICAgICBjb25zdCBpc0V4cGFuZGVkID0gZXhwYW5kZWRBY2NvcmRpb24gPT09IG5hbWUgJiYgaXNBY3RpdmVcblxuICAgICAgICAgICAgICBpZiAoaXNFeHBhbmRlZCkge1xuICAgICAgICAgICAgICAgIHZhbHVlQ29udGVudCA9IDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLnRyaWFuZ2xlRG93blNtYWxsfTwvVGV4dD5cbiAgICAgICAgICAgICAgICBhY2NvcmRpb25Db250ZW50ID0gKFxuICAgICAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luTGVmdD17Nn0+XG4gICAgICAgICAgICAgICAgICAgIHttc1ZhbHVlcy5tYXAoKG9wdFZhbCwgb3B0SWR4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0TGFiZWwgPSBnZXRNdWx0aVNlbGVjdExhYmVsKHNjaGVtYSwgb3B0VmFsKVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2hlY2tlZCA9IHNlbGVjdGVkLmluY2x1ZGVzKG9wdFZhbClcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0ZvY3VzZWQgPSBvcHRJZHggPT09IGFjY29yZGlvbk9wdGlvbkluZGV4XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtvcHRWYWx9IGdhcD17MX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VnZ2VzdGlvblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpc0ZvY3VzZWQgPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9e2lzQ2hlY2tlZCA/ICdzdWNjZXNzJyA6IHVuZGVmaW5lZH0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzQ2hlY2tlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBmaWd1cmVzLmNoZWNrYm94T25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogZmlndXJlcy5jaGVja2JveE9mZn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPXtpc0ZvY3VzZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9sZD17aXNGb2N1c2VkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge29wdExhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbGxhcHNlZDog4pa4IGFycm93IHRoZW4gY29tbWEtam9pbmVkIHNlbGVjdGVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgY29uc3QgYXJyb3cgPSBpc0FjdGl2ZSA/IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLnRyaWFuZ2xlUmlnaHRTbWFsbH0gPC9UZXh0PlxuICAgICAgICAgICAgICAgICkgOiBudWxsXG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlMYWJlbHMgPSBzZWxlY3RlZC5tYXAodiA9PlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aVNlbGVjdExhYmVsKHNjaGVtYSwgdiksXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICB2YWx1ZUNvbnRlbnQgPSAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIHthcnJvd31cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17YWN0aXZlQ29sb3J9IGJvbGQ9e2lzQWN0aXZlfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtkaXNwbGF5TGFiZWxzLmpvaW4oJywgJyl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHZhbHVlQ29udGVudCA9IChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgICAgICAge2Fycm93fVxuICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdCBzZXRcbiAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNFbnVtU2NoZW1hKHNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZW51bVZhbHVlcyA9IGdldEVudW1WYWx1ZXMoc2NoZW1hKVxuICAgICAgICAgICAgICBjb25zdCBpc0V4cGFuZGVkID0gZXhwYW5kZWRBY2NvcmRpb24gPT09IG5hbWUgJiYgaXNBY3RpdmVcblxuICAgICAgICAgICAgICBpZiAoaXNFeHBhbmRlZCkge1xuICAgICAgICAgICAgICAgIHZhbHVlQ29udGVudCA9IDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLnRyaWFuZ2xlRG93blNtYWxsfTwvVGV4dD5cbiAgICAgICAgICAgICAgICBhY2NvcmRpb25Db250ZW50ID0gKFxuICAgICAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luTGVmdD17Nn0+XG4gICAgICAgICAgICAgICAgICAgIHtlbnVtVmFsdWVzLm1hcCgob3B0VmFsLCBvcHRJZHgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcHRMYWJlbCA9IGdldEVudW1MYWJlbChzY2hlbWEsIG9wdFZhbClcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gdmFsdWUgPT09IG9wdFZhbFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzRm9jdXNlZCA9IG9wdElkeCA9PT0gYWNjb3JkaW9uT3B0aW9uSW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPEJveCBrZXk9e29wdFZhbH0gZ2FwPXsxfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzRm9jdXNlZCA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17aXNTZWxlY3RlZCA/ICdzdWNjZXNzJyA6IHVuZGVmaW5lZH0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzU2VsZWN0ZWQgPyBmaWd1cmVzLnJhZGlvT24gOiBmaWd1cmVzLnJhZGlvT2ZmfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2lzRm9jdXNlZCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2xkPXtpc0ZvY3VzZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7b3B0TGFiZWx9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ29sbGFwc2VkOiDilrggYXJyb3cgdGhlbiBjdXJyZW50IHZhbHVlXG4gICAgICAgICAgICAgICAgY29uc3QgYXJyb3cgPSBpc0FjdGl2ZSA/IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLnRyaWFuZ2xlUmlnaHRTbWFsbH0gPC9UZXh0PlxuICAgICAgICAgICAgICAgICkgOiBudWxsXG4gICAgICAgICAgICAgICAgaWYgKGhhc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICB2YWx1ZUNvbnRlbnQgPSAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIHthcnJvd31cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17YWN0aXZlQ29sb3J9IGJvbGQ9e2lzQWN0aXZlfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtnZXRFbnVtTGFiZWwoc2NoZW1hLCB2YWx1ZSBhcyBzdHJpbmcpfVxuICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICB2YWx1ZUNvbnRlbnQgPSAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIHthcnJvd31cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICAgICAgICAgICAgICBub3Qgc2V0XG4gICAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjaGVtYS50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgaWYgKGlzQWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdmFsdWVDb250ZW50ID0gaGFzVmFsdWUgPyAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17YWN0aXZlQ29sb3J9IGJvbGQ+XG4gICAgICAgICAgICAgICAgICAgIHt2YWx1ZSA/IGZpZ3VyZXMuY2hlY2tib3hPbiA6IGZpZ3VyZXMuY2hlY2tib3hPZmZ9XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLmNoZWNrYm94T2ZmfTwvVGV4dD5cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWVDb250ZW50ID0gaGFzVmFsdWUgPyAoXG4gICAgICAgICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgICAgICAge3ZhbHVlID8gZmlndXJlcy5jaGVja2JveE9uIDogZmlndXJlcy5jaGVja2JveE9mZn1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgICAgICAgICBub3Qgc2V0XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzVGV4dEZpZWxkKHNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgaWYgKGlzQWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgdmFsdWVDb250ZW50ID0gKFxuICAgICAgICAgICAgICAgICAgPFRleHRJbnB1dFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17dGV4dElucHV0VmFsdWV9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVUZXh0SW5wdXRDaGFuZ2V9XG4gICAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVUZXh0SW5wdXRTdWJtaXR9XG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXtgVHlwZSBzb21ldGhpbmdcXHV7MjAyNn1gfVxuICAgICAgICAgICAgICAgICAgICBjb2x1bW5zPXtNYXRoLm1pbihjb2x1bW5zIC0gMjAsIDYwKX1cbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yT2Zmc2V0PXt0ZXh0SW5wdXRDdXJzb3JPZmZzZXR9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlQ3Vyc29yT2Zmc2V0PXtzZXRUZXh0SW5wdXRDdXJzb3JPZmZzZXR9XG4gICAgICAgICAgICAgICAgICAgIGZvY3VzXG4gICAgICAgICAgICAgICAgICAgIHNob3dDdXJzb3JcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlWYWx1ZSA9XG4gICAgICAgICAgICAgICAgICBoYXNWYWx1ZSAmJiBpc0RhdGVUaW1lU2NoZW1hKHNjaGVtYSlcbiAgICAgICAgICAgICAgICAgICAgPyBmb3JtYXREYXRlRGlzcGxheShTdHJpbmcodmFsdWUpLCBzY2hlbWEpXG4gICAgICAgICAgICAgICAgICAgIDogU3RyaW5nKHZhbHVlKVxuICAgICAgICAgICAgICAgIHZhbHVlQ29udGVudCA9IGhhc1ZhbHVlID8gKFxuICAgICAgICAgICAgICAgICAgPFRleHQ+e2Rpc3BsYXlWYWx1ZX08L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICAgICAgbm90IHNldFxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWVDb250ZW50ID0gaGFzVmFsdWUgPyAoXG4gICAgICAgICAgICAgICAgPFRleHQ+e1N0cmluZyh2YWx1ZSl9PC9UZXh0PlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICAgIG5vdCBzZXRcbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPEJveCBrZXk9e25hbWV9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICA8Qm94IGdhcD17MX0+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj17c2VsZWN0aW9uQ29sb3J9PlxuICAgICAgICAgICAgICAgICAgICB7aXNBY3RpdmUgPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICB7Y2hlY2tib3h9XG4gICAgICAgICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICAgICAgICB7bGFiZWx9XG4gICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPXthY3RpdmVDb2xvcn0+OiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIHt2YWx1ZUNvbnRlbnR9XG4gICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICB7YWNjb3JkaW9uQ29udGVudH1cbiAgICAgICAgICAgICAgICB7c2NoZW1hLmRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxCb3ggbWFyZ2luTGVmdD17Nn0+XG4gICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntzY2hlbWEuZGVzY3JpcHRpb259PC9UZXh0PlxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezZ9IGhlaWdodD17MX0+XG4gICAgICAgICAgICAgICAgICB7ZXJyb3IgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIiBpdGFsaWM+XG4gICAgICAgICAgICAgICAgICAgICAge2Vycm9yfVxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8VGV4dD4gPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApXG4gICAgICAgICAgfSl9XG4gICAgICAgIHtoYXNGaWVsZHNCZWxvdyAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5MZWZ0PXsyfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7ZmlndXJlcy5hcnJvd0Rvd259IHtzY2hlbWFGaWVsZHMubGVuZ3RoIC0gc2Nyb2xsV2luZG93LmVuZH0gbW9yZVxuICAgICAgICAgICAgICBiZWxvd1xuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nXG4gICAgICB0aXRsZT17YE1DUCBzZXJ2ZXIgXFx1MjAxYyR7c2VydmVyTmFtZX1cXHUyMDFkIHJlcXVlc3RzIHlvdXIgaW5wdXRgfVxuICAgICAgc3VidGl0bGU9e2BcXG4ke21lc3NhZ2V9YH1cbiAgICAgIGNvbG9yPVwicGVybWlzc2lvblwiXG4gICAgICBvbkNhbmNlbD17KCkgPT4gb25SZXNwb25zZSgnY2FuY2VsJyl9XG4gICAgICBpc0NhbmNlbEFjdGl2ZT17KCFjdXJyZW50RmllbGQgfHwgISFmb2N1c2VkQnV0dG9uKSAmJiAhZXhwYW5kZWRBY2NvcmRpb259XG4gICAgICBpbnB1dEd1aWRlPXtleGl0U3RhdGUgPT5cbiAgICAgICAgZXhpdFN0YXRlLnBlbmRpbmcgPyAoXG4gICAgICAgICAgPFRleHQ+UHJlc3Mge2V4aXRTdGF0ZS5rZXlOYW1lfSBhZ2FpbiB0byBleGl0PC9UZXh0PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImNhbmNlbFwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaR4oaTXCIgYWN0aW9uPVwibmF2aWdhdGVcIiAvPlxuICAgICAgICAgICAge2N1cnJlbnRGaWVsZCAmJiAoXG4gICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkJhY2tzcGFjZVwiIGFjdGlvbj1cInVuc2V0XCIgLz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICB7Y3VycmVudEZpZWxkICYmIGN1cnJlbnRGaWVsZC5zY2hlbWEudHlwZSA9PT0gJ2Jvb2xlYW4nICYmIChcbiAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiU3BhY2VcIiBhY3Rpb249XCJ0b2dnbGVcIiAvPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIHtjdXJyZW50RmllbGQgJiZcbiAgICAgICAgICAgICAgaXNFbnVtU2NoZW1hKGN1cnJlbnRGaWVsZC5zY2hlbWEpICYmXG4gICAgICAgICAgICAgIChleHBhbmRlZEFjY29yZGlvbiA/IChcbiAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJTcGFjZVwiIGFjdGlvbj1cInNlbGVjdFwiIC8+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaSXCIgYWN0aW9uPVwiZXhwYW5kXCIgLz5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICB7Y3VycmVudEZpZWxkICYmXG4gICAgICAgICAgICAgIGlzTXVsdGlTZWxlY3RFbnVtU2NoZW1hKGN1cnJlbnRGaWVsZC5zY2hlbWEpICYmXG4gICAgICAgICAgICAgIChleHBhbmRlZEFjY29yZGlvbiA/IChcbiAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJTcGFjZVwiIGFjdGlvbj1cInRvZ2dsZVwiIC8+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaSXCIgYWN0aW9uPVwiZXhwYW5kXCIgLz5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICA+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAge3JlbmRlckZvcm1GaWVsZHMoKX1cbiAgICAgICAgPEJveD5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj5cbiAgICAgICAgICAgIHtmb2N1c2VkQnV0dG9uID09PSAnYWNjZXB0JyA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGJvbGQ9e2ZvY3VzZWRCdXR0b24gPT09ICdhY2NlcHQnfVxuICAgICAgICAgICAgY29sb3I9e2ZvY3VzZWRCdXR0b24gPT09ICdhY2NlcHQnID8gJ3N1Y2Nlc3MnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgZGltQ29sb3I9e2ZvY3VzZWRCdXR0b24gIT09ICdhY2NlcHQnfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHsnIEFjY2VwdCAgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAge2ZvY3VzZWRCdXR0b24gPT09ICdkZWNsaW5lJyA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGJvbGQ9e2ZvY3VzZWRCdXR0b24gPT09ICdkZWNsaW5lJ31cbiAgICAgICAgICAgIGNvbG9yPXtmb2N1c2VkQnV0dG9uID09PSAnZGVjbGluZScgPyAnZXJyb3InIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgZGltQ29sb3I9e2ZvY3VzZWRCdXR0b24gIT09ICdkZWNsaW5lJ31cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7JyBEZWNsaW5lJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgPC9EaWFsb2c+XG4gIClcbn1cblxuZnVuY3Rpb24gRWxpY2l0YXRpb25VUkxEaWFsb2coe1xuICBldmVudCxcbiAgb25SZXNwb25zZSxcbiAgb25XYWl0aW5nRGlzbWlzcyxcbn06IHtcbiAgZXZlbnQ6IEVsaWNpdGF0aW9uUmVxdWVzdEV2ZW50XG4gIG9uUmVzcG9uc2U6IFByb3BzWydvblJlc3BvbnNlJ11cbiAgb25XYWl0aW5nRGlzbWlzczogUHJvcHNbJ29uV2FpdGluZ0Rpc21pc3MnXVxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgc2VydmVyTmFtZSwgc2lnbmFsLCB3YWl0aW5nU3RhdGUgfSA9IGV2ZW50XG4gIGNvbnN0IHVybFBhcmFtcyA9IGV2ZW50LnBhcmFtcyBhcyBFbGljaXRSZXF1ZXN0VVJMUGFyYW1zXG4gIGNvbnN0IHsgbWVzc2FnZSwgdXJsIH0gPSB1cmxQYXJhbXNcbiAgY29uc3QgW3BoYXNlLCBzZXRQaGFzZV0gPSB1c2VTdGF0ZTwncHJvbXB0JyB8ICd3YWl0aW5nJz4oJ3Byb21wdCcpXG4gIGNvbnN0IHBoYXNlUmVmID0gdXNlUmVmPCdwcm9tcHQnIHwgJ3dhaXRpbmcnPigncHJvbXB0JylcbiAgY29uc3QgW2ZvY3VzZWRCdXR0b24sIHNldEZvY3VzZWRCdXR0b25dID0gdXNlU3RhdGU8XG4gICAgJ2FjY2VwdCcgfCAnZGVjbGluZScgfCAnb3BlbicgfCAnYWN0aW9uJyB8ICdjYW5jZWwnXG4gID4oJ2FjY2VwdCcpXG4gIGNvbnN0IHNob3dDYW5jZWwgPSB3YWl0aW5nU3RhdGU/LnNob3dDYW5jZWwgPz8gZmFsc2VcblxuICB1c2VOb3RpZnlBZnRlclRpbWVvdXQoXG4gICAgJ0NsYXVkZSBDb2RlIG5lZWRzIHlvdXIgaW5wdXQnLFxuICAgICdlbGljaXRhdGlvbl91cmxfZGlhbG9nJyxcbiAgKVxuICB1c2VSZWdpc3Rlck92ZXJsYXkoJ2VsaWNpdGF0aW9uLXVybCcpXG5cbiAgLy8gS2VlcCByZWZzIGluIHN5bmMgZm9yIHVzZSBpbiBhYm9ydCBoYW5kbGVyIChhdm9pZHMgcmUtcmVnaXN0ZXJpbmcgbGlzdGVuZXIpXG4gIHBoYXNlUmVmLmN1cnJlbnQgPSBwaGFzZVxuICBjb25zdCBvbldhaXRpbmdEaXNtaXNzUmVmID0gdXNlUmVmKG9uV2FpdGluZ0Rpc21pc3MpXG4gIG9uV2FpdGluZ0Rpc21pc3NSZWYuY3VycmVudCA9IG9uV2FpdGluZ0Rpc21pc3NcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGhhbmRsZUFib3J0ID0gKCkgPT4ge1xuICAgICAgaWYgKHBoYXNlUmVmLmN1cnJlbnQgPT09ICd3YWl0aW5nJykge1xuICAgICAgICBvbldhaXRpbmdEaXNtaXNzUmVmLmN1cnJlbnQ/LignY2FuY2VsJylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9uUmVzcG9uc2UoJ2NhbmNlbCcpXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzaWduYWwuYWJvcnRlZCkge1xuICAgICAgaGFuZGxlQWJvcnQoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGhhbmRsZUFib3J0KVxuICAgIHJldHVybiAoKSA9PiBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBoYW5kbGVBYm9ydClcbiAgfSwgW3NpZ25hbCwgb25SZXNwb25zZV0pXG5cbiAgLy8gUGFyc2UgVVJMIHRvIGhpZ2hsaWdodCB0aGUgZG9tYWluXG4gIGxldCBkb21haW4gPSAnJ1xuICBsZXQgdXJsQmVmb3JlRG9tYWluID0gJydcbiAgbGV0IHVybEFmdGVyRG9tYWluID0gJydcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKHVybClcbiAgICBkb21haW4gPSBwYXJzZWQuaG9zdG5hbWVcbiAgICBjb25zdCBkb21haW5TdGFydCA9IHVybC5pbmRleE9mKGRvbWFpbilcbiAgICB1cmxCZWZvcmVEb21haW4gPSB1cmwuc2xpY2UoMCwgZG9tYWluU3RhcnQpXG4gICAgdXJsQWZ0ZXJEb21haW4gPSB1cmwuc2xpY2UoZG9tYWluU3RhcnQgKyBkb21haW4ubGVuZ3RoKVxuICB9IGNhdGNoIHtcbiAgICBkb21haW4gPSB1cmxcbiAgfVxuXG4gIC8vIEF1dG8tZGlzbWlzcyB3aGVuIHRoZSBzZXJ2ZXIgc2VuZHMgYSBjb21wbGV0aW9uIG5vdGlmaWNhdGlvbiAoc2V0cyBjb21wbGV0ZWQgZmxhZylcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocGhhc2UgPT09ICd3YWl0aW5nJyAmJiBldmVudC5jb21wbGV0ZWQpIHtcbiAgICAgIG9uV2FpdGluZ0Rpc21pc3M/LihzaG93Q2FuY2VsID8gJ3JldHJ5JyA6ICdkaXNtaXNzJylcbiAgICB9XG4gIH0sIFtwaGFzZSwgZXZlbnQuY29tcGxldGVkLCBvbldhaXRpbmdEaXNtaXNzLCBzaG93Q2FuY2VsXSlcblxuICBjb25zdCBoYW5kbGVBY2NlcHQgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgdm9pZCBvcGVuQnJvd3Nlcih1cmwpXG4gICAgb25SZXNwb25zZSgnYWNjZXB0JylcbiAgICBzZXRQaGFzZSgnd2FpdGluZycpXG4gICAgcGhhc2VSZWYuY3VycmVudCA9ICd3YWl0aW5nJ1xuICAgIHNldEZvY3VzZWRCdXR0b24oJ29wZW4nKVxuICB9LCBbb25SZXNwb25zZSwgdXJsXSlcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gcmF3IGlucHV0IGZvciBidXR0b24gbmF2aWdhdGlvblxuICB1c2VJbnB1dCgoX2lucHV0LCBrZXkpID0+IHtcbiAgICBpZiAocGhhc2UgPT09ICdwcm9tcHQnKSB7XG4gICAgICBpZiAoa2V5LmxlZnRBcnJvdyB8fCBrZXkucmlnaHRBcnJvdykge1xuICAgICAgICBzZXRGb2N1c2VkQnV0dG9uKHByZXYgPT4gKHByZXYgPT09ICdhY2NlcHQnID8gJ2RlY2xpbmUnIDogJ2FjY2VwdCcpKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChrZXkucmV0dXJuKSB7XG4gICAgICAgIGlmIChmb2N1c2VkQnV0dG9uID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgIGhhbmRsZUFjY2VwdCgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb25SZXNwb25zZSgnZGVjbGluZScpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2FpdGluZyBwaGFzZSDigJQgY3ljbGUgdGhyb3VnaCBidXR0b25zXG4gICAgICB0eXBlIEJ1dHRvbk5hbWUgPSAnYWNjZXB0JyB8ICdkZWNsaW5lJyB8ICdvcGVuJyB8ICdhY3Rpb24nIHwgJ2NhbmNlbCdcbiAgICAgIGNvbnN0IHdhaXRpbmdCdXR0b25zOiByZWFkb25seSBCdXR0b25OYW1lW10gPSBzaG93Q2FuY2VsXG4gICAgICAgID8gWydvcGVuJywgJ2FjdGlvbicsICdjYW5jZWwnXVxuICAgICAgICA6IFsnb3BlbicsICdhY3Rpb24nXVxuICAgICAgaWYgKGtleS5sZWZ0QXJyb3cgfHwga2V5LnJpZ2h0QXJyb3cpIHtcbiAgICAgICAgc2V0Rm9jdXNlZEJ1dHRvbihwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBpZHggPSB3YWl0aW5nQnV0dG9ucy5pbmRleE9mKHByZXYpXG4gICAgICAgICAgY29uc3QgZGVsdGEgPSBrZXkucmlnaHRBcnJvdyA/IDEgOiAtMVxuICAgICAgICAgIHJldHVybiB3YWl0aW5nQnV0dG9uc1tcbiAgICAgICAgICAgIChpZHggKyBkZWx0YSArIHdhaXRpbmdCdXR0b25zLmxlbmd0aCkgJSB3YWl0aW5nQnV0dG9ucy5sZW5ndGhcbiAgICAgICAgICBdIVxuICAgICAgICB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChrZXkucmV0dXJuKSB7XG4gICAgICAgIGlmIChmb2N1c2VkQnV0dG9uID09PSAnb3BlbicpIHtcbiAgICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKHVybClcbiAgICAgICAgfSBlbHNlIGlmIChmb2N1c2VkQnV0dG9uID09PSAnY2FuY2VsJykge1xuICAgICAgICAgIG9uV2FpdGluZ0Rpc21pc3M/LignY2FuY2VsJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvbldhaXRpbmdEaXNtaXNzPy4oc2hvd0NhbmNlbCA/ICdyZXRyeScgOiAnZGlzbWlzcycpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgaWYgKHBoYXNlID09PSAnd2FpdGluZycpIHtcbiAgICBjb25zdCBhY3Rpb25MYWJlbCA9IHdhaXRpbmdTdGF0ZT8uYWN0aW9uTGFiZWwgPz8gJ0NvbnRpbnVlIHdpdGhvdXQgd2FpdGluZydcbiAgICByZXR1cm4gKFxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT17YE1DUCBzZXJ2ZXIgXFx1MjAxYyR7c2VydmVyTmFtZX1cXHUyMDFkIFxcdTIwMTQgd2FpdGluZyBmb3IgY29tcGxldGlvbmB9XG4gICAgICAgIHN1YnRpdGxlPXtgXFxuJHttZXNzYWdlfWB9XG4gICAgICAgIGNvbG9yPVwicGVybWlzc2lvblwiXG4gICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBvbldhaXRpbmdEaXNtaXNzPy4oJ2NhbmNlbCcpfVxuICAgICAgICBpc0NhbmNlbEFjdGl2ZVxuICAgICAgICBpbnB1dEd1aWRlPXtleGl0U3RhdGUgPT5cbiAgICAgICAgICBleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICAgIDxUZXh0PlByZXNzIHtleGl0U3RhdGUua2V5TmFtZX0gYWdhaW4gdG8gZXhpdDwvVGV4dD5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImNhbmNlbFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIlxcdTIxOTBcXHUyMTkyXCIgYWN0aW9uPVwic3dpdGNoXCIgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIHt1cmxCZWZvcmVEb21haW59XG4gICAgICAgICAgICAgIDxUZXh0IGJvbGQ+e2RvbWFpbn08L1RleHQ+XG4gICAgICAgICAgICAgIHt1cmxBZnRlckRvbWFpbn1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICAgIFdhaXRpbmcgZm9yIHRoZSBzZXJ2ZXIgdG8gY29uZmlybSBjb21wbGV0aW9u4oCmXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPEJveD5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiPlxuICAgICAgICAgICAgICB7Zm9jdXNlZEJ1dHRvbiA9PT0gJ29wZW4nID8gZmlndXJlcy5wb2ludGVyIDogJyAnfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgYm9sZD17Zm9jdXNlZEJ1dHRvbiA9PT0gJ29wZW4nfVxuICAgICAgICAgICAgICBjb2xvcj17Zm9jdXNlZEJ1dHRvbiA9PT0gJ29wZW4nID8gJ3N1Y2Nlc3MnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICBkaW1Db2xvcj17Zm9jdXNlZEJ1dHRvbiAhPT0gJ29wZW4nfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7JyBSZW9wZW4gVVJMICAnfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+XG4gICAgICAgICAgICAgIHtmb2N1c2VkQnV0dG9uID09PSAnYWN0aW9uJyA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgIGJvbGQ9e2ZvY3VzZWRCdXR0b24gPT09ICdhY3Rpb24nfVxuICAgICAgICAgICAgICBjb2xvcj17Zm9jdXNlZEJ1dHRvbiA9PT0gJ2FjdGlvbicgPyAnc3VjY2VzcycgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgIGRpbUNvbG9yPXtmb2N1c2VkQnV0dG9uICE9PSAnYWN0aW9uJ31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge2AgJHthY3Rpb25MYWJlbH1gfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAge3Nob3dDYW5jZWwgJiYgKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAgICAgICAge2ZvY3VzZWRCdXR0b24gPT09ICdjYW5jZWwnID8gZmlndXJlcy5wb2ludGVyIDogJyAnfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgYm9sZD17Zm9jdXNlZEJ1dHRvbiA9PT0gJ2NhbmNlbCd9XG4gICAgICAgICAgICAgICAgICBjb2xvcj17Zm9jdXNlZEJ1dHRvbiA9PT0gJ2NhbmNlbCcgPyAnZXJyb3InIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICAgICAgZGltQ29sb3I9e2ZvY3VzZWRCdXR0b24gIT09ICdjYW5jZWwnfVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHsnIENhbmNlbCd9XG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9EaWFsb2c+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nXG4gICAgICB0aXRsZT17YE1DUCBzZXJ2ZXIgXFx1MjAxYyR7c2VydmVyTmFtZX1cXHUyMDFkIHdhbnRzIHRvIG9wZW4gYSBVUkxgfVxuICAgICAgc3VidGl0bGU9e2BcXG4ke21lc3NhZ2V9YH1cbiAgICAgIGNvbG9yPVwicGVybWlzc2lvblwiXG4gICAgICBvbkNhbmNlbD17KCkgPT4gb25SZXNwb25zZSgnY2FuY2VsJyl9XG4gICAgICBpc0NhbmNlbEFjdGl2ZVxuICAgICAgaW5wdXRHdWlkZT17ZXhpdFN0YXRlID0+XG4gICAgICAgIGV4aXRTdGF0ZS5wZW5kaW5nID8gKFxuICAgICAgICAgIDxUZXh0PlByZXNzIHtleGl0U3RhdGUua2V5TmFtZX0gYWdhaW4gdG8gZXhpdDwvVGV4dD5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjYW5jZWxcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIlxcdTIxOTBcXHUyMTkyXCIgYWN0aW9uPVwic3dpdGNoXCIgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgKVxuICAgICAgfVxuICAgID5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAge3VybEJlZm9yZURvbWFpbn1cbiAgICAgICAgICAgIDxUZXh0IGJvbGQ+e2RvbWFpbn08L1RleHQ+XG4gICAgICAgICAgICB7dXJsQWZ0ZXJEb21haW59XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveD5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj5cbiAgICAgICAgICAgIHtmb2N1c2VkQnV0dG9uID09PSAnYWNjZXB0JyA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGJvbGQ9e2ZvY3VzZWRCdXR0b24gPT09ICdhY2NlcHQnfVxuICAgICAgICAgICAgY29sb3I9e2ZvY3VzZWRCdXR0b24gPT09ICdhY2NlcHQnID8gJ3N1Y2Nlc3MnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgZGltQ29sb3I9e2ZvY3VzZWRCdXR0b24gIT09ICdhY2NlcHQnfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHsnIEFjY2VwdCAgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAge2ZvY3VzZWRCdXR0b24gPT09ICdkZWNsaW5lJyA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGJvbGQ9e2ZvY3VzZWRCdXR0b24gPT09ICdkZWNsaW5lJ31cbiAgICAgICAgICAgIGNvbG9yPXtmb2N1c2VkQnV0dG9uID09PSAnZGVjbGluZScgPyAnZXJyb3InIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgZGltQ29sb3I9e2ZvY3VzZWRCdXR0b24gIT09ICdkZWNsaW5lJ31cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7JyBEZWNsaW5lJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgPC9EaWFsb2c+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLGNBQ0VBLHVCQUF1QixFQUN2QkMsc0JBQXNCLEVBQ3RCQyxZQUFZLEVBQ1pDLHlCQUF5QixRQUNwQixvQ0FBb0M7QUFDM0MsT0FBT0MsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsS0FBSyxJQUFJQyxXQUFXLEVBQUVDLFNBQVMsRUFBRUMsT0FBTyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ2hGLFNBQVNDLGtCQUFrQixRQUFRLGlDQUFpQztBQUNwRSxTQUFTQyxxQkFBcUIsUUFBUSxzQ0FBc0M7QUFDNUUsU0FBU0MsZUFBZSxRQUFRLGdDQUFnQztBQUNoRTtBQUNBLFNBQVNDLEdBQUcsRUFBRUMsSUFBSSxFQUFFQyxRQUFRLFFBQVEsY0FBYztBQUNsRCxTQUFTQyxhQUFhLFFBQVEsb0NBQW9DO0FBQ2xFLGNBQWNDLHVCQUF1QixRQUFR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