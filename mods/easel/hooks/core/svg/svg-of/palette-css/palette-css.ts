import Shapes from '../../../shapes'

/**
 * The colours for light or for dark, each ink a custom property of its
 * own name.
 *
 * @param theme which of the two colours of an ink to write
 * @returns the declarations, joined by `;`
 */
export const paletteCss = (theme: 'light' | 'dark'): string =>
  Object.entries(Shapes.PALETTE)
    .map(([ink, colours]) => `--${ink}:${colours[theme]}`)
    .join(';')
