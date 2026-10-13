# Scorecard — Baseball Scorecard App

A sleek iPhone-first baseball scorecard web app with live advanced analytics.
No frameworks, no build step, no emojis — just HTML/CSS/JS so it can be dropped
on any static host or opened directly in Safari.

## Features

- **Scorecard grid.** Nine-batter lineup, 11 innings, per-at-bat cells that
  render the play shape (diamond fills for 1B/2B/3B/HR, letters for K/BB/etc.,
  and ovals for ground-ball outs) exactly like a paper book.
- **Play picker sheet.** Batting / Pitching / Other tabs with all 16 play types
  from the mockups.
- **Hit location sheet.** Interactive SVG diamond with 7 fielding zones,
  foul-left / no-hit / foul-right shortcuts, and a recent-plays strip.
- **Live game state.** Count, outs, pitches, inning, and half-inning all track
  automatically. Three outs flip sides, nine batters roll the order, runs tally
  per inning.
- **Advanced analytics — update as you score.** The Stats tab recomputes on
  every tap:
  - Slash line: AVG / OBP / SLG / OPS / ISO / BABIP
  - Situational: RISP, two-out RBI, LOB
  - Pitching: IP, ERA, WHIP, K/9, BB/9, P/IP
  - Run Expectancy (RE24) for the current base-out state
  - Leverage tag and Win Probability bar
  - Spray chart with pull / center / oppo splits
  - Top hitters leaderboard sorted by OPS
- **Persistence.** State auto-saves to `localStorage`.
- **PWA-ready.** Manifest + `apple-mobile-web-app` tags — "Add to Home Screen"
  on iPhone gives a full-screen standalone app.

## Run it

```
cd baseball-scorecard-app
python3 -m http.server 8080
```

Open `http://localhost:8080/` on desktop or your phone.

To load the demo state seen in the mockups, tap **More → Load Demo Game**.

## Project layout

```
baseball-scorecard-app/
├── index.html               app shell
├── manifest.webmanifest     PWA config
├── styles.css               design tokens + all views
├── src/
│   ├── store.js             state store, reducer, scoring rules
│   ├── analytics.js         slash line, RE24, WP, spray splits
│   ├── icons.js             inline SVG icon set (no emoji)
│   ├── app.js               app shell + router + tab bar
│   └── views/
│       ├── games.js
│       ├── scorecard.js
│       ├── playPicker.js
│       ├── hitLocation.js
│       ├── lineup.js
│       └── stats.js
└── test.js                  node smoke test of store + analytics
```

## Scoring model notes

- At-bat cells store `{ play, short, color, bases, rbi, pitches, runs, hitLocation }`.
- Pitcher stats track `outs` and derive IP as `outs / 3` so fractional innings
  display correctly (e.g. `2.2` = two and two-thirds).
- Win probability uses a coarse logistic of run-diff, inning, half, outs, and
  runners on base — good enough for a live game-context signal.
- RE24 values are the 2010s MLB base-out table.
- Spray split assumes a right-handed hitter: `LF/3B/SS` = pull, `CF/2B/P` =
  center, `RF/1B` = oppo. (A lefty flag is an obvious extension.)

## Tests

```
node test.js
```

Covers home-run base clearing, grand-slam run count, 3-K half-inning flip,
and slash-line calculations.
