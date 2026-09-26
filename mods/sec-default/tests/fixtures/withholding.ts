import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that keeps the collector record named
 * `withheld` from the collector and marks every other one `edited`.
 */
export const withholding: Plugin = {
  name: 'withholding',
  register(on) {
    on('telemetry.log', { to: 'collector' }, ($, e, next) =>
      e.to === 'collector' && e.event !== 'withheld'
        ? next({ ...e, attributes: { ...e.attributes, edited: true } })
        : { deny: 'kept from the collector' },
    )
  },
}
