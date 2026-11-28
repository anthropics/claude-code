import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { useDeclaredCursor } from '../../ink/hooks/use-declared-cursor.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { Ansi, Box, Text } from '../../ink.js';
import { count } from '../../utils/array.js';
import type { PastedContent } from '../../utils/config.js';
import type { ImageDimensions } from '../../utils/imageResizer.js';
import { SelectInputOption } from './select-input-option.js';
import { SelectOption } from './select-option.js';
import { useSelectInput } from './use-select-input.js';
import { useSelectState } from './use-select-state.js';

// Extract text content from ReactNode for width calculation
function getTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (React.isValidElement<{
    children?: ReactNode;
  }>(node)) {
    return getTextContent(node.props.children);
  }
  return '';
}
type BaseOption<T> = {
  description?: string;
  dimDescription?: boolean;
  label: ReactNode;
  value: T;
  disabled?: boolean;
};
export type OptionWithDescription<T = string> = (BaseOption<T> & {
  type?: 'text';
}) | (BaseOption<T> & {
  type: 'input';
  onChange: (value: string) => void;
  placeholder?: string;
  initialValue?: string;
  /**
   * Controls behavior when submitting with empty input:
   * - true: calls onChange (treats empty as valid submission)
   * - false (default): calls onCancel (treats empty as cancellation)
   *
   * Also affects initial Enter press: when true, submits immediately;
   * when false, enters input mode first so user can type.
   */
  allowEmptySubmitToCancel?: boolean;
  /**
   * When true, always shows the label alongside the input value, regardless of
   * the global inlineDescriptions/showLabel setting. Use this when the label
   * provides important context that should always be visible (e.g., "Yes, and allow...").
   */
  showLabelWithValue?: boolean;
  /**
   * Custom separator between label and value when showLabel is true.
   * Defaults to ", ". Use ": " for labels that read better with a colon.
   */
  labelValueSeparator?: string;
  /**
   * When true, automatically reset cursor to end of line when:
   * - Option becomes focused
   * - Input value changes
   * This prevents cursor position bugs when the input value updates asynchronously.
   */
  resetCursorOnUpdate?: boolean;
});
export type SelectProps<T> = {
  /**
   * When disabled, user input is ignored.
   *
   * @default false
   */
  readonly isDisabled?: boolean;

  /**
   * When true, prevents selection on Enter but allows scrolling.
   *
   * @default false
   */
  readonly disableSelection?: boolean;

  /**
   * When true, hides the numeric indexes next to each option.
   *
   * @default false
   */
  readonly hideIndexes?: boolean;

  /**
   * Number of visible options.
   *
   * @default 5
   */
  readonly visibleOptionCount?: number;

  /**
   * Highlight text in option labels.
   */
  readonly highlightText?: string;

  /**
   * Options.
   */
  readonly options: OptionWithDescription<T>[];

  /**
   * Default value.
   */
  readonly defaultValue?: T;

  /**
   * Callback when cancel is pressed.
   */
  readonly onCancel?: () => void;

  /**
   * Callback when selected option changes.
   */
  readonly onChange?: (value: T) => void;

  /**
   * Callback when focused option changes.
   * Note: This is for one-way notification only. Avoid combining with focusValue
   * for bidirectional sync, as this can cause feedback loops.
   */
  readonly onFocus?: (value: T) => void;

  /**
   * Initial value to focus. This is used to set focus when the component mounts.
   */
  readonly defaultFocusValue?: T;

  /**
   * Layout of the options.
   * - `compact` (default) tries to use one line per option
   * - `expanded` uses multiple lines and an empty line between options
   * - `compact-vertical` uses compact index formatting with descriptions below labels
   */
  readonly layout?: 'compact' | 'expanded' | 'compact-vertical';

  /**
   * When true, descriptions are rendered inline after the label instead of
   * in a separate column. Use this for short descriptions like hints.
   *
   * @default false
   */
  readonly inlineDescriptions?: boolean;

  /**
   * Callback when user presses up from the first item.
   * If provided, navigation will not wrap to the last item.
   */
  readonly onUpFromFirstItem?: () => void;

  /**
   * Callback when user presses down from the last item.
   * If provided, navigation will not wrap to the first item.
   */
  readonly onDownFromLastItem?: () => void;

  /**
   * Callback when input mode should be toggled for an option.
   * Called when Tab is pressed (to enter or exit input mode).
   */
  readonly onInputModeToggle?: (value: T) => void;

  /**
   * Callback to open external editor for editing input option values.
   * When provided, ctrl+g will trigger this callback in input options
   * with the current value and a setter function to update the internal state.
   */
  readonly onOpenEditor?: (currentValue: string, setValue: (value: string) => void) => void;

  /**
   * Optional callback when an image is pasted into an input option.
   */
  readonly onImagePaste?: (base64Image: string, mediaType?: string, filename?: string, dimensions?: ImageDimensions, sourcePath?: string) => void;

  /**
   * Pasted content to display inline in input options.
   */
  readonly pastedContents?: Record<number, PastedContent>;

  /**
   * Callback to remove a pasted image by its ID.
   */
  readonly onRemoveImage?: (id: number) => void;
};
export function Select(t0) {
  const $ = _c(72);
  const {
    isDisabled: t1,
    hideIndexes: t2,
    visibleOptionCount: t3,
    highlightText,
    options,
    defaultValue,
    onCancel,
    onChange,
    onFocus,
    defaultFocusValue,
    layout: t4,
    disableSelection: t5,
    inlineDescriptions: t6,
    onUpFromFirstItem,
    onDownFromLastItem,
    onInputModeToggle,
    onOpenEditor,
    onImagePaste,
    pastedContents,
    onRemoveImage
  } = t0;
  const isDisabled = t1 === undefined ? false : t1;
  const hideIndexes = t2 === undefined ? false : t2;
  const visibleOptionCount = t3 === undefined ? 5 : t3;
  const layout = t4 === undefined ? "compact" : t4;
  const disableSelection = t5 === undefined ? false : t5;
  const inlineDescriptions = t6 === undefined ? false : t6;
  const [imagesSelected, setImagesSelected] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  let t7;
  if ($[0] !== options) {
    t7 = () => {
      const initialMap = new Map();
      options.forEach(option => {
        if (option.type === "input" && option.initialValue) {
          initialMap.set(option.value, option.initialValue);
        }
      });
      return initialMap;
    };
    $[0] = options;
    $[1] = t7;
  } else {
    t7 = $[1];
  }
  const [inputValues, setInputValues] = useState(t7);
  let t8;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = new Map();
    $[2] = t8;
  } else {
    t8 = $[2];
  }
  const lastInitialValues = useRef(t8);
  let t10;
  let t9;
  if ($[3] !== inputValues || $[4] !== options) {
    t9 = () => {
      for (const option_0 of options) {
        if (option_0.type === "input" && option_0.initialValue !== undefined) {
          const lastInitial = lastInitialValues.current.get(option_0.value) ?? "";
          const currentValue = inputValues.get(option_0.value) ?? "";
          const newInitial = option_0.initialValue;
          if (newInitial !== lastInitial && currentValue === lastInitial) {
            setInputValues(prev => {
              const next = new Map(prev);
              next.set(option_0.value, newInitial);
              return next;
            });
          }
          lastInitialValues.current.set(option_0.value, newInitial);
        }
      }
    };
    t10 = [options, inputValues];
    $[3] = inputValues;
    $[4] = options;
    $[5] = t10;
    $[6] = t9;
  } else {
    t10 = $[5];
    t9 = $[6];
  }
  useEffect(t9, t10);
  let t11;
  if ($[7] !== defaultFocusValue || $[8] !== defaultValue || $[9] !== onCancel || $[10] !== onChange || $[11] !== onFocus || $[12] !== options || $[13] !== visibleOptionCount) {
    t11 = {
      visibleOptionCount,
      options,
      defaultValue,
      onChange,
      onCancel,
      onFocus,
      focusValue: defaultFocusValue
    };
    $[7] = defaultFocusValue;
    $[8] = defaultValue;
    $[9] = onCancel;
    $[10] = onChange;
    $[11] = onFocus;
    $[12] = options;
    $[13] = visibleOptionCount;
    $[14] = t11;
  } else {
    t11 = $[14];
  }
  const state = useSelectState(t11);
  const t12 = disableSelection || (hideIndexes ? "numeric" : false);
  let t13;
  if ($[15] !== pastedContents) {
    t13 = () => {
      if (pastedContents && Object.values(pastedContents).some(_temp)) {
        const imageCount = count(Object.values(pastedContents), _temp2);
        setImagesSelected(true);
        setSelectedImageIndex(imageCount - 1);
        return true;
      }
      return false;
    };
    $[15] = pastedContents;
    $[16] = t13;
  } else {
    t13 = $[16];
  }
  let t14;
  if ($[17] !== imagesSelected || $[18] !== inputValues || $[19] !== isDisabled || $[20] !== onDownFromLastItem || $[21] !== onInputModeToggle || $[22] !== onUpFromFirstItem || $[23] !== options || $[24] !== state || $[25] !== t12 || $[26] !== t13) {
    t14 = {
      isDisabled,
      disableSelection: t12,
      state,
      options,
      isMultiSelect: false,
      onUpFromFirstItem,
      onDownFromLastItem,
      onInputModeToggle,
      inputValues,
      imagesSelected,
      onEnterImageSelection: t13
    };
    $[17] = imagesSelected;
    $[18] = inputValues;
    $[19] = isDisabled;
    $[20] = onDownFromLastItem;
    $[21] = onInputModeToggle;
    $[22] = onUpFromFirstItem;
    $[23] = options;
    $[24] = state;
    $[25] = t12;
    $[26] = t13;
    $[27] = t14;
  } else {
    t14 = $[27];
  }
  useSelectInput(t14);
  let T0;
  let t15;
  let t16;
  let t17;
  if ($[28] !== hideIndexes || $[29] !== highlightText || $[30] !== imagesSelected || $[31] !== inlineDescriptions || $[32] !== inputValues || $[33] !== isDisabled || $[34] !== layout || $[35] !== onCancel || $[36] !== onChange || $[37] !== onImagePaste || $[38] !== onOpenEditor || $[39] !== onRemoveImage || $[40] !== options.length || $[41] !== pastedContents || $[42] !== selectedImageIndex || $[43] !== state.focusedValue || $[44] !== state.options || $[45] !== state.value || $[46] !== state.visibleFromIndex || $[47] !== state.visibleOptions || $[48] !== state.visibleToIndex) {
    t17 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const styles = {
        container: _temp3,
        highlightedText: _temp4
      };
      if (layout === "expanded") {
        let t18;
        if ($[53] !== state.options.length) {
          t18 = state.options.length.toString();
          $[53] = state.options.length;
          $[54] = t18;
        } else {
          t18 = $[54];
        }
        const maxIndexWidth = t18.length;
        t17 = <Box {...styles.container()}>{state.visibleOptions.map((option_1, index) => {
            const isFirstVisibleOption = option_1.index === state.visibleFromIndex;
            const isLastVisibleOption = option_1.index === state.visibleToIndex - 1;
            const areMoreOptionsBelow = state.visibleToIndex < options.length;
            const areMoreOptionsAbove = state.visibleFromIndex > 0;
            const i = state.visibleFromIndex + index + 1;
            const isFocused = !isDisabled && state.focusedValue === option_1.value;
            const isSelected = state.value === option_1.value;
            if (option_1.type === "input") {
              const inputValue = inputValues.has(option_1.value) ? inputValues.get(option_1.value) : option_1.initialValue || "";
              return <SelectInputOption key={String(option_1.value)} option={option_1} isFocused={isFocused} isSelected={isSelected} shouldShowDownArrow={areMoreOptionsBelow && isLastVisibleOption} shouldShowUpArrow={areMoreOptionsAbove && isFirstVisibleOption} maxIndexWidth={maxIndexWidth} index={i} inputValue={inputValue} onInputChange={value => {
                setInputValues(prev_0 => {
                  const next_0 = new Map(prev_0);
                  next_0.set(option_1.value, value);
                  return next_0;
                });
              }} onSubmit={value_0 => {
                const hasImageAttachments = pastedContents && Object.values(pastedContents).some(_temp5);
                if (value_0.trim() || hasImageAttachments || option_1.allowEmptySubmitToCancel) {
                  onChange?.(option_1.value);
                } else {
                  onCancel?.();
                }
              }} onExit={onCancel} layout="expanded" showLabel={inlineDescriptions} onOpenEditor={onOpenEditor} resetCursorOnUpdate={option_1.resetCursorOnUpdate} onImagePaste={onImagePaste} pastedContents={pastedContents} onRemoveImage={onRemoveImage} imagesSelected={imagesSelected} selectedImageIndex={selectedImageIndex} onImagesSelectedChange={setImagesSelected} onSelectedImageIndexChange={setSelectedImageIndex} />;
            }
            let label = option_1.label;
            if (typeof option_1.label === "string" && highlightText && option_1.label.includes(highlightText)) {
              const labelText = option_1.label;
              const index_0 = labelText.indexOf(highlightText);
              label = <>{labelText.slice(0, index_0)}<Text {...styles.highlightedText()}>{highlightText}</Text>{labelText.slice(index_0 + highlightText.length)}</>;
            }
            const isOptionDisabled = option_1.disabled === true;
            const optionColor = isOptionDisabled ? undefined : isSelected ? "success" : isFocused ? "suggestion" : undefined;
            return <Box key={String(option_1.value)} flexDirection="column" flexShrink={0}><SelectOption isFocused={isFocused} isSelected={isSelected} shouldShowDownArrow={areMoreOptionsBelow && isLastVisibleOption} shouldShowUpArrow={areMoreOptionsAbove && isFirstVisibleOption}><Text dimColor={isOptionDisabled} color={optionColor}>{label}</Text></SelectOption>{option_1.description && <Box paddingLeft={2}><Text dimColor={isOptionDisabled || option_1.dimDescription !== false} color={optionColor}><Ansi>{option_1.description}</Ansi></Text></Box>}<Text> </Text></Box>;
          })}</Box>;
        break bb0;
      }
      if (layout === "compact-vertical") {
        let t18;
        if ($[55] !== hideIndexes || $[56] !== state.options) {
          t18 = hideIndexes ? 0 : state.options.length.toString().length;
          $[55] = hideIndexes;
          $[56] = state.options;
          $[57] = t18;
        } else {
          t18 = $[57];
        }
        const maxIndexWidth_0 = t18;
        t17 = <Box {...styles.container()}>{state.visibleOptions.map((option_2, index_1) => {
            const isFirstVisibleOption_0 = option_2.index === state.visibleFromIndex;
            const isLastVisibleOption_0 = option_2.index === state.visibleToIndex - 1;
            const areMoreOptionsBelow_0 = state.visibleToIndex < options.length;
            const areMoreOptionsAbove_0 = state.visibleFromIndex > 0;
            const i_0 = state.visibleFromIndex + index_1 + 1;
            const isFocused_0 = !isDisabled && state.focusedValue === option_2.value;
            const isSelected_0 = state.value === option_2.value;
            if (option_2.type === "input") {
              const inputValue_0 = inputValues.has(option_2.value) ? inputValues.get(option_2.value) : option_2.initialValue || "";
              return <SelectInputOption key={String(option_2.value)} option={option_2} isFocused={isFocused_0} isSelected={isSelected_0} shouldShowDownArrow={areMoreOptionsBelow_0 && isLastVisibleOption_0} shouldShowUpArrow={areMoreOptionsAbove_0 && isFirstVisibleOption_0} maxIndexWidth={maxIndexWidth_0} index={i_0} inputValue={inputValue_0} onInputChange={value_1 => {
                setInputValues(prev_1 => {
                  const next_1 = new Map(prev_1);
                  next_1.set(option_2.value, value_1);
                  return next_1;
                });
              }} onSubmit={value_2 => {
                const hasImageAttachments_0 = pastedContents && Object.values(pastedContents).some(_temp6);
                if (value_2.trim() || hasImageAttachments_0 || option_2.allowEmptySubmitToCancel) {
                  onChange?.(option_2.value);
                } else {
                  onCancel?.();
                }
              }} onExit={onCancel} layout="compact" showLabel={inlineDescriptions} onOpenEditor={onOpenEditor} resetCursorOnUpdate={option_2.resetCursorOnUpdate} onImagePaste={onImagePaste} pastedContents={pastedContents} onRemoveImage={onRemoveImage} imagesSelected={imagesSelected} selectedImageIndex={selectedImageIndex} onImagesSelectedChange={setImagesSelected} onSelectedImageIndexChange={setSelectedImageIndex} />;
            }
            let label_0 = option_2.label;
            if (typeof option_2.label === "string" && highlightText && option_2.label.includes(highlightText)) {
              const labelText_0 = option_2.label;
              const index_2 = labelText_0.indexOf(highlightText);
              label_0 = <>{labelText_0.slice(0, index_2)}<Text {...styles.highlightedText()}>{highlightText}</Text>{labelText_0.slice(index_2 + highlightText.length)}</>;
            }
            const isOptionDisabled_0 = option_2.disabled === true;
            return <Box key={String(option_2.value)} flexDirection="column" flexShrink={0}><SelectOption isFocused={isFocused_0} isSelected={isSelected_0} shouldShowDownArrow={areMoreOptionsBelow_0 && isLastVisibleOption_0} shouldShowUpArrow={areMoreOptionsAbove_0 && isFirstVisibleOption_0}><>{!hideIndexes && <Text dimColor={true}>{`${i_0}.`.padEnd(maxIndexWidth_0 + 1)}</Text>}<Text dimColor={isOptionDisabled_0} color={isOptionDisabled_0 ? undefined : isSelected_0 ? "success" : isFocused_0 ? "suggestion" : undefined}>{label_0}</Text></></SelectOption>{option_2.description && <Box paddingLeft={hideIndexes ? 4 : maxIndexWidth_0 + 4}><Text dimColor={isOptionDisabled_0 || option_2.dimDescription !== false} color={isOptionDisabled_0 ? undefined : isSelected_0 ? "success" : isFocused_0 ? "suggestion" : undefined}><Ansi>{option_2.description}</Ansi></Text></Box>}</Box>;
          })}</Box>;
        break bb0;
      }
      let t18;
      if ($[58] !== hideIndexes || $[59] !== state.options) {
        t18 = hideIndexes ? 0 : state.options.length.toString().length;
        $[58] = hideIndexes;
        $[59] = state.options;
        $[60] = t18;
      } else {
        t18 = $[60];
      }
      const maxIndexWidth_1 = t18;
      const hasInputOptions = state.visibleOptions.some(_temp7);
      const hasDescriptions = !inlineDescriptions && !hasInputOptions && state.visibleOptions.some(_temp8);
      const optionData = state.visibleOptions.map((option_3, index_3) => {
        const isFirstVisibleOption_1 = option_3.index === state.visibleFromIndex;
        const isLastVisibleOption_1 = option_3.index === state.visibleToIndex - 1;
        const areMoreOptionsBelow_1 = state.visibleToIndex < options.length;
        const areMoreOptionsAbove_1 = state.visibleFromIndex > 0;
        const i_1 = state.visibleFromIndex + index_3 + 1;
        const isFocused_1 = !isDisabled && state.focusedValue === option_3.value;
        const isSelected_1 = state.value === option_3.value;
        const isOptionDisabled_1 = option_3.disabled === true;
        let label_1 = option_3.label;
        if (typeof option_3.label === "string" && highlightText && option_3.label.includes(highlightText)) {
          const labelText_1 = option_3.label;
          const idx = labelText_1.indexOf(highlightText);
          label_1 = <>{labelText_1.slice(0, idx)}<Text {...styles.highlightedText()}>{highlightText}</Text>{labelText_1.slice(idx + highlightText.length)}</>;
        }
        return {
          option: option_3,
          index: i_1,
          label: label_1,
          isFocused: isFocused_1,
          isSelected: isSelected_1,
          isOptionDisabled: isOptionDisabled_1,
          shouldShowDownArrow: areMoreOptionsBelow_1 && isLastVisibleOption_1,
          shouldShowUpArrow: areMoreOptionsAbove_1 && isFirstVisibleOption_1
        };
      });
      if (hasDescriptions) {
        let t19;
        if ($[61] !== hideIndexes || $[62] !== maxIndexWidth_1) {
          t19 = data => {
            if (data.option.type === "input") {
              return 0;
            }
            const labelText_2 = getTextContent(data.option.label);
            const indexWidth = hideIndexes ? 0 : maxIndexWidth_1 + 2;
            const checkmarkWidth = data.isSelected ? 2 : 0;
            return 2 + indexWidth + stringWidth(labelText_2) + checkmarkWidth;
          };
          $[61] = hideIndexes;
          $[62] = maxIndexWidth_1;
          $[63] = t19;
        } else {
          t19 = $[63];
        }
        const maxLabelWidth = Math.max(...optionData.map(t19));
        let t20;
        if ($[64] !== hideIndexes || $[65] !== maxIndexWidth_1 || $[66] !== maxLabelWidth) {
          t20 = data_0 => {
            if (data_0.option.type === "input") {
              return null;
            }
            const labelText_3 = getTextContent(data_0.option.label);
            const indexWidth_0 = hideIndexes ? 0 : maxIndexWidth_1 + 2;
            const checkmarkWidth_0 = data_0.isSelected ? 2 : 0;
            const currentLabelWidth = 2 + indexWidth_0 + stringWidth(labelText_3) + checkmarkWidth_0;
            const padding = maxLabelWidth - currentLabelWidth;
            return <TwoColumnRow key={String(data_0.option.value)} isFocused={data_0.isFocused}><Box flexDirection="row" flexShrink={0}>{data_0.isFocused ? <Text color="suggestion">{figures.pointer}</Text> : data_0.shouldShowDownArrow ? <Text dimColor={true}>{figures.arrowDown}</Text> : data_0.shouldShowUpArrow ? <Text dimColor={true}>{figures.arrowUp}</Text> : <Text> </Text>}<Text> </Text><Text dimColor={data_0.isOptionDisabled} color={data_0.isOptionDisabled ? undefined : data_0.isSelected ? "success" : data_0.isFocused ? "suggestion" : undefined}>{!hideIndexes && <Text dimColor={true}>{`${data_0.index}.`.padEnd(maxIndexWidth_1 + 2)}</Text>}{data_0.label}</Text>{data_0.isSelected && <Text color="success"> {figures.tick}</Text>}{padding > 0 && <Text>{" ".repeat(padding)}</Text>}</Box><Box flexGrow={1} marginLeft={2}><Text wrap="wrap" dimColor={data_0.isOptionDisabled || data_0.option.dimDescription !== false} color={data_0.isOptionDisabled ? undefined : data_0.isSelected ? "success" : data_0.isFocused ? "suggestion" : undefined}><Ansi>{data_0.option.description || " "}</Ansi></Text></Box></TwoColumnRow>;
          };
          $[64] = hideIndexes;
          $[65] = maxIndexWidth_1;
          $[66] = maxLabelWidth;
          $[67] = t20;
        } else {
          t20 = $[67];
        }
        t17 = <Box {...styles.container()}>{optionData.map(t20)}</Box>;
        break bb0;
      }
      T0 = Box;
      t15 = styles.container();
      t16 = state.visibleOptions.map((option_4, index_4) => {
        if (option_4.type === "input") {
          const inputValue_1 = inputValues.has(option_4.value) ? inputValues.get(option_4.value) : option_4.initialValue || "";
          const isFirstVisibleOption_2 = option_4.index === state.visibleFromIndex;
          const isLastVisibleOption_2 = option_4.index === state.visibleToIndex - 1;
          const areMoreOptionsBelow_2 = state.visibleToIndex < options.length;
          const areMoreOptionsAbove_2 = state.visibleFromIndex > 0;
          const i_2 = state.visibleFromIndex + index_4 + 1;
          const isFocused_2 = !isDisabled && state.focusedValue === option_4.value;
          const isSelected_2 = state.value === option_4.value;
          return <SelectInputOption key={String(option_4.value)} option={option_4} isFocused={isFocused_2} isSelected={isSelected_2} shouldShowDownArrow={areMoreOptionsBelow_2 && isLastVisibleOption_2} shouldShowUpArrow={areMoreOptionsAbove_2 && isFirstVisibleOption_2} maxIndexWidth={maxIndexWidth_1} index={i_2} inputValue={inputValue_1} onInputChange={value_3 => {
            setInputValues(prev_2 => {
              const next_2 = new Map(prev_2);
              next_2.set(option_4.value, value_3);
              return next_2;
            });
          }} onSubmit={value_4 => {
            const hasImageAttachments_1 = pastedContents && Object.values(pastedContents).some(_temp9);
            if (value_4.trim() || hasImageAttachments_1 || option_4.allowEmptySubmitToCancel) {
              onChange?.(option_4.value);
            } else {
              onCancel?.();
            }
          }} onExit={onCancel} layout="compact" showLabel={inlineDescriptions} onOpenEditor={onOpenEditor} resetCursorOnUpdate={option_4.resetCursorOnUpdate} onImagePaste={onImagePaste} pastedContents={pastedContents} onRemoveImage={onRemoveImage} imagesSelected={imagesSelected} selectedImageIndex={selectedImageIndex} onImagesSelectedChange={setImagesSelected} onSelectedImageIndexChange={setSelectedImageIndex} />;
        }
        let label_2 = option_4.label;
        if (typeof option_4.label === "string" && highlightText && option_4.label.includes(highlightText)) {
          const labelText_4 = option_4.label;
          const index_5 = labelText_4.indexOf(highlightText);
          label_2 = <>{labelText_4.slice(0, index_5)}<Text {...styles.highlightedText()}>{highlightText}</Text>{labelText_4.slice(index_5 + highlightText.length)}</>;
        }
        const isFirstVisibleOption_3 = option_4.index === state.visibleFromIndex;
        const isLastVisibleOption_3 = option_4.index === state.visibleToIndex - 1;
        const areMoreOptionsBelow_3 = state.visibleToIndex < options.length;
        const areMoreOptionsAbove_3 = state.visibleFromIndex > 0;
        const i_3 = state.visibleFromIndex + index_4 + 1;
        const isFocused_3 = !isDisabled && state.focusedValue === option_4.value;
        const isSelected_3 = state.value === option_4.value;
        const isOptionDisabled_2 = option_4.disabled === true;
        return <SelectOption key={String(option_4.value)} isFocused={isFocused_3} isSelected={isSelected_3} shouldShowDownArrow={areMoreOptionsBelow_3 && isLastVisibleOption_3} shouldShowUpArrow={areMoreOptionsAbove_3 && isFirstVisibleOption_3}><Box flexDirection="row" flexShrink={0}>{!hideIndexes && <Text dimColor={true}>{`${i_3}.`.padEnd(maxIndexWidth_1 + 2)}</Text>}<Text dimColor={isOptionDisabled_2} color={isOptionDisabled_2 ? undefined : isSelected_3 ? "success" : isFocused_3 ? "suggestion" : undefined}>{label_2}{inlineDescriptions && option_4.description && <Text dimColor={isOptionDisabled_2 || option_4.dimDescription !== false}>{" "}{option_4.description}</Text>}</Text></Box>{!inlineDescriptions && option_4.description && <Box flexShrink={99} marginLeft={2}><Text wrap="wrap-trim" dimColor={isOptionDisabled_2 || option_4.dimDescription !== false} color={isOptionDisabled_2 ? undefined : isSelected_3 ? "success" : isFocused_3 ? "suggestion" : undefined}><Ansi>{option_4.description}</Ansi></Text></Box>}</SelectOption>;
      });
    }
    $[28] = hideIndexes;
    $[29] = highlightText;
    $[30] = imagesSelected;
    $[31] = inlineDescriptions;
    $[32] = inputValues;
    $[33] = isDisabled;
    $[34] = layout;
    $[35] = onCancel;
    $[36] = onChange;
    $[37] = onImagePaste;
    $[38] = onOpenEditor;
    $[39] = onRemoveImage;
    $[40] = options.length;
    $[41] = pastedContents;
    $[42] = selectedImageIndex;
    $[43] = state.focusedValue;
    $[44] = state.options;
    $[45] = state.value;
    $[46] = state.visibleFromIndex;
    $[47] = state.visibleOptions;
    $[48] = state.visibleToIndex;
    $[49] = T0;
    $[50] = t15;
    $[51] = t16;
    $[52] = t17;
  } else {
    T0 = $[49];
    t15 = $[50];
    t16 = $[51];
    t17 = $[52];
  }
  if (t17 !== Symbol.for("react.early_return_sentinel")) {
    return t17;
  }
  let t18;
  if ($[68] !== T0 || $[69] !== t15 || $[70] !== t16) {
    t18 = <T0 {...t15}>{t16}</T0>;
    $[68] = T0;
    $[69] = t15;
    $[70] = t16;
    $[71] = t18;
  } else {
    t18 = $[71];
  }
  return t18;
}

// Row container for the two-column (label + description) layout. Unlike
// the other Select layouts, this one doesn't render through SelectOption →
// ListItem, so it declares the native cursor directly. Parks the cursor
// on the pointer indicator so screen readers / magnifiers track focus.
function _temp9(c_3) {
  return c_3.type === "image";
}
function _temp8(opt_0) {
  return opt_0.description;
}
function _temp7(opt) {
  return opt.type === "input";
}
function _temp6(c_2) {
  return c_2.type === "image";
}
function _temp5(c_1) {
  return c_1.type === "image";
}
function _temp4() {
  return {
    bold: true
  };
}
function _temp3() {
  return {
    flexDirection: "column" as const
  };
}
function _temp2(c) {
  return c.type === "image";
}
function _temp(c_0) {
  return c_0.type === "image";
}
function TwoColumnRow(t0) {
  const $ = _c(5);
  const {
    isFocused,
    children
  } = t0;
  let t1;
  if ($[0] !== isFocused) {
    t1 = {
      line: 0,
      column: 0,
      active: isFocused
    };
    $[0] = isFocused;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const cursorRef = useDeclaredCursor(t1);
  let t2;
  if ($[2] !== children || $[3] !== cursorRef) {
    t2 = <Box ref={cursorRef} flexDirection="row">{children}</Box>;
    $[2] = children;
    $[3] = cursorRef;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  return t2;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJSZWFjdE5vZGUiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZURlY2xhcmVkQ3Vyc29yIiwic3RyaW5nV2lkdGgiLCJBbnNpIiwiQm94IiwiVGV4dCIsImNvdW50IiwiUGFzdGVkQ29udGVudCIsIkltYWdlRGltZW5zaW9ucyIsIlNlbGVjdElucHV0T3B0aW9uIiwiU2VsZWN0T3B0aW9uIiwidXNlU2VsZWN0SW5wdXQiLCJ1c2VTZWxlY3RTdGF0ZSIsImdldFRleHRDb250ZW50Iiwibm9kZSIsIlN0cmluZyIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsImpvaW4iLCJpc1ZhbGlkRWxlbWVudCIsImNoaWxkcmVuIiwicHJvcHMiLCJCYXNlT3B0aW9uIiwiZGVzY3JpcHRpb24iLCJkaW1EZXNjcmlwdGlvbiIsImxhYmVsIiwidmFsdWUiLCJUIiwiZGlzYWJsZWQiLCJPcHRpb25XaXRoRGVzY3JpcHRpb24iLCJ0eXBlIiwib25DaGFuZ2UiLCJwbGFjZWhvbGRlciIsImluaXRpYWxWYWx1ZSIsImFsbG93RW1wdHlTdWJtaXRUb0NhbmNlbCIsInNob3dMYWJlbFdpdGhWYWx1ZSIsImxhYmVsVmFsdWVTZXBhcmF0b3IiLCJyZXNldEN1cnNvck9uVXBkYXRlIiwiU2VsZWN0UHJvcHMiLCJpc0Rpc2FibGVkIiwiZGlzYWJsZVNlbGVjdGlvbiIsImhpZGVJbmRleGVzIiwidmlzaWJsZU9wdGlvbkNvdW50IiwiaGlnaGxpZ2h0VGV4dCIsIm9wdGlvbnMiLCJkZWZhdWx0VmFsdWUiLCJvbkNhbmNlbCIsIm9uRm9jdXMiLCJkZWZhdWx0Rm9jdXNWYWx1ZSIsImxheW91dCIsImlubGluZURlc2NyaXB0aW9ucyIsIm9uVXBGcm9tRmlyc3RJdGVtIiwib25Eb3duRnJvbUxhc3RJdGVtIiwib25JbnB1dE1vZGVUb2dnbGUiLCJvbk9wZW5FZGl0b3IiLCJjdXJyZW50VmFsdWUiLCJzZXRWYWx1ZSIsIm9uSW1hZ2VQYXN0ZSIsImJhc2U2NEltYWdlIiwibWVkaWFUeXBlIiwiZmlsZW5hbWUiLCJkaW1lbnNpb25zIiwic291cmNlUGF0aCIsInBhc3RlZENvbnRlbnRzIiwiUmVjb3JkIiwib25SZW1vdmVJbWFnZSIsImlkIiwiU2VsZWN0IiwidDAiLCIkIiwiX2MiLCJ0MSIsInQyIiwidDMiLCJ0NCIsInQ1IiwidDYiLCJ1bmRlZmluZWQiLCJpbWFnZXNTZWxlY3RlZCIsInNldEltYWdlc1NlbGVjdGVkIiwic2VsZWN0ZWRJbWFnZUluZGV4Iiwic2V0U2VsZWN0ZWRJbWFnZUluZGV4IiwidDciLCJpbml0aWFsTWFwIiwiTWFwIiwiZm9yRWFjaCIsIm9wdGlvbiIsInNldCIsImlucHV0VmFsdWVzIiwic2V0SW5wdXRWYWx1ZXMiLCJ0OCIsIlN5bWJvbCIsImZvciIsImxhc3RJbml0aWFsVmFsdWVzIiwidDEwIiwidDkiLCJvcHRpb25fMCIsImxhc3RJbml0aWFsIiwiY3VycmVudCIsImdldCIsIm5ld0luaXRpYWwiLCJwcmV2IiwibmV4dCIsInQxMSIsImZvY3VzVmFsdWUiLCJzdGF0ZSIsInQxMiIsInQxMyIsIk9iamVjdCIsInZhbHVlcyIsInNvbWUiLCJfdGVtcCIsImltYWdlQ291bnQiLCJfdGVtcDIiLCJ0MTQiLCJpc011bHRpU2VsZWN0Iiwib25FbnRlckltYWdlU2VsZWN0aW9uIiwiVDAiLCJ0MTUiLCJ0MTYiLCJ0MTciLCJsZW5ndGgiLCJmb2N1c2VkVmFsdWUiLCJ2aXNpYmxlRnJvbUluZGV4IiwidmlzaWJsZU9wdGlvbnMiLCJ2aXNpYmxlVG9JbmRleCIsImJiMCIsInN0eWxlcyIsImNvbnRhaW5lciIsIl90ZW1wMyIsImhpZ2hsaWdodGVkVGV4dCIsIl90ZW1wNCIsInQxOCIsInRvU3RyaW5nIiwibWF4SW5kZXhXaWR0aCIsIm9wdGlvbl8xIiwiaW5kZXgiLCJpc0ZpcnN0VmlzaWJsZU9wdGlvbiIsImlzTGFzdFZpc2libGVPcHRpb24iLCJhcmVNb3JlT3B0aW9uc0JlbG93IiwiYXJlTW9yZU9wdGlvbnNBYm92ZSIsImkiLCJpc0ZvY3VzZWQiLCJpc1NlbGVjdGVkIiwiaW5wdXRWYWx1ZSIsImhhcyIsInByZXZfMCIsIm5leHRfMCIsInZhbHVlXzAiLCJoYXNJbWFnZUF0dGFjaG1lbnRzIiwiX3RlbXA1IiwidHJpbSIsImluY2x1ZGVzIiwibGFiZWxUZXh0IiwiaW5kZXhfMCIsImluZGV4T2YiLCJzbGljZSIsImlzT3B0aW9uRGlzYWJsZWQiLCJvcHRpb25Db2xvciIsIm1heEluZGV4V2lkdGhfMCIsIm9wdGlvbl8yIiwiaW5kZXhfMSIsImlzRmlyc3RWaXNpYmxlT3B0aW9uXzAiLCJpc0xhc3RWaXNpYmxlT3B0aW9uXzAiLCJhcmVNb3JlT3B0aW9uc0JlbG93XzAiLCJhcmVNb3JlT3B0aW9uc0Fib3ZlXzAiLCJpXzAiLCJpc0ZvY3VzZWRfMCIsImlzU2VsZWN0ZWRfMCIsImlucHV0VmFsdWVfMCIsInZhbHVlXzEiLCJwcmV2XzEiLCJuZXh0XzEiLCJ2YWx1ZV8yIiwiaGFzSW1hZ2VBdHRhY2htZW50c18wIiwiX3RlbXA2IiwibGFiZWxfMCIsImxhYmVsVGV4dF8wIiwiaW5kZXhfMiIsImlzT3B0aW9uRGlzYWJsZWRfMCIsInBhZEVuZCIsIm1heEluZGV4V2lkdGhfMSIsImhhc0lucHV0T3B0aW9ucyIsIl90ZW1wNyIsImhhc0Rlc2NyaXB0aW9ucyIsIl90ZW1wOCIsIm9wdGlvbkRhdGEiLCJvcHRpb25fMyIsImluZGV4XzMiLCJpc0ZpcnN0VmlzaWJsZU9wdGlvbl8xIiwiaXNMYXN0VmlzaWJsZU9wdGlvbl8xIiwiYXJlTW9yZU9wdGlvbnNCZWxvd18xIiwiYXJlTW9yZU9wdGlvbnNBYm92ZV8xIiwiaV8xIiwiaXNGb2N1c2VkXzEiLCJpc1NlbGVjdGVkXzEiLCJpc09wdGlvbkRpc2FibGVkXzEiLCJsYWJlbF8xIiwibGFiZWxUZXh0XzEiLCJpZHgiLCJzaG91bGRTaG93RG93bkFycm93Iiwic2hvdWxkU2hvd1VwQXJyb3ciLCJ0MTkiLCJkYXRhIiwibGFiZWxUZXh0XzIiLCJpbmRleFdpZHRoIiwiY2hlY2ttYXJrV2lkdGgiLCJtYXhMYWJlbFdpZHRoIiwiTWF0aCIsIm1heCIsInQyMCIsImRhdGFfMCIsImxhYmVsVGV4dF8zIiwiaW5kZXhXaWR0aF8wIiwiY2hlY2ttYXJrV2lkdGhfMCIsImN1cnJlbnRMYWJlbFdpZHRoIiwicGFkZGluZyIsInBvaW50ZXIiLCJhcnJvd0Rvd24iLCJhcnJvd1VwIiwidGljayIsInJlcGVhdCIsIm9wdGlvbl80IiwiaW5kZXhfNCIsImlucHV0VmFsdWVfMSIsImlzRmlyc3RWaXNpYmxlT3B0aW9uXzIiLCJpc0xhc3RWaXNpYmxlT3B0aW9uXzIiLCJhcmVNb3JlT3B0aW9uc0JlbG93XzIiLCJhcmVNb3JlT3B0aW9uc0Fib3ZlXzIiLCJpXzIiLCJpc0ZvY3VzZWRfMiIsImlzU2VsZWN0ZWRfMiIsInZhbHVlXzMiLCJwcmV2XzIiLCJuZXh0XzIiLCJ2YWx1ZV80IiwiaGFzSW1hZ2VBdHRhY2htZW50c18xIiwiX3RlbXA5IiwibGFiZWxfMiIsImxhYmVsVGV4dF80IiwiaW5kZXhfNSIsImlzRmlyc3RWaXNpYmxlT3B0aW9uXzMiLCJpc0xhc3RWaXNpYmxlT3B0aW9uXzMiLCJhcmVNb3JlT3B0aW9uc0JlbG93XzMiLCJhcmVNb3JlT3B0aW9uc0Fib3ZlXzMiLCJpXzMiLCJpc0ZvY3VzZWRfMyIsImlzU2VsZWN0ZWRfMyIsImlzT3B0aW9uRGlzYWJsZWRfMiIsImNfMyIsImMiLCJvcHRfMCIsIm9wdCIsImNfMiIsImNfMSIsImJvbGQiLCJmbGV4RGlyZWN0aW9uIiwiY29uc3QiLCJjXzAiLCJUd29Db2x1bW5Sb3ciLCJsaW5lIiwiY29sdW1uIiwiYWN0aXZlIiwiY3Vyc29yUmVmIl0sInNvdXJjZXMiOlsic2VsZWN0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IFJlYWN0LCB7IHR5cGUgUmVhY3ROb2RlLCB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZURlY2xhcmVkQ3Vyc29yIH0gZnJvbSAnLi4vLi4vaW5rL2hvb2tzL3VzZS1kZWNsYXJlZC1jdXJzb3IuanMnXG5pbXBvcnQgeyBzdHJpbmdXaWR0aCB9IGZyb20gJy4uLy4uL2luay9zdHJpbmdXaWR0aC5qcydcbmltcG9ydCB7IEFuc2ksIEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IGNvdW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvYXJyYXkuanMnXG5pbXBvcnQgdHlwZSB7IFBhc3RlZENvbnRlbnQgfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgdHlwZSB7IEltYWdlRGltZW5zaW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2ltYWdlUmVzaXplci5qcydcbmltcG9ydCB7IFNlbGVjdElucHV0T3B0aW9uIH0gZnJvbSAnLi9zZWxlY3QtaW5wdXQtb3B0aW9uLmpzJ1xuaW1wb3J0IHsgU2VsZWN0T3B0aW9uIH0gZnJvbSAnLi9zZWxlY3Qtb3B0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlU2VsZWN0SW5wdXQgfSBmcm9tICcuL3VzZS1zZWxlY3QtaW5wdXQuanMnXG5pbXBvcnQgeyB1c2VTZWxlY3RTdGF0ZSB9IGZyb20gJy4vdXNlLXNlbGVjdC1zdGF0ZS5qcydcblxuLy8gRXh0cmFjdCB0ZXh0IGNvbnRlbnQgZnJvbSBSZWFjdE5vZGUgZm9yIHdpZHRoIGNhbGN1bGF0aW9uXG5mdW5jdGlvbiBnZXRUZXh0Q29udGVudChub2RlOiBSZWFjdE5vZGUpOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZVxuICBpZiAodHlwZW9mIG5vZGUgPT09ICdudW1iZXInKSByZXR1cm4gU3RyaW5nKG5vZGUpXG4gIGlmICghbm9kZSkgcmV0dXJuICcnXG4gIGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSByZXR1cm4gbm9kZS5tYXAoZ2V0VGV4dENvbnRlbnQpLmpvaW4oJycpXG4gIGlmIChSZWFjdC5pc1ZhbGlkRWxlbWVudDx7IGNoaWxkcmVuPzogUmVhY3ROb2RlIH0+KG5vZGUpKSB7XG4gICAgcmV0dXJuIGdldFRleHRDb250ZW50KG5vZGUucHJvcHMuY2hpbGRyZW4pXG4gIH1cbiAgcmV0dXJuICcnXG59XG5cbnR5cGUgQmFzZU9wdGlvbjxUPiA9IHtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgZGltRGVzY3JpcHRpb24/OiBib29sZWFuXG4gIGxhYmVsOiBSZWFjdE5vZGVcbiAgdmFsdWU6IFRcbiAgZGlzYWJsZWQ/OiBib29sZWFuXG59XG5cbmV4cG9ydCB0eXBlIE9wdGlvbldpdGhEZXNjcmlwdGlvbjxUID0gc3RyaW5nPiA9XG4gIHwgKEJhc2VPcHRpb248VD4gJiB7XG4gICAgICB0eXBlPzogJ3RleHQnXG4gICAgfSlcbiAgfCAoQmFzZU9wdGlvbjxUPiAmIHtcbiAgICAgIHR5cGU6ICdpbnB1dCdcbiAgICAgIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZFxuICAgICAgcGxhY2Vob2xkZXI/OiBzdHJpbmdcbiAgICAgIGluaXRpYWxWYWx1ZT86IHN0cmluZ1xuICAgICAgLyoqXG4gICAgICAgKiBDb250cm9scyBiZWhhdmlvciB3aGVuIHN1Ym1pdHRpbmcgd2l0aCBlbXB0eSBpbnB1dDpcbiAgICAgICAqIC0gdHJ1ZTogY2FsbHMgb25DaGFuZ2UgKHRyZWF0cyBlbXB0eSBhcyB2YWxpZCBzdWJtaXNzaW9uKVxuICAgICAgICogLSBmYWxzZSAoZGVmYXVsdCk6IGNhbGxzIG9uQ2FuY2VsICh0cmVhdHMgZW1wdHkgYXMgY2FuY2VsbGF0aW9uKVxuICAgICAgICpcbiAgICAgICAqIEFsc28gYWZmZWN0cyBpbml0aWFsIEVudGVyIHByZXNzOiB3aGVuIHRydWUsIHN1Ym1pdHMgaW1tZWRpYXRlbHk7XG4gICAgICAgKiB3aGVuIGZhbHNlLCBlbnRlcnMgaW5wdXQgbW9kZSBmaXJzdCBzbyB1c2VyIGNhbiB0eXBlLlxuICAgICAgICovXG4gICAgICBhbGxvd0VtcHR5U3VibWl0VG9DYW5jZWw/OiBib29sZWFuXG4gICAgICAvKipcbiAgICAgICAqIFdoZW4gdHJ1ZSwgYWx3YXlzIHNob3dzIHRoZSBsYWJlbCBhbG9uZ3NpZGUgdGhlIGlucHV0IHZhbHVlLCByZWdhcmRsZXNzIG9mXG4gICAgICAgKiB0aGUgZ2xvYmFsIGlubGluZURlc2NyaXB0aW9ucy9zaG93TGFiZWwgc2V0dGluZy4gVXNlIHRoaXMgd2hlbiB0aGUgbGFiZWxcbiAgICAgICAqIHByb3ZpZGVzIGltcG9ydGFudCBjb250ZXh0IHRoYXQgc2hvdWxkIGFsd2F5cyBiZSB2aXNpYmxlIChlLmcuLCBcIlllcywgYW5kIGFsbG93Li4uXCIpLlxuICAgICAgICovXG4gICAgICBzaG93TGFiZWxXaXRoVmFsdWU/OiBib29sZWFuXG4gICAgICAvKipcbiAgICAgICAqIEN1c3RvbSBzZXBhcmF0b3IgYmV0d2VlbiBsYWJlbCBhbmQgdmFsdWUgd2hlbiBzaG93TGFiZWwgaXMgdHJ1ZS5cbiAgICAgICAqIERlZmF1bHRzIHRvIFwiLCBcIi4gVXNlIFwiOiBcIiBmb3IgbGFiZWxzIHRoYXQgcmVhZCBiZXR0ZXIgd2l0aCBhIGNvbG9uLlxuICAgICAgICovXG4gICAgICBsYWJlbFZhbHVlU2VwYXJhdG9yPzogc3RyaW5nXG4gICAgICAvKipcbiAgICAgICAqIFdoZW4gdHJ1ZSwgYXV0b21hdGljYWxseSByZXNldCBjdXJzb3IgdG8gZW5kIG9mIGxpbmUgd2hlbjpcbiAgICAgICAqIC0gT3B0aW9uIGJlY29tZXMgZm9jdXNlZFxuICAgICAgICogLSBJbnB1dCB2YWx1ZSBjaGFuZ2VzXG4gICAgICAgKiBUaGlzIHByZXZlbnRzIGN1cnNvciBwb3NpdGlvbiBidWdzIHdoZW4gdGhlIGlucHV0IHZhbHVlIHVwZGF0ZXMgYXN5bmNocm9ub3VzbHkuXG4gICAgICAgKi9cbiAgICAgIHJlc2V0Q3Vyc29yT25VcGRhdGU/OiBib29sZWFuXG4gICAgfSlcblxuZXhwb3J0IHR5cGUgU2VsZWN0UHJvcHM8VD4gPSB7XG4gIC8qKlxuICAgKiBXaGVuIGRpc2FibGVkLCB1c2VyIGlucHV0IGlzIGlnbm9yZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBpc0Rpc2FibGVkPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBXaGVuIHRydWUsIHByZXZlbnRzIHNlbGVjdGlvbiBvbiBFbnRlciBidXQgYWxsb3dzIHNjcm9sbGluZy5cbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHJlYWRvbmx5IGRpc2FibGVTZWxlY3Rpb24/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFdoZW4gdHJ1ZSwgaGlkZXMgdGhlIG51bWVyaWMgaW5kZXhlcyBuZXh0IHRvIGVhY2ggb3B0aW9uLlxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgaGlkZUluZGV4ZXM/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiB2aXNpYmxlIG9wdGlvbnMuXG4gICAqXG4gICAqIEBkZWZhdWx0IDVcbiAgICovXG4gIHJlYWRvbmx5IHZpc2libGVPcHRpb25Db3VudD86IG51bWJlclxuXG4gIC8qKlxuICAgKiBIaWdobGlnaHQgdGV4dCBpbiBvcHRpb24gbGFiZWxzLlxuICAgKi9cbiAgcmVhZG9ubHkgaGlnaGxpZ2h0VGV4dD86IHN0cmluZ1xuXG4gIC8qKlxuICAgKiBPcHRpb25zLlxuICAgKi9cbiAgcmVhZG9ubHkgb3B0aW9uczogT3B0aW9uV2l0aERlc2NyaXB0aW9uPFQ+W11cblxuICAvKipcbiAgICogRGVmYXVsdCB2YWx1ZS5cbiAgICovXG4gIHJlYWRvbmx5IGRlZmF1bHRWYWx1ZT86IFRcblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBjYW5jZWwgaXMgcHJlc3NlZC5cbiAgICovXG4gIHJlYWRvbmx5IG9uQ2FuY2VsPzogKCkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIHNlbGVjdGVkIG9wdGlvbiBjaGFuZ2VzLlxuICAgKi9cbiAgcmVhZG9ubHkgb25DaGFuZ2U/OiAodmFsdWU6IFQpID0+IHZvaWRcblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBmb2N1c2VkIG9wdGlvbiBjaGFuZ2VzLlxuICAgKiBOb3RlOiBUaGlzIGlzIGZvciBvbmUtd2F5IG5vdGlmaWNhdGlvbiBvbmx5LiBBdm9pZCBjb21iaW5pbmcgd2l0aCBmb2N1c1ZhbHVlXG4gICAqIGZvciBiaWRpcmVjdGlvbmFsIHN5bmMsIGFzIHRoaXMgY2FuIGNhdXNlIGZlZWRiYWNrIGxvb3BzLlxuICAgKi9cbiAgcmVhZG9ubHkgb25Gb2N1cz86ICh2YWx1ZTogVCkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBJbml0aWFsIHZhbHVlIHRvIGZvY3VzLiBUaGlzIGlzIHVzZWQgdG8gc2V0IGZvY3VzIHdoZW4gdGhlIGNvbXBvbmVudCBtb3VudHMuXG4gICAqL1xuICByZWFkb25seSBkZWZhdWx0Rm9jdXNWYWx1ZT86IFRcblxuICAvKipcbiAgICogTGF5b3V0IG9mIHRoZSBvcHRpb25zLlxuICAgKiAtIGBjb21wYWN0YCAoZGVmYXVsdCkgdHJpZXMgdG8gdXNlIG9uZSBsaW5lIHBlciBvcHRpb25cbiAgICogLSBgZXhwYW5kZWRgIHVzZXMgbXVsdGlwbGUgbGluZXMgYW5kIGFuIGVtcHR5IGxpbmUgYmV0d2VlbiBvcHRpb25zXG4gICAqIC0gYGNvbXBhY3QtdmVydGljYWxgIHVzZXMgY29tcGFjdCBpbmRleCBmb3JtYXR0aW5nIHdpdGggZGVzY3JpcHRpb25zIGJlbG93IGxhYmVsc1xuICAgKi9cbiAgcmVhZG9ubHkgbGF5b3V0PzogJ2NvbXBhY3QnIHwgJ2V4cGFuZGVkJyB8ICdjb21wYWN0LXZlcnRpY2FsJ1xuXG4gIC8qKlxuICAgKiBXaGVuIHRydWUsIGRlc2NyaXB0aW9ucyBhcmUgcmVuZGVyZWQgaW5saW5lIGFmdGVyIHRoZSBsYWJlbCBpbnN0ZWFkIG9mXG4gICAqIGluIGEgc2VwYXJhdGUgY29sdW1uLiBVc2UgdGhpcyBmb3Igc2hvcnQgZGVzY3JpcHRpb25zIGxpa2UgaGludHMuXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBpbmxpbmVEZXNjcmlwdGlvbnM/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gdXNlciBwcmVzc2VzIHVwIGZyb20gdGhlIGZpcnN0IGl0ZW0uXG4gICAqIElmIHByb3ZpZGVkLCBuYXZpZ2F0aW9uIHdpbGwgbm90IHdyYXAgdG8gdGhlIGxhc3QgaXRlbS5cbiAgICovXG4gIHJlYWRvbmx5IG9uVXBGcm9tRmlyc3RJdGVtPzogKCkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIHVzZXIgcHJlc3NlcyBkb3duIGZyb20gdGhlIGxhc3QgaXRlbS5cbiAgICogSWYgcHJvdmlkZWQsIG5hdmlnYXRpb24gd2lsbCBub3Qgd3JhcCB0byB0aGUgZmlyc3QgaXRlbS5cbiAgICovXG4gIHJlYWRvbmx5IG9uRG93bkZyb21MYXN0SXRlbT86ICgpID0+IHZvaWRcblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBpbnB1dCBtb2RlIHNob3VsZCBiZSB0b2dnbGVkIGZvciBhbiBvcHRpb24uXG4gICAqIENhbGxlZCB3aGVuIFRhYiBpcyBwcmVzc2VkICh0byBlbnRlciBvciBleGl0IGlucHV0IG1vZGUpLlxuICAgKi9cbiAgcmVhZG9ubHkgb25JbnB1dE1vZGVUb2dnbGU/OiAodmFsdWU6IFQpID0+IHZvaWRcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdG8gb3BlbiBleHRlcm5hbCBlZGl0b3IgZm9yIGVkaXRpbmcgaW5wdXQgb3B0aW9uIHZhbHVlcy5cbiAgICogV2hlbiBwcm92aWRlZCwgY3RybCtnIHdpbGwgdHJpZ2dlciB0aGlzIGNhbGxiYWNrIGluIGlucHV0IG9wdGlvbnNcbiAgICogd2l0aCB0aGUgY3VycmVudCB2YWx1ZSBhbmQgYSBzZXR0ZXIgZnVuY3Rpb24gdG8gdXBkYXRlIHRoZSBpbnRlcm5hbCBzdGF0ZS5cbiAgICovXG4gIHJlYWRvbmx5IG9uT3BlbkVkaXRvcj86IChcbiAgICBjdXJyZW50VmFsdWU6IHN0cmluZyxcbiAgICBzZXRWYWx1ZTogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWQsXG4gICkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBPcHRpb25hbCBjYWxsYmFjayB3aGVuIGFuIGltYWdlIGlzIHBhc3RlZCBpbnRvIGFuIGlucHV0IG9wdGlvbi5cbiAgICovXG4gIHJlYWRvbmx5IG9uSW1hZ2VQYXN0ZT86IChcbiAgICBiYXNlNjRJbWFnZTogc3RyaW5nLFxuICAgIG1lZGlhVHlwZT86IHN0cmluZyxcbiAgICBmaWxlbmFtZT86IHN0cmluZyxcbiAgICBkaW1lbnNpb25zPzogSW1hZ2VEaW1lbnNpb25zLFxuICAgIHNvdXJjZVBhdGg/OiBzdHJpbmcsXG4gICkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBQYXN0ZWQgY29udGVudCB0byBkaXNwbGF5IGlubGluZSBpbiBpbnB1dCBvcHRpb25zLlxuICAgKi9cbiAgcmVhZG9ubHkgcGFzdGVkQ29udGVudHM/OiBSZWNvcmQ8bnVtYmVyLCBQYXN0ZWRDb250ZW50PlxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0byByZW1vdmUgYSBwYXN0ZWQgaW1hZ2UgYnkgaXRzIElELlxuICAgKi9cbiAgcmVhZG9ubHkgb25SZW1vdmVJbWFnZT86IChpZDogbnVtYmVyKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTZWxlY3Q8VD4oe1xuICBpc0Rpc2FibGVkID0gZmFsc2UsXG4gIGhpZGVJbmRleGVzID0gZmFsc2UsXG4gIHZpc2libGVPcHRpb25Db3VudCA9IDUsXG4gIGhpZ2hsaWdodFRleHQsXG4gIG9wdGlvbnMsXG4gIGRlZmF1bHRWYWx1ZSxcbiAgb25DYW5jZWwsXG4gIG9uQ2hhbmdlLFxuICBvbkZvY3VzLFxuICBkZWZhdWx0Rm9jdXNWYWx1ZSxcbiAgbGF5b3V0ID0gJ2NvbXBhY3QnLFxuICBkaXNhYmxlU2VsZWN0aW9uID0gZmFsc2UsXG4gIGlubGluZURlc2NyaXB0aW9ucyA9IGZhbHNlLFxuICBvblVwRnJvbUZpcnN0SXRlbSxcbiAgb25Eb3duRnJvbUxhc3RJdGVtLFxuICBvbklucHV0TW9kZVRvZ2dsZSxcbiAgb25PcGVuRWRpdG9yLFxuICBvbkltYWdlUGFzdGUsXG4gIHBhc3RlZENvbnRlbnRzLFxuICBvblJlbW92ZUltYWdlLFxufTogU2VsZWN0UHJvcHM8VD4pOiBSZWFjdC5SZWFjdE5vZGUge1xuICAvLyBJbWFnZSBzZWxlY3Rpb24gbW9kZSBzdGF0ZVxuICBjb25zdCBbaW1hZ2VzU2VsZWN0ZWQsIHNldEltYWdlc1NlbGVjdGVkXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2VsZWN0ZWRJbWFnZUluZGV4LCBzZXRTZWxlY3RlZEltYWdlSW5kZXhdID0gdXNlU3RhdGUoMClcblxuICAvLyBTdGF0ZSBmb3IgaW5wdXQgdHlwZSBvcHRpb25zXG4gIGNvbnN0IFtpbnB1dFZhbHVlcywgc2V0SW5wdXRWYWx1ZXNdID0gdXNlU3RhdGU8TWFwPFQsIHN0cmluZz4+KCgpID0+IHtcbiAgICBjb25zdCBpbml0aWFsTWFwID0gbmV3IE1hcDxULCBzdHJpbmc+KClcbiAgICBvcHRpb25zLmZvckVhY2gob3B0aW9uID0+IHtcbiAgICAgIGlmIChvcHRpb24udHlwZSA9PT0gJ2lucHV0JyAmJiBvcHRpb24uaW5pdGlhbFZhbHVlKSB7XG4gICAgICAgIGluaXRpYWxNYXAuc2V0KG9wdGlvbi52YWx1ZSwgb3B0aW9uLmluaXRpYWxWYWx1ZSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBpbml0aWFsTWFwXG4gIH0pXG5cbiAgLy8gVHJhY2sgdGhlIGxhc3QgaW5pdGlhbFZhbHVlIHdlIHN5bmNlZCwgc28gd2UgY2FuIGRldGVjdCB1c2VyIGVkaXRzXG4gIGNvbnN0IGxhc3RJbml0aWFsVmFsdWVzID0gdXNlUmVmPE1hcDxULCBzdHJpbmc+PihuZXcgTWFwKCkpXG5cbiAgLy8gU3luYyBpbml0aWFsVmFsdWUgY2hhbmdlcyB0byBpbnB1dFZhbHVlcyBzdGF0ZSwgYnV0IG9ubHkgaWYgdXNlciBoYXNuJ3QgZWRpdGVkXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgZm9yIChjb25zdCBvcHRpb24gb2Ygb3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbi50eXBlID09PSAnaW5wdXQnICYmIG9wdGlvbi5pbml0aWFsVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBsYXN0SW5pdGlhbCA9IGxhc3RJbml0aWFsVmFsdWVzLmN1cnJlbnQuZ2V0KG9wdGlvbi52YWx1ZSkgPz8gJydcbiAgICAgICAgY29uc3QgY3VycmVudFZhbHVlID0gaW5wdXRWYWx1ZXMuZ2V0KG9wdGlvbi52YWx1ZSkgPz8gJydcbiAgICAgICAgY29uc3QgbmV3SW5pdGlhbCA9IG9wdGlvbi5pbml0aWFsVmFsdWVcblxuICAgICAgICAvLyBPbmx5IHVwZGF0ZSBpZjpcbiAgICAgICAgLy8gMS4gVGhlIGluaXRpYWxWYWx1ZSBoYXMgY2hhbmdlZFxuICAgICAgICAvLyAyLiBUaGUgdXNlciBoYXNuJ3QgZWRpdGVkIChjdXJyZW50IHZhbHVlIHN0aWxsIG1hdGNoZXMgdGhlIGxhc3QgaW5pdGlhbFZhbHVlIHdlIHNldClcbiAgICAgICAgaWYgKG5ld0luaXRpYWwgIT09IGxhc3RJbml0aWFsICYmIGN1cnJlbnRWYWx1ZSA9PT0gbGFzdEluaXRpYWwpIHtcbiAgICAgICAgICBzZXRJbnB1dFZhbHVlcyhwcmV2ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgICBuZXh0LnNldChvcHRpb24udmFsdWUsIG5ld0luaXRpYWwpXG4gICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbHdheXMgdHJhY2sgdGhlIGxhdGVzdCBpbml0aWFsVmFsdWVcbiAgICAgICAgbGFzdEluaXRpYWxWYWx1ZXMuY3VycmVudC5zZXQob3B0aW9uLnZhbHVlLCBuZXdJbml0aWFsKVxuICAgICAgfVxuICAgIH1cbiAgfSwgW29wdGlvbnMsIGlucHV0VmFsdWVzXSlcblxuICBjb25zdCBzdGF0ZSA9IHVzZVNlbGVjdFN0YXRlKHtcbiAgICB2aXNpYmxlT3B0aW9uQ291bnQsXG4gICAgb3B0aW9ucyxcbiAgICBkZWZhdWx0VmFsdWUsXG4gICAgb25DaGFuZ2UsXG4gICAgb25DYW5jZWwsXG4gICAgb25Gb2N1cyxcbiAgICBmb2N1c1ZhbHVlOiBkZWZhdWx0Rm9jdXNWYWx1ZSxcbiAgfSlcblxuICB1c2VTZWxlY3RJbnB1dCh7XG4gICAgaXNEaXNhYmxlZCxcbiAgICBkaXNhYmxlU2VsZWN0aW9uOiBkaXNhYmxlU2VsZWN0aW9uIHx8IChoaWRlSW5kZXhlcyA/ICdudW1lcmljJyA6IGZhbHNlKSxcbiAgICBzdGF0ZSxcbiAgICBvcHRpb25zLFxuICAgIGlzTXVsdGlTZWxlY3Q6IGZhbHNlLCAvLyBTZWxlY3QgaXMgYWx3YXlzIHNpbmdsZS1jaG9pY2VcbiAgICBvblVwRnJvbUZpcnN0SXRlbSxcbiAgICBvbkRvd25Gcm9tTGFzdEl0ZW0sXG4gICAgb25JbnB1dE1vZGVUb2dnbGUsXG4gICAgaW5wdXRWYWx1ZXMsXG4gICAgaW1hZ2VzU2VsZWN0ZWQsXG4gICAgb25FbnRlckltYWdlU2VsZWN0aW9uOiAoKSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIHBhc3RlZENvbnRlbnRzICYmXG4gICAgICAgIE9iamVjdC52YWx1ZXMocGFzdGVkQ29udGVudHMpLnNvbWUoYyA9PiBjLnR5cGUgPT09ICdpbWFnZScpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgaW1hZ2VDb3VudCA9IGNvdW50KFxuICAgICAgICAgIE9iamVjdC52YWx1ZXMocGFzdGVkQ29udGVudHMpLFxuICAgICAgICAgIGMgPT4gYy50eXBlID09PSAnaW1hZ2UnLFxuICAgICAgICApXG4gICAgICAgIHNldEltYWdlc1NlbGVjdGVkKHRydWUpXG4gICAgICAgIHNldFNlbGVjdGVkSW1hZ2VJbmRleChpbWFnZUNvdW50IC0gMSlcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0sXG4gIH0pXG5cbiAgY29uc3Qgc3R5bGVzID0ge1xuICAgIGNvbnRhaW5lcjogKCkgPT4gKHsgZmxleERpcmVjdGlvbjogJ2NvbHVtbicgYXMgY29uc3QgfSksXG4gICAgaGlnaGxpZ2h0ZWRUZXh0OiAoKSA9PiAoeyBib2xkOiB0cnVlIH0pLFxuICB9XG5cbiAgaWYgKGxheW91dCA9PT0gJ2V4cGFuZGVkJykge1xuICAgIGNvbnN0IG1heEluZGV4V2lkdGggPSBzdGF0ZS5vcHRpb25zLmxlbmd0aC50b1N0cmluZygpLmxlbmd0aFxuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggey4uLnN0eWxlcy5jb250YWluZXIoKX0+XG4gICAgICAgIHtzdGF0ZS52aXNpYmxlT3B0aW9ucy5tYXAoKG9wdGlvbiwgaW5kZXgpID0+IHtcbiAgICAgICAgICBjb25zdCBpc0ZpcnN0VmlzaWJsZU9wdGlvbiA9IG9wdGlvbi5pbmRleCA9PT0gc3RhdGUudmlzaWJsZUZyb21JbmRleFxuICAgICAgICAgIGNvbnN0IGlzTGFzdFZpc2libGVPcHRpb24gPSBvcHRpb24uaW5kZXggPT09IHN0YXRlLnZpc2libGVUb0luZGV4IC0gMVxuICAgICAgICAgIGNvbnN0IGFyZU1vcmVPcHRpb25zQmVsb3cgPSBzdGF0ZS52aXNpYmxlVG9JbmRleCA8IG9wdGlvbnMubGVuZ3RoXG4gICAgICAgICAgY29uc3QgYXJlTW9yZU9wdGlvbnNBYm92ZSA9IHN0YXRlLnZpc2libGVGcm9tSW5kZXggPiAwXG5cbiAgICAgICAgICBjb25zdCBpID0gc3RhdGUudmlzaWJsZUZyb21JbmRleCArIGluZGV4ICsgMVxuXG4gICAgICAgICAgY29uc3QgaXNGb2N1c2VkID0gIWlzRGlzYWJsZWQgJiYgc3RhdGUuZm9jdXNlZFZhbHVlID09PSBvcHRpb24udmFsdWVcbiAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gc3RhdGUudmFsdWUgPT09IG9wdGlvbi52YWx1ZVxuXG4gICAgICAgICAgLy8gSGFuZGxlIGlucHV0IHR5cGUgb3B0aW9uc1xuICAgICAgICAgIGlmIChvcHRpb24udHlwZSA9PT0gJ2lucHV0Jykge1xuICAgICAgICAgICAgY29uc3QgaW5wdXRWYWx1ZSA9IGlucHV0VmFsdWVzLmhhcyhvcHRpb24udmFsdWUpXG4gICAgICAgICAgICAgID8gaW5wdXRWYWx1ZXMuZ2V0KG9wdGlvbi52YWx1ZSkhXG4gICAgICAgICAgICAgIDogb3B0aW9uLmluaXRpYWxWYWx1ZSB8fCAnJ1xuXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8U2VsZWN0SW5wdXRPcHRpb25cbiAgICAgICAgICAgICAgICBrZXk9e1N0cmluZyhvcHRpb24udmFsdWUpfVxuICAgICAgICAgICAgICAgIG9wdGlvbj17b3B0aW9ufVxuICAgICAgICAgICAgICAgIGlzRm9jdXNlZD17aXNGb2N1c2VkfVxuICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2lzU2VsZWN0ZWR9XG4gICAgICAgICAgICAgICAgc2hvdWxkU2hvd0Rvd25BcnJvdz17YXJlTW9yZU9wdGlvbnNCZWxvdyAmJiBpc0xhc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgICAgIHNob3VsZFNob3dVcEFycm93PXthcmVNb3JlT3B0aW9uc0Fib3ZlICYmIGlzRmlyc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgICAgIG1heEluZGV4V2lkdGg9e21heEluZGV4V2lkdGh9XG4gICAgICAgICAgICAgICAgaW5kZXg9e2l9XG4gICAgICAgICAgICAgICAgaW5wdXRWYWx1ZT17aW5wdXRWYWx1ZX1cbiAgICAgICAgICAgICAgICBvbklucHV0Q2hhbmdlPXt2YWx1ZSA9PiB7XG4gICAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlcyhwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocHJldilcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXQob3B0aW9uLnZhbHVlLCB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5leHRcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBvblN1Ym1pdD17KHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc0ltYWdlQXR0YWNobWVudHMgPVxuICAgICAgICAgICAgICAgICAgICBwYXN0ZWRDb250ZW50cyAmJlxuICAgICAgICAgICAgICAgICAgICBPYmplY3QudmFsdWVzKHBhc3RlZENvbnRlbnRzKS5zb21lKGMgPT4gYy50eXBlID09PSAnaW1hZ2UnKVxuICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZS50cmltKCkgfHxcbiAgICAgICAgICAgICAgICAgICAgaGFzSW1hZ2VBdHRhY2htZW50cyB8fFxuICAgICAgICAgICAgICAgICAgICBvcHRpb24uYWxsb3dFbXB0eVN1Ym1pdFRvQ2FuY2VsXG4gICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U/LihvcHRpb24udmFsdWUpXG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvbkNhbmNlbD8uKClcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIG9uRXhpdD17b25DYW5jZWx9XG4gICAgICAgICAgICAgICAgbGF5b3V0PVwiZXhwYW5kZWRcIlxuICAgICAgICAgICAgICAgIHNob3dMYWJlbD17aW5saW5lRGVzY3JpcHRpb25zfVxuICAgICAgICAgICAgICAgIG9uT3BlbkVkaXRvcj17b25PcGVuRWRpdG9yfVxuICAgICAgICAgICAgICAgIHJlc2V0Q3Vyc29yT25VcGRhdGU9e29wdGlvbi5yZXNldEN1cnNvck9uVXBkYXRlfVxuICAgICAgICAgICAgICAgIG9uSW1hZ2VQYXN0ZT17b25JbWFnZVBhc3RlfVxuICAgICAgICAgICAgICAgIHBhc3RlZENvbnRlbnRzPXtwYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgICAgICBvblJlbW92ZUltYWdlPXtvblJlbW92ZUltYWdlfVxuICAgICAgICAgICAgICAgIGltYWdlc1NlbGVjdGVkPXtpbWFnZXNTZWxlY3RlZH1cbiAgICAgICAgICAgICAgICBzZWxlY3RlZEltYWdlSW5kZXg9e3NlbGVjdGVkSW1hZ2VJbmRleH1cbiAgICAgICAgICAgICAgICBvbkltYWdlc1NlbGVjdGVkQ2hhbmdlPXtzZXRJbWFnZXNTZWxlY3RlZH1cbiAgICAgICAgICAgICAgICBvblNlbGVjdGVkSW1hZ2VJbmRleENoYW5nZT17c2V0U2VsZWN0ZWRJbWFnZUluZGV4fVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEhhbmRsZSB0ZXh0IHR5cGUgb3B0aW9uc1xuICAgICAgICAgIGxldCBsYWJlbDogUmVhY3ROb2RlID0gb3B0aW9uLmxhYmVsXG5cbiAgICAgICAgICAvLyBPbmx5IGFwcGx5IGhpZ2hsaWdodCB3aGVuIGxhYmVsIGlzIGEgc3RyaW5nXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbi5sYWJlbCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgIGhpZ2hsaWdodFRleHQgJiZcbiAgICAgICAgICAgIG9wdGlvbi5sYWJlbC5pbmNsdWRlcyhoaWdobGlnaHRUZXh0KVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY29uc3QgbGFiZWxUZXh0ID0gb3B0aW9uLmxhYmVsXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGxhYmVsVGV4dC5pbmRleE9mKGhpZ2hsaWdodFRleHQpXG5cbiAgICAgICAgICAgIGxhYmVsID0gKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIHtsYWJlbFRleHQuc2xpY2UoMCwgaW5kZXgpfVxuICAgICAgICAgICAgICAgIDxUZXh0IHsuLi5zdHlsZXMuaGlnaGxpZ2h0ZWRUZXh0KCl9PntoaWdobGlnaHRUZXh0fTwvVGV4dD5cbiAgICAgICAgICAgICAgICB7bGFiZWxUZXh0LnNsaWNlKGluZGV4ICsgaGlnaGxpZ2h0VGV4dC5sZW5ndGgpfVxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpc09wdGlvbkRpc2FibGVkID0gb3B0aW9uLmRpc2FibGVkID09PSB0cnVlXG4gICAgICAgICAgY29uc3Qgb3B0aW9uQ29sb3IgPSBpc09wdGlvbkRpc2FibGVkXG4gICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgOiBpc1NlbGVjdGVkXG4gICAgICAgICAgICAgID8gJ3N1Y2Nlc3MnXG4gICAgICAgICAgICAgIDogaXNGb2N1c2VkXG4gICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuXG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgICAga2V5PXtTdHJpbmcob3B0aW9uLnZhbHVlKX1cbiAgICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICAgIGZsZXhTaHJpbms9ezB9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxTZWxlY3RPcHRpb25cbiAgICAgICAgICAgICAgICBpc0ZvY3VzZWQ9e2lzRm9jdXNlZH1cbiAgICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpc1NlbGVjdGVkfVxuICAgICAgICAgICAgICAgIHNob3VsZFNob3dEb3duQXJyb3c9e2FyZU1vcmVPcHRpb25zQmVsb3cgJiYgaXNMYXN0VmlzaWJsZU9wdGlvbn1cbiAgICAgICAgICAgICAgICBzaG91bGRTaG93VXBBcnJvdz17YXJlTW9yZU9wdGlvbnNBYm92ZSAmJiBpc0ZpcnN0VmlzaWJsZU9wdGlvbn1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPXtpc09wdGlvbkRpc2FibGVkfSBjb2xvcj17b3B0aW9uQ29sb3J9PlxuICAgICAgICAgICAgICAgICAge2xhYmVsfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9TZWxlY3RPcHRpb24+XG4gICAgICAgICAgICAgIHtvcHRpb24uZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9PlxuICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgZGltQ29sb3I9e1xuICAgICAgICAgICAgICAgICAgICAgIGlzT3B0aW9uRGlzYWJsZWQgfHwgb3B0aW9uLmRpbURlc2NyaXB0aW9uICE9PSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yPXtvcHRpb25Db2xvcn1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPEFuc2k+e29wdGlvbi5kZXNjcmlwdGlvbn08L0Fuc2k+XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApXG4gICAgICAgIH0pfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKGxheW91dCA9PT0gJ2NvbXBhY3QtdmVydGljYWwnKSB7XG4gICAgY29uc3QgbWF4SW5kZXhXaWR0aCA9IGhpZGVJbmRleGVzXG4gICAgICA/IDBcbiAgICAgIDogc3RhdGUub3B0aW9ucy5sZW5ndGgudG9TdHJpbmcoKS5sZW5ndGhcblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IHsuLi5zdHlsZXMuY29udGFpbmVyKCl9PlxuICAgICAgICB7c3RhdGUudmlzaWJsZU9wdGlvbnMubWFwKChvcHRpb24sIGluZGV4KSA9PiB7XG4gICAgICAgICAgY29uc3QgaXNGaXJzdFZpc2libGVPcHRpb24gPSBvcHRpb24uaW5kZXggPT09IHN0YXRlLnZpc2libGVGcm9tSW5kZXhcbiAgICAgICAgICBjb25zdCBpc0xhc3RWaXNpYmxlT3B0aW9uID0gb3B0aW9uLmluZGV4ID09PSBzdGF0ZS52aXNpYmxlVG9JbmRleCAtIDFcbiAgICAgICAgICBjb25zdCBhcmVNb3JlT3B0aW9uc0JlbG93ID0gc3RhdGUudmlzaWJsZVRvSW5kZXggPCBvcHRpb25zLmxlbmd0aFxuICAgICAgICAgIGNvbnN0IGFyZU1vcmVPcHRpb25zQWJvdmUgPSBzdGF0ZS52aXNpYmxlRnJvbUluZGV4ID4gMFxuXG4gICAgICAgICAgY29uc3QgaSA9IHN0YXRlLnZpc2libGVGcm9tSW5kZXggKyBpbmRleCArIDFcblxuICAgICAgICAgIGNvbnN0IGlzRm9jdXNlZCA9ICFpc0Rpc2FibGVkICYmIHN0YXRlLmZvY3VzZWRWYWx1ZSA9PT0gb3B0aW9uLnZhbHVlXG4gICAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IHN0YXRlLnZhbHVlID09PSBvcHRpb24udmFsdWVcblxuICAgICAgICAgIC8vIEhhbmRsZSBpbnB1dCB0eXBlIG9wdGlvbnNcbiAgICAgICAgICBpZiAob3B0aW9uLnR5cGUgPT09ICdpbnB1dCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0VmFsdWUgPSBpbnB1dFZhbHVlcy5oYXMob3B0aW9uLnZhbHVlKVxuICAgICAgICAgICAgICA/IGlucHV0VmFsdWVzLmdldChvcHRpb24udmFsdWUpIVxuICAgICAgICAgICAgICA6IG9wdGlvbi5pbml0aWFsVmFsdWUgfHwgJydcblxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPFNlbGVjdElucHV0T3B0aW9uXG4gICAgICAgICAgICAgICAga2V5PXtTdHJpbmcob3B0aW9uLnZhbHVlKX1cbiAgICAgICAgICAgICAgICBvcHRpb249e29wdGlvbn1cbiAgICAgICAgICAgICAgICBpc0ZvY3VzZWQ9e2lzRm9jdXNlZH1cbiAgICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpc1NlbGVjdGVkfVxuICAgICAgICAgICAgICAgIHNob3VsZFNob3dEb3duQXJyb3c9e2FyZU1vcmVPcHRpb25zQmVsb3cgJiYgaXNMYXN0VmlzaWJsZU9wdGlvbn1cbiAgICAgICAgICAgICAgICBzaG91bGRTaG93VXBBcnJvdz17YXJlTW9yZU9wdGlvbnNBYm92ZSAmJiBpc0ZpcnN0VmlzaWJsZU9wdGlvbn1cbiAgICAgICAgICAgICAgICBtYXhJbmRleFdpZHRoPXttYXhJbmRleFdpZHRofVxuICAgICAgICAgICAgICAgIGluZGV4PXtpfVxuICAgICAgICAgICAgICAgIGlucHV0VmFsdWU9e2lucHV0VmFsdWV9XG4gICAgICAgICAgICAgICAgb25JbnB1dENoYW5nZT17dmFsdWUgPT4ge1xuICAgICAgICAgICAgICAgICAgc2V0SW5wdXRWYWx1ZXMocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0KG9wdGlvbi52YWx1ZSwgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXh0XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgb25TdWJtaXQ9eyh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBoYXNJbWFnZUF0dGFjaG1lbnRzID1cbiAgICAgICAgICAgICAgICAgICAgcGFzdGVkQ29udGVudHMgJiZcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LnZhbHVlcyhwYXN0ZWRDb250ZW50cykuc29tZShjID0+IGMudHlwZSA9PT0gJ2ltYWdlJylcbiAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUudHJpbSgpIHx8XG4gICAgICAgICAgICAgICAgICAgIGhhc0ltYWdlQXR0YWNobWVudHMgfHxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uLmFsbG93RW1wdHlTdWJtaXRUb0NhbmNlbFxuICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPy4ob3B0aW9uLnZhbHVlKVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb25DYW5jZWw/LigpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBvbkV4aXQ9e29uQ2FuY2VsfVxuICAgICAgICAgICAgICAgIGxheW91dD1cImNvbXBhY3RcIlxuICAgICAgICAgICAgICAgIHNob3dMYWJlbD17aW5saW5lRGVzY3JpcHRpb25zfVxuICAgICAgICAgICAgICAgIG9uT3BlbkVkaXRvcj17b25PcGVuRWRpdG9yfVxuICAgICAgICAgICAgICAgIHJlc2V0Q3Vyc29yT25VcGRhdGU9e29wdGlvbi5yZXNldEN1cnNvck9uVXBkYXRlfVxuICAgICAgICAgICAgICAgIG9uSW1hZ2VQYXN0ZT17b25JbWFnZVBhc3RlfVxuICAgICAgICAgICAgICAgIHBhc3RlZENvbnRlbnRzPXtwYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgICAgICBvblJlbW92ZUltYWdlPXtvblJlbW92ZUltYWdlfVxuICAgICAgICAgICAgICAgIGltYWdlc1NlbGVjdGVkPXtpbWFnZXNTZWxlY3RlZH1cbiAgICAgICAgICAgICAgICBzZWxlY3RlZEltYWdlSW5kZXg9e3NlbGVjdGVkSW1hZ2VJbmRleH1cbiAgICAgICAgICAgICAgICBvbkltYWdlc1NlbGVjdGVkQ2hhbmdlPXtzZXRJbWFnZXNTZWxlY3RlZH1cbiAgICAgICAgICAgICAgICBvblNlbGVjdGVkSW1hZ2VJbmRleENoYW5nZT17c2V0U2VsZWN0ZWRJbWFnZUluZGV4fVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEhhbmRsZSB0ZXh0IHR5cGUgb3B0aW9uc1xuICAgICAgICAgIGxldCBsYWJlbDogUmVhY3ROb2RlID0gb3B0aW9uLmxhYmVsXG5cbiAgICAgICAgICAvLyBPbmx5IGFwcGx5IGhpZ2hsaWdodCB3aGVuIGxhYmVsIGlzIGEgc3RyaW5nXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbi5sYWJlbCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgIGhpZ2hsaWdodFRleHQgJiZcbiAgICAgICAgICAgIG9wdGlvbi5sYWJlbC5pbmNsdWRlcyhoaWdobGlnaHRUZXh0KVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY29uc3QgbGFiZWxUZXh0ID0gb3B0aW9uLmxhYmVsXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGxhYmVsVGV4dC5pbmRleE9mKGhpZ2hsaWdodFRleHQpXG5cbiAgICAgICAgICAgIGxhYmVsID0gKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIHtsYWJlbFRleHQuc2xpY2UoMCwgaW5kZXgpfVxuICAgICAgICAgICAgICAgIDxUZXh0IHsuLi5zdHlsZXMuaGlnaGxpZ2h0ZWRUZXh0KCl9PntoaWdobGlnaHRUZXh0fTwvVGV4dD5cbiAgICAgICAgICAgICAgICB7bGFiZWxUZXh0LnNsaWNlKGluZGV4ICsgaGlnaGxpZ2h0VGV4dC5sZW5ndGgpfVxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpc09wdGlvbkRpc2FibGVkID0gb3B0aW9uLmRpc2FibGVkID09PSB0cnVlXG5cbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPEJveFxuICAgICAgICAgICAgICBrZXk9e1N0cmluZyhvcHRpb24udmFsdWUpfVxuICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgICAgZmxleFNocmluaz17MH1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPFNlbGVjdE9wdGlvblxuICAgICAgICAgICAgICAgIGlzRm9jdXNlZD17aXNGb2N1c2VkfVxuICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2lzU2VsZWN0ZWR9XG4gICAgICAgICAgICAgICAgc2hvdWxkU2hvd0Rvd25BcnJvdz17YXJlTW9yZU9wdGlvbnNCZWxvdyAmJiBpc0xhc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgICAgIHNob3VsZFNob3dVcEFycm93PXthcmVNb3JlT3B0aW9uc0Fib3ZlICYmIGlzRmlyc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgIHshaGlkZUluZGV4ZXMgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57YCR7aX0uYC5wYWRFbmQobWF4SW5kZXhXaWR0aCArIDEpfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgICBkaW1Db2xvcj17aXNPcHRpb25EaXNhYmxlZH1cbiAgICAgICAgICAgICAgICAgICAgY29sb3I9e1xuICAgICAgICAgICAgICAgICAgICAgIGlzT3B0aW9uRGlzYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGlzU2VsZWN0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnc3VjY2VzcydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpc0ZvY3VzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdzdWdnZXN0aW9uJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge2xhYmVsfVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICA8L1NlbGVjdE9wdGlvbj5cbiAgICAgICAgICAgICAge29wdGlvbi5kZXNjcmlwdGlvbiAmJiAoXG4gICAgICAgICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17aGlkZUluZGV4ZXMgPyA0IDogbWF4SW5kZXhXaWR0aCArIDR9PlxuICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgZGltQ29sb3I9e1xuICAgICAgICAgICAgICAgICAgICAgIGlzT3B0aW9uRGlzYWJsZWQgfHwgb3B0aW9uLmRpbURlc2NyaXB0aW9uICE9PSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yPXtcbiAgICAgICAgICAgICAgICAgICAgICBpc09wdGlvbkRpc2FibGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiBpc1NlbGVjdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gJ3N1Y2Nlc3MnXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogaXNGb2N1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxBbnNpPntvcHRpb24uZGVzY3JpcHRpb259PC9BbnNpPlxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKVxuICAgICAgICB9KX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IG1heEluZGV4V2lkdGggPSBoaWRlSW5kZXhlcyA/IDAgOiBzdGF0ZS5vcHRpb25zLmxlbmd0aC50b1N0cmluZygpLmxlbmd0aFxuXG4gIC8vIENoZWNrIGlmIGFueSB2aXNpYmxlIG9wdGlvbnMgaGF2ZSBkZXNjcmlwdGlvbnMgKGZvciB0d28tY29sdW1uIGxheW91dClcbiAgLy8gQWxzbyBjaGVjayB0aGF0IHRoZXJlIGFyZSBOTyBpbnB1dCBvcHRpb25zLCBzaW5jZSB0aGV5J3JlIG5vdCBzdXBwb3J0ZWQgaW4gdHdvLWNvbHVtbiBsYXlvdXRcbiAgLy8gU2tpcCB0d28tY29sdW1uIGxheW91dCB3aGVuIGlubGluZURlc2NyaXB0aW9ucyBpcyBlbmFibGVkXG4gIGNvbnN0IGhhc0lucHV0T3B0aW9ucyA9IHN0YXRlLnZpc2libGVPcHRpb25zLnNvbWUob3B0ID0+IG9wdC50eXBlID09PSAnaW5wdXQnKVxuICBjb25zdCBoYXNEZXNjcmlwdGlvbnMgPVxuICAgICFpbmxpbmVEZXNjcmlwdGlvbnMgJiZcbiAgICAhaGFzSW5wdXRPcHRpb25zICYmXG4gICAgc3RhdGUudmlzaWJsZU9wdGlvbnMuc29tZShvcHQgPT4gb3B0LmRlc2NyaXB0aW9uKVxuXG4gIC8vIFByZS1jb21wdXRlIG9wdGlvbiBkYXRhIGZvciB0d28tY29sdW1uIGxheW91dFxuICBjb25zdCBvcHRpb25EYXRhID0gc3RhdGUudmlzaWJsZU9wdGlvbnMubWFwKChvcHRpb24sIGluZGV4KSA9PiB7XG4gICAgY29uc3QgaXNGaXJzdFZpc2libGVPcHRpb24gPSBvcHRpb24uaW5kZXggPT09IHN0YXRlLnZpc2libGVGcm9tSW5kZXhcbiAgICBjb25zdCBpc0xhc3RWaXNpYmxlT3B0aW9uID0gb3B0aW9uLmluZGV4ID09PSBzdGF0ZS52aXNpYmxlVG9JbmRleCAtIDFcbiAgICBjb25zdCBhcmVNb3JlT3B0aW9uc0JlbG93ID0gc3RhdGUudmlzaWJsZVRvSW5kZXggPCBvcHRpb25zLmxlbmd0aFxuICAgIGNvbnN0IGFyZU1vcmVPcHRpb25zQWJvdmUgPSBzdGF0ZS52aXNpYmxlRnJvbUluZGV4ID4gMFxuICAgIGNvbnN0IGkgPSBzdGF0ZS52aXNpYmxlRnJvbUluZGV4ICsgaW5kZXggKyAxXG4gICAgY29uc3QgaXNGb2N1c2VkID0gIWlzRGlzYWJsZWQgJiYgc3RhdGUuZm9jdXNlZFZhbHVlID09PSBvcHRpb24udmFsdWVcbiAgICBjb25zdCBpc1NlbGVjdGVkID0gc3RhdGUudmFsdWUgPT09IG9wdGlvbi52YWx1ZVxuICAgIGNvbnN0IGlzT3B0aW9uRGlzYWJsZWQgPSBvcHRpb24uZGlzYWJsZWQgPT09IHRydWVcblxuICAgIGxldCBsYWJlbDogUmVhY3ROb2RlID0gb3B0aW9uLmxhYmVsXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG9wdGlvbi5sYWJlbCA9PT0gJ3N0cmluZycgJiZcbiAgICAgIGhpZ2hsaWdodFRleHQgJiZcbiAgICAgIG9wdGlvbi5sYWJlbC5pbmNsdWRlcyhoaWdobGlnaHRUZXh0KVxuICAgICkge1xuICAgICAgY29uc3QgbGFiZWxUZXh0ID0gb3B0aW9uLmxhYmVsXG4gICAgICBjb25zdCBpZHggPSBsYWJlbFRleHQuaW5kZXhPZihoaWdobGlnaHRUZXh0KVxuICAgICAgbGFiZWwgPSAoXG4gICAgICAgIDw+XG4gICAgICAgICAge2xhYmVsVGV4dC5zbGljZSgwLCBpZHgpfVxuICAgICAgICAgIDxUZXh0IHsuLi5zdHlsZXMuaGlnaGxpZ2h0ZWRUZXh0KCl9PntoaWdobGlnaHRUZXh0fTwvVGV4dD5cbiAgICAgICAgICB7bGFiZWxUZXh0LnNsaWNlKGlkeCArIGhpZ2hsaWdodFRleHQubGVuZ3RoKX1cbiAgICAgICAgPC8+XG4gICAgICApXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wdGlvbixcbiAgICAgIGluZGV4OiBpLFxuICAgICAgbGFiZWwsXG4gICAgICBpc0ZvY3VzZWQsXG4gICAgICBpc1NlbGVjdGVkLFxuICAgICAgaXNPcHRpb25EaXNhYmxlZCxcbiAgICAgIHNob3VsZFNob3dEb3duQXJyb3c6IGFyZU1vcmVPcHRpb25zQmVsb3cgJiYgaXNMYXN0VmlzaWJsZU9wdGlvbixcbiAgICAgIHNob3VsZFNob3dVcEFycm93OiBhcmVNb3JlT3B0aW9uc0Fib3ZlICYmIGlzRmlyc3RWaXNpYmxlT3B0aW9uLFxuICAgIH1cbiAgfSlcblxuICAvLyBDYWxjdWxhdGUgbWF4IGxhYmVsIHdpZHRoIGZvciBhbGlnbm1lbnQgd2hlbiBkZXNjcmlwdGlvbnMgZXhpc3RcbiAgaWYgKGhhc0Rlc2NyaXB0aW9ucykge1xuICAgIGNvbnN0IG1heExhYmVsV2lkdGggPSBNYXRoLm1heChcbiAgICAgIC4uLm9wdGlvbkRhdGEubWFwKGRhdGEgPT4ge1xuICAgICAgICBpZiAoZGF0YS5vcHRpb24udHlwZSA9PT0gJ2lucHV0JykgcmV0dXJuIDBcbiAgICAgICAgY29uc3QgbGFiZWxUZXh0ID0gZ2V0VGV4dENvbnRlbnQoZGF0YS5vcHRpb24ubGFiZWwpXG4gICAgICAgIC8vIFdpZHRoOiBpbmRpY2F0b3IgKDEpICsgc3BhY2UgKDEpICsgaW5kZXggKyBsYWJlbCArIHNwYWNlICsgY2hlY2ttYXJrICgxKVxuICAgICAgICBjb25zdCBpbmRleFdpZHRoID0gaGlkZUluZGV4ZXMgPyAwIDogbWF4SW5kZXhXaWR0aCArIDJcbiAgICAgICAgY29uc3QgY2hlY2ttYXJrV2lkdGggPSBkYXRhLmlzU2VsZWN0ZWQgPyAyIDogMFxuICAgICAgICByZXR1cm4gMiArIGluZGV4V2lkdGggKyBzdHJpbmdXaWR0aChsYWJlbFRleHQpICsgY2hlY2ttYXJrV2lkdGhcbiAgICAgIH0pLFxuICAgIClcblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IHsuLi5zdHlsZXMuY29udGFpbmVyKCl9PlxuICAgICAgICB7b3B0aW9uRGF0YS5tYXAoZGF0YSA9PiB7XG4gICAgICAgICAgaWYgKGRhdGEub3B0aW9uLnR5cGUgPT09ICdpbnB1dCcpIHtcbiAgICAgICAgICAgIC8vIElucHV0IG9wdGlvbnMgbm90IHN1cHBvcnRlZCBpbiB0d28tY29sdW1uIGxheW91dFxuICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgbGFiZWxUZXh0ID0gZ2V0VGV4dENvbnRlbnQoZGF0YS5vcHRpb24ubGFiZWwpXG4gICAgICAgICAgY29uc3QgaW5kZXhXaWR0aCA9IGhpZGVJbmRleGVzID8gMCA6IG1heEluZGV4V2lkdGggKyAyXG4gICAgICAgICAgY29uc3QgY2hlY2ttYXJrV2lkdGggPSBkYXRhLmlzU2VsZWN0ZWQgPyAyIDogMFxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRMYWJlbFdpZHRoID1cbiAgICAgICAgICAgIDIgKyBpbmRleFdpZHRoICsgc3RyaW5nV2lkdGgobGFiZWxUZXh0KSArIGNoZWNrbWFya1dpZHRoXG4gICAgICAgICAgY29uc3QgcGFkZGluZyA9IG1heExhYmVsV2lkdGggLSBjdXJyZW50TGFiZWxXaWR0aFxuXG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxUd29Db2x1bW5Sb3dcbiAgICAgICAgICAgICAga2V5PXtTdHJpbmcoZGF0YS5vcHRpb24udmFsdWUpfVxuICAgICAgICAgICAgICBpc0ZvY3VzZWQ9e2RhdGEuaXNGb2N1c2VkfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7LyogTGFiZWwgcGFydCAtIG5vIGdhcCwgaGFuZGxlIHNwYWNpbmcgZXhwbGljaXRseSAqL31cbiAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZmxleFNocmluaz17MH0+XG4gICAgICAgICAgICAgICAge2RhdGEuaXNGb2N1c2VkID8gKFxuICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2ZpZ3VyZXMucG9pbnRlcn08L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IGRhdGEuc2hvdWxkU2hvd0Rvd25BcnJvdyA/IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmaWd1cmVzLmFycm93RG93bn08L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IGRhdGEuc2hvdWxkU2hvd1VwQXJyb3cgPyAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57ZmlndXJlcy5hcnJvd1VwfTwvVGV4dD5cbiAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgIGRpbUNvbG9yPXtkYXRhLmlzT3B0aW9uRGlzYWJsZWR9XG4gICAgICAgICAgICAgICAgICBjb2xvcj17XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaXNPcHRpb25EaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgICAgOiBkYXRhLmlzU2VsZWN0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJ3N1Y2Nlc3MnXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGRhdGEuaXNGb2N1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gJ3N1Z2dlc3Rpb24nXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgeyFoaWRlSW5kZXhlcyAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgICAgIHtgJHtkYXRhLmluZGV4fS5gLnBhZEVuZChtYXhJbmRleFdpZHRoICsgMil9XG4gICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICB7ZGF0YS5sYWJlbH1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAge2RhdGEuaXNTZWxlY3RlZCAmJiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj4ge2ZpZ3VyZXMudGlja308L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7LyogUGFkZGluZyB0byBhbGlnbiBkZXNjcmlwdGlvbnMgKi99XG4gICAgICAgICAgICAgICAge3BhZGRpbmcgPiAwICYmIDxUZXh0PnsnICcucmVwZWF0KHBhZGRpbmcpfTwvVGV4dD59XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICB7LyogRGVzY3JpcHRpb24gcGFydCAqL31cbiAgICAgICAgICAgICAgPEJveCBmbGV4R3Jvdz17MX0gbWFyZ2luTGVmdD17Mn0+XG4gICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgIHdyYXA9XCJ3cmFwXCJcbiAgICAgICAgICAgICAgICAgIGRpbUNvbG9yPXtcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5pc09wdGlvbkRpc2FibGVkIHx8XG4gICAgICAgICAgICAgICAgICAgIGRhdGEub3B0aW9uLmRpbURlc2NyaXB0aW9uICE9PSBmYWxzZVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29sb3I9e1xuICAgICAgICAgICAgICAgICAgICBkYXRhLmlzT3B0aW9uRGlzYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgIDogZGF0YS5pc1NlbGVjdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA/ICdzdWNjZXNzJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiBkYXRhLmlzRm9jdXNlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdzdWdnZXN0aW9uJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxBbnNpPntkYXRhLm9wdGlvbi5kZXNjcmlwdGlvbiB8fCAnICd9PC9BbnNpPlxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8L1R3b0NvbHVtblJvdz5cbiAgICAgICAgICApXG4gICAgICAgIH0pfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IHsuLi5zdHlsZXMuY29udGFpbmVyKCl9PlxuICAgICAge3N0YXRlLnZpc2libGVPcHRpb25zLm1hcCgob3B0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgICAvLyBIYW5kbGUgaW5wdXQgdHlwZSBvcHRpb25zXG4gICAgICAgIGlmIChvcHRpb24udHlwZSA9PT0gJ2lucHV0Jykge1xuICAgICAgICAgIGNvbnN0IGlucHV0VmFsdWUgPSBpbnB1dFZhbHVlcy5oYXMob3B0aW9uLnZhbHVlKVxuICAgICAgICAgICAgPyBpbnB1dFZhbHVlcy5nZXQob3B0aW9uLnZhbHVlKSFcbiAgICAgICAgICAgIDogb3B0aW9uLmluaXRpYWxWYWx1ZSB8fCAnJ1xuXG4gICAgICAgICAgY29uc3QgaXNGaXJzdFZpc2libGVPcHRpb24gPSBvcHRpb24uaW5kZXggPT09IHN0YXRlLnZpc2libGVGcm9tSW5kZXhcbiAgICAgICAgICBjb25zdCBpc0xhc3RWaXNpYmxlT3B0aW9uID0gb3B0aW9uLmluZGV4ID09PSBzdGF0ZS52aXNpYmxlVG9JbmRleCAtIDFcbiAgICAgICAgICBjb25zdCBhcmVNb3JlT3B0aW9uc0JlbG93ID0gc3RhdGUudmlzaWJsZVRvSW5kZXggPCBvcHRpb25zLmxlbmd0aFxuICAgICAgICAgIGNvbnN0IGFyZU1vcmVPcHRpb25zQWJvdmUgPSBzdGF0ZS52aXNpYmxlRnJvbUluZGV4ID4gMFxuXG4gICAgICAgICAgY29uc3QgaSA9IHN0YXRlLnZpc2libGVGcm9tSW5kZXggKyBpbmRleCArIDFcblxuICAgICAgICAgIGNvbnN0IGlzRm9jdXNlZCA9ICFpc0Rpc2FibGVkICYmIHN0YXRlLmZvY3VzZWRWYWx1ZSA9PT0gb3B0aW9uLnZhbHVlXG4gICAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IHN0YXRlLnZhbHVlID09PSBvcHRpb24udmFsdWVcblxuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8U2VsZWN0SW5wdXRPcHRpb25cbiAgICAgICAgICAgICAga2V5PXtTdHJpbmcob3B0aW9uLnZhbHVlKX1cbiAgICAgICAgICAgICAgb3B0aW9uPXtvcHRpb259XG4gICAgICAgICAgICAgIGlzRm9jdXNlZD17aXNGb2N1c2VkfVxuICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpc1NlbGVjdGVkfVxuICAgICAgICAgICAgICBzaG91bGRTaG93RG93bkFycm93PXthcmVNb3JlT3B0aW9uc0JlbG93ICYmIGlzTGFzdFZpc2libGVPcHRpb259XG4gICAgICAgICAgICAgIHNob3VsZFNob3dVcEFycm93PXthcmVNb3JlT3B0aW9uc0Fib3ZlICYmIGlzRmlyc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgICBtYXhJbmRleFdpZHRoPXttYXhJbmRleFdpZHRofVxuICAgICAgICAgICAgICBpbmRleD17aX1cbiAgICAgICAgICAgICAgaW5wdXRWYWx1ZT17aW5wdXRWYWx1ZX1cbiAgICAgICAgICAgICAgb25JbnB1dENoYW5nZT17dmFsdWUgPT4ge1xuICAgICAgICAgICAgICAgIHNldElucHV0VmFsdWVzKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocHJldilcbiAgICAgICAgICAgICAgICAgIG5leHQuc2V0KG9wdGlvbi52YWx1ZSwgdmFsdWUpXG4gICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIG9uU3VibWl0PXsodmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0ltYWdlQXR0YWNobWVudHMgPVxuICAgICAgICAgICAgICAgICAgcGFzdGVkQ29udGVudHMgJiZcbiAgICAgICAgICAgICAgICAgIE9iamVjdC52YWx1ZXMocGFzdGVkQ29udGVudHMpLnNvbWUoYyA9PiBjLnR5cGUgPT09ICdpbWFnZScpXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgdmFsdWUudHJpbSgpIHx8XG4gICAgICAgICAgICAgICAgICBoYXNJbWFnZUF0dGFjaG1lbnRzIHx8XG4gICAgICAgICAgICAgICAgICBvcHRpb24uYWxsb3dFbXB0eVN1Ym1pdFRvQ2FuY2VsXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT8uKG9wdGlvbi52YWx1ZSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgb25DYW5jZWw/LigpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBvbkV4aXQ9e29uQ2FuY2VsfVxuICAgICAgICAgICAgICBsYXlvdXQ9XCJjb21wYWN0XCJcbiAgICAgICAgICAgICAgc2hvd0xhYmVsPXtpbmxpbmVEZXNjcmlwdGlvbnN9XG4gICAgICAgICAgICAgIG9uT3BlbkVkaXRvcj17b25PcGVuRWRpdG9yfVxuICAgICAgICAgICAgICByZXNldEN1cnNvck9uVXBkYXRlPXtvcHRpb24ucmVzZXRDdXJzb3JPblVwZGF0ZX1cbiAgICAgICAgICAgICAgb25JbWFnZVBhc3RlPXtvbkltYWdlUGFzdGV9XG4gICAgICAgICAgICAgIHBhc3RlZENvbnRlbnRzPXtwYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgICAgb25SZW1vdmVJbWFnZT17b25SZW1vdmVJbWFnZX1cbiAgICAgICAgICAgICAgaW1hZ2VzU2VsZWN0ZWQ9e2ltYWdlc1NlbGVjdGVkfVxuICAgICAgICAgICAgICBzZWxlY3RlZEltYWdlSW5kZXg9e3NlbGVjdGVkSW1hZ2VJbmRleH1cbiAgICAgICAgICAgICAgb25JbWFnZXNTZWxlY3RlZENoYW5nZT17c2V0SW1hZ2VzU2VsZWN0ZWR9XG4gICAgICAgICAgICAgIG9uU2VsZWN0ZWRJbWFnZUluZGV4Q2hhbmdlPXtzZXRTZWxlY3RlZEltYWdlSW5kZXh9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSB0ZXh0IHR5cGUgb3B0aW9uc1xuICAgICAgICBsZXQgbGFiZWw6IFJlYWN0Tm9kZSA9IG9wdGlvbi5sYWJlbFxuXG4gICAgICAgIC8vIE9ubHkgYXBwbHkgaGlnaGxpZ2h0IHdoZW4gbGFiZWwgaXMgYSBzdHJpbmdcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHR5cGVvZiBvcHRpb24ubGFiZWwgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgaGlnaGxpZ2h0VGV4dCAmJlxuICAgICAgICAgIG9wdGlvbi5sYWJlbC5pbmNsdWRlcyhoaWdobGlnaHRUZXh0KVxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBsYWJlbFRleHQgPSBvcHRpb24ubGFiZWxcbiAgICAgICAgICBjb25zdCBpbmRleCA9IGxhYmVsVGV4dC5pbmRleE9mKGhpZ2hsaWdodFRleHQpXG5cbiAgICAgICAgICBsYWJlbCA9IChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIHtsYWJlbFRleHQuc2xpY2UoMCwgaW5kZXgpfVxuICAgICAgICAgICAgICA8VGV4dCB7Li4uc3R5bGVzLmhpZ2hsaWdodGVkVGV4dCgpfT57aGlnaGxpZ2h0VGV4dH08L1RleHQ+XG4gICAgICAgICAgICAgIHtsYWJlbFRleHQuc2xpY2UoaW5kZXggKyBoaWdobGlnaHRUZXh0Lmxlbmd0aCl9XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0ZpcnN0VmlzaWJsZU9wdGlvbiA9IG9wdGlvbi5pbmRleCA9PT0gc3RhdGUudmlzaWJsZUZyb21JbmRleFxuICAgICAgICBjb25zdCBpc0xhc3RWaXNpYmxlT3B0aW9uID0gb3B0aW9uLmluZGV4ID09PSBzdGF0ZS52aXNpYmxlVG9JbmRleCAtIDFcbiAgICAgICAgY29uc3QgYXJlTW9yZU9wdGlvbnNCZWxvdyA9IHN0YXRlLnZpc2libGVUb0luZGV4IDwgb3B0aW9ucy5sZW5ndGhcbiAgICAgICAgY29uc3QgYXJlTW9yZU9wdGlvbnNBYm92ZSA9IHN0YXRlLnZpc2libGVGcm9tSW5kZXggPiAwXG5cbiAgICAgICAgY29uc3QgaSA9IHN0YXRlLnZpc2libGVGcm9tSW5kZXggKyBpbmRleCArIDFcblxuICAgICAgICBjb25zdCBpc0ZvY3VzZWQgPSAhaXNEaXNhYmxlZCAmJiBzdGF0ZS5mb2N1c2VkVmFsdWUgPT09IG9wdGlvbi52YWx1ZVxuICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gc3RhdGUudmFsdWUgPT09IG9wdGlvbi52YWx1ZVxuICAgICAgICBjb25zdCBpc09wdGlvbkRpc2FibGVkID0gb3B0aW9uLmRpc2FibGVkID09PSB0cnVlXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8U2VsZWN0T3B0aW9uXG4gICAgICAgICAgICBrZXk9e1N0cmluZyhvcHRpb24udmFsdWUpfVxuICAgICAgICAgICAgaXNGb2N1c2VkPXtpc0ZvY3VzZWR9XG4gICAgICAgICAgICBpc1NlbGVjdGVkPXtpc1NlbGVjdGVkfVxuICAgICAgICAgICAgc2hvdWxkU2hvd0Rvd25BcnJvdz17YXJlTW9yZU9wdGlvbnNCZWxvdyAmJiBpc0xhc3RWaXNpYmxlT3B0aW9ufVxuICAgICAgICAgICAgc2hvdWxkU2hvd1VwQXJyb3c9e2FyZU1vcmVPcHRpb25zQWJvdmUgJiYgaXNGaXJzdFZpc2libGVPcHRpb259XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZmxleFNocmluaz17MH0+XG4gICAgICAgICAgICAgIHshaGlkZUluZGV4ZXMgJiYgKFxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntgJHtpfS5gLnBhZEVuZChtYXhJbmRleFdpZHRoICsgMil9PC9UZXh0PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgIGRpbUNvbG9yPXtpc09wdGlvbkRpc2FibGVkfVxuICAgICAgICAgICAgICAgIGNvbG9yPXtcbiAgICAgICAgICAgICAgICAgIGlzT3B0aW9uRGlzYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgOiBpc1NlbGVjdGVkXG4gICAgICAgICAgICAgICAgICAgICAgPyAnc3VjY2VzcydcbiAgICAgICAgICAgICAgICAgICAgICA6IGlzRm9jdXNlZFxuICAgICAgICAgICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2xhYmVsfVxuICAgICAgICAgICAgICAgIHtpbmxpbmVEZXNjcmlwdGlvbnMgJiYgb3B0aW9uLmRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICAgIGRpbUNvbG9yPXtcbiAgICAgICAgICAgICAgICAgICAgICBpc09wdGlvbkRpc2FibGVkIHx8IG9wdGlvbi5kaW1EZXNjcmlwdGlvbiAhPT0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7JyAnfVxuICAgICAgICAgICAgICAgICAgICB7b3B0aW9uLmRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgeyFpbmxpbmVEZXNjcmlwdGlvbnMgJiYgb3B0aW9uLmRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgICAgPEJveCBmbGV4U2hyaW5rPXs5OX0gbWFyZ2luTGVmdD17Mn0+XG4gICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgIHdyYXA9XCJ3cmFwLXRyaW1cIlxuICAgICAgICAgICAgICAgICAgZGltQ29sb3I9e2lzT3B0aW9uRGlzYWJsZWQgfHwgb3B0aW9uLmRpbURlc2NyaXB0aW9uICE9PSBmYWxzZX1cbiAgICAgICAgICAgICAgICAgIGNvbG9yPXtcbiAgICAgICAgICAgICAgICAgICAgaXNPcHRpb25EaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgICAgOiBpc1NlbGVjdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA/ICdzdWNjZXNzJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiBpc0ZvY3VzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8QW5zaT57b3B0aW9uLmRlc2NyaXB0aW9ufTwvQW5zaT5cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1NlbGVjdE9wdGlvbj5cbiAgICAgICAgKVxuICAgICAgfSl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLy8gUm93IGNvbnRhaW5lciBmb3IgdGhlIHR3by1jb2x1bW4gKGxhYmVsICsgZGVzY3JpcHRpb24pIGxheW91dC4gVW5saWtlXG4vLyB0aGUgb3RoZXIgU2VsZWN0IGxheW91dHMsIHRoaXMgb25lIGRvZXNuJ3QgcmVuZGVyIHRocm91Z2ggU2VsZWN0T3B0aW9uIOKGklxuLy8gTGlzdEl0ZW0sIHNvIGl0IGRlY2xhcmVzIHRoZSBuYXRpdmUgY3Vyc29yIGRpcmVjdGx5LiBQYXJrcyB0aGUgY3Vyc29yXG4vLyBvbiB0aGUgcG9pbnRlciBpbmRpY2F0b3Igc28gc2NyZWVuIHJlYWRlcnMgLyBtYWduaWZpZXJzIHRyYWNrIGZvY3VzLlxuZnVuY3Rpb24gVHdvQ29sdW1uUm93KHtcbiAgaXNGb2N1c2VkLFxuICBjaGlsZHJlbixcbn06IHtcbiAgaXNGb2N1c2VkOiBib29sZWFuXG4gIGNoaWxkcmVuOiBSZWFjdE5vZGVcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBjdXJzb3JSZWYgPSB1c2VEZWNsYXJlZEN1cnNvcih7XG4gICAgbGluZTogMCxcbiAgICBjb2x1bW46IDAsXG4gICAgYWN0aXZlOiBpc0ZvY3VzZWQsXG4gIH0pXG4gIHJldHVybiAoXG4gICAgPEJveCByZWY9e2N1cnNvclJlZn0gZmxleERpcmVjdGlvbj1cInJvd1wiPlxuICAgICAge2NoaWxkcmVufVxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPQyxLQUFLLElBQUksS0FBS0MsU0FBUyxFQUFFQyxTQUFTLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDMUUsU0FBU0MsaUJBQWlCLFFBQVEsd0NBQXdDO0FBQzFFLFNBQVNDLFdBQVcsUUFBUSwwQkFBMEI7QUFDdEQsU0FBU0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQzlDLFNBQVNDLEtBQUssUUFBUSxzQkFBc0I7QUFDNUMsY0FBY0MsYUFBYSxRQUFRLHVCQUF1QjtBQUMxRCxjQUFjQyxlQUFlLFFBQVEsNkJBQTZCO0FBQ2xFLFNBQVNDLGlCQUFpQixRQUFRLDBCQUEwQjtBQUM1RCxTQUFTQyxZQUFZLFFBQVEsb0JBQW9CO0FBQ2pELFNBQVND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