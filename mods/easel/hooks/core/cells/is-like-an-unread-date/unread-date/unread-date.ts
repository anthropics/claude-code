import { MONTH_NAME } from './month-name'

/**
 * `06/01/2026`, `Sep 7`: which number is the day depends on the country, and
 * the year could be any. A version such as `1.2.3` must not match.
 */
export const UNREAD_DATE = new RegExp(
  String.raw`^(?:\d{1,2}([./-])\d{1,2}\1\d{4}\b|\d{1,2}/\d{1,2}/\d{2}\b|` +
    String.raw`\d{1,2}[./]\d{4}\b|${MONTH_NAME} \d{1,2}$|` +
    String.raw`\d{1,2} ${MONTH_NAME}$)`,
)
