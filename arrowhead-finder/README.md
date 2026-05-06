# Arrowhead Finder

A phone-first static web app for surface-hunters of Native American arrowheads.
Tap one big button when you find one — GPS is captured automatically — then add
a photo, size, and type in a follow-up sheet. Everything renders on a Leaflet
map, in a chronological gallery, and as simple analytics.

No frameworks, no build step, no emojis — just HTML/CSS/JS. Drop it on any
static host or open `index.html` directly in Safari.

## Features

- **One-tap logging.** A big "I Found One!" button captures GPS via
  `navigator.geolocation` and opens a details sheet. The find is created
  immediately so you can add photo/size/type later without losing the
  coordinates.
- **Classification.** Pick from common type categories (Clovis, Folsom,
  Dalton, Archaic Stemmed, Archaic Notched, Woodland Triangular, Mississippian
  Triangular, Other), material (chert, flint, obsidian, jasper, quartzite,
  quartz), and condition.
- **Size in mm or inches.** Toggle unit; stored internally in mm so analytics
  work regardless of what the user typed.
- **Photos, downscaled.** Added photos are read via `FileReader`, downscaled
  to max 1024 px long edge via a hidden canvas (JPEG, quality 0.75), and a
  128 px thumbnail is generated for the list and map popups so a gallery of
  200 finds doesn't decode 200 full-size images.
- **Map.** Leaflet + OpenStreetMap tiles. Arrowhead-SVG `divIcon` markers with
  popup previews. Filter chips (All / Clovis / Folsom / Archaic / Woodland /
  Other) and a "locate me" button.
- **Finds list.** Reverse-chronological, searchable by type / material / notes.
- **Analytics.** Total, days hunted, unique types, largest length; CSS bar
  charts for type / material / size; last-12-weeks timeline; top 5 "hotspots"
  as a text list of bucketed coordinates (no heatmap on purpose — see the
  responsible-use note below).
- **Groups + sharing.** Groups are local namespaces tagged by a shareable
  code (e.g. `FLINT-7QK`). Each find carries a `groupId`. Because this app has
  no backend, sharing with group-mates is explicit: **Export** downloads a
  JSON file with the group and all its finds; **Import** merges a partner's
  JSON back in, upserting by find id with last-write-wins on `updatedAt`.
  Trade files by AirDrop, email, iMessage, Signal, etc.
- **Persistence.** State lives in `localStorage` under key `arrowhead.v1`.
  The app warns and opens a "storage full" sheet on `QuotaExceededError`.
- **PWA-ready.** `manifest.webmanifest` + `apple-mobile-web-app` tags — "Add
  to Home Screen" on iPhone gives a full-screen standalone app.

## Run it

```
cd arrowhead-finder
python3 -m http.server 8080
```

Open `http://localhost:8080/` on desktop or your phone (same Wi-Fi). For
geolocation to work on iOS, you'll need to serve over HTTPS when accessing
from another device — Safari gives location on `http://localhost` but not on
plain-HTTP LAN IPs. The easiest path for on-phone testing is to add the site
to the Home Screen through a tunnel like `cloudflared`/`ngrok`.

## Project layout

```
arrowhead-finder/
├── index.html                  app shell
├── manifest.webmanifest        PWA config
├── styles.css                  design tokens + all views
├── src/
│   ├── store.js                state store, find/group CRUD, export/import
│   ├── analytics.js            totals, type/material/size bars, timeline, hotspots
│   ├── photo.js                FileReader + canvas downscaler, thumbnailer
│   ├── geo.js                  navigator.geolocation Promise wrapper + haversine
│   ├── icons.js                inline SVG icons (arrowhead, tab icons, etc.)
│   ├── app.js                  shell + tab router + sheet overlay host
│   └── views/
│       ├── log.js              "I Found One!" CTA + recent finds strip
│       ├── map.js              Leaflet map, markers, filter chips, locate-me
│       ├── finds.js            chronological list with search
│       ├── findDetail.js       full edit sheet for a single find
│       ├── analytics.js        KPI cards + bar charts + timeline + hotspots
│       └── groups.js           create/join/switch/export/import
└── test.js                     Node smoke test (store + analytics)
```

Scripts are loaded sequentially from `index.html` — no bundler.

## Data model

```json
{
  "schemaVersion": 1,
  "activeGroupId": "grp_...",
  "groups": {
    "grp_...": {
      "id": "grp_...", "code": "FLINT-7QK", "name": "Creek Bottom Crew",
      "createdAt": 1713657600000, "members": ["Dad", "Me"]
    }
  },
  "finds": {
    "fnd_...": {
      "id": "fnd_...", "groupId": "grp_...",
      "createdAt": 1713657600000, "updatedAt": 1713657600000,
      "finderName": "Me",
      "coords": { "lat": 35.1234, "lng": -85.6789, "accuracy": 8.2 },
      "type": "Clovis", "material": "chert",
      "size": { "lengthMm": 58, "widthMm": 22 },
      "condition": "intact",
      "notes": "Gray chert, fluted base, near streambed.",
      "photoDataUrl": "data:image/jpeg;base64,...",
      "thumbDataUrl": "data:image/jpeg;base64,..."
    }
  }
}
```

Export file format (produced by the Groups tab's **Export** button):

```json
{
  "format": "arrowhead-finder/group-export",
  "schemaVersion": 1,
  "exportedAt": 1713657600000,
  "group": { "id": "...", "code": "...", "name": "...", "members": [...] },
  "finds": [ ...find objects... ]
}
```

Import validates the `format` and `schemaVersion` fields, then upserts finds
by id with last-write-wins on `updatedAt`. The group is looked up by `code`
locally: if you've already joined the same code, incoming finds merge into
your existing local group record; otherwise a new group is created.

## Responsible use

GPS coordinates of arrowhead finds are sensitive. Surface-collected artifacts
and their locations can attract looters, and many jurisdictions have legal
protections for archaeological material:

- **Federal land in the US** — collecting prehistoric artifacts is generally
  prohibited under the Archaeological Resources Protection Act (ARPA) and the
  Antiquities Act. Don't surface-hunt or mark points on BLM, NPS, USFS, Corps
  of Engineers, tribal, or other public lands without the proper permit.
- **Human remains or cultural patrimony** — the Native American Graves
  Protection and Repatriation Act (NAGPRA) requires you to stop and contact
  the landowner and tribal authorities. Do not photograph, move, or log
  anything further.
- **State law varies.** Many states have additional rules for private land,
  waterways, and navigable rivers.
- **Get permission.** Only surface-hunt on private land where you have the
  owner's explicit permission.

This app keeps your data on your device. It never uploads anywhere unless you
explicitly export a JSON file and share it. The Analytics tab intentionally
shows top hotspots as rough bucketed coordinates (0.01° cells, ~1.1 km) and
does **not** render a heatmap, to reduce the chance that someone glancing at
your screen can pinpoint sites.

Treat exports like you'd treat a journal of your sites — share them only with
trusted group-mates.

## Tests

```
node test.js
```

Covers:

- Group creation + code regex
- Find creation (including rejection of missing coords / no active group)
- Analytics over a seeded set (type counts, size buckets sum, timeline, largest)
- Export → import roundtrip with idempotent re-import
- Last-write-wins update semantics
- `joinGroup` placeholder + import merging into the same local id
