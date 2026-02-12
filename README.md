# qz-workout-builder

Static web app to convert Runna workout text into `qdomyos-zwift` treadmill XML rows.

## Features

- Parse common Runna text blocks (warm up, cool down, distance + pace, walking rests)
- Handle basic repeats:
  - `Repeat the following 2x: ---------- ... ----------`
  - `3 reps of: 400m at 5:35/km, 60s walking rest`
- Unit modes for user targets:
  - `PACE (km)`
  - `PACE (miles)`
  - `KMH`
  - `MILES` (mph)
- Conversational pace is configurable by the user
- Convert pace to treadmill speed (`km/h`) for XML export
- Keep original matched Runna text in parsed rows preview
- Export XML using `forcespeed="1"` on every row
- Optional default incline (`inclination` attribute) for distance rows
- Download generated XML directly from the browser

## Run locally

Open `index.html` in a browser.

## GitHub Pages

This project is fully static, so it works with GitHub Pages.

1. Push repository to GitHub.
2. In repository settings, enable Pages from the `main` branch root.
3. Open the published URL and use the converter directly on iPhone.

## TODO

- OCR flow: upload screenshot of Runna workout, extract text, then parse.
