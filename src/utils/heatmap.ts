import chalk from 'chalk'
import type { DailyActivity } from './stats.js'
import { toDateString } from './statsCache.js'

export type HeatmapOptions = {
  terminalWidth?: number // Terminal width in characters
  showMonthLabels?: boolean
}

type Percentiles = {
  p25: number
  p50: number
  p75: number
}

/**
 * Pre-calculates percentiles from activity data for use in intensity calculations
 */
function calculatePercentiles(
  dailyActivity: DailyActivity[],
): Percentiles | null {
  const counts = dailyActivity
    .map(a => a.messageCount)
    .filter(c => c > 0)
    .sort((a, b) => a - b)

  if (counts.length === 0) return null

  return {
    p25: counts[Math.floor(counts.length * 0.25)]!,
    p50: counts[Math.floor(counts.length * 0.5)]!,
    p75: counts[Math.floor(counts.length * 0.75)]!,
  }
}

/**
 * Generates a GitHub-style activity heatmap for the terminal
 */
export function generateHeatmap(
  dailyActivity: DailyActivity[],
  options: HeatmapOptions = {},
): string {
  const { terminalWidth = 80, showMonthLabels = true } = options

  // Day labels take 4 characters ("Mon "), calculate weeks that fit
  // Cap at 52 weeks (1 year) to match GitHub style
  const dayLabelWidth = 4
  const availableWidth = terminalWidth - dayLabelWidth
  const width = Math.min(52, Math.max(10, availableWidth))

  // Build activity map by date
  const activityMap = new Map<string, DailyActivity>()
  for (const activity of dailyActivity) {
    activityMap.set(activity.date, activity)
  }

  // Pre-calculate percentiles once for all intensity lookups
  const percentiles = calculatePercentiles(dailyActivity)

  // Calculate date range - end at today, go back N weeks
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the Sunday of the current week (start of the week containing today)
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - today.getDay())

  // Go back (width - 1) weeks from the current week start
  const startDate = new Date(currentWeekStart)
  startDate.setDate(startDate.getDate() - (width - 1) * 7)

  // Generate grid (7 rows for days of week, width columns for weeks)
  // Also track which week each month starts for labels
  const grid: string[][] = Array.from({ length: 7 }, () =>
    Array(width).fill(''),
  )
  const monthStarts: { month: number; week: number }[] = []
  let lastMonth = -1

  const currentDate = new Date(startDate)
  for (let week = 0; week < width; week++) {
    for (let day = 0; day < 7; day++) {
      // Don't show future dates
      if (currentDate > today) {
        grid[day]![week] = ' '
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      const dateStr = toDateString(currentDate)
      const activity = activityMap.get(dateStr)

      // Track month changes (on day 0 = Sunday of each week)
      if (day === 0) {
        const month = currentDate.getMonth()
        if (month !== lastMonth) {
          monthStarts.push({ month, week })
          lastMonth = month
        }
      }

      // Determine intensity level based on message count
      const intensity = getIntensity(activity?.messageCount || 0, percentiles)
      grid[day]![week] = getHeatmapChar(intensity)

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Build output
  const lines: string[] = []

  // Month labels - evenly spaced across the grid
  if (showMonthLabels) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    // Build label line with fixed-width month labels
    const uniqueMonths = monthStarts.map(m => m.month)
    const labelWidth = Math.floor(width / Math.max(uniqueMonths.length, 1))
    const monthLabels = uniqueMonths
      .map(month => monthNames[month]!.padEnd(labelWidth))
      .join('')

    // 4 spaces for day label column prefix
    lines.push('    ' + monthLabels)
  }

  // Day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Grid
  for (let day = 0; day < 7; day++) {
    // Only show labels for Mon, Wed, Fri
    const label = [1, 3, 5].includes(day) ? dayLabels[day]!.padEnd(3) : '   '
    const row = label + ' ' + grid[day]!.join('')
    lines.push(row)
  }

  // Legend
  lines.push('')
  lines.push(
    '    Less ' +
      [
        claudeOrange('░'),
        claudeOrange('▒'),
        claudeOrange('▓'),
        claudeOrange('█'),
      ].join(' ') +
      ' More',
  )

  return lines.join('\n')
}

function getIntensity(
  messageCount: number,
  percentiles: Percentiles | null,
): number {
  if (messageCount === 0 || !percentiles) return 0

  if (messageCount >= percentiles.p75) return 4
  if (messageCount >= percentiles.p50) return 3
  if (messageCount >= percentiles.p25) return 2
  return 1
}

// Claude orange color (hex #da7756)
const claudeOrange = chalk.hex('#da7756')

function getHeatmapChar(intensity: number): string {
  switch (intensity) {
    case 0:
      return chalk.gray('·')
    case 1:
      return claudeOrange('░')
    case 2:
      return claudeOrange('▒')
    case 3:
      return claudeOrange('▓')
    case 4:
      return claudeOrange('█')
    default:
      return chalk.gray('·')
  }
}
