import type CoreCall from '../../../../call'
import type Casting from '../../../../casting'
import Lists from '../../../../lists'
import type Refusal from '../../../../refusal'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Refuses a column of mixed units, and one scale for columns of several.
 *
 * @param reading the table as read, for the units of its columns
 * @param roles what each column is read as
 * @param request the chart that was asked for
 * @returns the reason to refuse, or undefined
 */
export function unitProblemIn(
  reading: Types.TableReading,
  roles: Casting.Roles,
  request: CoreCall.ChartRequest,
): Refusal.Problem | undefined {
  const unitLists = [...reading.units.values()]
  const hasMixedUnits = unitLists.some(unitList => unitList.length > 1)

  if (hasMixedUnits) {
    const unitNames = unitLists.flat().map(unit => unit || 'none')
    const isOneUnitBesideBareNumbers =
      unitNames.includes('none') &&
      new Set(unitNames).size === Limits.ONE_UNIT_AND_NONE

    return {
      code: 'units_mixed',
      why:
        `the values of a column carry different units ` +
        `(${unitNames.join(', ')}). ` +
        (isOneUnitBesideBareNumbers
          ? 'Name what the bare numbers are in as unit'
          : 'Convert them to one unit, or chart the rows of each unit in ' +
            'a call of its own'),
    }
  }

  const columnsByUnit = Lists.groupBy(
    reading.units.keys(),
    column => reading.units.get(column)?.[0] ?? '',
  )
  const isOneScaleForSeveralUnits =
    (roles.form === 'bars' || request.form === 'sparks') &&
    columnsByUnit.size > 1

  return isOneScaleForSeveralUnits
    ? {
        code: 'units_differ',
        why:
          (request.form === 'sparks' ? 'sparks' : 'bars') +
          ` share one scale, and the y columns are in different units (` +
          [...columnsByUnit]
            .map(
              ([unit, columns]) =>
                `${columns.join(', ')} in ${unit || 'no unit'}`,
            )
            .join('; ') +
          `). Call once for each unit`,
      }
    : undefined
}
