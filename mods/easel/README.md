# easel

Draws charts in the transcript of Claude Code. There are two ways to get one:

- **Claude asks.** It calls `mcp__easel__chart` on a tool result it already has, or on a table it passes itself, and names the columns (`x`, `y`, `by`). Where the call leaves a real choice open, the tool refuses, lists the columns it found, and Claude calls again.
- **Nobody asks.** An automatic line chart appears under another MCP tool's result, but only if that result is the answer of a metrics service, such as Prometheus or Datadog (`METRIC_FORMATS`), or frames of Grafana's that say they are time series, with no unread value and no second table that may hold a number or a time. Such an answer says itself what is time, value and label. Any other table may hold numbers that measure nothing, such as an id or a postcode, so Claude has to ask.

| form | what it shows | axis |
| --- | --- | --- |
| `line` | up to 8 series | time |
| `columns` | one column per period, stacked where the values add up | time |
| `sparks` | a small strip beside each of up to 40 names | time |
| `bars` | one bar per name | category |
| `share` | the parts of a whole as one bar | category |

A call that names a form over time for an x that holds only names is drawn as bars, and a note says so: no other form fits. That takes a bar for each name. Past the count of bars they would be ranked and cut, so the call is refused.

A terminal gets text cells. The desktop, mobile and VS Code apps get an SVG as wide as their pane. A headless session that no app has joined gets no tool and no chart, though its system prompt has the hint, which an app joining later must not change. A loop whose conversation the host does not keep, such as the one that suggests the next prompt, is refused a chart, and the call is not counted.

Settings (`/config`): `autoCharts` turns automatic charts off. `autoChartSkip` names MCP servers that never get one.

## How it works

```
text ─ readData ─▶ Data, or a refusal
Data ─ chartOf ─▶ Chart ─ sceneOf(columns) ─▶ Scene ─ rasterOf ─▶ terminal rows
                                                    └ svgOf ───▶ SVG
```

1. **Refuse early, then always draw.** Whatever `readData` returns can be drawn, so no later stage has an error path.
2. **Guess nothing.** A cell is read in full, or it is counted and the count is stated. A choice between two readings belongs to the caller.
3. **Write every word once.** `chartOf` makes all words and positions before any width is known. The painters get text and places, never data, so the terminal, the image and the model's text cannot disagree.
4. **Store nothing.** A redraw reads the same row of the transcript again. The cache in `register.ts` only saves work, but for one note, one race and one rewrite (see Known gaps).

| folder | what it holds |
| --- | --- |
| `hooks/register.ts`, `answered-calls/`, `meet-watcher/`, `record-use/`, `with-newest-chart/`, `shell/`, `view/` | the hooks; the four functions that they hand the host's `$` to; the helpers that take what the hooks read; the element trees they return |
| `core/easel/` | the two entry points, `chartFromCall` and `chartFromResult` |
| `core/call/`, `forms/` | what the model reads about the tool; the forms and their limits |
| `core/tables/`, `wire/`, `json/` | a text to tables; the metric formats |
| `core/cells/`, `calendar/` | one cell to a number or a time; calendar steps and ticks |
| `core/casting/`, `reading/`, `column-summary/` | the roles of a table's columns; tables to series, and every reason to refuse |
| `core/refusal/`, `usage/` | the code of each refusal; what telemetry is told |
| `core/charting/`, `numbers/` | series to words and positions |
| `core/layout/`, `shapes/` | words and positions to shapes in cells |
| `core/raster/`, `svg/` | the two painters |
| `core/texts/`, `lists/` | text width and truncation; list helpers |

A hooks module may import only its own files and the types of `claude-code`, so `texts/` and `lists/` carry their own helpers. Each folder holds one declaration a file and is read through its `index.ts`, except where that would close an import cycle: two types that name each other share a file, and a file imports another folder's file directly instead of its `index.ts`.

## How to add things

- **A metric format:** a row in `METRIC_FORMATS` (`wire/`). The first format whose paths all lead somewhere wins. A shape that code reads instead names its key in `KEYS_OF_SHAPES`: unasked, a result with the keys of no shape is not read.
- **An option:** a field in `INPUT_SCHEMA` (`call/`); the type and the validator derive from it. Use it in `reading/` if it changes what is read, else in `chartOf`.
- **A form:** the enum in `call/`, a row in `FORMS`, `READ_AS` in `casting/`, `formProblemIn` in `reading/`, a member of `Chart`, and a `case` in `sceneOf`. A new shape fails to compile until both painters handle it.
- **A refusal:** a `{ code, why }`. A new code goes in `REFUSAL_CODES` (`refusal/`), and a case must get it. The event has room for 31. Past that, fold rare codes into one word there: a mark's reason has no such limit.

## Telemetry

No text of the data is sent: every word is one that the plugin spells itself (`usage/`). Three numbers depend on the data: how many series, how many points, and the time to read them and lay them out. Each is rounded down to a power of two. The host refuses any other entry, takes none from an installed copy, and sends nothing where analytics are off.

| what | when | says |
| --- | --- | --- |
| mark `easel_chart` | Claude asks | `ok`; `sad` `data_left_out`, where a note says that cells, tables or lines are not in the chart (series with no value, or over a form's limit, do not count); `sad` `form_replaced`, where bars were drawn for a form over time; `bad` with the refusal's code |
| mark `easel_auto` | nobody asks | `ok`; `bad` `failed` for a crash. A result that gives no chart is not marked: that is nearly every MCP result |
| event `tengu_plugin_easel_chart` | with each mark | the outcome, the form, whether the call named it and whether bars took its place, the format, where the data came from, the three numbers, the surfaces, and whether a subagent called |
| event `tengu_plugin_easel_settings` | somebody comes to watch | `off` or `skips_servers`, only where the user changed `autoCharts` or `autoChartSkip`. It can repeat in a session |

## Limits

- **Input:** under 64 KiB, 200 columns and 262,144 cells, and JSON nested at most 32 deep. A result that was cut short is refused.
- **Width:** a terminal chart takes 40 to 1,000 cells, an image 40 to 100. With less room, the model's text is shown instead.
- **A narrow pane:** nothing is painted past the edge. The last stats give way first, then names are cut. The model's text keeps them all.
- **Many series:** the largest are drawn and a note counts the rest. A stack and a share draw the rest as one grey part.
- **No guesses:** `06/01/2026`, `1.000,50` and a bare number beside `$12,400` are refused, with the reason. Rows are not counted and times are not put in buckets.
- **Also read:** rows of named fields in XML, where the text opens with a tag, as some query tools answer; the answer of Google Sheets: `values` by rows beside `range`, with the names in the first row.
- **Only when asked:** every table that no metrics service answered. Text aligned with spaces (`df -h`) and tables with no header are likely, not certain. A result with a stray line, an unread cell or a second table that may hold numbers or times is charted in part, and a note says so.
- **The model's text** is at most 8,000 characters, and is also the alt text of the image.
- **An automatic chart** adds one fixed sentence to what the model reads. The host sends a hook's `context` as a system reminder, unescaped, so nothing from a result may go there.
- **A screen reader** gets text in place of cells. Built in, easel takes the host's answer, `--ax-screen-reader` included. Installed, it reads `CLAUDE_AX_SCREEN_READER`; when that variable is unset or not a yes/no value, it takes `axScreenReader` from the first of managed, `--settings` or user settings that has it, never from project or local settings. It can't tell when `--setting-sources` leaves user settings out, so it may then still draw charts as text.

## Known gaps

- **A loop with no kept conversation:** a workflow's agent is refused a chart. So is a forked skill that sets `background: false` where transcripts are not saved, whose charts no screen showed.
- **Hint:** a session whose system prompt leaves out the environment section (`excludeDynamicSections`, or `--system-prompt`) never has it, and a thread recorded without it does not gain it on a resume.
- **A resumed conversation:** in a terminal, its first prompt waits up to 500 ms for the chart tool, or the host tells the model that the tool was removed. The host can still tell it so past that wait, and in a turn that resumes by itself with no prompt. Where the tool is never listed (its server turned off in `/mcp` or blocked by a policy, an agent without it), every resume waits the whole 500 ms.
- **A result rewritten after its tool answers:** an automatic chart draws the rewritten result, and only where the first answer held a chart too. The note to the model and the usage mark are settled as the tool answers, so they can tell of a chart that was not drawn.
- **A closed run of calls on an app:** an automatic chart is drawn under it. A chart that Claude asks for is drawn at its own call's row alone, so a page that asks for that row only once the call is opened shows the chart only then.
- **Host:** after `--continue` a chart call's header row can be missing until a resize. A plugin is handed the newest 4,096 messages, so an older chart call has no chart after a resume, and an older row has none on an app. On an app, a row whose transcript read fails has no chart until the pane is resized.
- **A chart call in one batch with its query:** the host starts a call as soon as the one before it ends, some milliseconds before that one's answer is written. So a call with no `data` can read the result before it: it is refused, or draws an older table that has the same columns, and a redraw then shows another chart. Built in and in the main conversation, it waits: it reads the transcript again until that holds an answer of every other tool's call made before it in the turn (`answeredCalls`). After 5 waits, 310 ms in all, it takes the transcript as it is, since some calls are listed and never answered. An installed copy does not wait. The race can also hide the answer of a call that gives no table: after `[query, another tool]` in its batch, a chart call that does not wait draws the query's result, until a redraw, and one that waits is refused.
- **Which result a call with no `data` reads:** the last in the order of the calls that is not empty, not failed and not a chart's. After a batch of queries, a call that names the columns of an earlier one is refused. Where the query before it failed, it draws the last result that did not.
- **Not read:** the expanded form of `psql`, `YYYYMMDD` dates, two header lines (`vmstat`), the envelopes of Snowflake and Databricks, and the compact rows of ClickHouse.
- **Apps that show a tool's own widget:** the desktop app draws the widget in place of the tool's row and asks for no plugin drawing there. An automatic chart of such a result, as of Datadog's own MCP server, is told to Claude and shown to nobody. A chart that Claude asks for is shown.
- **The last point of an automatic chart:** that its period was not over at the call is said unless the service reads each value at its time (`isReadAtInstants`), as Prometheus does. No host stores when another tool answered, so a redraw that the cache no longer serves, as after a restart, draws the same lines without that note.
- **Clock changes:** an even step of under a day is looked for in UTC alone.
- **A terminal cell has one ink** (two in a stack). Of lines that share a cell, the one with the most dots shows. A part of a stack thinner than a row can be missing, and a note then says so.

## Try it

```sh
claude --plugin-dir mods/easel
```

then ask Claude for a chart of a table, or of a tool's result.

## Tests

```sh
claude plugin test mods/easel
```

`tests/register.test.ts` covers the three ways a result ends: a chart call draws, the answer of a metrics service gets an automatic chart, and any other answer gets none.
