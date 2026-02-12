# qz-workout-builder

Static web app to convert Runna workout text into `qdomyos-zwift` treadmill XML rows.

## Features

- Parse common Runna text blocks (warm up, cool down, distance + pace, walking rests)
- Handle basic repeats:
  - `Repeat the following 2x: ---------- ... ----------`
  - `3 reps of: 400m at 5:35/km, 60s walking rest`
- Convert pace (`mm:ss/km`) to speed (`km/h`)
- Export XML using `forcespeed="1"` on every row
- Download generated XML directly from the browser

## Run locally

Open `index.html` in a browser.

## GitHub Pages

This project is fully static, so it works with GitHub Pages.

1. Push repository to GitHub.
2. In repository settings, enable Pages from the `main` branch root.
3. Open the published URL and use the converter directly on iPhone.
