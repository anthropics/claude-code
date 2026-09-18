# Local Sips

A small single-page web app that shows a city's local beers and wines along
with ratings and a map pinned with where to try them.

## Features

- City selector (Portland, Munich, Napa, Bordeaux, Tokyo)
- Filter by Beer / Wine / All
- Rating stars + numeric score for each drink
- Map pins color-coded by beverage type (OpenStreetMap tiles via Leaflet)
- Click a card to focus its pin, or click a pin to highlight its card

## Run

No build step. Just serve the folder and open `index.html`:

```sh
cd local-beverages-map
python3 -m http.server 8000
# then visit http://localhost:8000
```

Opening `index.html` directly from disk also works in most browsers.

## Files

- `index.html` — layout and script/stylesheet references
- `styles.css` — styling
- `data.js` — city + beverage data (edit to add more cities)
- `app.js` — rendering, filtering, map + list wiring

## Adding a city

Append an entry to `window.CITIES` in `data.js`. Each beverage needs
`type` (`"beer"` or `"wine"`), `name`, `venue`, `address`, `rating` (0-5),
`coords` (`[lat, lng]`), and a `description`.

## Notes

Ratings and locations are illustrative seed data, not live reviews.
