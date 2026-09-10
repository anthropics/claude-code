import { c as _c } from "react/compiler-runtime";
import type { ReactNode } from 'react';
import React, { useContext } from 'react';
import Text from '../../ink/components/Text.js';
import type { Color, Styles } from '../../ink/styles.js';
import { getTheme, type Theme } from '../../utils/theme.js';
import { useTheme } from './ThemeProvider.js';

/** Colors uncolored ThemedText in the subtree. Precedence: explicit `color` >
 *  this > dimColor. Crosses Box boundaries (Ink's style cascade doesn't). */
export const TextHoverColorContext = React.createContext<keyof Theme | undefined>(undefined);
export type Props = {
  /**
   * Change text color. Accepts a theme key or raw color value.
   */
  readonly color?: keyof Theme | Color;

  /**
   * Same as `color`, but for background. Must be a theme key.
   */
  readonly backgroundColor?: keyof Theme;

  /**
   * Dim the color using the theme's inactive color.
   * This is compatible with bold (unlike ANSI dim).
   */
  readonly dimColor?: boolean;

  /**
   * Make the text bold.
   */
  readonly bold?: boolean;

  /**
   * Make the text italic.
   */
  readonly italic?: boolean;

  /**
   * Make the text underlined.
   */
  readonly underline?: boolean;

  /**
   * Make the text crossed with a line.
   */
  readonly strikethrough?: boolean;

  /**
   * Inverse background and foreground colors.
   */
  readonly inverse?: boolean;

  /**
   * This property tells Ink to wrap or truncate text if its width is larger than container.
   * If `wrap` is passed (by default), Ink will wrap text and split it into multiple lines.
   * If `truncate-*` is passed, Ink will truncate text instead, which will result in one line of text with the rest cut off.
   */
  readonly wrap?: Styles['textWrap'];
  readonly children?: ReactNode;
};

/**
 * Resolves a color value that may be a theme key to a raw Color.
 */
function resolveColor(color: keyof Theme | Color | undefined, theme: Theme): Color | undefined {
  if (!color) return undefined;
  // Check if it's a raw color (starts with rgb(, #, ansi256(, or ansi:)
  if (color.startsWith('rgb(') || color.startsWith('#') || color.startsWith('ansi256(') || color.startsWith('ansi:')) {
    return color as Color;
  }
  // It's a theme key - resolve it
  return theme[color as keyof Theme] as Color;
}

/**
 * Theme-aware Text component that resolves theme color keys to raw colors.
 * This wraps the base Text component with theme resolution.
 */
export default function ThemedText(t0) {
  const $ = _c(10);
  const {
    color,
    backgroundColor,
    dimColor: t1,
    bold: t2,
    italic: t3,
    underline: t4,
    strikethrough: t5,
    inverse: t6,
    wrap: t7,
    children
  } = t0;
  const dimColor = t1 === undefined ? false : t1;
  const bold = t2 === undefined ? false : t2;
  const italic = t3 === undefined ? false : t3;
  const underline = t4 === undefined ? false : t4;
  const strikethrough = t5 === undefined ? false : t5;
  const inverse = t6 === undefined ? false : t6;
  const wrap = t7 === undefined ? "wrap" : t7;
  const [themeName] = useTheme();
  const theme = getTheme(themeName);
  const hoverColor = useContext(TextHoverColorContext);
  const resolvedColor = !color && hoverColor ? resolveColor(hoverColor, theme) : dimColor ? theme.inactive as Color : resolveColor(color, theme);
  const resolvedBackgroundColor = backgroundColor ? theme[backgroundColor] as Color : undefined;
  let t8;
  if ($[0] !== bold || $[1] !== children || $[2] !== inverse || $[3] !== italic || $[4] !== resolvedBackgroundColor || $[5] !== resolvedColor || $[6] !== strikethrough || $[7] !== underline || $[8] !== wrap) {
    t8 = <Text color={resolvedColor} backgroundColor={resolvedBackgroundColor} bold={bold} italic={italic} underline={underline} strikethrough={strikethrough} inverse={inverse} wrap={wrap}>{children}</Text>;
    $[0] = bold;
    $[1] = children;
    $[2] = inverse;
    $[3] = italic;
    $[4] = resolvedBackgroundColor;
    $[5] = resolvedColor;
    $[6] = strikethrough;
    $[7] = underline;
    $[8] = wrap;
    $[9] = t8;
  } else {
    t8 = $[9];
  }
  return t8;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdE5vZGUiLCJSZWFjdCIsInVzZUNvbnRleHQiLCJUZXh0IiwiQ29sb3IiLCJTdHlsZXMiLCJnZXRUaGVtZSIsIlRoZW1lIiwidXNlVGhlbWUiLCJUZXh0SG92ZXJDb2xvckNvbnRleHQiLCJjcmVhdGVDb250ZXh0IiwidW5kZWZpbmVkIiwiUHJvcHMiLCJjb2xvciIsImJhY2tncm91bmRDb2xvciIsImRpbUNvbG9yIiwiYm9sZCIsIml0YWxpYyIsInVuZGVybGluZSIsInN0cmlrZXRocm91Z2giLCJpbnZlcnNlIiwid3JhcCIsImNoaWxkcmVuIiwicmVzb2x2ZUNvbG9yIiwidGhlbWUiLCJzdGFydHNXaXRoIiwiVGhlbWVkVGV4dCIsInQwIiwiJCIsIl9jIiwidDEiLCJ0MiIsInQzIiwidDQiLCJ0NSIsInQ2IiwidDciLCJ0aGVtZU5hbWUiLCJob3ZlckNvbG9yIiwicmVzb2x2ZWRDb2xvciIsImluYWN0aXZlIiwicmVzb2x2ZWRCYWNrZ3JvdW5kQ29sb3IiLCJ0OCJdLCJzb3VyY2VzIjpbIlRoZW1lZFRleHQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgUmVhY3ROb2RlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgUmVhY3QsIHsgdXNlQ29udGV4dCB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IFRleHQgZnJvbSAnLi4vLi4vaW5rL2NvbXBvbmVudHMvVGV4dC5qcydcbmltcG9ydCB0eXBlIHsgQ29sb3IsIFN0eWxlcyB9IGZyb20gJy4uLy4uL2luay9zdHlsZXMuanMnXG5pbXBvcnQgeyBnZXRUaGVtZSwgdHlwZSBUaGVtZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHsgdXNlVGhlbWUgfSBmcm9tICcuL1RoZW1lUHJvdmlkZXIuanMnXG5cbi8qKiBDb2xvcnMgdW5jb2xvcmVkIFRoZW1lZFRleHQgaW4gdGhlIHN1YnRyZWUuIFByZWNlZGVuY2U6IGV4cGxpY2l0IGBjb2xvcmAgPlxuICogIHRoaXMgPiBkaW1Db2xvci4gQ3Jvc3NlcyBCb3ggYm91bmRhcmllcyAoSW5rJ3Mgc3R5bGUgY2FzY2FkZSBkb2Vzbid0KS4gKi9cbmV4cG9ydCBjb25zdCBUZXh0SG92ZXJDb2xvckNvbnRleHQgPSBSZWFjdC5jcmVhdGVDb250ZXh0PFxuICBrZXlvZiBUaGVtZSB8IHVuZGVmaW5lZFxuPih1bmRlZmluZWQpXG5cbmV4cG9ydCB0eXBlIFByb3BzID0ge1xuICAvKipcbiAgICogQ2hhbmdlIHRleHQgY29sb3IuIEFjY2VwdHMgYSB0aGVtZSBrZXkgb3IgcmF3IGNvbG9yIHZhbHVlLlxuICAgKi9cbiAgcmVhZG9ubHkgY29sb3I/OiBrZXlvZiBUaGVtZSB8IENvbG9yXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYGNvbG9yYCwgYnV0IGZvciBiYWNrZ3JvdW5kLiBNdXN0IGJlIGEgdGhlbWUga2V5LlxuICAgKi9cbiAgcmVhZG9ubHkgYmFja2dyb3VuZENvbG9yPzoga2V5b2YgVGhlbWVcblxuICAvKipcbiAgICogRGltIHRoZSBjb2xvciB1c2luZyB0aGUgdGhlbWUncyBpbmFjdGl2ZSBjb2xvci5cbiAgICogVGhpcyBpcyBjb21wYXRpYmxlIHdpdGggYm9sZCAodW5saWtlIEFOU0kgZGltKS5cbiAgICovXG4gIHJlYWRvbmx5IGRpbUNvbG9yPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBNYWtlIHRoZSB0ZXh0IGJvbGQuXG4gICAqL1xuICByZWFkb25seSBib2xkPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBNYWtlIHRoZSB0ZXh0IGl0YWxpYy5cbiAgICovXG4gIHJlYWRvbmx5IGl0YWxpYz86IGJvb2xlYW5cblxuICAvKipcbiAgICogTWFrZSB0aGUgdGV4dCB1bmRlcmxpbmVkLlxuICAgKi9cbiAgcmVhZG9ubHkgdW5kZXJsaW5lPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBNYWtlIHRoZSB0ZXh0IGNyb3NzZWQgd2l0aCBhIGxpbmUuXG4gICAqL1xuICByZWFkb25seSBzdHJpa2V0aHJvdWdoPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBJbnZlcnNlIGJhY2tncm91bmQgYW5kIGZvcmVncm91bmQgY29sb3JzLlxuICAgKi9cbiAgcmVhZG9ubHkgaW52ZXJzZT86IGJvb2xlYW5cblxuICAvKipcbiAgICogVGhpcyBwcm9wZXJ0eSB0ZWxscyBJbmsgdG8gd3JhcCBvciB0cnVuY2F0ZSB0ZXh0IGlmIGl0cyB3aWR0aCBpcyBsYXJnZXIgdGhhbiBjb250YWluZXIuXG4gICAqIElmIGB3cmFwYCBpcyBwYXNzZWQgKGJ5IGRlZmF1bHQpLCBJbmsgd2lsbCB3cmFwIHRleHQgYW5kIHNwbGl0IGl0IGludG8gbXVsdGlwbGUgbGluZXMuXG4gICAqIElmIGB0cnVuY2F0ZS0qYCBpcyBwYXNzZWQsIEluayB3aWxsIHRydW5jYXRlIHRleHQgaW5zdGVhZCwgd2hpY2ggd2lsbCByZXN1bHQgaW4gb25lIGxpbmUgb2YgdGV4dCB3aXRoIHRoZSByZXN0IGN1dCBvZmYuXG4gICAqL1xuICByZWFkb25seSB3cmFwPzogU3R5bGVzWyd0ZXh0V3JhcCddXG5cbiAgcmVhZG9ubHkgY2hpbGRyZW4/OiBSZWFjdE5vZGVcbn1cblxuLyoqXG4gKiBSZXNvbHZlcyBhIGNvbG9yIHZhbHVlIHRoYXQgbWF5IGJlIGEgdGhlbWUga2V5IHRvIGEgcmF3IENvbG9yLlxuICovXG5mdW5jdGlvbiByZXNvbHZlQ29sb3IoXG4gIGNvbG9yOiBrZXlvZiBUaGVtZSB8IENvbG9yIHwgdW5kZWZpbmVkLFxuICB0aGVtZTogVGhlbWUsXG4pOiBDb2xvciB8IHVuZGVmaW5lZCB7XG4gIGlmICghY29sb3IpIHJldHVybiB1bmRlZmluZWRcbiAgLy8gQ2hlY2sgaWYgaXQncyBhIHJhdyBjb2xvciAoc3RhcnRzIHdpdGggcmdiKCwgIywgYW5zaTI1NigsIG9yIGFuc2k6KVxuICBpZiAoXG4gICAgY29sb3Iuc3RhcnRzV2l0aCgncmdiKCcpIHx8XG4gICAgY29sb3Iuc3RhcnRzV2l0aCgnIycpIHx8XG4gICAgY29sb3Iuc3RhcnRzV2l0aCgnYW5zaTI1NignKSB8fFxuICAgIGNvbG9yLnN0YXJ0c1dpdGgoJ2Fuc2k6JylcbiAgKSB7XG4gICAgcmV0dXJuIGNvbG9yIGFzIENvbG9yXG4gIH1cbiAgLy8gSXQncyBhIHRoZW1lIGtleSAtIHJlc29sdmUgaXRcbiAgcmV0dXJuIHRoZW1lW2NvbG9yIGFzIGtleW9mIFRoZW1lXSBhcyBDb2xvclxufVxuXG4vKipcbiAqIFRoZW1lLWF3YXJlIFRleHQgY29tcG9uZW50IHRoYXQgcmVzb2x2ZXMgdGhlbWUgY29sb3Iga2V5cyB0byByYXcgY29sb3JzLlxuICogVGhpcyB3cmFwcyB0aGUgYmFzZSBUZXh0IGNvbXBvbmVudCB3aXRoIHRoZW1lIHJlc29sdXRpb24uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFRoZW1lZFRleHQoe1xuICBjb2xvcixcbiAgYmFja2dyb3VuZENvbG9yLFxuICBkaW1Db2xvciA9IGZhbHNlLFxuICBib2xkID0gZmFsc2UsXG4gIGl0YWxpYyA9IGZhbHNlLFxuICB1bmRlcmxpbmUgPSBmYWxzZSxcbiAgc3RyaWtldGhyb3VnaCA9IGZhbHNlLFxuICBpbnZlcnNlID0gZmFsc2UsXG4gIHdyYXAgPSAnd3JhcCcsXG4gIGNoaWxkcmVuLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbdGhlbWVOYW1lXSA9IHVzZVRoZW1lKClcbiAgY29uc3QgdGhlbWUgPSBnZXRUaGVtZSh0aGVtZU5hbWUpXG4gIGNvbnN0IGhvdmVyQ29sb3IgPSB1c2VDb250ZXh0KFRleHRIb3ZlckNvbG9yQ29udGV4dClcblxuICAvLyBSZXNvbHZlIHRoZW1lIGtleXMgdG8gcmF3IGNvbG9yc1xuICBjb25zdCByZXNvbHZlZENvbG9yID1cbiAgICAhY29sb3IgJiYgaG92ZXJDb2xvclxuICAgICAgPyByZXNvbHZlQ29sb3IoaG92ZXJDb2xvciwgdGhlbWUpXG4gICAgICA6IGRpbUNvbG9yXG4gICAgICAgID8gKHRoZW1lLmluYWN0aXZlIGFzIENvbG9yKVxuICAgICAgICA6IHJlc29sdmVDb2xvcihjb2xvciwgdGhlbWUpXG4gIGNvbnN0IHJlc29sdmVkQmFja2dyb3VuZENvbG9yID0gYmFja2dyb3VuZENvbG9yXG4gICAgPyAodGhlbWVbYmFja2dyb3VuZENvbG9yXSBhcyBDb2xvcilcbiAgICA6IHVuZGVmaW5lZFxuXG4gIHJldHVybiAoXG4gICAgPFRleHRcbiAgICAgIGNvbG9yPXtyZXNvbHZlZENvbG9yfVxuICAgICAgYmFja2dyb3VuZENvbG9yPXtyZXNvbHZlZEJhY2tncm91bmRDb2xvcn1cbiAgICAgIGJvbGQ9e2JvbGR9XG4gICAgICBpdGFsaWM9e2l0YWxpY31cbiAgICAgIHVuZGVybGluZT17dW5kZXJsaW5lfVxuICAgICAgc3RyaWtldGhyb3VnaD17c3RyaWtldGhyb3VnaH1cbiAgICAgIGludmVyc2U9e2ludmVyc2V9XG4gICAgICB3cmFwPXt3cmFwfVxuICAgID5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L1RleHQ+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLGNBQWNBLFNBQVMsUUFBUSxPQUFPO0FBQ3RDLE9BQU9DLEtBQUssSUFBSUMsVUFBVSxRQUFRLE9BQU87QUFDekMsT0FBT0MsSUFBSSxNQUFNLDhCQUE4QjtBQUMvQyxjQUFjQyxLQUFLLEVBQUVDLE1BQU0sUUFBUSxxQkFBcUI7QUFDeEQsU0FBU0MsUUFBUSxFQUFFLEtBQUtDLEtBQUssUUFBUSxzQkFBc0I7QUFDM0QsU0FBU0MsUUFBUSxRQUFRLG9CQUFvQjs7QUFFN0M7QUFDQTtBQUNBLE9BQU8sTUFBTUMscUJBQXFCLEdBQUdSLEtBQUssQ0FBQ1MsYUFBYSxDQUN0RCxNQUFNSCxLQUFLLEdBQUcsU0FBUyxDQUN4QixDQUFDSSxTQUFTLENBQUM7QUFFWixPQUFPLEtBQUtDLEtBQUssR0FBRztFQUNsQjtBQUNGO0FBQ0E7RUFDRSxTQUFTQyxLQUFLLENBQUMsRUFBRSxNQUFNTixLQUFLLEdBQUdILEtBQUs7O0VBRXBDO0FBQ0Y7QUFDQTtFQUNFLFNBQVNVLGVBQWUsQ0FBQyxFQUFFLE1BQU1QLEtBQUs7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