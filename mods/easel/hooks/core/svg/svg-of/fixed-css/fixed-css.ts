import Limits from '../../limits'

/**
 * The style rules that are the same under both themes.
 */
export const FIXED_CSS = [
  `text{font-size:${Limits.FONT_SIZE}px;` +
    'font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre}',
  'polyline{fill:none;stroke-width:1.6;' +
    'stroke-linejoin:round;stroke-linecap:round}',
  '.grid{opacity:.25}',
].join('')
