import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that keeps the collector record named
 * `withheld` from the collector and marks every other one `edited`.
 */
export const withholding: Plugin = {
  name: 'withholding',
  register(on) {
    on('telemetry.log', { to: 'collector' }, ($, e, next) =>
      e.event === 'withheld'
        ? { deny: 'kept from the collector' }
        : next({ ...e, props: { ...e.props, edited: true } }),
    )
  },
}
