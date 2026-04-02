/**
 * Converts ANSI-escaped terminal text to SVG format
 * Supports basic ANSI color codes (foreground colors)
 */

import { escapeXml } from './xml.js'

export type AnsiColor = {
  r: number
  g: number
  b: number
}

// Default terminal color palette (similar to most terminals)
const ANSI_COLORS: Record<number, AnsiColor> = {
  30: { r: 0, g: 0, b: 0 }, // black
  31: { r: 205, g: 49, b: 49 }, // red
  32: { r: 13, g: 188, b: 121 }, // green
  33: { r: 229, g: 229, b: 16 }, // yellow
  34: { r: 36, g: 114, b: 200 }, // blue
  35: { r: 188, g: 63, b: 188 }, // magenta
  36: { r: 17, g: 168, b: 205 }, // cyan
  37: { r: 229, g: 229, b: 229 }, // white
  // Bright colors
  90: { r: 102, g: 102, b: 102 }, // bright black (gray)
  91: { r: 241, g: 76, b: 76 }, // bright red
  92: { r: 35, g: 209, b: 139 }, // bright green
  93: { r: 245, g: 245, b: 67 }, // bright yellow
  94: { r: 59, g: 142, b: 234 }, // bright blue
  95: { r: 214, g: 112, b: 214 }, // bright magenta
  96: { r: 41, g: 184, b: 219 }, // bright cyan
  97: { r: 255, g: 255, b: 255 }, // bright white
}

export const DEFAULT_FG: AnsiColor = { r: 229, g: 229, b: 229 } // light gray
export const DEFAULT_BG: AnsiColor = { r: 30, g: 30, b: 30 } // dark gray

export type TextSpan = {
  text: string
  color: AnsiColor
  bold: boolean
}

export type ParsedLine = TextSpan[]

/**
 * Parse ANSI escape sequences from text
 * Supports:
 * - Basic colors (30-37, 90-97)
 * - 256-color mode (38;5;n)
 * - 24-bit true color (38;2;r;g;b)
 */
export function parseAnsi(text: string): ParsedLine[] {
  const lines: ParsedLine[] = []
  const rawLines = text.split('\n')

  for (const line of rawLines) {
    const spans: TextSpan[] = []
    let currentColor = DEFAULT_FG
    let bold = false
    let i = 0

    while (i < line.length) {
      // Check for ANSI escape sequence
      if (line[i] === '\x1b' && line[i + 1] === '[') {
        // Find the end of the escape sequence
        let j = i + 2
        while (j < line.length && !/[A-Za-z]/.test(line[j]!)) {
          j++
        }

        if (line[j] === 'm') {
          // Color/style code
          const codes = line
            .slice(i + 2, j)
            .split(';')
            .map(Number)

          let k = 0
          while (k < codes.length) {
            const code = codes[k]!
            if (code === 0) {
              // Reset
              currentColor = DEFAULT_FG
              bold = false
            } else if (code === 1) {
              bold = true
            } else if (code >= 30 && code <= 37) {
              currentColor = ANSI_COLORS[code] || DEFAULT_FG
            } else if (code >= 90 && code <= 97) {
              currentColor = ANSI_COLORS[code] || DEFAULT_FG
            } else if (code === 39) {
              currentColor = DEFAULT_FG
            } else if (code === 38) {
              // Extended color - check next code
              if (codes[k + 1] === 5 && codes[k + 2] !== undefined) {
                // 256-color mode: 38;5;n
                const colorIndex = codes[k + 2]!
                currentColor = get256Color(colorIndex)
                k += 2
              } else if (
                codes[k + 1] === 2 &&
                codes[k + 2] !== undefined &&
                codes[k + 3] !== undefined &&
                codes[k + 4] !== undefined
              ) {
                // 24-bit true color: 38;2;r;g;b
                currentColor = {
                  r: codes[k + 2]!,
                  g: codes[k + 3]!,
                  b: codes[k + 4]!,
                }
                k += 4
              }
            }
            k++
          }
        }

        i = j + 1
        continue
      }

      // Regular character - find extent of same-styled text
      const textStart = i
      while (i < line.length && line[i] !== '\x1b') {
        i++
      }

      const spanText = line.slice(textStart, i)
      if (spanText) {
        spans.push({ text: spanText, color: currentColor, bold })
      }
    }

    // Add empty span if line is empty (to preserve line)
    if (spans.length === 0) {
      spans.push({ text: '', color: DEFAULT_FG, bold: false })
    }

    lines.push(spans)
  }

  return lines
}

/**
 * Get color from 256-color palette
 */
function get256Color(index: number): AnsiColor {
  // Standard colors (0-15)
  if (index < 16) {
    const standardColors: AnsiColor[] = [
      { r: 0, g: 0, b: 0 }, // 0 black
      { r: 128, g: 0, b: 0 }, // 1 red
      { r: 0, g: 128, b: 0 }, // 2 green
      { r: 128, g: 128, b: 0 }, // 3 yellow
      { r: 0, g: 0, b: 128 }, // 4 blue
      { r: 128, g: 0, b: 128 }, // 5 magenta
      { r: 0, g: 128, b: 128 }, // 6 cyan
      { r: 192, g: 192, b: 192 }, // 7 white
      { r: 128, g: 128, b: 128 }, // 8 bright black
      { r: 255, g: 0, b: 0 }, // 9 bright red
      { r: 0, g: 255, b: 0 }, // 10 bright green
      { r: 255, g: 255, b: 0 }, // 11 bright yellow
      { r: 0, g: 0, b: 255 }, // 12 bright blue
      { r: 255, g: 0, b: 255 }, // 13 bright magenta
      { r: 0, g: 255, b: 255 }, // 14 bright cyan
      { r: 255, g: 255, b: 255 }, // 15 bright white
    ]
    return standardColors[index] || DEFAULT_FG
  }

  // 216 color cube (16-231)
  if (index < 232) {
    const i = index - 16
    const r = Math.floor(i / 36)
    const g = Math.floor((i % 36) / 6)
    const b = i % 6
    return {
      r: r === 0 ? 0 : 55 + r * 40,
      g: g === 0 ? 0 : 55 + g * 40,
      b: b === 0 ? 0 : 55 + b * 40,
    }
  }

  // Grayscale (232-255)
  const gray = (index - 232) * 10 + 8
  return { r: gray, g: gray, b: gray }
}

export type AnsiToSvgOptions = {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  paddingX?: number
  paddingY?: number
  backgroundColor?: string
  borderRadius?: number
}

/**
 * Convert ANSI text to SVG
 * Uses <tspan> elements within a single <text> per line so the renderer
 * handles character spacing natively (no manual charWidth calculation)
 */
export function ansiToSvg(
  ansiText: string,
  options: AnsiToSvgOptions = {},
): string {
  const {
    fontFamily = 'Menlo, Monaco, monospace',
    fontSize = 14,
    lineHeight = 22,
    paddingX = 24,
    paddingY = 24,
    backgroundColor = `rgb(${DEFAULT_BG.r}, ${DEFAULT_BG.g}, ${DEFAULT_BG.b})`,
    borderRadius = 8,
  } = options

  const lines = parseAnsi(ansiText)

  // Trim trailing empty lines
  while (
    lines.length > 0 &&
    lines[lines.length - 1]!.every(span => span.text.trim() === '')
  ) {
    lines.pop()
  }

  // Estimate width based on max line length (for SVG dimensions only)
  // For monospace fonts, character width is roughly 0.6 * fontSize
  const charWidthEstimate = fontSize * 0.6
  const maxLineLength = Math.max(
    ...lines.map(spans => spans.reduce((acc, s) => acc + s.text.length, 0)),
  )
  const width = Math.ceil(maxLineLength * charWidthEstimate + paddingX * 2)
  const height = lines.length * lineHeight + paddingY * 2

  // Build SVG - use tspan elements so renderer handles character positioning
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  svg += `  <rect width="100%" height="100%" fill="${backgroundColor}" rx="${borderRadius}" ry="${borderRadius}"/>\n`
  svg += `  <style>\n`
  svg += `    text { font-family: ${fontFamily}; font-size: ${fontSize}px; white-space: pre; }\n`
  svg += `    .b { font-weight: bold; }\n`
  svg += `  </style>\n`

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const spans = lines[lineIndex]!
    const y =
      paddingY + (lineIndex + 1) * lineHeight - (lineHeight - fontSize) / 2

    // Build a single <text> element with <tspan> children for each colored segment
    // xml:space="preserve" prevents SVG from collapsing whitespace
    svg += `  <text x="${paddingX}" y="${y}" xml:space="preserve">`

    for (const span of spans) {
      if (!span.text) continue

      const colorStr = `rgb(${span.color.r}, ${span.color.g}, ${span.color.b})`
      const boldClass = span.bold ? ' class="b"' : ''

      svg += `<tspan fill="${colorStr}"${boldClass}>${escapeXml(span.text)}</tspan>`
    }

    svg += `</text>\n`
  }

  svg += `</svg>`

  return svg
}
