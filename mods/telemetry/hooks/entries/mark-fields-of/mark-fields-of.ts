import { FEATURE_PREFIX } from '../feature-prefix'
import type { Fields } from '../fields'
import type { Mark } from '../mark'

/**
 * One checked mark as its fields: the CLI's own feature event,
 * `tengu_feature_<kind>` with `feature_name`, and `error_code` when given.
 *
 * The mark's properties merge in as the CLI's feature events merge their
 * extras: after `feature_name` on an ok row, and beneath `feature_name`
 * and `error_code` on a sad or bad one.
 *
 * @param mark the feature, how it went, why when not ok, and its checked
 *   properties
 * @returns the event's name and props, ready to log
 */
export const markFieldsOf = ({
  kind,
  feature,
  reason,
  props,
}: Mark): Fields => ({
  name: FEATURE_PREFIX + kind,
  props:
    reason === undefined
      ? { feature_name: feature, ...props }
      : { ...props, feature_name: feature, error_code: reason },
})
