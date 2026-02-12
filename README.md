# qz-workout-builder

Static web app to convert Runna workout text into `qdomyos-zwift` treadmill XML rows.

> Thanks to the `qdomyos-zwift` project: https://github.com/cagnulein/qdomyos-zwift  
> This builder is explicitly intended to generate workout XML files for use with the `qdomyos-zwift` app.

## Features

- Parse common Runna text blocks (warm up, cool down, distance + pace, walking rests)
- Handle basic repeats:
  - `Repeat the following 2x: ---------- ... ----------`
  - `3 reps of: 400m at 5:35/km, 60s walking rest`
- Input tabs:
  - `Runna Workout Text` (implemented)
  - `Runna Workout Image` (placeholder)
  - `Build your own` (placeholder)
- Unit slider for workout inputs and parsed preview: `km` or `miles`
- Conversational pace is configurable by the user
- Nested parsed rows preview with repeat blocks and section headers
- Keep original matched Runna text in parsed rows preview
- XML output unit toggle: `km` or `miles`
- Export XML with `forcespeed="1"` on every row
- Optional default incline (`inclination` attribute) for distance rows
- Download generated XML directly from the browser

## How to use it

1. Open the app and keep `Runna Workout Text` selected.
2. Paste your workout text in the text area.
3. In `Workout options`:
   - choose workout unit (`km` or `miles`)
   - set `Walking pace`
   - set `Conversational pace`
   - optionally set `Default incline`
4. Click `Generate workout`.
5. Review `Parsed rows` to verify structure and paces.
6. In `XML output`:
   - choose XML unit (`km` or `miles`)
   - click `Download XML`
7. Load the XML file in your treadmill workflow.

## Sample input/output

### Sample Runna text input

```text
2km warm up at a conversational pace (no faster than 7:05/km)
90s walking rest

Repeat the following 2x:
----------
3 reps of:
400m at 5:35/km (5:25-5:45/km), 60s walking rest
60s walking rest
----------

2km cool down at a conversational pace (or slower!)
```

### Sample XML output (km mode)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rows>
    <row distance="2" speed="7.4" forcespeed="1"/>
    <row duration="00:01:30" speed="4.0" forcespeed="1"/>
    <row distance="0.4" speed="10.7" forcespeed="1"/>
    <row duration="00:01:00" speed="4.0" forcespeed="1"/>
    ...
    <row distance="2" speed="7.4" forcespeed="1"/>
</rows>
```

Notes:
- Actual output includes all expanded repeats/rests.
- `speed` is exported in the selected XML unit mode (`km/h` or `mph`).
- `distance` is exported in the selected XML unit mode (`km` or `mi`).

## Supported text patterns

Current parser supports these common patterns:

- Warm up / cool down by distance:
  - `2km warm up at a conversational pace ...`
  - `2km cool down at a conversational pace ...`
- Pace intervals by distance:
  - `400m at 5:35/km`
  - `1.6km at 6:00/km`
- Walking rest by seconds:
  - `60s walking rest`
  - `120s walking rest`
- Repeats:
  - `Repeat the following 2x: ---------- ... ----------`
  - `3 reps of: 400m at 5:35/km, 60s walking rest`

Not currently supported:
- Arbitrary free-form wording outside these structures.
- Image/OCR parsing (placeholder tab only).
- Full custom builder flow (placeholder tab only).

## Run locally (dev)

```powershell
npm.cmd install
npm.cmd run dev
```

Then open the URL shown in terminal (usually `http://localhost:3000`).

## Run tests (optional)

```powershell
npm.cmd run test:e2e
```

## GitHub Pages

This project is fully static, so it works with GitHub Pages.

1. Push repository to GitHub.
2. In repository settings, enable Pages from the `main` branch root.
3. Open the published URL and use the converter directly on iPhone.

## Known limitations

- `Runna Workout Image` and `Build your own` tabs are not implemented yet.
- Parser focuses on current Runna text patterns and may miss uncommon wording.

## Troubleshooting

### `npm` not recognized in PowerShell

Use:

```powershell
npm.cmd run dev
```

### Page looks outdated after deploy

- Hard refresh browser (`Ctrl + F5`).
- On iPhone, close/reopen tab or clear site data.
- Wait 1-2 minutes for GitHub Pages to finish deploy.

### Parsed rows look wrong but XML looks right

- Confirm your input still matches supported patterns.
- Keep repeat separators as long dashes (`----------`).
- Share exact text input to improve parser coverage.

## TODO
- OCR flow: upload screenshot of Runna workout, extract text, then parse.

## Version / changelog

### v1.0.0

- First working release with:
  - Runna text parsing
  - Nested parsed-row visualization
  - Unit controls for workout and XML output
  - XML export/download for `qdomyos-zwift`
