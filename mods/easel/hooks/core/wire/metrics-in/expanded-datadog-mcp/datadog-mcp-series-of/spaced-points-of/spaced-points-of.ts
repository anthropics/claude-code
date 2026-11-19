import Cells from '../../../../../cells'
import Json from '../../../../../json'
import { spacedPointAt } from './spaced-point-at'

/**
 * The values that an expression writes as one text, a time for each.
 *
 * A start that names no zone is no instant: its values are left out.
 *
 * @param node one expression of the server's answer, with its values
 * @returns a time and a value per point, none without an instant to start at
 */
export function spacedPointsOf(node: unknown): unknown[][] {
  const start = Cells.readTime(String(Json.valuesAt(node, 'start_time')[0]))
  const isInstant = start.kind === 'time' && start.isZoned

  return isInstant
    ? Json.valuesAt(node, 'values')
        .flatMap(text => String(text).split(','))
        .map(
          spacedPointAt(
            start.ms,
            Number(Json.valuesAt(node, 'interval_ms')[0]),
          ),
        )
    : []
}
