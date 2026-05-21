import type { TextProps } from '../ink.js'
import {
  AGENT_COLOR_TO_THEME_COLOR,
  type AgentColorName,
} from '../tools/AgentTool/agentColorManager.js'

const DEFAULT_AGENT_THEME_COLOR = 'cyan_FOR_SUBAGENTS_ONLY'

/**
 * Convert a color string to Ink's TextProps['color'] format.
 * Colors are typically AgentColorName values like 'blue', 'green', etc.
 * This converts them to theme keys so they respect the current theme.
 * Falls back to the raw ANSI color if the color is not a known agent color.
 */
export function toInkColor(color: string | undefined): TextProps['color'] {
  if (!color) {
    return DEFAULT_AGENT_THEME_COLOR
  }
  // Try to map to a theme color if it's a known agent color
  const themeColor = AGENT_COLOR_TO_THEME_COLOR[color as AgentColorName]
  if (themeColor) {
    return themeColor
  }
  // Fall back to raw ANSI color for unknown colors
  return `ansi:${color}` as TextProps['color']
}
