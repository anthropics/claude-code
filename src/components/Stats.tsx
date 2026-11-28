import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import { plot as asciichart } from 'asciichart';
import chalk from 'chalk';
import figures from 'figures';
import React, { Suspense, use, useCallback, useEffect, useMemo, useState } from 'react';
import stripAnsi from 'strip-ansi';
import type { CommandResultDisplay } from '../commands.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { applyColor } from '../ink/colorize.js';
import { stringWidth as getStringWidth } from '../ink/stringWidth.js';
import type { Color } from '../ink/styles.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw j/k/arrow stats navigation
import { Ansi, Box, Text, useInput } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { getGlobalConfig } from '../utils/config.js';
import { formatDuration, formatNumber } from '../utils/format.js';
import { generateHeatmap } from '../utils/heatmap.js';
import { renderModelName } from '../utils/model/model.js';
import { copyAnsiToClipboard } from '../utils/screenshotClipboard.js';
import { aggregateClaudeCodeStatsForRange, type ClaudeCodeStats, type DailyModelTokens, type StatsDateRange } from '../utils/stats.js';
import { resolveThemeSetting } from '../utils/systemTheme.js';
import { getTheme, themeColorToAnsi } from '../utils/theme.js';
import { Pane } from './design-system/Pane.js';
import { Tab, Tabs, useTabHeaderFocus } from './design-system/Tabs.js';
import { Spinner } from './Spinner.js';
function formatPeakDay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
type Props = {
  onClose: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
type StatsResult = {
  type: 'success';
  data: ClaudeCodeStats;
} | {
  type: 'error';
  message: string;
} | {
  type: 'empty';
};
const DATE_RANGE_LABELS: Record<StatsDateRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time'
};
const DATE_RANGE_ORDER: StatsDateRange[] = ['all', '7d', '30d'];
function getNextDateRange(current: StatsDateRange): StatsDateRange {
  const currentIndex = DATE_RANGE_ORDER.indexOf(current);
  return DATE_RANGE_ORDER[(currentIndex + 1) % DATE_RANGE_ORDER.length]!;
}

/**
 * Creates a stats loading promise that never rejects.
 * Always loads all-time stats for the heatmap.
 */
function createAllTimeStatsPromise(): Promise<StatsResult> {
  return aggregateClaudeCodeStatsForRange('all').then((data): StatsResult => {
    if (!data || data.totalSessions === 0) {
      return {
        type: 'empty'
      };
    }
    return {
      type: 'success',
      data
    };
  }).catch((err): StatsResult => {
    const message = err instanceof Error ? err.message : 'Failed to load stats';
    return {
      type: 'error',
      message
    };
  });
}
export function Stats(t0) {
  const $ = _c(4);
  const {
    onClose
  } = t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = createAllTimeStatsPromise();
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const allTimePromise = t1;
  let t2;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box marginTop={1}><Spinner /><Text> Loading your Claude Code stats…</Text></Box>;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  let t3;
  if ($[2] !== onClose) {
    t3 = <Suspense fallback={t2}><StatsContent allTimePromise={allTimePromise} onClose={onClose} /></Suspense>;
    $[2] = onClose;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  return t3;
}
type StatsContentProps = {
  allTimePromise: Promise<StatsResult>;
  onClose: Props['onClose'];
};

/**
 * Inner component that uses React 19's use() to read the stats promise.
 * Suspends while loading all-time stats, then handles date range changes without suspending.
 */
function StatsContent(t0) {
  const $ = _c(34);
  const {
    allTimePromise,
    onClose
  } = t0;
  const allTimeResult = use(allTimePromise);
  const [dateRange, setDateRange] = useState("all");
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = {};
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const [statsCache, setStatsCache] = useState(t1);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [copyStatus, setCopyStatus] = useState(null);
  let t2;
  let t3;
  if ($[1] !== dateRange || $[2] !== statsCache) {
    t2 = () => {
      if (dateRange === "all") {
        return;
      }
      if (statsCache[dateRange]) {
        return;
      }
      let cancelled = false;
      setIsLoadingFiltered(true);
      aggregateClaudeCodeStatsForRange(dateRange).then(data => {
        if (!cancelled) {
          setStatsCache(prev => ({
            ...prev,
            [dateRange]: data
          }));
          setIsLoadingFiltered(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setIsLoadingFiltered(false);
        }
      });
      return () => {
        cancelled = true;
      };
    };
    t3 = [dateRange, statsCache];
    $[1] = dateRange;
    $[2] = statsCache;
    $[3] = t2;
    $[4] = t3;
  } else {
    t2 = $[3];
    t3 = $[4];
  }
  useEffect(t2, t3);
  const displayStats = dateRange === "all" ? allTimeResult.type === "success" ? allTimeResult.data : null : statsCache[dateRange] ?? (allTimeResult.type === "success" ? allTimeResult.data : null);
  const allTimeStats = allTimeResult.type === "success" ? allTimeResult.data : null;
  let t4;
  if ($[5] !== onClose) {
    t4 = () => {
      onClose("Stats dialog dismissed", {
        display: "system"
      });
    };
    $[5] = onClose;
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  const handleClose = t4;
  let t5;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = {
      context: "Confirmation"
    };
    $[7] = t5;
  } else {
    t5 = $[7];
  }
  useKeybinding("confirm:no", handleClose, t5);
  let t6;
  if ($[8] !== activeTab || $[9] !== dateRange || $[10] !== displayStats || $[11] !== onClose) {
    t6 = (input, key) => {
      if (key.ctrl && (input === "c" || input === "d")) {
        onClose("Stats dialog dismissed", {
          display: "system"
        });
      }
      if (key.tab) {
        setActiveTab(_temp);
      }
      if (input === "r" && !key.ctrl && !key.meta) {
        setDateRange(getNextDateRange(dateRange));
      }
      if (key.ctrl && input === "s" && displayStats) {
        handleScreenshot(displayStats, activeTab, setCopyStatus);
      }
    };
    $[8] = activeTab;
    $[9] = dateRange;
    $[10] = displayStats;
    $[11] = onClose;
    $[12] = t6;
  } else {
    t6 = $[12];
  }
  useInput(t6);
  if (allTimeResult.type === "error") {
    let t7;
    if ($[13] !== allTimeResult.message) {
      t7 = <Box marginTop={1}><Text color="error">Failed to load stats: {allTimeResult.message}</Text></Box>;
      $[13] = allTimeResult.message;
      $[14] = t7;
    } else {
      t7 = $[14];
    }
    return t7;
  }
  if (allTimeResult.type === "empty") {
    let t7;
    if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
      t7 = <Box marginTop={1}><Text color="warning">No stats available yet. Start using Claude Code!</Text></Box>;
      $[15] = t7;
    } else {
      t7 = $[15];
    }
    return t7;
  }
  if (!displayStats || !allTimeStats) {
    let t7;
    if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
      t7 = <Box marginTop={1}><Spinner /><Text> Loading stats…</Text></Box>;
      $[16] = t7;
    } else {
      t7 = $[16];
    }
    return t7;
  }
  let t7;
  if ($[17] !== allTimeStats || $[18] !== dateRange || $[19] !== displayStats || $[20] !== isLoadingFiltered) {
    t7 = <Tab title="Overview"><OverviewTab stats={displayStats} allTimeStats={allTimeStats} dateRange={dateRange} isLoading={isLoadingFiltered} /></Tab>;
    $[17] = allTimeStats;
    $[18] = dateRange;
    $[19] = displayStats;
    $[20] = isLoadingFiltered;
    $[21] = t7;
  } else {
    t7 = $[21];
  }
  let t8;
  if ($[22] !== dateRange || $[23] !== displayStats || $[24] !== isLoadingFiltered) {
    t8 = <Tab title="Models"><ModelsTab stats={displayStats} dateRange={dateRange} isLoading={isLoadingFiltered} /></Tab>;
    $[22] = dateRange;
    $[23] = displayStats;
    $[24] = isLoadingFiltered;
    $[25] = t8;
  } else {
    t8 = $[25];
  }
  let t9;
  if ($[26] !== t7 || $[27] !== t8) {
    t9 = <Box flexDirection="row" gap={1} marginBottom={1}><Tabs title="" color="claude" defaultTab="Overview">{t7}{t8}</Tabs></Box>;
    $[26] = t7;
    $[27] = t8;
    $[28] = t9;
  } else {
    t9 = $[28];
  }
  const t10 = copyStatus ? ` · ${copyStatus}` : "";
  let t11;
  if ($[29] !== t10) {
    t11 = <Box paddingLeft={2}><Text dimColor={true}>Esc to cancel · r to cycle dates · ctrl+s to copy{t10}</Text></Box>;
    $[29] = t10;
    $[30] = t11;
  } else {
    t11 = $[30];
  }
  let t12;
  if ($[31] !== t11 || $[32] !== t9) {
    t12 = <Pane color="claude">{t9}{t11}</Pane>;
    $[31] = t11;
    $[32] = t9;
    $[33] = t12;
  } else {
    t12 = $[33];
  }
  return t12;
}
function _temp(prev_0) {
  return prev_0 === "Overview" ? "Models" : "Overview";
}
function DateRangeSelector(t0) {
  const $ = _c(9);
  const {
    dateRange,
    isLoading
  } = t0;
  let t1;
  if ($[0] !== dateRange) {
    t1 = DATE_RANGE_ORDER.map((range, i) => <Text key={range}>{i > 0 && <Text dimColor={true}> · </Text>}{range === dateRange ? <Text bold={true} color="claude">{DATE_RANGE_LABELS[range]}</Text> : <Text dimColor={true}>{DATE_RANGE_LABELS[range]}</Text>}</Text>);
    $[0] = dateRange;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] !== t1) {
    t2 = <Box>{t1}</Box>;
    $[2] = t1;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] !== isLoading) {
    t3 = isLoading && <Spinner />;
    $[4] = isLoading;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  let t4;
  if ($[6] !== t2 || $[7] !== t3) {
    t4 = <Box marginBottom={1} gap={1}>{t2}{t3}</Box>;
    $[6] = t2;
    $[7] = t3;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}
function OverviewTab({
  stats,
  allTimeStats,
  dateRange,
  isLoading
}: {
  stats: ClaudeCodeStats;
  allTimeStats: ClaudeCodeStats;
  dateRange: StatsDateRange;
  isLoading: boolean;
}): React.ReactNode {
  const {
    columns: terminalWidth
  } = useTerminalSize();

  // Calculate favorite model and total tokens
  const modelEntries = Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
  const favoriteModel = modelEntries[0];
  const totalTokens = modelEntries.reduce((sum, [, usage]) => sum + usage.inputTokens + usage.outputTokens, 0);

  // Memoize the factoid so it doesn't change when switching tabs
  const factoid = useMemo(() => generateFunFactoid(stats, totalTokens), [stats, totalTokens]);

  // Calculate range days based on selected date range
  const rangeDays = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : stats.totalDays;

  // Compute shot stats data (ant-only, gated by feature flag)
  let shotStatsData: {
    avgShots: string;
    buckets: {
      label: string;
      count: number;
      pct: number;
    }[];
  } | null = null;
  if (feature('SHOT_STATS') && stats.shotDistribution) {
    const dist = stats.shotDistribution;
    const total = Object.values(dist).reduce((s, n) => s + n, 0);
    if (total > 0) {
      const totalShots = Object.entries(dist).reduce((s_0, [count, sessions]) => s_0 + parseInt(count, 10) * sessions, 0);
      const bucket = (min: number, max?: number) => Object.entries(dist).filter(([k]) => {
        const n_0 = parseInt(k, 10);
        return n_0 >= min && (max === undefined || n_0 <= max);
      }).reduce((s_1, [, v]) => s_1 + v, 0);
      const pct = (n_1: number) => Math.round(n_1 / total * 100);
      const b1 = bucket(1, 1);
      const b2_5 = bucket(2, 5);
      const b6_10 = bucket(6, 10);
      const b11 = bucket(11);
      shotStatsData = {
        avgShots: (totalShots / total).toFixed(1),
        buckets: [{
          label: '1-shot',
          count: b1,
          pct: pct(b1)
        }, {
          label: '2\u20135 shot',
          count: b2_5,
          pct: pct(b2_5)
        }, {
          label: '6\u201310 shot',
          count: b6_10,
          pct: pct(b6_10)
        }, {
          label: '11+ shot',
          count: b11,
          pct: pct(b11)
        }]
      };
    }
  }
  return <Box flexDirection="column" marginTop={1}>
      {/* Activity Heatmap - always shows all-time data */}
      {allTimeStats.dailyActivity.length > 0 && <Box flexDirection="column" marginBottom={1}>
          <Ansi>
            {generateHeatmap(allTimeStats.dailyActivity, {
          terminalWidth
        })}
          </Ansi>
        </Box>}

      {/* Date range selector */}
      <DateRangeSelector dateRange={dateRange} isLoading={isLoading} />

      {/* Section 1: Usage */}
      <Box flexDirection="row" gap={4} marginBottom={1}>
        <Box flexDirection="column" width={28}>
          {favoriteModel && <Text wrap="truncate">
              Favorite model:{' '}
              <Text color="claude" bold>
                {renderModelName(favoriteModel[0])}
              </Text>
            </Text>}
        </Box>
        <Box flexDirection="column" width={28}>
          <Text wrap="truncate">
            Total tokens:{' '}
            <Text color="claude">{formatNumber(totalTokens)}</Text>
          </Text>
        </Box>
      </Box>

      {/* Section 2: Activity - Row 1: Sessions | Longest session */}
      <Box flexDirection="row" gap={4}>
        <Box flexDirection="column" width={28}>
          <Text wrap="truncate">
            Sessions:{' '}
            <Text color="claude">{formatNumber(stats.totalSessions)}</Text>
          </Text>
        </Box>
        <Box flexDirection="column" width={28}>
          {stats.longestSession && <Text wrap="truncate">
              Longest session:{' '}
              <Text color="claude">
                {formatDuration(stats.longestSession.duration)}
              </Text>
            </Text>}
        </Box>
      </Box>

      {/* Row 2: Active days | Longest streak */}
      <Box flexDirection="row" gap={4}>
        <Box flexDirection="column" width={28}>
          <Text wrap="truncate">
            Active days: <Text color="claude">{stats.activeDays}</Text>
            <Text color="subtle">/{rangeDays}</Text>
          </Text>
        </Box>
        <Box flexDirection="column" width={28}>
          <Text wrap="truncate">
            Longest streak:{' '}
            <Text color="claude" bold>
              {stats.streaks.longestStreak}
            </Text>{' '}
            {stats.streaks.longestStreak === 1 ? 'day' : 'days'}
          </Text>
        </Box>
      </Box>

      {/* Row 3: Most active day | Current streak */}
      <Box flexDirection="row" gap={4}>
        <Box flexDirection="column" width={28}>
          {stats.peakActivityDay && <Text wrap="truncate">
              Most active day:{' '}
              <Text color="claude">{formatPeakDay(stats.peakActivityDay)}</Text>
            </Text>}
        </Box>
        <Box flexDirection="column" width={28}>
          <Text wrap="truncate">
            Current streak:{' '}
            <Text color="claude" bold>
              {allTimeStats.streaks.currentStreak}
            </Text>{' '}
            {allTimeStats.streaks.currentStreak === 1 ? 'day' : 'days'}
          </Text>
        </Box>
      </Box>

      {/* Speculation time saved (ant-only) */}
      {"external" === 'ant' && stats.totalSpeculationTimeSavedMs > 0 && <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                Speculation saved:{' '}
                <Text color="claude">
                  {formatDuration(stats.totalSpeculationTimeSavedMs)}
                </Text>
              </Text>
            </Box>
          </Box>}

      {/* Shot stats (ant-only) */}
      {shotStatsData && <>
          <Box marginTop={1}>
            <Text>Shot distribution</Text>
          </Box>
          <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                {shotStatsData.buckets[0]!.label}:{' '}
                <Text color="claude">{shotStatsData.buckets[0]!.count}</Text>
                <Text color="subtle"> ({shotStatsData.buckets[0]!.pct}%)</Text>
              </Text>
            </Box>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                {shotStatsData.buckets[1]!.label}:{' '}
                <Text color="claude">{shotStatsData.buckets[1]!.count}</Text>
                <Text color="subtle"> ({shotStatsData.buckets[1]!.pct}%)</Text>
              </Text>
            </Box>
          </Box>
          <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                {shotStatsData.buckets[2]!.label}:{' '}
                <Text color="claude">{shotStatsData.buckets[2]!.count}</Text>
                <Text color="subtle"> ({shotStatsData.buckets[2]!.pct}%)</Text>
              </Text>
            </Box>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                {shotStatsData.buckets[3]!.label}:{' '}
                <Text color="claude">{shotStatsData.buckets[3]!.count}</Text>
                <Text color="subtle"> ({shotStatsData.buckets[3]!.pct}%)</Text>
              </Text>
            </Box>
          </Box>
          <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" width={28}>
              <Text wrap="truncate">
                Avg/session:{' '}
                <Text color="claude">{shotStatsData.avgShots}</Text>
              </Text>
            </Box>
          </Box>
        </>}

      {/* Fun factoid */}
      {factoid && <Box marginTop={1}>
          <Text color="suggestion">{factoid}</Text>
        </Box>}
    </Box>;
}

// Famous books and their approximate token counts (words * ~1.3)
// Sorted by tokens ascending for comparison logic
const BOOK_COMPARISONS = [{
  name: 'The Little Prince',
  tokens: 22000
}, {
  name: 'The Old Man and the Sea',
  tokens: 35000
}, {
  name: 'A Christmas Carol',
  tokens: 37000
}, {
  name: 'Animal Farm',
  tokens: 39000
}, {
  name: 'Fahrenheit 451',
  tokens: 60000
}, {
  name: 'The Great Gatsby',
  tokens: 62000
}, {
  name: 'Slaughterhouse-Five',
  tokens: 64000
}, {
  name: 'Brave New World',
  tokens: 83000
}, {
  name: 'The Catcher in the Rye',
  tokens: 95000
}, {
  name: "Harry Potter and the Philosopher's Stone",
  tokens: 103000
}, {
  name: 'The Hobbit',
  tokens: 123000
}, {
  name: '1984',
  tokens: 123000
}, {
  name: 'To Kill a Mockingbird',
  tokens: 130000
}, {
  name: 'Pride and Prejudice',
  tokens: 156000
}, {
  name: 'Dune',
  tokens: 244000
}, {
  name: 'Moby-Dick',
  tokens: 268000
}, {
  name: 'Crime and Punishment',
  tokens: 274000
}, {
  name: 'A Game of Thrones',
  tokens: 381000
}, {
  name: 'Anna Karenina',
  tokens: 468000
}, {
  name: 'Don Quixote',
  tokens: 520000
}, {
  name: 'The Lord of the Rings',
  tokens: 576000
}, {
  name: 'The Count of Monte Cristo',
  tokens: 603000
}, {
  name: 'Les Misérables',
  tokens: 689000
}, {
  name: 'War and Peace',
  tokens: 730000
}];

// Time equivalents for session durations
const TIME_COMPARISONS = [{
  name: 'a TED talk',
  minutes: 18
}, {
  name: 'an episode of The Office',
  minutes: 22
}, {
  name: 'listening to Abbey Road',
  minutes: 47
}, {
  name: 'a yoga class',
  minutes: 60
}, {
  name: 'a World Cup soccer match',
  minutes: 90
}, {
  name: 'a half marathon (average time)',
  minutes: 120
}, {
  name: 'the movie Inception',
  minutes: 148
}, {
  name: 'watching Titanic',
  minutes: 195
}, {
  name: 'a transatlantic flight',
  minutes: 420
}, {
  name: 'a full night of sleep',
  minutes: 480
}];
function generateFunFactoid(stats: ClaudeCodeStats, totalTokens: number): string {
  const factoids: string[] = [];
  if (totalTokens > 0) {
    const matchingBooks = BOOK_COMPARISONS.filter(book => totalTokens >= book.tokens);
    for (const book of matchingBooks) {
      const times = totalTokens / book.tokens;
      if (times >= 2) {
        factoids.push(`You've used ~${Math.floor(times)}x more tokens than ${book.name}`);
      } else {
        factoids.push(`You've used the same number of tokens as ${book.name}`);
      }
    }
  }
  if (stats.longestSession) {
    const sessionMinutes = stats.longestSession.duration / (1000 * 60);
    for (const comparison of TIME_COMPARISONS) {
      const ratio = sessionMinutes / comparison.minutes;
      if (ratio >= 2) {
        factoids.push(`Your longest session is ~${Math.floor(ratio)}x longer than ${comparison.name}`);
      }
    }
  }
  if (factoids.length === 0) {
    return '';
  }
  const randomIndex = Math.floor(Math.random() * factoids.length);
  return factoids[randomIndex]!;
}
function ModelsTab(t0) {
  const $ = _c(15);
  const {
    stats,
    dateRange,
    isLoading
  } = t0;
  const {
    headerFocused,
    focusHeader
  } = useTabHeaderFocus();
  const [scrollOffset, setScrollOffset] = useState(0);
  const {
    columns: terminalWidth
  } = useTerminalSize();
  const modelEntries = Object.entries(stats.modelUsage).sort(_temp7);
  const t1 = !headerFocused;
  let t2;
  if ($[0] !== t1) {
    t2 = {
      isActive: t1
    };
    $[0] = t1;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  useInput((_input, key) => {
    if (key.downArrow && scrollOffset < modelEntries.length - 4) {
      setScrollOffset(prev => Math.min(prev + 2, modelEntries.length - 4));
    }
    if (key.upArrow) {
      if (scrollOffset > 0) {
        setScrollOffset(_temp8);
      } else {
        focusHeader();
      }
    }
  }, t2);
  if (modelEntries.length === 0) {
    let t3;
    if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
      t3 = <Box><Text color="subtle">No model usage data available</Text></Box>;
      $[2] = t3;
    } else {
      t3 = $[2];
    }
    return t3;
  }
  const totalTokens = modelEntries.reduce(_temp9, 0);
  const chartOutput = generateTokenChart(stats.dailyModelTokens, modelEntries.map(_temp0), terminalWidth);
  const visibleModels = modelEntries.slice(scrollOffset, scrollOffset + 4);
  const midpoint = Math.ceil(visibleModels.length / 2);
  const leftModels = visibleModels.slice(0, midpoint);
  const rightModels = visibleModels.slice(midpoint);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset < modelEntries.length - 4;
  const showScrollHint = modelEntries.length > 4;
  let t3;
  if ($[3] !== dateRange || $[4] !== isLoading) {
    t3 = <DateRangeSelector dateRange={dateRange} isLoading={isLoading} />;
    $[3] = dateRange;
    $[4] = isLoading;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  const T0 = Box;
  const t5 = "column";
  const t6 = 36;
  const t8 = rightModels.map(t7 => {
    const [model_1, usage_1] = t7;
    return <ModelEntry key={model_1} model={model_1} usage={usage_1} totalTokens={totalTokens} />;
  });
  let t9;
  if ($[6] !== T0 || $[7] !== t8) {
    t9 = <T0 flexDirection={t5} width={t6}>{t8}</T0>;
    $[6] = T0;
    $[7] = t8;
    $[8] = t9;
  } else {
    t9 = $[8];
  }
  let t10;
  if ($[9] !== canScrollDown || $[10] !== canScrollUp || $[11] !== modelEntries || $[12] !== scrollOffset || $[13] !== showScrollHint) {
    t10 = showScrollHint && <Box marginTop={1}><Text color="subtle">{canScrollUp ? figures.arrowUp : " "}{" "}{canScrollDown ? figures.arrowDown : " "} {scrollOffset + 1}-{Math.min(scrollOffset + 4, modelEntries.length)} of{" "}{modelEntries.length} models (↑↓ to scroll)</Text></Box>;
    $[9] = canScrollDown;
    $[10] = canScrollUp;
    $[11] = modelEntries;
    $[12] = scrollOffset;
    $[13] = showScrollHint;
    $[14] = t10;
  } else {
    t10 = $[14];
  }
  return <Box flexDirection="column" marginTop={1}>{chartOutput && <Box flexDirection="column" marginBottom={1}><Text bold={true}>Tokens per Day</Text><Ansi>{chartOutput.chart}</Ansi><Text color="subtle">{chartOutput.xAxisLabels}</Text><Box>{chartOutput.legend.map(_temp1)}</Box></Box>}{t3}<Box flexDirection="row" gap={4}><Box flexDirection="column" width={36}>{leftModels.map(t4 => {
          const [model_0, usage_0] = t4;
          return <ModelEntry key={model_0} model={model_0} usage={usage_0} totalTokens={totalTokens} />;
        })}</Box>{t9}</Box>{t10}</Box>;
}
function _temp1(item, i) {
  return <Text key={item.model}>{i > 0 ? " \xB7 " : ""}<Ansi>{item.coloredBullet}</Ansi> {item.model}</Text>;
}
function _temp0(t0) {
  const [model] = t0;
  return model;
}
function _temp9(sum, t0) {
  const [, usage] = t0;
  return sum + usage.inputTokens + usage.outputTokens;
}
function _temp8(prev_0) {
  return Math.max(prev_0 - 2, 0);
}
function _temp7(t0, t1) {
  const [, a] = t0;
  const [, b] = t1;
  return b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens);
}
type ModelEntryProps = {
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
  };
  totalTokens: number;
};
function ModelEntry(t0) {
  const $ = _c(21);
  const {
    model,
    usage,
    totalTokens
  } = t0;
  const modelTokens = usage.inputTokens + usage.outputTokens;
  const t1 = modelTokens / totalTokens * 100;
  let t2;
  if ($[0] !== t1) {
    t2 = t1.toFixed(1);
    $[0] = t1;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  const percentage = t2;
  let t3;
  if ($[2] !== model) {
    t3 = renderModelName(model);
    $[2] = model;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  let t4;
  if ($[4] !== t3) {
    t4 = <Text bold={true}>{t3}</Text>;
    $[4] = t3;
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  let t5;
  if ($[6] !== percentage) {
    t5 = <Text color="subtle">({percentage}%)</Text>;
    $[6] = percentage;
    $[7] = t5;
  } else {
    t5 = $[7];
  }
  let t6;
  if ($[8] !== t4 || $[9] !== t5) {
    t6 = <Text>{figures.bullet} {t4}{" "}{t5}</Text>;
    $[8] = t4;
    $[9] = t5;
    $[10] = t6;
  } else {
    t6 = $[10];
  }
  let t7;
  if ($[11] !== usage.inputTokens) {
    t7 = formatNumber(usage.inputTokens);
    $[11] = usage.inputTokens;
    $[12] = t7;
  } else {
    t7 = $[12];
  }
  let t8;
  if ($[13] !== usage.outputTokens) {
    t8 = formatNumber(usage.outputTokens);
    $[13] = usage.outputTokens;
    $[14] = t8;
  } else {
    t8 = $[14];
  }
  let t9;
  if ($[15] !== t7 || $[16] !== t8) {
    t9 = <Text color="subtle">{"  "}In: {t7} · Out:{" "}{t8}</Text>;
    $[15] = t7;
    $[16] = t8;
    $[17] = t9;
  } else {
    t9 = $[17];
  }
  let t10;
  if ($[18] !== t6 || $[19] !== t9) {
    t10 = <Box flexDirection="column">{t6}{t9}</Box>;
    $[18] = t6;
    $[19] = t9;
    $[20] = t10;
  } else {
    t10 = $[20];
  }
  return t10;
}
type ChartLegend = {
  model: string;
  coloredBullet: string; // Pre-colored bullet using chalk
};
type ChartOutput = {
  chart: string;
  legend: ChartLegend[];
  xAxisLabels: string;
};
function generateTokenChart(dailyTokens: DailyModelTokens[], models: string[], terminalWidth: number): ChartOutput | null {
  if (dailyTokens.length < 2 || models.length === 0) {
    return null;
  }

  // Y-axis labels take about 6 characters, plus some padding
  // Cap at ~52 to align with heatmap width (1 year of data)
  const yAxisWidth = 7;
  const availableWidth = terminalWidth - yAxisWidth;
  const chartWidth = Math.min(52, Math.max(20, availableWidth));

  // Distribute data across the available chart width
  let recentData: DailyModelTokens[];
  if (dailyTokens.length >= chartWidth) {
    // More data than space: take most recent N days
    recentData = dailyTokens.slice(-chartWidth);
  } else {
    // Less data than space: expand by repeating each point
    const repeatCount = Math.floor(chartWidth / dailyTokens.length);
    recentData = [];
    for (const day of dailyTokens) {
      for (let i = 0; i < repeatCount; i++) {
        recentData.push(day);
      }
    }
  }

  // Color palette for different models - use theme colors
  const theme = getTheme(resolveThemeSetting(getGlobalConfig().theme));
  const colors = [themeColorToAnsi(theme.suggestion), themeColorToAnsi(theme.success), themeColorToAnsi(theme.warning)];

  // Prepare series data for each model
  const series: number[][] = [];
  const legend: ChartLegend[] = [];

  // Only show top 3 models to keep chart readable
  const topModels = models.slice(0, 3);
  for (let i = 0; i < topModels.length; i++) {
    const model = topModels[i]!;
    const data = recentData.map(day => day.tokensByModel[model] || 0);

    // Only include if there's actual data
    if (data.some(v => v > 0)) {
      series.push(data);
      // Use theme colors that match the chart
      const bulletColors = [theme.suggestion, theme.success, theme.warning];
      legend.push({
        model: renderModelName(model),
        coloredBullet: applyColor(figures.bullet, bulletColors[i % bulletColors.length] as Color)
      });
    }
  }
  if (series.length === 0) {
    return null;
  }
  const chart = asciichart(series, {
    height: 8,
    colors: colors.slice(0, series.length),
    format: (x: number) => {
      let label: string;
      if (x >= 1_000_000) {
        label = (x / 1_000_000).toFixed(1) + 'M';
      } else if (x >= 1_000) {
        label = (x / 1_000).toFixed(0) + 'k';
      } else {
        label = x.toFixed(0);
      }
      return label.padStart(6);
    }
  });

  // Generate x-axis labels with dates
  const xAxisLabels = generateXAxisLabels(recentData, recentData.length, yAxisWidth);
  return {
    chart,
    legend,
    xAxisLabels
  };
}
function generateXAxisLabels(data: DailyModelTokens[], _chartWidth: number, yAxisOffset: number): string {
  if (data.length === 0) return '';

  // Show 3-4 date labels evenly spaced, but leave room for last label
  const numLabels = Math.min(4, Math.max(2, Math.floor(data.length / 8)));
  // Don't use the very last position - leave room for the label text
  const usableLength = data.length - 6; // Reserve ~6 chars for last label (e.g., "Dec 7")
  const step = Math.floor(usableLength / (numLabels - 1)) || 1;
  const labelPositions: {
    pos: number;
    label: string;
  }[] = [];
  for (let i = 0; i < numLabels; i++) {
    const idx = Math.min(i * step, data.length - 1);
    const date = new Date(data[idx]!.date);
    const label = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    labelPositions.push({
      pos: idx,
      label
    });
  }

  // Build the label string with proper spacing
  let result = ' '.repeat(yAxisOffset);
  let currentPos = 0;
  for (const {
    pos,
    label
  } of labelPositions) {
    const spaces = Math.max(1, pos - currentPos);
    result += ' '.repeat(spaces) + label;
    currentPos = pos + label.length;
  }
  return result;
}

// Screenshot functionality
async function handleScreenshot(stats: ClaudeCodeStats, activeTab: 'Overview' | 'Models', setStatus: (status: string | null) => void): Promise<void> {
  setStatus('copying…');
  const ansiText = renderStatsToAnsi(stats, activeTab);
  const result = await copyAnsiToClipboard(ansiText);
  setStatus(result.success ? 'copied!' : 'copy failed');

  // Clear status after 2 seconds
  setTimeout(setStatus, 2000, null);
}
function renderStatsToAnsi(stats: ClaudeCodeStats, activeTab: 'Overview' | 'Models'): string {
  const lines: string[] = [];
  if (activeTab === 'Overview') {
    lines.push(...renderOverviewToAnsi(stats));
  } else {
    lines.push(...renderModelsToAnsi(stats));
  }

  // Trim trailing empty lines
  while (lines.length > 0 && stripAnsi(lines[lines.length - 1]!).trim() === '') {
    lines.pop();
  }

  // Add "/stats" right-aligned on the last line
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]!;
    const lastLineLen = getStringWidth(lastLine);
    // Use known content widths based on layout:
    // Overview: two-column stats = COL2_START(40) + COL2_LABEL_WIDTH(18) + max_value(~12) = 70
    // Models: chart width = 80
    const contentWidth = activeTab === 'Overview' ? 70 : 80;
    const statsLabel = '/stats';
    const padding = Math.max(2, contentWidth - lastLineLen - statsLabel.length);
    lines[lines.length - 1] = lastLine + ' '.repeat(padding) + chalk.gray(statsLabel);
  }
  return lines.join('\n');
}
function renderOverviewToAnsi(stats: ClaudeCodeStats): string[] {
  const lines: string[] = [];
  const theme = getTheme(resolveThemeSetting(getGlobalConfig().theme));
  const h = (text: string) => applyColor(text, theme.claude as Color);

  // Two-column helper with fixed spacing
  // Column 1: label (18 chars) + value + padding to reach col 2
  // Column 2 starts at character position 40
  const COL1_LABEL_WIDTH = 18;
  const COL2_START = 40;
  const COL2_LABEL_WIDTH = 18;
  const row = (l1: string, v1: string, l2: string, v2: string): string => {
    // Build column 1: label + value
    const label1 = (l1 + ':').padEnd(COL1_LABEL_WIDTH);
    const col1PlainLen = label1.length + v1.length;

    // Calculate spaces needed between col1 value and col2 label
    const spaceBetween = Math.max(2, COL2_START - col1PlainLen);

    // Build column 2: label + value
    const label2 = (l2 + ':').padEnd(COL2_LABEL_WIDTH);

    // Assemble with colors applied to values only
    return label1 + h(v1) + ' '.repeat(spaceBetween) + label2 + h(v2);
  };

  // Heatmap - use fixed width for screenshot (56 = 52 weeks + 4 for day labels)
  if (stats.dailyActivity.length > 0) {
    lines.push(generateHeatmap(stats.dailyActivity, {
      terminalWidth: 56
    }));
    lines.push('');
  }

  // Calculate values
  const modelEntries = Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
  const favoriteModel = modelEntries[0];
  const totalTokens = modelEntries.reduce((sum, [, usage]) => sum + usage.inputTokens + usage.outputTokens, 0);

  // Row 1: Favorite model | Total tokens
  if (favoriteModel) {
    lines.push(row('Favorite model', renderModelName(favoriteModel[0]), 'Total tokens', formatNumber(totalTokens)));
  }
  lines.push('');

  // Row 2: Sessions | Longest session
  lines.push(row('Sessions', formatNumber(stats.totalSessions), 'Longest session', stats.longestSession ? formatDuration(stats.longestSession.duration) : 'N/A'));

  // Row 3: Current streak | Longest streak
  const currentStreakVal = `${stats.streaks.currentStreak} ${stats.streaks.currentStreak === 1 ? 'day' : 'days'}`;
  const longestStreakVal = `${stats.streaks.longestStreak} ${stats.streaks.longestStreak === 1 ? 'day' : 'days'}`;
  lines.push(row('Current streak', currentStreakVal, 'Longest streak', longestStreakVal));

  // Row 4: Active days | Peak hour
  const activeDaysVal = `${stats.activeDays}/${stats.totalDays}`;
  const peakHourVal = stats.peakActivityHour !== null ? `${stats.peakActivityHour}:00-${stats.peakActivityHour + 1}:00` : 'N/A';
  lines.push(row('Active days', activeDaysVal, 'Peak hour', peakHourVal));

  // Speculation time saved (ant-only)
  if ("external" === 'ant' && stats.totalSpeculationTimeSavedMs > 0) {
    const label = 'Speculation saved:'.padEnd(COL1_LABEL_WIDTH);
    lines.push(label + h(formatDuration(stats.totalSpeculationTimeSavedMs)));
  }

  // Shot stats (ant-only)
  if (feature('SHOT_STATS') && stats.shotDistribution) {
    const dist = stats.shotDistribution;
    const totalWithShots = Object.values(dist).reduce((s, n) => s + n, 0);
    if (totalWithShots > 0) {
      const totalShots = Object.entries(dist).reduce((s, [count, sessions]) => s + parseInt(count, 10) * sessions, 0);
      const avgShots = (totalShots / totalWithShots).toFixed(1);
      const bucket = (min: number, max?: number) => Object.entries(dist).filter(([k]) => {
        const n = parseInt(k, 10);
        return n >= min && (max === undefined || n <= max);
      }).reduce((s, [, v]) => s + v, 0);
      const pct = (n: number) => Math.round(n / totalWithShots * 100);
      const fmtBucket = (count: number, p: number) => `${count} (${p}%)`;
      const b1 = bucket(1, 1);
      const b2_5 = bucket(2, 5);
      const b6_10 = bucket(6, 10);
      const b11 = bucket(11);
      lines.push('');
      lines.push('Shot distribution');
      lines.push(row('1-shot', fmtBucket(b1, pct(b1)), '2\u20135 shot', fmtBucket(b2_5, pct(b2_5))));
      lines.push(row('6\u201310 shot', fmtBucket(b6_10, pct(b6_10)), '11+ shot', fmtBucket(b11, pct(b11))));
      lines.push(`${'Avg/session:'.padEnd(COL1_LABEL_WIDTH)}${h(avgShots)}`);
    }
  }
  lines.push('');

  // Fun factoid
  const factoid = generateFunFactoid(stats, totalTokens);
  lines.push(h(factoid));
  lines.push(chalk.gray(`Stats from the last ${stats.totalDays} days`));
  return lines;
}
function renderModelsToAnsi(stats: ClaudeCodeStats): string[] {
  const lines: string[] = [];
  const modelEntries = Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
  if (modelEntries.length === 0) {
    lines.push(chalk.gray('No model usage data available'));
    return lines;
  }
  const favoriteModel = modelEntries[0];
  const totalTokens = modelEntries.reduce((sum, [, usage]) => sum + usage.inputTokens + usage.outputTokens, 0);

  // Generate chart if we have data - use fixed width for screenshot
  const chartOutput = generateTokenChart(stats.dailyModelTokens, modelEntries.map(([model]) => model), 80 // Fixed width for screenshot
  );
  if (chartOutput) {
    lines.push(chalk.bold('Tokens per Day'));
    lines.push(chartOutput.chart);
    lines.push(chalk.gray(chartOutput.xAxisLabels));
    // Legend - use pre-colored bullets from chart output
    const legendLine = chartOutput.legend.map(item => `${item.coloredBullet} ${item.model}`).join(' · ');
    lines.push(legendLine);
    lines.push('');
  }

  // Summary
  lines.push(`${figures.star} Favorite: ${chalk.magenta.bold(renderModelName(favoriteModel?.[0] || ''))} · ${figures.circle} Total: ${chalk.magenta(formatNumber(totalTokens))} tokens`);
  lines.push('');

  // Model breakdown - only show top 3 for screenshot
  const topModels = modelEntries.slice(0, 3);
  for (const [model, usage] of topModels) {
    const modelTokens = usage.inputTokens + usage.outputTokens;
    const percentage = (modelTokens / totalTokens * 100).toFixed(1);
    lines.push(`${figures.bullet} ${chalk.bold(renderModelName(model))} ${chalk.gray(`(${percentage}%)`)}`);
    lines.push(chalk.dim(`  In: ${formatNumber(usage.inputTokens)} · Out: ${formatNumber(usage.outputTokens)}`));
  }
  return lines;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwicGxvdCIsImFzY2lpY2hhcnQiLCJjaGFsayIsImZpZ3VyZXMiLCJSZWFjdCIsIlN1c3BlbnNlIiwidXNlIiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlU3RhdGUiLCJzdHJpcEFuc2kiLCJDb21tYW5kUmVzdWx0RGlzcGxheSIsInVzZVRlcm1pbmFsU2l6ZSIsImFwcGx5Q29sb3IiLCJzdHJpbmdXaWR0aCIsImdldFN0cmluZ1dpZHRoIiwiQ29sb3IiLCJBbnNpIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlS2V5YmluZGluZyIsImdldEdsb2JhbENvbmZpZyIsImZvcm1hdER1cmF0aW9uIiwiZm9ybWF0TnVtYmVyIiwiZ2VuZXJhdGVIZWF0bWFwIiwicmVuZGVyTW9kZWxOYW1lIiwiY29weUFuc2lUb0NsaXBib2FyZCIsImFnZ3JlZ2F0ZUNsYXVkZUNvZGVTdGF0c0ZvclJhbmdlIiwiQ2xhdWRlQ29kZVN0YXRzIiwiRGFpbHlNb2RlbFRva2VucyIsIlN0YXRzRGF0ZVJhbmdlIiwicmVzb2x2ZVRoZW1lU2V0dGluZyIsImdldFRoZW1lIiwidGhlbWVDb2xvclRvQW5zaSIsIlBhbmUiLCJUYWIiLCJUYWJzIiwidXNlVGFiSGVhZGVyRm9jdXMiLCJTcGlubmVyIiwiZm9ybWF0UGVha0RheSIsImRhdGVTdHIiLCJkYXRlIiwiRGF0ZSIsInRvTG9jYWxlRGF0ZVN0cmluZyIsIm1vbnRoIiwiZGF5IiwiUHJvcHMiLCJvbkNsb3NlIiwicmVzdWx0Iiwib3B0aW9ucyIsImRpc3BsYXkiLCJTdGF0c1Jlc3VsdCIsInR5cGUiLCJkYXRhIiwibWVzc2FnZSIsIkRBVEVfUkFOR0VfTEFCRUxTIiwiUmVjb3JkIiwiYWxsIiwiREFURV9SQU5HRV9PUkRFUiIsImdldE5leHREYXRlUmFuZ2UiLCJjdXJyZW50IiwiY3VycmVudEluZGV4IiwiaW5kZXhPZiIsImxlbmd0aCIsImNyZWF0ZUFsbFRpbWVTdGF0c1Byb21pc2UiLCJQcm9taXNlIiwidGhlbiIsInRvdGFsU2Vzc2lvbnMiLCJjYXRjaCIsImVyciIsIkVycm9yIiwiU3RhdHMiLCJ0MCIsIiQiLCJfYyIsInQxIiwiU3ltYm9sIiwiZm9yIiwiYWxsVGltZVByb21pc2UiLCJ0MiIsInQzIiwiU3RhdHNDb250ZW50UHJvcHMiLCJTdGF0c0NvbnRlbnQiLCJhbGxUaW1lUmVzdWx0IiwiZGF0ZVJhbmdlIiwic2V0RGF0ZVJhbmdlIiwic3RhdHNDYWNoZSIsInNldFN0YXRzQ2FjaGUiLCJpc0xvYWRpbmdGaWx0ZXJlZCIsInNldElzTG9hZGluZ0ZpbHRlcmVkIiwiYWN0aXZlVGFiIiwic2V0QWN0aXZlVGFiIiwiY29weVN0YXR1cyIsInNldENvcHlTdGF0dXMiLCJjYW5jZWxsZWQiLCJwcmV2IiwiZGlzcGxheVN0YXRzIiwiYWxsVGltZVN0YXRzIiwidDQiLCJoYW5kbGVDbG9zZSIsInQ1IiwiY29udGV4dCIsInQ2IiwiaW5wdXQiLCJrZXkiLCJjdHJsIiwidGFiIiwiX3RlbXAiLCJtZXRhIiwiaGFuZGxlU2NyZWVuc2hvdCIsInQ3IiwidDgiLCJ0OSIsInQxMCIsInQxMSIsInQxMiIsInByZXZfMCIsIkRhdGVSYW5nZVNlbGVjdG9yIiwiaXNMb2FkaW5nIiwibWFwIiwicmFuZ2UiLCJpIiwiT3ZlcnZpZXdUYWIiLCJzdGF0cyIsIlJlYWN0Tm9kZSIsImNvbHVtbnMiLCJ0ZXJtaW5hbFdpZHRoIiwibW9kZWxFbnRyaWVzIiwiT2JqZWN0IiwiZW50cmllcyIsIm1vZGVsVXNhZ2UiLCJzb3J0IiwiYSIsImIiLCJpbnB1dFRva2VucyIsIm91dHB1dFRva2VucyIsImZhdm9yaXRlTW9kZWwiLCJ0b3RhbFRva2VucyIsInJlZHVjZSIsInN1bSIsInVzYWdlIiwiZmFjdG9pZCIsImdlbmVyYXRlRnVuRmFjdG9pZCIsInJhbmdlRGF5cyIsInRvdGFsRGF5cyIsInNob3RTdGF0c0RhdGEiLCJhdmdTaG90cyIsImJ1Y2tldHMiLCJsYWJlbCIsImNvdW50IiwicGN0Iiwic2hvdERpc3RyaWJ1dGlvbiIsImRpc3QiLCJ0b3RhbCIsInZhbHVlcyIsInMiLCJuIiwidG90YWxTaG90cyIsInNlc3Npb25zIiwicGFyc2VJbnQiLCJidWNrZXQiLCJtaW4iLCJtYXgiLCJmaWx0ZXIiLCJrIiwidW5kZWZpbmVkIiwidiIsIk1hdGgiLCJyb3VuZCIsImIxIiwiYjJfNSIsImI2XzEwIiwiYjExIiwidG9GaXhlZCIsImRhaWx5QWN0aXZpdHkiLCJsb25nZXN0U2Vzc2lvbiIsImR1cmF0aW9uIiwiYWN0aXZlRGF5cyIsInN0cmVha3MiLCJsb25nZXN0U3RyZWFrIiwicGVha0FjdGl2aXR5RGF5IiwiY3VycmVudFN0cmVhayIsInRvdGFsU3BlY3VsYXRpb25UaW1lU2F2ZWRNcyIsIkJPT0tfQ09NUEFSSVNPTlMiLCJuYW1lIiwidG9rZW5zIiwiVElNRV9DT01QQVJJU09OUyIsIm1pbnV0ZXMiLCJmYWN0b2lkcyIsIm1hdGNoaW5nQm9va3MiLCJib29rIiwidGltZXMiLCJwdXNoIiwiZmxvb3IiLCJzZXNzaW9uTWludXRlcyIsImNvbXBhcmlzb24iLCJyYXRpbyIsInJhbmRvbUluZGV4IiwicmFuZG9tIiwiTW9kZWxzVGFiIiwiaGVhZGVyRm9jdXNlZCIsImZvY3VzSGVhZGVyIiwic2Nyb2xsT2Zmc2V0Iiwic2V0U2Nyb2xsT2Zmc2V0IiwiX3RlbXA3IiwiaXNBY3RpdmUiLCJfaW5wdXQiLCJkb3duQXJyb3ciLCJ1cEFycm93IiwiX3RlbXA4IiwiX3RlbXA5IiwiY2hhcnRPdXRwdXQiLCJnZW5lcmF0ZVRva2VuQ2hhcnQiLCJkYWlseU1vZGVsVG9rZW5zIiwiX3RlbXAwIiwidmlzaWJsZU1vZGVscyIsInNsaWNlIiwibWlkcG9pbnQiLCJjZWlsIiwibGVmdE1vZGVscyIsInJpZ2h0TW9kZWxzIiwiY2FuU2Nyb2xsVXAiLCJjYW5TY3JvbGxEb3duIiwic2hvd1Njcm9sbEhpbnQiLCJUMCIsIm1vZGVsXzEiLCJ1c2FnZV8xIiwibW9kZWwiLCJhcnJvd1VwIiwiYXJyb3dEb3duIiwiY2hhcnQiLCJ4QXhpc0xhYmVscyIsImxlZ2VuZCIsIl90ZW1wMSIsIm1vZGVsXzAiLCJ1c2FnZV8wIiwiaXRlbSIsImNvbG9yZWRCdWxsZXQiLCJNb2RlbEVudHJ5UHJvcHMiLCJjYWNoZVJlYWRJbnB1dFRva2VucyIsIk1vZGVsRW50cnkiLCJtb2RlbFRva2VucyIsInBlcmNlbnRhZ2UiLCJidWxsZXQiLCJDaGFydExlZ2VuZCIsIkNoYXJ0T3V0cHV0IiwiZGFpbHlUb2tlbnMiLCJtb2RlbHMiLCJ5QXhpc1dpZHRoIiwiYXZhaWxhYmxlV2lkdGgiLCJjaGFydFdpZHRoIiwicmVjZW50RGF0YSIsInJlcGVhdENvdW50IiwidGhlbWUiLCJjb2xvcnMiLCJzdWdnZXN0aW9uIiwic3VjY2VzcyIsIndhcm5pbmciLCJzZXJpZXMiLCJ0b3BNb2RlbHMiLCJ0b2tlbnNCeU1vZGVsIiwic29tZSIsImJ1bGxldENvbG9ycyIsImhlaWdodCIsImZvcm1hdCIsIngiLCJwYWRTdGFydCIsImdlbmVyYXRlWEF4aXNMYWJlbHMiLCJfY2hhcnRXaWR0aCIsInlBeGlzT2Zmc2V0IiwibnVtTGFiZWxzIiwidXNhYmxlTGVuZ3RoIiwic3RlcCIsImxhYmVsUG9zaXRpb25zIiwicG9zIiwiaWR4IiwicmVwZWF0IiwiY3VycmVudFBvcyIsInNwYWNlcyIsInNldFN0YXR1cyIsInN0YXR1cyIsImFuc2lUZXh0IiwicmVuZGVyU3RhdHNUb0Fuc2kiLCJzZXRUaW1lb3V0IiwibGluZXMiLCJyZW5kZXJPdmVydmlld1RvQW5zaSIsInJlbmRlck1vZGVsc1RvQW5zaSIsInRyaW0iLCJwb3AiLCJsYXN0TGluZSIsImxhc3RMaW5lTGVuIiwiY29udGVudFdpZHRoIiwic3RhdHNMYWJlbCIsInBhZGRpbmciLCJncmF5Iiwiam9pbiIsImgiLCJ0ZXh0IiwiY2xhdWRlIiwiQ09MMV9MQUJFTF9XSURUSCIsIkNPTDJfU1RBUlQiLCJDT0wyX0xBQkVMX1dJRFRIIiwicm93IiwibDEiLCJ2MSIsImwyIiwidjIiLCJsYWJlbDEiLCJwYWRFbmQiLCJjb2wxUGxhaW5MZW4iLCJzcGFjZUJldHdlZW4iLCJsYWJlbDIiLCJjdXJyZW50U3RyZWFrVmFsIiwibG9uZ2VzdFN0cmVha1ZhbCIsImFjdGl2ZURheXNWYWwiLCJwZWFrSG91clZhbCIsInBlYWtBY3Rpdml0eUhvdXIiLCJ0b3RhbFdpdGhTaG90cyIsImZtdEJ1Y2tldCIsInAiLCJib2xkIiwibGVnZW5kTGluZSIsInN0YXIiLCJtYWdlbnRhIiwiY2lyY2xlIiwiZGltIl0sInNvdXJjZXMiOlsiU3RhdHMudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHsgcGxvdCBhcyBhc2NpaWNoYXJ0IH0gZnJvbSAnYXNjaWljaGFydCdcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsaydcbmltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgUmVhY3QsIHtcbiAgU3VzcGVuc2UsXG4gIHVzZSxcbiAgdXNlQ2FsbGJhY2ssXG4gIHVzZUVmZmVjdCxcbiAgdXNlTWVtbyxcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHN0cmlwQW5zaSBmcm9tICdzdHJpcC1hbnNpJ1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kUmVzdWx0RGlzcGxheSB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgYXBwbHlDb2xvciB9IGZyb20gJy4uL2luay9jb2xvcml6ZS5qcydcbmltcG9ydCB7IHN0cmluZ1dpZHRoIGFzIGdldFN0cmluZ1dpZHRoIH0gZnJvbSAnLi4vaW5rL3N0cmluZ1dpZHRoLmpzJ1xuaW1wb3J0IHR5cGUgeyBDb2xvciB9IGZyb20gJy4uL2luay9zdHlsZXMuanMnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gcmF3IGovay9hcnJvdyBzdGF0cyBuYXZpZ2F0aW9uXG5pbXBvcnQgeyBBbnNpLCBCb3gsIFRleHQsIHVzZUlucHV0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyBnZXRHbG9iYWxDb25maWcgfSBmcm9tICcuLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgeyBmb3JtYXREdXJhdGlvbiwgZm9ybWF0TnVtYmVyIH0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHsgZ2VuZXJhdGVIZWF0bWFwIH0gZnJvbSAnLi4vdXRpbHMvaGVhdG1hcC5qcydcbmltcG9ydCB7IHJlbmRlck1vZGVsTmFtZSB9IGZyb20gJy4uL3V0aWxzL21vZGVsL21vZGVsLmpzJ1xuaW1wb3J0IHsgY29weUFuc2lUb0NsaXBib2FyZCB9IGZyb20gJy4uL3V0aWxzL3NjcmVlbnNob3RDbGlwYm9hcmQuanMnXG5pbXBvcnQge1xuICBhZ2dyZWdhdGVDbGF1ZGVDb2RlU3RhdHNGb3JSYW5nZSxcbiAgdHlwZSBDbGF1ZGVDb2RlU3RhdHMsXG4gIHR5cGUgRGFpbHlNb2RlbFRva2VucyxcbiAgdHlwZSBTdGF0c0RhdGVSYW5nZSxcbn0gZnJvbSAnLi4vdXRpbHMvc3RhdHMuanMnXG5pbXBvcnQgeyByZXNvbHZlVGhlbWVTZXR0aW5nIH0gZnJvbSAnLi4vdXRpbHMvc3lzdGVtVGhlbWUuanMnXG5pbXBvcnQgeyBnZXRUaGVtZSwgdGhlbWVDb2xvclRvQW5zaSB9IGZyb20gJy4uL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHsgUGFuZSB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9QYW5lLmpzJ1xuaW1wb3J0IHsgVGFiLCBUYWJzLCB1c2VUYWJIZWFkZXJGb2N1cyB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9UYWJzLmpzJ1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4vU3Bpbm5lci5qcydcblxuZnVuY3Rpb24gZm9ybWF0UGVha0RheShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cilcbiAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHtcbiAgICBtb250aDogJ3Nob3J0JyxcbiAgICBkYXk6ICdudW1lcmljJyxcbiAgfSlcbn1cblxudHlwZSBQcm9wcyA9IHtcbiAgb25DbG9zZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkXG59XG5cbnR5cGUgU3RhdHNSZXN1bHQgPVxuICB8IHsgdHlwZTogJ3N1Y2Nlc3MnOyBkYXRhOiBDbGF1ZGVDb2RlU3RhdHMgfVxuICB8IHsgdHlwZTogJ2Vycm9yJzsgbWVzc2FnZTogc3RyaW5nIH1cbiAgfCB7IHR5cGU6ICdlbXB0eScgfVxuXG5jb25zdCBEQVRFX1JBTkdFX0xBQkVMUzogUmVjb3JkPFN0YXRzRGF0ZVJhbmdlLCBzdHJpbmc+ID0ge1xuICAnN2QnOiAnTGFzdCA3IGRheXMnLFxuICAnMzBkJzogJ0xhc3QgMzAgZGF5cycsXG4gIGFsbDogJ0FsbCB0aW1lJyxcbn1cblxuY29uc3QgREFURV9SQU5HRV9PUkRFUjogU3RhdHNEYXRlUmFuZ2VbXSA9IFsnYWxsJywgJzdkJywgJzMwZCddXG5cbmZ1bmN0aW9uIGdldE5leHREYXRlUmFuZ2UoY3VycmVudDogU3RhdHNEYXRlUmFuZ2UpOiBTdGF0c0RhdGVSYW5nZSB7XG4gIGNvbnN0IGN1cnJlbnRJbmRleCA9IERBVEVfUkFOR0VfT1JERVIuaW5kZXhPZihjdXJyZW50KVxuICByZXR1cm4gREFURV9SQU5HRV9PUkRFUlsoY3VycmVudEluZGV4ICsgMSkgJSBEQVRFX1JBTkdFX09SREVSLmxlbmd0aF0hXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHN0YXRzIGxvYWRpbmcgcHJvbWlzZSB0aGF0IG5ldmVyIHJlamVjdHMuXG4gKiBBbHdheXMgbG9hZHMgYWxsLXRpbWUgc3RhdHMgZm9yIHRoZSBoZWF0bWFwLlxuICovXG5mdW5jdGlvbiBjcmVhdGVBbGxUaW1lU3RhdHNQcm9taXNlKCk6IFByb21pc2U8U3RhdHNSZXN1bHQ+IHtcbiAgcmV0dXJuIGFnZ3JlZ2F0ZUNsYXVkZUNvZGVTdGF0c0ZvclJhbmdlKCdhbGwnKVxuICAgIC50aGVuKChkYXRhKTogU3RhdHNSZXN1bHQgPT4ge1xuICAgICAgaWYgKCFkYXRhIHx8IGRhdGEudG90YWxTZXNzaW9ucyA9PT0gMCkge1xuICAgICAgICByZXR1cm4geyB0eXBlOiAnZW1wdHknIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB7IHR5cGU6ICdzdWNjZXNzJywgZGF0YSB9XG4gICAgfSlcbiAgICAuY2F0Y2goKGVycik6IFN0YXRzUmVzdWx0ID0+IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPVxuICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ0ZhaWxlZCB0byBsb2FkIHN0YXRzJ1xuICAgICAgcmV0dXJuIHsgdHlwZTogJ2Vycm9yJywgbWVzc2FnZSB9XG4gICAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFN0YXRzKHsgb25DbG9zZSB9OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIEFsd2F5cyBsb2FkIGFsbC10aW1lIHN0YXRzIGZpcnN0IChmb3IgaGVhdG1hcClcbiAgY29uc3QgYWxsVGltZVByb21pc2UgPSB1c2VNZW1vKCgpID0+IGNyZWF0ZUFsbFRpbWVTdGF0c1Byb21pc2UoKSwgW10pXG5cbiAgcmV0dXJuIChcbiAgICA8U3VzcGVuc2VcbiAgICAgIGZhbGxiYWNrPXtcbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgICAgPFRleHQ+IExvYWRpbmcgeW91ciBDbGF1ZGUgQ29kZSBzdGF0c+KApjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICB9XG4gICAgPlxuICAgICAgPFN0YXRzQ29udGVudCBhbGxUaW1lUHJvbWlzZT17YWxsVGltZVByb21pc2V9IG9uQ2xvc2U9e29uQ2xvc2V9IC8+XG4gICAgPC9TdXNwZW5zZT5cbiAgKVxufVxuXG50eXBlIFN0YXRzQ29udGVudFByb3BzID0ge1xuICBhbGxUaW1lUHJvbWlzZTogUHJvbWlzZTxTdGF0c1Jlc3VsdD5cbiAgb25DbG9zZTogUHJvcHNbJ29uQ2xvc2UnXVxufVxuXG4vKipcbiAqIElubmVyIGNvbXBvbmVudCB0aGF0IHVzZXMgUmVhY3QgMTkncyB1c2UoKSB0byByZWFkIHRoZSBzdGF0cyBwcm9taXNlLlxuICogU3VzcGVuZHMgd2hpbGUgbG9hZGluZyBhbGwtdGltZSBzdGF0cywgdGhlbiBoYW5kbGVzIGRhdGUgcmFuZ2UgY2hhbmdlcyB3aXRob3V0IHN1c3BlbmRpbmcuXG4gKi9cbmZ1bmN0aW9uIFN0YXRzQ29udGVudCh7XG4gIGFsbFRpbWVQcm9taXNlLFxuICBvbkNsb3NlLFxufTogU3RhdHNDb250ZW50UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBhbGxUaW1lUmVzdWx0ID0gdXNlKGFsbFRpbWVQcm9taXNlKVxuICBjb25zdCBbZGF0ZVJhbmdlLCBzZXREYXRlUmFuZ2VdID0gdXNlU3RhdGU8U3RhdHNEYXRlUmFuZ2U+KCdhbGwnKVxuICBjb25zdCBbc3RhdHNDYWNoZSwgc2V0U3RhdHNDYWNoZV0gPSB1c2VTdGF0ZTxcbiAgICBQYXJ0aWFsPFJlY29yZDxTdGF0c0RhdGVSYW5nZSwgQ2xhdWRlQ29kZVN0YXRzPj5cbiAgPih7fSlcbiAgY29uc3QgW2lzTG9hZGluZ0ZpbHRlcmVkLCBzZXRJc0xvYWRpbmdGaWx0ZXJlZF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2FjdGl2ZVRhYiwgc2V0QWN0aXZlVGFiXSA9IHVzZVN0YXRlPCdPdmVydmlldycgfCAnTW9kZWxzJz4oJ092ZXJ2aWV3JylcbiAgY29uc3QgW2NvcHlTdGF0dXMsIHNldENvcHlTdGF0dXNdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcblxuICAvLyBMb2FkIGZpbHRlcmVkIHN0YXRzIHdoZW4gZGF0ZSByYW5nZSBjaGFuZ2VzICh3aXRoIGNhY2hpbmcpXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGRhdGVSYW5nZSA9PT0gJ2FsbCcpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEFscmVhZHkgY2FjaGVkXG4gICAgaWYgKHN0YXRzQ2FjaGVbZGF0ZVJhbmdlXSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlXG4gICAgc2V0SXNMb2FkaW5nRmlsdGVyZWQodHJ1ZSlcblxuICAgIGFnZ3JlZ2F0ZUNsYXVkZUNvZGVTdGF0c0ZvclJhbmdlKGRhdGVSYW5nZSlcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xuICAgICAgICAgIHNldFN0YXRzQ2FjaGUocHJldiA9PiAoeyAuLi5wcmV2LCBbZGF0ZVJhbmdlXTogZGF0YSB9KSlcbiAgICAgICAgICBzZXRJc0xvYWRpbmdGaWx0ZXJlZChmYWxzZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgIGlmICghY2FuY2VsbGVkKSB7XG4gICAgICAgICAgc2V0SXNMb2FkaW5nRmlsdGVyZWQoZmFsc2UpXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2FuY2VsbGVkID0gdHJ1ZVxuICAgIH1cbiAgfSwgW2RhdGVSYW5nZSwgc3RhdHNDYWNoZV0pXG5cbiAgLy8gVXNlIGNhY2hlZCBzdGF0cyBmb3IgY3VycmVudCByYW5nZVxuICBjb25zdCBkaXNwbGF5U3RhdHMgPVxuICAgIGRhdGVSYW5nZSA9PT0gJ2FsbCdcbiAgICAgID8gYWxsVGltZVJlc3VsdC50eXBlID09PSAnc3VjY2VzcydcbiAgICAgICAgPyBhbGxUaW1lUmVzdWx0LmRhdGFcbiAgICAgICAgOiBudWxsXG4gICAgICA6IChzdGF0c0NhY2hlW2RhdGVSYW5nZV0gPz9cbiAgICAgICAgKGFsbFRpbWVSZXN1bHQudHlwZSA9PT0gJ3N1Y2Nlc3MnID8gYWxsVGltZVJlc3VsdC5kYXRhIDogbnVsbCkpXG5cbiAgLy8gQWxsLXRpbWUgc3RhdHMgZm9yIHRoZSBoZWF0bWFwIChhbHdheXMgdXNlIGFsbC10aW1lKVxuICBjb25zdCBhbGxUaW1lU3RhdHMgPVxuICAgIGFsbFRpbWVSZXN1bHQudHlwZSA9PT0gJ3N1Y2Nlc3MnID8gYWxsVGltZVJlc3VsdC5kYXRhIDogbnVsbFxuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIG9uQ2xvc2UoJ1N0YXRzIGRpYWxvZyBkaXNtaXNzZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gIH0sIFtvbkNsb3NlXSlcblxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlQ2xvc2UsIHsgY29udGV4dDogJ0NvbmZpcm1hdGlvbicgfSlcblxuICB1c2VJbnB1dCgoaW5wdXQsIGtleSkgPT4ge1xuICAgIC8vIEhhbmRsZSBjdHJsK2MgYW5kIGN0cmwrZCBmb3IgY2xvc2luZ1xuICAgIGlmIChrZXkuY3RybCAmJiAoaW5wdXQgPT09ICdjJyB8fCBpbnB1dCA9PT0gJ2QnKSkge1xuICAgICAgb25DbG9zZSgnU3RhdHMgZGlhbG9nIGRpc21pc3NlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICB9XG4gICAgLy8gVHJhY2sgdGFiIGNoYW5nZXNcbiAgICBpZiAoa2V5LnRhYikge1xuICAgICAgc2V0QWN0aXZlVGFiKHByZXYgPT4gKHByZXYgPT09ICdPdmVydmlldycgPyAnTW9kZWxzJyA6ICdPdmVydmlldycpKVxuICAgIH1cbiAgICAvLyByIHRvIGN5Y2xlIGRhdGUgcmFuZ2VcbiAgICBpZiAoaW5wdXQgPT09ICdyJyAmJiAha2V5LmN0cmwgJiYgIWtleS5tZXRhKSB7XG4gICAgICBzZXREYXRlUmFuZ2UoZ2V0TmV4dERhdGVSYW5nZShkYXRlUmFuZ2UpKVxuICAgIH1cbiAgICAvLyBDdHJsK1MgdG8gY29weSBzY3JlZW5zaG90IHRvIGNsaXBib2FyZFxuICAgIGlmIChrZXkuY3RybCAmJiBpbnB1dCA9PT0gJ3MnICYmIGRpc3BsYXlTdGF0cykge1xuICAgICAgdm9pZCBoYW5kbGVTY3JlZW5zaG90KGRpc3BsYXlTdGF0cywgYWN0aXZlVGFiLCBzZXRDb3B5U3RhdHVzKVxuICAgIH1cbiAgfSlcblxuICBpZiAoYWxsVGltZVJlc3VsdC50eXBlID09PSAnZXJyb3InKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPkZhaWxlZCB0byBsb2FkIHN0YXRzOiB7YWxsVGltZVJlc3VsdC5tZXNzYWdlfTwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGlmIChhbGxUaW1lUmVzdWx0LnR5cGUgPT09ICdlbXB0eScpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICBObyBzdGF0cyBhdmFpbGFibGUgeWV0LiBTdGFydCB1c2luZyBDbGF1ZGUgQ29kZSFcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKCFkaXNwbGF5U3RhdHMgfHwgIWFsbFRpbWVTdGF0cykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgIDxUZXh0PiBMb2FkaW5nIHN0YXRz4oCmPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8UGFuZSBjb2xvcj1cImNsYXVkZVwiPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXsxfSBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICA8VGFicyB0aXRsZT1cIlwiIGNvbG9yPVwiY2xhdWRlXCIgZGVmYXVsdFRhYj1cIk92ZXJ2aWV3XCI+XG4gICAgICAgICAgPFRhYiB0aXRsZT1cIk92ZXJ2aWV3XCI+XG4gICAgICAgICAgICA8T3ZlcnZpZXdUYWJcbiAgICAgICAgICAgICAgc3RhdHM9e2Rpc3BsYXlTdGF0c31cbiAgICAgICAgICAgICAgYWxsVGltZVN0YXRzPXthbGxUaW1lU3RhdHN9XG4gICAgICAgICAgICAgIGRhdGVSYW5nZT17ZGF0ZVJhbmdlfVxuICAgICAgICAgICAgICBpc0xvYWRpbmc9e2lzTG9hZGluZ0ZpbHRlcmVkfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RhYj5cbiAgICAgICAgICA8VGFiIHRpdGxlPVwiTW9kZWxzXCI+XG4gICAgICAgICAgICA8TW9kZWxzVGFiXG4gICAgICAgICAgICAgIHN0YXRzPXtkaXNwbGF5U3RhdHN9XG4gICAgICAgICAgICAgIGRhdGVSYW5nZT17ZGF0ZVJhbmdlfVxuICAgICAgICAgICAgICBpc0xvYWRpbmc9e2lzTG9hZGluZ0ZpbHRlcmVkfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RhYj5cbiAgICAgICAgPC9UYWJzPlxuICAgICAgPC9Cb3g+XG4gICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgRXNjIHRvIGNhbmNlbCDCtyByIHRvIGN5Y2xlIGRhdGVzIMK3IGN0cmwrcyB0byBjb3B5XG4gICAgICAgICAge2NvcHlTdGF0dXMgPyBgIMK3ICR7Y29weVN0YXR1c31gIDogJyd9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIDwvUGFuZT5cbiAgKVxufVxuXG5mdW5jdGlvbiBEYXRlUmFuZ2VTZWxlY3Rvcih7XG4gIGRhdGVSYW5nZSxcbiAgaXNMb2FkaW5nLFxufToge1xuICBkYXRlUmFuZ2U6IFN0YXRzRGF0ZVJhbmdlXG4gIGlzTG9hZGluZzogYm9vbGVhblxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHJldHVybiAoXG4gICAgPEJveCBtYXJnaW5Cb3R0b209ezF9IGdhcD17MX0+XG4gICAgICA8Qm94PlxuICAgICAgICB7REFURV9SQU5HRV9PUkRFUi5tYXAoKHJhbmdlLCBpKSA9PiAoXG4gICAgICAgICAgPFRleHQga2V5PXtyYW5nZX0+XG4gICAgICAgICAgICB7aSA+IDAgJiYgPFRleHQgZGltQ29sb3I+IMK3IDwvVGV4dD59XG4gICAgICAgICAgICB7cmFuZ2UgPT09IGRhdGVSYW5nZSA/IChcbiAgICAgICAgICAgICAgPFRleHQgYm9sZCBjb2xvcj1cImNsYXVkZVwiPlxuICAgICAgICAgICAgICAgIHtEQVRFX1JBTkdFX0xBQkVMU1tyYW5nZV19XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntEQVRFX1JBTkdFX0xBQkVMU1tyYW5nZV19PC9UZXh0PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICkpfVxuICAgICAgPC9Cb3g+XG4gICAgICB7aXNMb2FkaW5nICYmIDxTcGlubmVyIC8+fVxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIE92ZXJ2aWV3VGFiKHtcbiAgc3RhdHMsXG4gIGFsbFRpbWVTdGF0cyxcbiAgZGF0ZVJhbmdlLFxuICBpc0xvYWRpbmcsXG59OiB7XG4gIHN0YXRzOiBDbGF1ZGVDb2RlU3RhdHNcbiAgYWxsVGltZVN0YXRzOiBDbGF1ZGVDb2RlU3RhdHNcbiAgZGF0ZVJhbmdlOiBTdGF0c0RhdGVSYW5nZVxuICBpc0xvYWRpbmc6IGJvb2xlYW5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB7IGNvbHVtbnM6IHRlcm1pbmFsV2lkdGggfSA9IHVzZVRlcm1pbmFsU2l6ZSgpXG5cbiAgLy8gQ2FsY3VsYXRlIGZhdm9yaXRlIG1vZGVsIGFuZCB0b3RhbCB0b2tlbnNcbiAgY29uc3QgbW9kZWxFbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc3RhdHMubW9kZWxVc2FnZSkuc29ydChcbiAgICAoWywgYV0sIFssIGJdKSA9PlxuICAgICAgYi5pbnB1dFRva2VucyArIGIub3V0cHV0VG9rZW5zIC0gKGEuaW5wdXRUb2tlbnMgKyBhLm91dHB1dFRva2VucyksXG4gIClcbiAgY29uc3QgZmF2b3JpdGVNb2RlbCA9IG1vZGVsRW50cmllc1swXVxuICBjb25zdCB0b3RhbFRva2VucyA9IG1vZGVsRW50cmllcy5yZWR1Y2UoXG4gICAgKHN1bSwgWywgdXNhZ2VdKSA9PiBzdW0gKyB1c2FnZS5pbnB1dFRva2VucyArIHVzYWdlLm91dHB1dFRva2VucyxcbiAgICAwLFxuICApXG5cbiAgLy8gTWVtb2l6ZSB0aGUgZmFjdG9pZCBzbyBpdCBkb2Vzbid0IGNoYW5nZSB3aGVuIHN3aXRjaGluZyB0YWJzXG4gIGNvbnN0IGZhY3RvaWQgPSB1c2VNZW1vKFxuICAgICgpID0+IGdlbmVyYXRlRnVuRmFjdG9pZChzdGF0cywgdG90YWxUb2tlbnMpLFxuICAgIFtzdGF0cywgdG90YWxUb2tlbnNdLFxuICApXG5cbiAgLy8gQ2FsY3VsYXRlIHJhbmdlIGRheXMgYmFzZWQgb24gc2VsZWN0ZWQgZGF0ZSByYW5nZVxuICBjb25zdCByYW5nZURheXMgPVxuICAgIGRhdGVSYW5nZSA9PT0gJzdkJyA/IDcgOiBkYXRlUmFuZ2UgPT09ICczMGQnID8gMzAgOiBzdGF0cy50b3RhbERheXNcblxuICAvLyBDb21wdXRlIHNob3Qgc3RhdHMgZGF0YSAoYW50LW9ubHksIGdhdGVkIGJ5IGZlYXR1cmUgZmxhZylcbiAgbGV0IHNob3RTdGF0c0RhdGE6IHtcbiAgICBhdmdTaG90czogc3RyaW5nXG4gICAgYnVja2V0czogeyBsYWJlbDogc3RyaW5nOyBjb3VudDogbnVtYmVyOyBwY3Q6IG51bWJlciB9W11cbiAgfSB8IG51bGwgPSBudWxsXG4gIGlmIChmZWF0dXJlKCdTSE9UX1NUQVRTJykgJiYgc3RhdHMuc2hvdERpc3RyaWJ1dGlvbikge1xuICAgIGNvbnN0IGRpc3QgPSBzdGF0cy5zaG90RGlzdHJpYnV0aW9uXG4gICAgY29uc3QgdG90YWwgPSBPYmplY3QudmFsdWVzKGRpc3QpLnJlZHVjZSgocywgbikgPT4gcyArIG4sIDApXG4gICAgaWYgKHRvdGFsID4gMCkge1xuICAgICAgY29uc3QgdG90YWxTaG90cyA9IE9iamVjdC5lbnRyaWVzKGRpc3QpLnJlZHVjZShcbiAgICAgICAgKHMsIFtjb3VudCwgc2Vzc2lvbnNdKSA9PiBzICsgcGFyc2VJbnQoY291bnQsIDEwKSAqIHNlc3Npb25zLFxuICAgICAgICAwLFxuICAgICAgKVxuICAgICAgY29uc3QgYnVja2V0ID0gKG1pbjogbnVtYmVyLCBtYXg/OiBudW1iZXIpID0+XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKGRpc3QpXG4gICAgICAgICAgLmZpbHRlcigoW2tdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuID0gcGFyc2VJbnQoaywgMTApXG4gICAgICAgICAgICByZXR1cm4gbiA+PSBtaW4gJiYgKG1heCA9PT0gdW5kZWZpbmVkIHx8IG4gPD0gbWF4KVxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnJlZHVjZSgocywgWywgdl0pID0+IHMgKyB2LCAwKVxuICAgICAgY29uc3QgcGN0ID0gKG46IG51bWJlcikgPT4gTWF0aC5yb3VuZCgobiAvIHRvdGFsKSAqIDEwMClcbiAgICAgIGNvbnN0IGIxID0gYnVja2V0KDEsIDEpXG4gICAgICBjb25zdCBiMl81ID0gYnVja2V0KDIsIDUpXG4gICAgICBjb25zdCBiNl8xMCA9IGJ1Y2tldCg2LCAxMClcbiAgICAgIGNvbnN0IGIxMSA9IGJ1Y2tldCgxMSlcbiAgICAgIHNob3RTdGF0c0RhdGEgPSB7XG4gICAgICAgIGF2Z1Nob3RzOiAodG90YWxTaG90cyAvIHRvdGFsKS50b0ZpeGVkKDEpLFxuICAgICAgICBidWNrZXRzOiBbXG4gICAgICAgICAgeyBsYWJlbDogJzEtc2hvdCcsIGNvdW50OiBiMSwgcGN0OiBwY3QoYjEpIH0sXG4gICAgICAgICAgeyBsYWJlbDogJzJcXHUyMDEzNSBzaG90JywgY291bnQ6IGIyXzUsIHBjdDogcGN0KGIyXzUpIH0sXG4gICAgICAgICAgeyBsYWJlbDogJzZcXHUyMDEzMTAgc2hvdCcsIGNvdW50OiBiNl8xMCwgcGN0OiBwY3QoYjZfMTApIH0sXG4gICAgICAgICAgeyBsYWJlbDogJzExKyBzaG90JywgY291bnQ6IGIxMSwgcGN0OiBwY3QoYjExKSB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgIHsvKiBBY3Rpdml0eSBIZWF0bWFwIC0gYWx3YXlzIHNob3dzIGFsbC10aW1lIGRhdGEgKi99XG4gICAgICB7YWxsVGltZVN0YXRzLmRhaWx5QWN0aXZpdHkubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPEFuc2k+XG4gICAgICAgICAgICB7Z2VuZXJhdGVIZWF0bWFwKGFsbFRpbWVTdGF0cy5kYWlseUFjdGl2aXR5LCB7IHRlcm1pbmFsV2lkdGggfSl9XG4gICAgICAgICAgPC9BbnNpPlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBEYXRlIHJhbmdlIHNlbGVjdG9yICovfVxuICAgICAgPERhdGVSYW5nZVNlbGVjdG9yIGRhdGVSYW5nZT17ZGF0ZVJhbmdlfSBpc0xvYWRpbmc9e2lzTG9hZGluZ30gLz5cblxuICAgICAgey8qIFNlY3Rpb24gMTogVXNhZ2UgKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezR9IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAge2Zhdm9yaXRlTW9kZWwgJiYgKFxuICAgICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgIEZhdm9yaXRlIG1vZGVsOnsnICd9XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCIgYm9sZD5cbiAgICAgICAgICAgICAgICB7cmVuZGVyTW9kZWxOYW1lKGZhdm9yaXRlTW9kZWxbMF0pfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICBUb3RhbCB0b2tlbnM6eycgJ31cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e2Zvcm1hdE51bWJlcih0b3RhbFRva2Vucyl9PC9UZXh0PlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIFNlY3Rpb24gMjogQWN0aXZpdHkgLSBSb3cgMTogU2Vzc2lvbnMgfCBMb25nZXN0IHNlc3Npb24gKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezR9PlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Mjh9PlxuICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgU2Vzc2lvbnM6eycgJ31cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e2Zvcm1hdE51bWJlcihzdGF0cy50b3RhbFNlc3Npb25zKX08L1RleHQ+XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9ezI4fT5cbiAgICAgICAgICB7c3RhdHMubG9uZ2VzdFNlc3Npb24gJiYgKFxuICAgICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgIExvbmdlc3Qgc2Vzc2lvbjp7JyAnfVxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPlxuICAgICAgICAgICAgICAgIHtmb3JtYXREdXJhdGlvbihzdGF0cy5sb25nZXN0U2Vzc2lvbi5kdXJhdGlvbil9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuXG4gICAgICB7LyogUm93IDI6IEFjdGl2ZSBkYXlzIHwgTG9uZ2VzdCBzdHJlYWsgKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezR9PlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Mjh9PlxuICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgQWN0aXZlIGRheXM6IDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e3N0YXRzLmFjdGl2ZURheXN9PC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWJ0bGVcIj4ve3JhbmdlRGF5c308L1RleHQ+XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9ezI4fT5cbiAgICAgICAgICA8VGV4dCB3cmFwPVwidHJ1bmNhdGVcIj5cbiAgICAgICAgICAgIExvbmdlc3Qgc3RyZWFrOnsnICd9XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiIGJvbGQ+XG4gICAgICAgICAgICAgIHtzdGF0cy5zdHJlYWtzLmxvbmdlc3RTdHJlYWt9XG4gICAgICAgICAgICA8L1RleHQ+eycgJ31cbiAgICAgICAgICAgIHtzdGF0cy5zdHJlYWtzLmxvbmdlc3RTdHJlYWsgPT09IDEgPyAnZGF5JyA6ICdkYXlzJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBSb3cgMzogTW9zdCBhY3RpdmUgZGF5IHwgQ3VycmVudCBzdHJlYWsgKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezR9PlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Mjh9PlxuICAgICAgICAgIHtzdGF0cy5wZWFrQWN0aXZpdHlEYXkgJiYgKFxuICAgICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgIE1vc3QgYWN0aXZlIGRheTp7JyAnfVxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPntmb3JtYXRQZWFrRGF5KHN0YXRzLnBlYWtBY3Rpdml0eURheSl9PC9UZXh0PlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Mjh9PlxuICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgQ3VycmVudCBzdHJlYWs6eycgJ31cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCIgYm9sZD5cbiAgICAgICAgICAgICAge2FsbFRpbWVTdGF0cy5zdHJlYWtzLmN1cnJlbnRTdHJlYWt9XG4gICAgICAgICAgICA8L1RleHQ+eycgJ31cbiAgICAgICAgICAgIHthbGxUaW1lU3RhdHMuc3RyZWFrcy5jdXJyZW50U3RyZWFrID09PSAxID8gJ2RheScgOiAnZGF5cyd9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuXG4gICAgICB7LyogU3BlY3VsYXRpb24gdGltZSBzYXZlZCAoYW50LW9ubHkpICovfVxuICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgc3RhdHMudG90YWxTcGVjdWxhdGlvblRpbWVTYXZlZE1zID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXs0fT5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgICAgIFNwZWN1bGF0aW9uIHNhdmVkOnsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJjbGF1ZGVcIj5cbiAgICAgICAgICAgICAgICAgIHtmb3JtYXREdXJhdGlvbihzdGF0cy50b3RhbFNwZWN1bGF0aW9uVGltZVNhdmVkTXMpfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgIHsvKiBTaG90IHN0YXRzIChhbnQtb25seSkgKi99XG4gICAgICB7c2hvdFN0YXRzRGF0YSAmJiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFRleHQ+U2hvdCBkaXN0cmlidXRpb248L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXs0fT5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgICAgIHtzaG90U3RhdHNEYXRhLmJ1Y2tldHNbMF0hLmxhYmVsfTp7JyAnfVxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e3Nob3RTdGF0c0RhdGEuYnVja2V0c1swXSEuY291bnR9PC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCI+ICh7c2hvdFN0YXRzRGF0YS5idWNrZXRzWzBdIS5wY3R9JSk8L1RleHQ+XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9ezI4fT5cbiAgICAgICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAge3Nob3RTdGF0c0RhdGEuYnVja2V0c1sxXSEubGFiZWx9OnsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJjbGF1ZGVcIj57c2hvdFN0YXRzRGF0YS5idWNrZXRzWzFdIS5jb3VudH08L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWJ0bGVcIj4gKHtzaG90U3RhdHNEYXRhLmJ1Y2tldHNbMV0hLnBjdH0lKTwvVGV4dD5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXs0fT5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgICAgIHtzaG90U3RhdHNEYXRhLmJ1Y2tldHNbMl0hLmxhYmVsfTp7JyAnfVxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e3Nob3RTdGF0c0RhdGEuYnVja2V0c1syXSEuY291bnR9PC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCI+ICh7c2hvdFN0YXRzRGF0YS5idWNrZXRzWzJdIS5wY3R9JSk8L1RleHQ+XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9ezI4fT5cbiAgICAgICAgICAgICAgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAge3Nob3RTdGF0c0RhdGEuYnVja2V0c1szXSEubGFiZWx9OnsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJjbGF1ZGVcIj57c2hvdFN0YXRzRGF0YS5idWNrZXRzWzNdIS5jb3VudH08L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWJ0bGVcIj4gKHtzaG90U3RhdHNEYXRhLmJ1Y2tldHNbM10hLnBjdH0lKTwvVGV4dD5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXs0fT5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXsyOH0+XG4gICAgICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgICAgIEF2Zy9zZXNzaW9uOnsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJjbGF1ZGVcIj57c2hvdFN0YXRzRGF0YS5hdmdTaG90c308L1RleHQ+XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8Lz5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBGdW4gZmFjdG9pZCAqL31cbiAgICAgIHtmYWN0b2lkICYmIChcbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VnZ2VzdGlvblwiPntmYWN0b2lkfTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgIDwvQm94PlxuICApXG59XG5cbi8vIEZhbW91cyBib29rcyBhbmQgdGhlaXIgYXBwcm94aW1hdGUgdG9rZW4gY291bnRzICh3b3JkcyAqIH4xLjMpXG4vLyBTb3J0ZWQgYnkgdG9rZW5zIGFzY2VuZGluZyBmb3IgY29tcGFyaXNvbiBsb2dpY1xuY29uc3QgQk9PS19DT01QQVJJU09OUyA9IFtcbiAgeyBuYW1lOiAnVGhlIExpdHRsZSBQcmluY2UnLCB0b2tlbnM6IDIyMDAwIH0sXG4gIHsgbmFtZTogJ1RoZSBPbGQgTWFuIGFuZCB0aGUgU2VhJywgdG9rZW5zOiAzNTAwMCB9LFxuICB7IG5hbWU6ICdBIENocmlzdG1hcyBDYXJvbCcsIHRva2VuczogMzcwMDAgfSxcbiAgeyBuYW1lOiAnQW5pbWFsIEZhcm0nLCB0b2tlbnM6IDM5MDAwIH0sXG4gIHsgbmFtZTogJ0ZhaHJlbmhlaXQgNDUxJywgdG9rZW5zOiA2MDAwMCB9LFxuICB7IG5hbWU6ICdUaGUgR3JlYXQgR2F0c2J5JywgdG9rZW5zOiA2MjAwMCB9LFxuICB7IG5hbWU6ICdTbGF1Z2h0ZXJob3VzZS1GaXZlJywgdG9rZW5zOiA2NDAwMCB9LFxuICB7IG5hbWU6ICdCcmF2ZSBOZXcgV29ybGQnLCB0b2tlbnM6IDgzMDAwIH0sXG4gIHsgbmFtZTogJ1RoZSBDYXRjaGVyIGluIHRoZSBSeWUnLCB0b2tlbnM6IDk1MDAwIH0sXG4gIHsgbmFtZTogXCJIYXJyeSBQb3R0ZXIgYW5kIHRoZSBQaGlsb3NvcGhlcidzIFN0b25lXCIsIHRva2VuczogMTAzMDAwIH0sXG4gIHsgbmFtZTogJ1RoZSBIb2JiaXQnLCB0b2tlbnM6IDEyMzAwMCB9LFxuICB7IG5hbWU6ICcxOTg0JywgdG9rZW5zOiAxMjMwMDAgfSxcbiAgeyBuYW1lOiAnVG8gS2lsbCBhIE1vY2tpbmdiaXJkJywgdG9rZW5zOiAxMzAwMDAgfSxcbiAgeyBuYW1lOiAnUHJpZGUgYW5kIFByZWp1ZGljZScsIHRva2VuczogMTU2MDAwIH0sXG4gIHsgbmFtZTogJ0R1bmUnLCB0b2tlbnM6IDI0NDAwMCB9LFxuICB7IG5hbWU6ICdNb2J5LURpY2snLCB0b2tlbnM6IDI2ODAwMCB9LFxuICB7IG5hbWU6ICdDcmltZSBhbmQgUHVuaXNobWVudCcsIHRva2VuczogMjc0MDAwIH0sXG4gIHsgbmFtZTogJ0EgR2FtZSBvZiBUaHJvbmVzJywgdG9rZW5zOiAzODEwMDAgfSxcbiAgeyBuYW1lOiAnQW5uYSBLYXJlbmluYScsIHRva2VuczogNDY4MDAwIH0sXG4gIHsgbmFtZTogJ0RvbiBRdWl4b3RlJywgdG9rZW5zOiA1MjAwMDAgfSxcbiAgeyBuYW1lOiAnVGhlIExvcmQgb2YgdGhlIFJpbmdzJywgdG9rZW5zOiA1NzYwMDAgfSxcbiAgeyBuYW1lOiAnVGhlIENvdW50IG9mIE1vbnRlIENyaXN0bycsIHRva2VuczogNjAzMDAwIH0sXG4gIHsgbmFtZTogJ0xlcyBNaXPDqXJhYmxlcycsIHRva2VuczogNjg5MDAwIH0sXG4gIHsgbmFtZTogJ1dhciBhbmQgUGVhY2UnLCB0b2tlbnM6IDczMDAwMCB9LFxuXVxuXG4vLyBUaW1lIGVxdWl2YWxlbnRzIGZvciBzZXNzaW9uIGR1cmF0aW9uc1xuY29uc3QgVElNRV9DT01QQVJJU09OUyA9IFtcbiAgeyBuYW1lOiAnYSBURUQgdGFsaycsIG1pbnV0ZXM6IDE4IH0sXG4gIHsgbmFtZTogJ2FuIGVwaXNvZGUgb2YgVGhlIE9mZmljZScsIG1pbnV0ZXM6IDIyIH0sXG4gIHsgbmFtZTogJ2xpc3RlbmluZyB0byBBYmJleSBSb2FkJywgbWludXRlczogNDcgfSxcbiAgeyBuYW1lOiAnYSB5b2dhIGNsYXNzJywgbWludXRlczogNjAgfSxcbiAgeyBuYW1lOiAnYSBXb3JsZCBDdXAgc29jY2VyIG1hdGNoJywgbWludXRlczogOTAgfSxcbiAgeyBuYW1lOiAnYSBoYWxmIG1hcmF0aG9uIChhdmVyYWdlIHRpbWUpJywgbWludXRlczogMTIwIH0sXG4gIHsgbmFtZTogJ3RoZSBtb3ZpZSBJbmNlcHRpb24nLCBtaW51dGVzOiAxNDggfSxcbiAgeyBuYW1lOiAnd2F0Y2hpbmcgVGl0YW5pYycsIG1pbnV0ZXM6IDE5NSB9LFxuICB7IG5hbWU6ICdhIHRyYW5zYXRsYW50aWMgZmxpZ2h0JywgbWludXRlczogNDIwIH0sXG4gIHsgbmFtZTogJ2EgZnVsbCBuaWdodCBvZiBzbGVlcCcsIG1pbnV0ZXM6IDQ4MCB9LFxuXVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUZ1bkZhY3RvaWQoXG4gIHN0YXRzOiBDbGF1ZGVDb2RlU3RhdHMsXG4gIHRvdGFsVG9rZW5zOiBudW1iZXIsXG4pOiBzdHJpbmcge1xuICBjb25zdCBmYWN0b2lkczogc3RyaW5nW10gPSBbXVxuXG4gIGlmICh0b3RhbFRva2VucyA+IDApIHtcbiAgICBjb25zdCBtYXRjaGluZ0Jvb2tzID0gQk9PS19DT01QQVJJU09OUy5maWx0ZXIoXG4gICAgICBib29rID0+IHRvdGFsVG9rZW5zID49IGJvb2sudG9rZW5zLFxuICAgIClcblxuICAgIGZvciAoY29uc3QgYm9vayBvZiBtYXRjaGluZ0Jvb2tzKSB7XG4gICAgICBjb25zdCB0aW1lcyA9IHRvdGFsVG9rZW5zIC8gYm9vay50b2tlbnNcbiAgICAgIGlmICh0aW1lcyA+PSAyKSB7XG4gICAgICAgIGZhY3RvaWRzLnB1c2goXG4gICAgICAgICAgYFlvdSd2ZSB1c2VkIH4ke01hdGguZmxvb3IodGltZXMpfXggbW9yZSB0b2tlbnMgdGhhbiAke2Jvb2submFtZX1gLFxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmYWN0b2lkcy5wdXNoKGBZb3UndmUgdXNlZCB0aGUgc2FtZSBudW1iZXIgb2YgdG9rZW5zIGFzICR7Ym9vay5uYW1lfWApXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKHN0YXRzLmxvbmdlc3RTZXNzaW9uKSB7XG4gICAgY29uc3Qgc2Vzc2lvbk1pbnV0ZXMgPSBzdGF0cy5sb25nZXN0U2Vzc2lvbi5kdXJhdGlvbiAvICgxMDAwICogNjApXG4gICAgZm9yIChjb25zdCBjb21wYXJpc29uIG9mIFRJTUVfQ09NUEFSSVNPTlMpIHtcbiAgICAgIGNvbnN0IHJhdGlvID0gc2Vzc2lvbk1pbnV0ZXMgLyBjb21wYXJpc29uLm1pbnV0ZXNcbiAgICAgIGlmIChyYXRpbyA+PSAyKSB7XG4gICAgICAgIGZhY3RvaWRzLnB1c2goXG4gICAgICAgICAgYFlvdXIgbG9uZ2VzdCBzZXNzaW9uIGlzIH4ke01hdGguZmxvb3IocmF0aW8pfXggbG9uZ2VyIHRoYW4gJHtjb21wYXJpc29uLm5hbWV9YCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChmYWN0b2lkcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuICBjb25zdCByYW5kb21JbmRleCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGZhY3RvaWRzLmxlbmd0aClcbiAgcmV0dXJuIGZhY3RvaWRzW3JhbmRvbUluZGV4XSFcbn1cblxuZnVuY3Rpb24gTW9kZWxzVGFiKHtcbiAgc3RhdHMsXG4gIGRhdGVSYW5nZSxcbiAgaXNMb2FkaW5nLFxufToge1xuICBzdGF0czogQ2xhdWRlQ29kZVN0YXRzXG4gIGRhdGVSYW5nZTogU3RhdHNEYXRlUmFuZ2VcbiAgaXNMb2FkaW5nOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgeyBoZWFkZXJGb2N1c2VkLCBmb2N1c0hlYWRlciB9ID0gdXNlVGFiSGVhZGVyRm9jdXMoKVxuICBjb25zdCBbc2Nyb2xsT2Zmc2V0LCBzZXRTY3JvbGxPZmZzZXRdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgeyBjb2x1bW5zOiB0ZXJtaW5hbFdpZHRoIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICBjb25zdCBWSVNJQkxFX01PREVMUyA9IDQgLy8gU2hvdyA0IG1vZGVscyBhdCBhIHRpbWUgKDIgcGVyIGNvbHVtbilcblxuICBjb25zdCBtb2RlbEVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzdGF0cy5tb2RlbFVzYWdlKS5zb3J0KFxuICAgIChbLCBhXSwgWywgYl0pID0+XG4gICAgICBiLmlucHV0VG9rZW5zICsgYi5vdXRwdXRUb2tlbnMgLSAoYS5pbnB1dFRva2VucyArIGEub3V0cHV0VG9rZW5zKSxcbiAgKVxuXG4gIC8vIEhhbmRsZSBzY3JvbGxpbmcgd2l0aCBhcnJvdyBrZXlzXG4gIHVzZUlucHV0KFxuICAgIChfaW5wdXQsIGtleSkgPT4ge1xuICAgICAgaWYgKFxuICAgICAgICBrZXkuZG93bkFycm93ICYmXG4gICAgICAgIHNjcm9sbE9mZnNldCA8IG1vZGVsRW50cmllcy5sZW5ndGggLSBWSVNJQkxFX01PREVMU1xuICAgICAgKSB7XG4gICAgICAgIHNldFNjcm9sbE9mZnNldChwcmV2ID0+XG4gICAgICAgICAgTWF0aC5taW4ocHJldiArIDIsIG1vZGVsRW50cmllcy5sZW5ndGggLSBWSVNJQkxFX01PREVMUyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChrZXkudXBBcnJvdykge1xuICAgICAgICBpZiAoc2Nyb2xsT2Zmc2V0ID4gMCkge1xuICAgICAgICAgIHNldFNjcm9sbE9mZnNldChwcmV2ID0+IE1hdGgubWF4KHByZXYgLSAyLCAwKSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb2N1c0hlYWRlcigpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHsgaXNBY3RpdmU6ICFoZWFkZXJGb2N1c2VkIH0sXG4gIClcblxuICBpZiAobW9kZWxFbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94PlxuICAgICAgICA8VGV4dCBjb2xvcj1cInN1YnRsZVwiPk5vIG1vZGVsIHVzYWdlIGRhdGEgYXZhaWxhYmxlPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgY29uc3QgdG90YWxUb2tlbnMgPSBtb2RlbEVudHJpZXMucmVkdWNlKFxuICAgIChzdW0sIFssIHVzYWdlXSkgPT4gc3VtICsgdXNhZ2UuaW5wdXRUb2tlbnMgKyB1c2FnZS5vdXRwdXRUb2tlbnMsXG4gICAgMCxcbiAgKVxuXG4gIC8vIEdlbmVyYXRlIHRva2VuIHVzYWdlIGNoYXJ0IC0gdXNlIHRlcm1pbmFsIHdpZHRoIGZvciByZXNwb25zaXZlIHNpemluZ1xuICBjb25zdCBjaGFydE91dHB1dCA9IGdlbmVyYXRlVG9rZW5DaGFydChcbiAgICBzdGF0cy5kYWlseU1vZGVsVG9rZW5zLFxuICAgIG1vZGVsRW50cmllcy5tYXAoKFttb2RlbF0pID0+IG1vZGVsKSxcbiAgICB0ZXJtaW5hbFdpZHRoLFxuICApXG5cbiAgLy8gR2V0IHZpc2libGUgbW9kZWxzIGFuZCBzcGxpdCBpbnRvIHR3byBjb2x1bW5zXG4gIGNvbnN0IHZpc2libGVNb2RlbHMgPSBtb2RlbEVudHJpZXMuc2xpY2UoXG4gICAgc2Nyb2xsT2Zmc2V0LFxuICAgIHNjcm9sbE9mZnNldCArIFZJU0lCTEVfTU9ERUxTLFxuICApXG4gIGNvbnN0IG1pZHBvaW50ID0gTWF0aC5jZWlsKHZpc2libGVNb2RlbHMubGVuZ3RoIC8gMilcbiAgY29uc3QgbGVmdE1vZGVscyA9IHZpc2libGVNb2RlbHMuc2xpY2UoMCwgbWlkcG9pbnQpXG4gIGNvbnN0IHJpZ2h0TW9kZWxzID0gdmlzaWJsZU1vZGVscy5zbGljZShtaWRwb2ludClcblxuICBjb25zdCBjYW5TY3JvbGxVcCA9IHNjcm9sbE9mZnNldCA+IDBcbiAgY29uc3QgY2FuU2Nyb2xsRG93biA9IHNjcm9sbE9mZnNldCA8IG1vZGVsRW50cmllcy5sZW5ndGggLSBWSVNJQkxFX01PREVMU1xuICBjb25zdCBzaG93U2Nyb2xsSGludCA9IG1vZGVsRW50cmllcy5sZW5ndGggPiBWSVNJQkxFX01PREVMU1xuXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgIHsvKiBUb2tlbiB1c2FnZSBjaGFydCAqL31cbiAgICAgIHtjaGFydE91dHB1dCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD5Ub2tlbnMgcGVyIERheTwvVGV4dD5cbiAgICAgICAgICA8QW5zaT57Y2hhcnRPdXRwdXQuY2hhcnR9PC9BbnNpPlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCI+e2NoYXJ0T3V0cHV0LnhBeGlzTGFiZWxzfTwvVGV4dD5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAge2NoYXJ0T3V0cHV0LmxlZ2VuZC5tYXAoKGl0ZW0sIGkpID0+IChcbiAgICAgICAgICAgICAgPFRleHQga2V5PXtpdGVtLm1vZGVsfT5cbiAgICAgICAgICAgICAgICB7aSA+IDAgPyAnIMK3ICcgOiAnJ31cbiAgICAgICAgICAgICAgICA8QW5zaT57aXRlbS5jb2xvcmVkQnVsbGV0fTwvQW5zaT4ge2l0ZW0ubW9kZWx9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBEYXRlIHJhbmdlIHNlbGVjdG9yICovfVxuICAgICAgPERhdGVSYW5nZVNlbGVjdG9yIGRhdGVSYW5nZT17ZGF0ZVJhbmdlfSBpc0xvYWRpbmc9e2lzTG9hZGluZ30gLz5cblxuICAgICAgey8qIE1vZGVsIGJyZWFrZG93biAtIHR3byBjb2x1bW5zIHdpdGggZml4ZWQgd2lkdGggKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezR9PlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17MzZ9PlxuICAgICAgICAgIHtsZWZ0TW9kZWxzLm1hcCgoW21vZGVsLCB1c2FnZV0pID0+IChcbiAgICAgICAgICAgIDxNb2RlbEVudHJ5XG4gICAgICAgICAgICAgIGtleT17bW9kZWx9XG4gICAgICAgICAgICAgIG1vZGVsPXttb2RlbH1cbiAgICAgICAgICAgICAgdXNhZ2U9e3VzYWdlfVxuICAgICAgICAgICAgICB0b3RhbFRva2Vucz17dG90YWxUb2tlbnN9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9ezM2fT5cbiAgICAgICAgICB7cmlnaHRNb2RlbHMubWFwKChbbW9kZWwsIHVzYWdlXSkgPT4gKFxuICAgICAgICAgICAgPE1vZGVsRW50cnlcbiAgICAgICAgICAgICAga2V5PXttb2RlbH1cbiAgICAgICAgICAgICAgbW9kZWw9e21vZGVsfVxuICAgICAgICAgICAgICB1c2FnZT17dXNhZ2V9XG4gICAgICAgICAgICAgIHRvdGFsVG9rZW5zPXt0b3RhbFRva2Vuc31cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBTY3JvbGwgaGludCAqL31cbiAgICAgIHtzaG93U2Nyb2xsSGludCAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1YnRsZVwiPlxuICAgICAgICAgICAge2NhblNjcm9sbFVwID8gZmlndXJlcy5hcnJvd1VwIDogJyAnfXsnICd9XG4gICAgICAgICAgICB7Y2FuU2Nyb2xsRG93biA/IGZpZ3VyZXMuYXJyb3dEb3duIDogJyAnfSB7c2Nyb2xsT2Zmc2V0ICsgMX0tXG4gICAgICAgICAgICB7TWF0aC5taW4oc2Nyb2xsT2Zmc2V0ICsgVklTSUJMRV9NT0RFTFMsIG1vZGVsRW50cmllcy5sZW5ndGgpfSBvZnsnICd9XG4gICAgICAgICAgICB7bW9kZWxFbnRyaWVzLmxlbmd0aH0gbW9kZWxzICjihpHihpMgdG8gc2Nyb2xsKVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgIDwvQm94PlxuICApXG59XG5cbnR5cGUgTW9kZWxFbnRyeVByb3BzID0ge1xuICBtb2RlbDogc3RyaW5nXG4gIHVzYWdlOiB7XG4gICAgaW5wdXRUb2tlbnM6IG51bWJlclxuICAgIG91dHB1dFRva2VuczogbnVtYmVyXG4gICAgY2FjaGVSZWFkSW5wdXRUb2tlbnM6IG51bWJlclxuICB9XG4gIHRvdGFsVG9rZW5zOiBudW1iZXJcbn1cblxuZnVuY3Rpb24gTW9kZWxFbnRyeSh7XG4gIG1vZGVsLFxuICB1c2FnZSxcbiAgdG90YWxUb2tlbnMsXG59OiBNb2RlbEVudHJ5UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBtb2RlbFRva2VucyA9IHVzYWdlLmlucHV0VG9rZW5zICsgdXNhZ2Uub3V0cHV0VG9rZW5zXG4gIGNvbnN0IHBlcmNlbnRhZ2UgPSAoKG1vZGVsVG9rZW5zIC8gdG90YWxUb2tlbnMpICogMTAwKS50b0ZpeGVkKDEpXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxUZXh0PlxuICAgICAgICB7ZmlndXJlcy5idWxsZXR9IDxUZXh0IGJvbGQ+e3JlbmRlck1vZGVsTmFtZShtb2RlbCl9PC9UZXh0PnsnICd9XG4gICAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCI+KHtwZXJjZW50YWdlfSUpPC9UZXh0PlxuICAgICAgPC9UZXh0PlxuICAgICAgPFRleHQgY29sb3I9XCJzdWJ0bGVcIj5cbiAgICAgICAgeycgICd9SW46IHtmb3JtYXROdW1iZXIodXNhZ2UuaW5wdXRUb2tlbnMpfSDCtyBPdXQ6eycgJ31cbiAgICAgICAge2Zvcm1hdE51bWJlcih1c2FnZS5vdXRwdXRUb2tlbnMpfVxuICAgICAgPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG5cbnR5cGUgQ2hhcnRMZWdlbmQgPSB7XG4gIG1vZGVsOiBzdHJpbmdcbiAgY29sb3JlZEJ1bGxldDogc3RyaW5nIC8vIFByZS1jb2xvcmVkIGJ1bGxldCB1c2luZyBjaGFsa1xufVxuXG50eXBlIENoYXJ0T3V0cHV0ID0ge1xuICBjaGFydDogc3RyaW5nXG4gIGxlZ2VuZDogQ2hhcnRMZWdlbmRbXVxuICB4QXhpc0xhYmVsczogc3RyaW5nXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlVG9rZW5DaGFydChcbiAgZGFpbHlUb2tlbnM6IERhaWx5TW9kZWxUb2tlbnNbXSxcbiAgbW9kZWxzOiBzdHJpbmdbXSxcbiAgdGVybWluYWxXaWR0aDogbnVtYmVyLFxuKTogQ2hhcnRPdXRwdXQgfCBudWxsIHtcbiAgaWYgKGRhaWx5VG9rZW5zLmxlbmd0aCA8IDIgfHwgbW9kZWxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICAvLyBZLWF4aXMgbGFiZWxzIHRha2UgYWJvdXQgNiBjaGFyYWN0ZXJzLCBwbHVzIHNvbWUgcGFkZGluZ1xuICAvLyBDYXAgYXQgfjUyIHRvIGFsaWduIHdpdGggaGVhdG1hcCB3aWR0aCAoMSB5ZWFyIG9mIGRhdGEpXG4gIGNvbnN0IHlBeGlzV2lkdGggPSA3XG4gIGNvbnN0IGF2YWlsYWJsZVdpZHRoID0gdGVybWluYWxXaWR0aCAtIHlBeGlzV2lkdGhcbiAgY29uc3QgY2hhcnRXaWR0aCA9IE1hdGgubWluKDUyLCBNYXRoLm1heCgyMCwgYXZhaWxhYmxlV2lkdGgpKVxuXG4gIC8vIERpc3RyaWJ1dGUgZGF0YSBhY3Jvc3MgdGhlIGF2YWlsYWJsZSBjaGFydCB3aWR0aFxuICBsZXQgcmVjZW50RGF0YTogRGFpbHlNb2RlbFRva2Vuc1tdXG4gIGlmIChkYWlseVRva2Vucy5sZW5ndGggPj0gY2hhcnRXaWR0aCkge1xuICAgIC8vIE1vcmUgZGF0YSB0aGFuIHNwYWNlOiB0YWtlIG1vc3QgcmVjZW50IE4gZGF5c1xuICAgIHJlY2VudERhdGEgPSBkYWlseVRva2Vucy5zbGljZSgtY2hhcnRXaWR0aClcbiAgfSBlbHNlIHtcbiAgICAvLyBMZXNzIGRhdGEgdGhhbiBzcGFjZTogZXhwYW5kIGJ5IHJlcGVhdGluZyBlYWNoIHBvaW50XG4gICAgY29uc3QgcmVwZWF0Q291bnQgPSBNYXRoLmZsb29yKGNoYXJ0V2lkdGggLyBkYWlseVRva2Vucy5sZW5ndGgpXG4gICAgcmVjZW50RGF0YSA9IFtdXG4gICAgZm9yIChjb25zdCBkYXkgb2YgZGFpbHlUb2tlbnMpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVwZWF0Q291bnQ7IGkrKykge1xuICAgICAgICByZWNlbnREYXRhLnB1c2goZGF5KVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIENvbG9yIHBhbGV0dGUgZm9yIGRpZmZlcmVudCBtb2RlbHMgLSB1c2UgdGhlbWUgY29sb3JzXG4gIGNvbnN0IHRoZW1lID0gZ2V0VGhlbWUocmVzb2x2ZVRoZW1lU2V0dGluZyhnZXRHbG9iYWxDb25maWcoKS50aGVtZSkpXG4gIGNvbnN0IGNvbG9ycyA9IFtcbiAgICB0aGVtZUNvbG9yVG9BbnNpKHRoZW1lLnN1Z2dlc3Rpb24pLFxuICAgIHRoZW1lQ29sb3JUb0Fuc2kodGhlbWUuc3VjY2VzcyksXG4gICAgdGhlbWVDb2xvclRvQW5zaSh0aGVtZS53YXJuaW5nKSxcbiAgXVxuXG4gIC8vIFByZXBhcmUgc2VyaWVzIGRhdGEgZm9yIGVhY2ggbW9kZWxcbiAgY29uc3Qgc2VyaWVzOiBudW1iZXJbXVtdID0gW11cbiAgY29uc3QgbGVnZW5kOiBDaGFydExlZ2VuZFtdID0gW11cblxuICAvLyBPbmx5IHNob3cgdG9wIDMgbW9kZWxzIHRvIGtlZXAgY2hhcnQgcmVhZGFibGVcbiAgY29uc3QgdG9wTW9kZWxzID0gbW9kZWxzLnNsaWNlKDAsIDMpXG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b3BNb2RlbHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBtb2RlbCA9IHRvcE1vZGVsc1tpXSFcbiAgICBjb25zdCBkYXRhID0gcmVjZW50RGF0YS5tYXAoZGF5ID0+IGRheS50b2tlbnNCeU1vZGVsW21vZGVsXSB8fCAwKVxuXG4gICAgLy8gT25seSBpbmNsdWRlIGlmIHRoZXJlJ3MgYWN0dWFsIGRhdGFcbiAgICBpZiAoZGF0YS5zb21lKHYgPT4gdiA+IDApKSB7XG4gICAgICBzZXJpZXMucHVzaChkYXRhKVxuICAgICAgLy8gVXNlIHRoZW1lIGNvbG9ycyB0aGF0IG1hdGNoIHRoZSBjaGFydFxuICAgICAgY29uc3QgYnVsbGV0Q29sb3JzID0gW3RoZW1lLnN1Z2dlc3Rpb24sIHRoZW1lLnN1Y2Nlc3MsIHRoZW1lLndhcm5pbmddXG4gICAgICBsZWdlbmQucHVzaCh7XG4gICAgICAgIG1vZGVsOiByZW5kZXJNb2RlbE5hbWUobW9kZWwpLFxuICAgICAgICBjb2xvcmVkQnVsbGV0OiBhcHBseUNvbG9yKFxuICAgICAgICAgIGZpZ3VyZXMuYnVsbGV0LFxuICAgICAgICAgIGJ1bGxldENvbG9yc1tpICUgYnVsbGV0Q29sb3JzLmxlbmd0aF0gYXMgQ29sb3IsXG4gICAgICAgICksXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIGlmIChzZXJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGNvbnN0IGNoYXJ0ID0gYXNjaWljaGFydChzZXJpZXMsIHtcbiAgICBoZWlnaHQ6IDgsXG4gICAgY29sb3JzOiBjb2xvcnMuc2xpY2UoMCwgc2VyaWVzLmxlbmd0aCksXG4gICAgZm9ybWF0OiAoeDogbnVtYmVyKSA9PiB7XG4gICAgICBsZXQgbGFiZWw6IHN0cmluZ1xuICAgICAgaWYgKHggPj0gMV8wMDBfMDAwKSB7XG4gICAgICAgIGxhYmVsID0gKHggLyAxXzAwMF8wMDApLnRvRml4ZWQoMSkgKyAnTSdcbiAgICAgIH0gZWxzZSBpZiAoeCA+PSAxXzAwMCkge1xuICAgICAgICBsYWJlbCA9ICh4IC8gMV8wMDApLnRvRml4ZWQoMCkgKyAnaydcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxhYmVsID0geC50b0ZpeGVkKDApXG4gICAgICB9XG4gICAgICByZXR1cm4gbGFiZWwucGFkU3RhcnQoNilcbiAgICB9LFxuICB9KVxuXG4gIC8vIEdlbmVyYXRlIHgtYXhpcyBsYWJlbHMgd2l0aCBkYXRlc1xuICBjb25zdCB4QXhpc0xhYmVscyA9IGdlbmVyYXRlWEF4aXNMYWJlbHMoXG4gICAgcmVjZW50RGF0YSxcbiAgICByZWNlbnREYXRhLmxlbmd0aCxcbiAgICB5QXhpc1dpZHRoLFxuICApXG5cbiAgcmV0dXJuIHsgY2hhcnQsIGxlZ2VuZCwgeEF4aXNMYWJlbHMgfVxufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVhBeGlzTGFiZWxzKFxuICBkYXRhOiBEYWlseU1vZGVsVG9rZW5zW10sXG4gIF9jaGFydFdpZHRoOiBudW1iZXIsXG4gIHlBeGlzT2Zmc2V0OiBudW1iZXIsXG4pOiBzdHJpbmcge1xuICBpZiAoZGF0YS5sZW5ndGggPT09IDApIHJldHVybiAnJ1xuXG4gIC8vIFNob3cgMy00IGRhdGUgbGFiZWxzIGV2ZW5seSBzcGFjZWQsIGJ1dCBsZWF2ZSByb29tIGZvciBsYXN0IGxhYmVsXG4gIGNvbnN0IG51bUxhYmVscyA9IE1hdGgubWluKDQsIE1hdGgubWF4KDIsIE1hdGguZmxvb3IoZGF0YS5sZW5ndGggLyA4KSkpXG4gIC8vIERvbid0IHVzZSB0aGUgdmVyeSBsYXN0IHBvc2l0aW9uIC0gbGVhdmUgcm9vbSBmb3IgdGhlIGxhYmVsIHRleHRcbiAgY29uc3QgdXNhYmxlTGVuZ3RoID0gZGF0YS5sZW5ndGggLSA2IC8vIFJlc2VydmUgfjYgY2hhcnMgZm9yIGxhc3QgbGFiZWwgKGUuZy4sIFwiRGVjIDdcIilcbiAgY29uc3Qgc3RlcCA9IE1hdGguZmxvb3IodXNhYmxlTGVuZ3RoIC8gKG51bUxhYmVscyAtIDEpKSB8fCAxXG5cbiAgY29uc3QgbGFiZWxQb3NpdGlvbnM6IHsgcG9zOiBudW1iZXI7IGxhYmVsOiBzdHJpbmcgfVtdID0gW11cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUxhYmVsczsgaSsrKSB7XG4gICAgY29uc3QgaWR4ID0gTWF0aC5taW4oaSAqIHN0ZXAsIGRhdGEubGVuZ3RoIC0gMSlcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0YVtpZHhdIS5kYXRlKVxuICAgIGNvbnN0IGxhYmVsID0gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLVVTJywge1xuICAgICAgbW9udGg6ICdzaG9ydCcsXG4gICAgICBkYXk6ICdudW1lcmljJyxcbiAgICB9KVxuICAgIGxhYmVsUG9zaXRpb25zLnB1c2goeyBwb3M6IGlkeCwgbGFiZWwgfSlcbiAgfVxuXG4gIC8vIEJ1aWxkIHRoZSBsYWJlbCBzdHJpbmcgd2l0aCBwcm9wZXIgc3BhY2luZ1xuICBsZXQgcmVzdWx0ID0gJyAnLnJlcGVhdCh5QXhpc09mZnNldClcbiAgbGV0IGN1cnJlbnRQb3MgPSAwXG5cbiAgZm9yIChjb25zdCB7IHBvcywgbGFiZWwgfSBvZiBsYWJlbFBvc2l0aW9ucykge1xuICAgIGNvbnN0IHNwYWNlcyA9IE1hdGgubWF4KDEsIHBvcyAtIGN1cnJlbnRQb3MpXG4gICAgcmVzdWx0ICs9ICcgJy5yZXBlYXQoc3BhY2VzKSArIGxhYmVsXG4gICAgY3VycmVudFBvcyA9IHBvcyArIGxhYmVsLmxlbmd0aFxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBTY3JlZW5zaG90IGZ1bmN0aW9uYWxpdHlcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNjcmVlbnNob3QoXG4gIHN0YXRzOiBDbGF1ZGVDb2RlU3RhdHMsXG4gIGFjdGl2ZVRhYjogJ092ZXJ2aWV3JyB8ICdNb2RlbHMnLFxuICBzZXRTdGF0dXM6IChzdGF0dXM6IHN0cmluZyB8IG51bGwpID0+IHZvaWQsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgc2V0U3RhdHVzKCdjb3B5aW5n4oCmJylcblxuICBjb25zdCBhbnNpVGV4dCA9IHJlbmRlclN0YXRzVG9BbnNpKHN0YXRzLCBhY3RpdmVUYWIpXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvcHlBbnNpVG9DbGlwYm9hcmQoYW5zaVRleHQpXG5cbiAgc2V0U3RhdHVzKHJlc3VsdC5zdWNjZXNzID8gJ2NvcGllZCEnIDogJ2NvcHkgZmFpbGVkJylcblxuICAvLyBDbGVhciBzdGF0dXMgYWZ0ZXIgMiBzZWNvbmRzXG4gIHNldFRpbWVvdXQoc2V0U3RhdHVzLCAyMDAwLCBudWxsKVxufVxuXG5mdW5jdGlvbiByZW5kZXJTdGF0c1RvQW5zaShcbiAgc3RhdHM6IENsYXVkZUNvZGVTdGF0cyxcbiAgYWN0aXZlVGFiOiAnT3ZlcnZpZXcnIHwgJ01vZGVscycsXG4pOiBzdHJpbmcge1xuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXVxuXG4gIGlmIChhY3RpdmVUYWIgPT09ICdPdmVydmlldycpIHtcbiAgICBsaW5lcy5wdXNoKC4uLnJlbmRlck92ZXJ2aWV3VG9BbnNpKHN0YXRzKSlcbiAgfSBlbHNlIHtcbiAgICBsaW5lcy5wdXNoKC4uLnJlbmRlck1vZGVsc1RvQW5zaShzdGF0cykpXG4gIH1cblxuICAvLyBUcmltIHRyYWlsaW5nIGVtcHR5IGxpbmVzXG4gIHdoaWxlIChcbiAgICBsaW5lcy5sZW5ndGggPiAwICYmXG4gICAgc3RyaXBBbnNpKGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdISkudHJpbSgpID09PSAnJ1xuICApIHtcbiAgICBsaW5lcy5wb3AoKVxuICB9XG5cbiAgLy8gQWRkIFwiL3N0YXRzXCIgcmlnaHQtYWxpZ25lZCBvbiB0aGUgbGFzdCBsaW5lXG4gIGlmIChsaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbGFzdExpbmUgPSBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXSFcbiAgICBjb25zdCBsYXN0TGluZUxlbiA9IGdldFN0cmluZ1dpZHRoKGxhc3RMaW5lKVxuICAgIC8vIFVzZSBrbm93biBjb250ZW50IHdpZHRocyBiYXNlZCBvbiBsYXlvdXQ6XG4gICAgLy8gT3ZlcnZpZXc6IHR3by1jb2x1bW4gc3RhdHMgPSBDT0wyX1NUQVJUKDQwKSArIENPTDJfTEFCRUxfV0lEVEgoMTgpICsgbWF4X3ZhbHVlKH4xMikgPSA3MFxuICAgIC8vIE1vZGVsczogY2hhcnQgd2lkdGggPSA4MFxuICAgIGNvbnN0IGNvbnRlbnRXaWR0aCA9IGFjdGl2ZVRhYiA9PT0gJ092ZXJ2aWV3JyA/IDcwIDogODBcbiAgICBjb25zdCBzdGF0c0xhYmVsID0gJy9zdGF0cydcbiAgICBjb25zdCBwYWRkaW5nID0gTWF0aC5tYXgoMiwgY29udGVudFdpZHRoIC0gbGFzdExpbmVMZW4gLSBzdGF0c0xhYmVsLmxlbmd0aClcbiAgICBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXSA9XG4gICAgICBsYXN0TGluZSArICcgJy5yZXBlYXQocGFkZGluZykgKyBjaGFsay5ncmF5KHN0YXRzTGFiZWwpXG4gIH1cblxuICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbn1cblxuZnVuY3Rpb24gcmVuZGVyT3ZlcnZpZXdUb0Fuc2koc3RhdHM6IENsYXVkZUNvZGVTdGF0cyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW11cbiAgY29uc3QgdGhlbWUgPSBnZXRUaGVtZShyZXNvbHZlVGhlbWVTZXR0aW5nKGdldEdsb2JhbENvbmZpZygpLnRoZW1lKSlcbiAgY29uc3QgaCA9ICh0ZXh0OiBzdHJpbmcpID0+IGFwcGx5Q29sb3IodGV4dCwgdGhlbWUuY2xhdWRlIGFzIENvbG9yKVxuXG4gIC8vIFR3by1jb2x1bW4gaGVscGVyIHdpdGggZml4ZWQgc3BhY2luZ1xuICAvLyBDb2x1bW4gMTogbGFiZWwgKDE4IGNoYXJzKSArIHZhbHVlICsgcGFkZGluZyB0byByZWFjaCBjb2wgMlxuICAvLyBDb2x1bW4gMiBzdGFydHMgYXQgY2hhcmFjdGVyIHBvc2l0aW9uIDQwXG4gIGNvbnN0IENPTDFfTEFCRUxfV0lEVEggPSAxOFxuICBjb25zdCBDT0wyX1NUQVJUID0gNDBcbiAgY29uc3QgQ09MMl9MQUJFTF9XSURUSCA9IDE4XG5cbiAgY29uc3Qgcm93ID0gKGwxOiBzdHJpbmcsIHYxOiBzdHJpbmcsIGwyOiBzdHJpbmcsIHYyOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgIC8vIEJ1aWxkIGNvbHVtbiAxOiBsYWJlbCArIHZhbHVlXG4gICAgY29uc3QgbGFiZWwxID0gKGwxICsgJzonKS5wYWRFbmQoQ09MMV9MQUJFTF9XSURUSClcbiAgICBjb25zdCBjb2wxUGxhaW5MZW4gPSBsYWJlbDEubGVuZ3RoICsgdjEubGVuZ3RoXG5cbiAgICAvLyBDYWxjdWxhdGUgc3BhY2VzIG5lZWRlZCBiZXR3ZWVuIGNvbDEgdmFsdWUgYW5kIGNvbDIgbGFiZWxcbiAgICBjb25zdCBzcGFjZUJldHdlZW4gPSBNYXRoLm1heCgyLCBDT0wyX1NUQVJUIC0gY29sMVBsYWluTGVuKVxuXG4gICAgLy8gQnVpbGQgY29sdW1uIDI6IGxhYmVsICsgdmFsdWVcbiAgICBjb25zdCBsYWJlbDIgPSAobDIgKyAnOicpLnBhZEVuZChDT0wyX0xBQkVMX1dJRFRIKVxuXG4gICAgLy8gQXNzZW1ibGUgd2l0aCBjb2xvcnMgYXBwbGllZCB0byB2YWx1ZXMgb25seVxuICAgIHJldHVybiBsYWJlbDEgKyBoKHYxKSArICcgJy5yZXBlYXQoc3BhY2VCZXR3ZWVuKSArIGxhYmVsMiArIGgodjIpXG4gIH1cblxuICAvLyBIZWF0bWFwIC0gdXNlIGZpeGVkIHdpZHRoIGZvciBzY3JlZW5zaG90ICg1NiA9IDUyIHdlZWtzICsgNCBmb3IgZGF5IGxhYmVscylcbiAgaWYgKHN0YXRzLmRhaWx5QWN0aXZpdHkubGVuZ3RoID4gMCkge1xuICAgIGxpbmVzLnB1c2goZ2VuZXJhdGVIZWF0bWFwKHN0YXRzLmRhaWx5QWN0aXZpdHksIHsgdGVybWluYWxXaWR0aDogNTYgfSkpXG4gICAgbGluZXMucHVzaCgnJylcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB2YWx1ZXNcbiAgY29uc3QgbW9kZWxFbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc3RhdHMubW9kZWxVc2FnZSkuc29ydChcbiAgICAoWywgYV0sIFssIGJdKSA9PlxuICAgICAgYi5pbnB1dFRva2VucyArIGIub3V0cHV0VG9rZW5zIC0gKGEuaW5wdXRUb2tlbnMgKyBhLm91dHB1dFRva2VucyksXG4gIClcbiAgY29uc3QgZmF2b3JpdGVNb2RlbCA9IG1vZGVsRW50cmllc1swXVxuICBjb25zdCB0b3RhbFRva2VucyA9IG1vZGVsRW50cmllcy5yZWR1Y2UoXG4gICAgKHN1bSwgWywgdXNhZ2VdKSA9PiBzdW0gKyB1c2FnZS5pbnB1dFRva2VucyArIHVzYWdlLm91dHB1dFRva2VucyxcbiAgICAwLFxuICApXG5cbiAgLy8gUm93IDE6IEZhdm9yaXRlIG1vZGVsIHwgVG90YWwgdG9rZW5zXG4gIGlmIChmYXZvcml0ZU1vZGVsKSB7XG4gICAgbGluZXMucHVzaChcbiAgICAgIHJvdyhcbiAgICAgICAgJ0Zhdm9yaXRlIG1vZGVsJyxcbiAgICAgICAgcmVuZGVyTW9kZWxOYW1lKGZhdm9yaXRlTW9kZWxbMF0pLFxuICAgICAgICAnVG90YWwgdG9rZW5zJyxcbiAgICAgICAgZm9ybWF0TnVtYmVyKHRvdGFsVG9rZW5zKSxcbiAgICAgICksXG4gICAgKVxuICB9XG4gIGxpbmVzLnB1c2goJycpXG5cbiAgLy8gUm93IDI6IFNlc3Npb25zIHwgTG9uZ2VzdCBzZXNzaW9uXG4gIGxpbmVzLnB1c2goXG4gICAgcm93KFxuICAgICAgJ1Nlc3Npb25zJyxcbiAgICAgIGZvcm1hdE51bWJlcihzdGF0cy50b3RhbFNlc3Npb25zKSxcbiAgICAgICdMb25nZXN0IHNlc3Npb24nLFxuICAgICAgc3RhdHMubG9uZ2VzdFNlc3Npb25cbiAgICAgICAgPyBmb3JtYXREdXJhdGlvbihzdGF0cy5sb25nZXN0U2Vzc2lvbi5kdXJhdGlvbilcbiAgICAgICAgOiAnTi9BJyxcbiAgICApLFxuICApXG5cbiAgLy8gUm93IDM6IEN1cnJlbnQgc3RyZWFrIHwgTG9uZ2VzdCBzdHJlYWtcbiAgY29uc3QgY3VycmVudFN0cmVha1ZhbCA9IGAke3N0YXRzLnN0cmVha3MuY3VycmVudFN0cmVha30gJHtzdGF0cy5zdHJlYWtzLmN1cnJlbnRTdHJlYWsgPT09IDEgPyAnZGF5JyA6ICdkYXlzJ31gXG4gIGNvbnN0IGxvbmdlc3RTdHJlYWtWYWwgPSBgJHtzdGF0cy5zdHJlYWtzLmxvbmdlc3RTdHJlYWt9ICR7c3RhdHMuc3RyZWFrcy5sb25nZXN0U3RyZWFrID09PSAxID8gJ2RheScgOiAnZGF5cyd9YFxuICBsaW5lcy5wdXNoKFxuICAgIHJvdygnQ3VycmVudCBzdHJlYWsnLCBjdXJyZW50U3RyZWFrVmFsLCAnTG9uZ2VzdCBzdHJlYWsnLCBsb25nZXN0U3RyZWFrVmFsKSxcbiAgKVxuXG4gIC8vIFJvdyA0OiBBY3RpdmUgZGF5cyB8IFBlYWsgaG91clxuICBjb25zdCBhY3RpdmVEYXlzVmFsID0gYCR7c3RhdHMuYWN0aXZlRGF5c30vJHtzdGF0cy50b3RhbERheXN9YFxuICBjb25zdCBwZWFrSG91clZhbCA9XG4gICAgc3RhdHMucGVha0FjdGl2aXR5SG91ciAhPT0gbnVsbFxuICAgICAgPyBgJHtzdGF0cy5wZWFrQWN0aXZpdHlIb3VyfTowMC0ke3N0YXRzLnBlYWtBY3Rpdml0eUhvdXIgKyAxfTowMGBcbiAgICAgIDogJ04vQSdcbiAgbGluZXMucHVzaChyb3coJ0FjdGl2ZSBkYXlzJywgYWN0aXZlRGF5c1ZhbCwgJ1BlYWsgaG91cicsIHBlYWtIb3VyVmFsKSlcblxuICAvLyBTcGVjdWxhdGlvbiB0aW1lIHNhdmVkIChhbnQtb25seSlcbiAgaWYgKFxuICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICBzdGF0cy50b3RhbFNwZWN1bGF0aW9uVGltZVNhdmVkTXMgPiAwXG4gICkge1xuICAgIGNvbnN0IGxhYmVsID0gJ1NwZWN1bGF0aW9uIHNhdmVkOicucGFkRW5kKENPTDFfTEFCRUxfV0lEVEgpXG4gICAgbGluZXMucHVzaChsYWJlbCArIGgoZm9ybWF0RHVyYXRpb24oc3RhdHMudG90YWxTcGVjdWxhdGlvblRpbWVTYXZlZE1zKSkpXG4gIH1cblxuICAvLyBTaG90IHN0YXRzIChhbnQtb25seSlcbiAgaWYgKGZlYXR1cmUoJ1NIT1RfU1RBVFMnKSAmJiBzdGF0cy5zaG90RGlzdHJpYnV0aW9uKSB7XG4gICAgY29uc3QgZGlzdCA9IHN0YXRzLnNob3REaXN0cmlidXRpb25cbiAgICBjb25zdCB0b3RhbFdpdGhTaG90cyA9IE9iamVjdC52YWx1ZXMoZGlzdCkucmVkdWNlKChzLCBuKSA9PiBzICsgbiwgMClcbiAgICBpZiAodG90YWxXaXRoU2hvdHMgPiAwKSB7XG4gICAgICBjb25zdCB0b3RhbFNob3RzID0gT2JqZWN0LmVudHJpZXMoZGlzdCkucmVkdWNlKFxuICAgICAgICAocywgW2NvdW50LCBzZXNzaW9uc10pID0+IHMgKyBwYXJzZUludChjb3VudCwgMTApICogc2Vzc2lvbnMsXG4gICAgICAgIDAsXG4gICAgICApXG4gICAgICBjb25zdCBhdmdTaG90cyA9ICh0b3RhbFNob3RzIC8gdG90YWxXaXRoU2hvdHMpLnRvRml4ZWQoMSlcbiAgICAgIGNvbnN0IGJ1Y2tldCA9IChtaW46IG51bWJlciwgbWF4PzogbnVtYmVyKSA9PlxuICAgICAgICBPYmplY3QuZW50cmllcyhkaXN0KVxuICAgICAgICAgIC5maWx0ZXIoKFtrXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbiA9IHBhcnNlSW50KGssIDEwKVxuICAgICAgICAgICAgcmV0dXJuIG4gPj0gbWluICYmIChtYXggPT09IHVuZGVmaW5lZCB8fCBuIDw9IG1heClcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5yZWR1Y2UoKHMsIFssIHZdKSA9PiBzICsgdiwgMClcbiAgICAgIGNvbnN0IHBjdCA9IChuOiBudW1iZXIpID0+IE1hdGgucm91bmQoKG4gLyB0b3RhbFdpdGhTaG90cykgKiAxMDApXG4gICAgICBjb25zdCBmbXRCdWNrZXQgPSAoY291bnQ6IG51bWJlciwgcDogbnVtYmVyKSA9PiBgJHtjb3VudH0gKCR7cH0lKWBcbiAgICAgIGNvbnN0IGIxID0gYnVja2V0KDEsIDEpXG4gICAgICBjb25zdCBiMl81ID0gYnVja2V0KDIsIDUpXG4gICAgICBjb25zdCBiNl8xMCA9IGJ1Y2tldCg2LCAxMClcbiAgICAgIGNvbnN0IGIxMSA9IGJ1Y2tldCgxMSlcbiAgICAgIGxpbmVzLnB1c2goJycpXG4gICAgICBsaW5lcy5wdXNoKCdTaG90IGRpc3RyaWJ1dGlvbicpXG4gICAgICBsaW5lcy5wdXNoKFxuICAgICAgICByb3coXG4gICAgICAgICAgJzEtc2hvdCcsXG4gICAgICAgICAgZm10QnVja2V0KGIxLCBwY3QoYjEpKSxcbiAgICAgICAgICAnMlxcdTIwMTM1IHNob3QnLFxuICAgICAgICAgIGZtdEJ1Y2tldChiMl81LCBwY3QoYjJfNSkpLFxuICAgICAgICApLFxuICAgICAgKVxuICAgICAgbGluZXMucHVzaChcbiAgICAgICAgcm93KFxuICAgICAgICAgICc2XFx1MjAxMzEwIHNob3QnLFxuICAgICAgICAgIGZtdEJ1Y2tldChiNl8xMCwgcGN0KGI2XzEwKSksXG4gICAgICAgICAgJzExKyBzaG90JyxcbiAgICAgICAgICBmbXRCdWNrZXQoYjExLCBwY3QoYjExKSksXG4gICAgICAgICksXG4gICAgICApXG4gICAgICBsaW5lcy5wdXNoKGAkeydBdmcvc2Vzc2lvbjonLnBhZEVuZChDT0wxX0xBQkVMX1dJRFRIKX0ke2goYXZnU2hvdHMpfWApXG4gICAgfVxuICB9XG5cbiAgbGluZXMucHVzaCgnJylcblxuICAvLyBGdW4gZmFjdG9pZFxuICBjb25zdCBmYWN0b2lkID0gZ2VuZXJhdGVGdW5GYWN0b2lkKHN0YXRzLCB0b3RhbFRva2VucylcbiAgbGluZXMucHVzaChoKGZhY3RvaWQpKVxuICBsaW5lcy5wdXNoKGNoYWxrLmdyYXkoYFN0YXRzIGZyb20gdGhlIGxhc3QgJHtzdGF0cy50b3RhbERheXN9IGRheXNgKSlcblxuICByZXR1cm4gbGluZXNcbn1cblxuZnVuY3Rpb24gcmVuZGVyTW9kZWxzVG9BbnNpKHN0YXRzOiBDbGF1ZGVDb2RlU3RhdHMpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdXG5cbiAgY29uc3QgbW9kZWxFbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc3RhdHMubW9kZWxVc2FnZSkuc29ydChcbiAgICAoWywgYV0sIFssIGJdKSA9PlxuICAgICAgYi5pbnB1dFRva2VucyArIGIub3V0cHV0VG9rZW5zIC0gKGEuaW5wdXRUb2tlbnMgKyBhLm91dHB1dFRva2VucyksXG4gIClcblxuICBpZiAobW9kZWxFbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIGxpbmVzLnB1c2goY2hhbGsuZ3JheSgnTm8gbW9kZWwgdXNhZ2UgZGF0YSBhdmFpbGFibGUnKSlcbiAgICByZXR1cm4gbGluZXNcbiAgfVxuXG4gIGNvbnN0IGZhdm9yaXRlTW9kZWwgPSBtb2RlbEVudHJpZXNbMF1cbiAgY29uc3QgdG90YWxUb2tlbnMgPSBtb2RlbEVudHJpZXMucmVkdWNlKFxuICAgIChzdW0sIFssIHVzYWdlXSkgPT4gc3VtICsgdXNhZ2UuaW5wdXRUb2tlbnMgKyB1c2FnZS5vdXRwdXRUb2tlbnMsXG4gICAgMCxcbiAgKVxuXG4gIC8vIEdlbmVyYXRlIGNoYXJ0IGlmIHdlIGhhdmUgZGF0YSAtIHVzZSBmaXhlZCB3aWR0aCBmb3Igc2NyZWVuc2hvdFxuICBjb25zdCBjaGFydE91dHB1dCA9IGdlbmVyYXRlVG9rZW5DaGFydChcbiAgICBzdGF0cy5kYWlseU1vZGVsVG9rZW5zLFxuICAgIG1vZGVsRW50cmllcy5tYXAoKFttb2RlbF0pID0+IG1vZGVsKSxcbiAgICA4MCwgLy8gRml4ZWQgd2lkdGggZm9yIHNjcmVlbnNob3RcbiAgKVxuXG4gIGlmIChjaGFydE91dHB1dCkge1xuICAgIGxpbmVzLnB1c2goY2hhbGsuYm9sZCgnVG9rZW5zIHBlciBEYXknKSlcbiAgICBsaW5lcy5wdXNoKGNoYXJ0T3V0cHV0LmNoYXJ0KVxuICAgIGxpbmVzLnB1c2goY2hhbGsuZ3JheShjaGFydE91dHB1dC54QXhpc0xhYmVscykpXG4gICAgLy8gTGVnZW5kIC0gdXNlIHByZS1jb2xvcmVkIGJ1bGxldHMgZnJvbSBjaGFydCBvdXRwdXRcbiAgICBjb25zdCBsZWdlbmRMaW5lID0gY2hhcnRPdXRwdXQubGVnZW5kXG4gICAgICAubWFwKGl0ZW0gPT4gYCR7aXRlbS5jb2xvcmVkQnVsbGV0fSAke2l0ZW0ubW9kZWx9YClcbiAgICAgIC5qb2luKCcgwrcgJylcbiAgICBsaW5lcy5wdXNoKGxlZ2VuZExpbmUpXG4gICAgbGluZXMucHVzaCgnJylcbiAgfVxuXG4gIC8vIFN1bW1hcnlcbiAgbGluZXMucHVzaChcbiAgICBgJHtmaWd1cmVzLnN0YXJ9IEZhdm9yaXRlOiAke2NoYWxrLm1hZ2VudGEuYm9sZChyZW5kZXJNb2RlbE5hbWUoZmF2b3JpdGVNb2RlbD8uWzBdIHx8ICcnKSl9IMK3ICR7ZmlndXJlcy5jaXJjbGV9IFRvdGFsOiAke2NoYWxrLm1hZ2VudGEoZm9ybWF0TnVtYmVyKHRvdGFsVG9rZW5zKSl9IHRva2Vuc2AsXG4gIClcbiAgbGluZXMucHVzaCgnJylcblxuICAvLyBNb2RlbCBicmVha2Rvd24gLSBvbmx5IHNob3cgdG9wIDMgZm9yIHNjcmVlbnNob3RcbiAgY29uc3QgdG9wTW9kZWxzID0gbW9kZWxFbnRyaWVzLnNsaWNlKDAsIDMpXG4gIGZvciAoY29uc3QgW21vZGVsLCB1c2FnZV0gb2YgdG9wTW9kZWxzKSB7XG4gICAgY29uc3QgbW9kZWxUb2tlbnMgPSB1c2FnZS5pbnB1dFRva2VucyArIHVzYWdlLm91dHB1dFRva2Vuc1xuICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSAoKG1vZGVsVG9rZW5zIC8gdG90YWxUb2tlbnMpICogMTAwKS50b0ZpeGVkKDEpXG4gICAgbGluZXMucHVzaChcbiAgICAgIGAke2ZpZ3VyZXMuYnVsbGV0fSAke2NoYWxrLmJvbGQocmVuZGVyTW9kZWxOYW1lKG1vZGVsKSl9ICR7Y2hhbGsuZ3JheShgKCR7cGVyY2VudGFnZX0lKWApfWAsXG4gICAgKVxuICAgIGxpbmVzLnB1c2goXG4gICAgICBjaGFsay5kaW0oXG4gICAgICAgIGAgIEluOiAke2Zvcm1hdE51bWJlcih1c2FnZS5pbnB1dFRva2Vucyl9IMK3IE91dDogJHtmb3JtYXROdW1iZXIodXNhZ2Uub3V0cHV0VG9rZW5zKX1gLFxuICAgICAgKSxcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGluZXNcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLFNBQVNDLElBQUksSUFBSUMsVUFBVSxRQUFRLFlBQVk7QUFDL0MsT0FBT0MsS0FBSyxNQUFNLE9BQU87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