# qz-workout-builder

Static web app to convert Runna workouts into `qdomyos-zwift` treadmill XML rows.

> Thanks to the `qdomyos-zwift` project: https://github.com/cagnulein/qdomyos-zwift  
> This builder is explicitly intended to generate workout XML files for use with the `qdomyos-zwift` app.

## Features

- Three input modes:
  - `Runna Workout Text`: paste workout text and parse it.
  - `Runna Workout Image`: upload a screenshot and parse with OCR.
  - `Build your own`: create blocks manually with drag and drop.
- Text parser support for common Runna structures:
  - warm-up/cool-down
  - distance + pace or speed blocks
  - walking rest blocks
  - repeat patterns (`Repeat xN`, `N reps of`)
- OCR workflow (Image tab):
  - OCR engine selector (`Auto`, `Scribe`, `Tesseract`)
  - optional image preprocessing
  - uploaded image preview
  - automatic unit detection (`km`/`miles`) from OCR text
  - OCR debug text logged to browser console
- Build mode:
  - add/remove/reorder blocks
  - nest blocks inside repeat blocks
  - choose run input mode (`Pace` or `Speed`)
  - generate XML from builder blocks
- Shared workout options:
  - `Unit` slider (`km` / `miles`)
  - `Walking` and `Conversational` target fields
  - optional default incline for distance rows
- Smart input handling:
  - normalizes incomplete values (for example `20` -> `20:00`)
  - invalid edits revert to the last valid value
- Parsed rows view:
  - grouped sections and nested repeat blocks
  - action color coding
  - `Edit` button to copy parsed rows into Build mode
- XML output:
  - always includes `forcespeed="1"`
  - supports distance rows (`distance`) and rest rows (`duration`)
  - XML unit toggle (`km`/`miles`) regenerates from cached rows (no OCR rerun)
  - download XML directly from browser

## How To Use

### 1. Runna Workout Text

1. Open `Runna Workout Text` tab.
2. Paste your workout text.
3. Configure `Workout options`.
4. Click `Generate workout`.
5. Review `Parsed rows`.
6. In `XML output`, choose XML unit and click `Download XML`.

### 2. Runna Workout Image

1. Open `Runna Workout Image` tab.
2. Upload a Runna screenshot.
3. Choose OCR settings if needed.
4. Click `Generate workout`.
5. Review parsed rows carefully (OCR is not 100% reliable).
6. Use `Edit` to send the parsed workout to Build mode for manual correction.
7. Download XML when satisfied.

### 3. Build your own

1. Open `Build your own` tab.
2. Add and reorder blocks.
3. Use repeat blocks for intervals.
4. Choose whether run inputs are entered as `Pace` or `Speed`.
5. Click `Generate XML` and then `Download XML`.

## XML Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rows>
    <row distance="2" speed="7.4" forcespeed="1"/>
    <row duration="00:01:30" speed="4.0" forcespeed="1"/>
    <row distance="0.4" speed="10.7" forcespeed="1"/>
</rows>
```

Notes:
- `speed` is exported in selected XML output unit (`km/h` or `mph`).
- `distance` is exported in selected XML output unit (`km` or `mi`).
- `duration` uses `HH:MM:SS`.

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the URL shown in terminal (usually `http://localhost:3000`).

## Run Tests

```powershell
npm.cmd run test:e2e
```

## GitHub Pages

This project is static and deploys to GitHub Pages.

1. Push to GitHub.
2. In repository settings, enable Pages from `main` branch root.
3. Open the published URL.

## Known Limitations

- OCR quality depends on screenshot quality, crop, and UI overlays.
- Some OCR outputs still need manual correction in Build mode.
- Free-form workout wording outside supported patterns may parse incorrectly.

## Troubleshooting

### `npm` not recognized in PowerShell

Use:

```powershell
npm.cmd run dev
```

### Parsed rows look wrong

- Check OCR tab warning and review parsed rows before download.
- Use `Edit` to move parsed workout into Build mode and correct blocks.
- If text mode fails, share the exact workout text for parser improvements.

## License Notes

- This repository is currently marked as `ISC`.
- If you use `scribe.js-ocr` in distributed/public deployments, review AGPL-3.0 obligations.

## Changelog

### v1.1.0

- Added full Image OCR workflow and Build mode workflow.
- Added unit auto-detection from OCR text.
- Added cached XML-unit switching (no OCR rerun).
- Added live target updates and stronger input normalization/validation.
- Added parser improvements for noisy OCR screenshot headers/toolbars.
