const workoutInput = document.getElementById("workoutInput");
const buildInput = document.getElementById("buildInput");
const modeTextBtn = document.getElementById("modeTextBtn");
const modeImageBtn = document.getElementById("modeImageBtn");
const modeBuildBtn = document.getElementById("modeBuildBtn");
const textInputSection = document.getElementById("textInputSection");
const imageInputSection = document.getElementById("imageInputSection");
const buildInputSection = document.getElementById("buildInputSection");
const unitKmInput = document.getElementById("unitKm");
const unitMilesInput = document.getElementById("unitMiles");
const walkingTargetInput = document.getElementById("walkingTarget");
const conversationalTargetInput = document.getElementById("conversationalTarget");
const defaultInclineInput = document.getElementById("defaultIncline");
const walkingTargetLabel = document.getElementById("walkingTargetLabel");
const conversationalTargetLabel = document.getElementById("conversationalTargetLabel");
const parseBtn = document.getElementById("parseBtn");
const downloadBtn = document.getElementById("downloadBtn");
const rowsOutput = document.getElementById("rowsOutput");
const xmlOutput = document.getElementById("xmlOutput");
const statusOutput = document.getElementById("status");

const KM_PER_MILE = 1.60934;
let inputMode = "text";

function normalizePaceUnit(unitText) {
  if (!unitText) return "km";
  const unit = unitText.toLowerCase();
  return unit.startsWith("mi") ? "mi" : "km";
}

function currentUserUnit() {
  return unitMilesInput.checked ? "mi" : "km";
}

function parsePaceToKmh(paceText, unitText) {
  const match = paceText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const totalMinutes = mins + secs / 60;
  if (totalMinutes <= 0) return null;
  const unit = normalizePaceUnit(unitText);
  const distance = unit === "mi" ? KM_PER_MILE : 1;
  return (60 / totalMinutes) * distance;
}

function kmhToPace(kmh, unitText) {
  if (!Number.isFinite(kmh) || kmh <= 0) return "-";
  const unit = normalizePaceUnit(unitText);
  const perUnit = unit === "mi" ? kmh / KM_PER_MILE : kmh;
  const totalMinutes = 60 / perUnit;
  let mm = Math.floor(totalMinutes);
  let ss = Math.round((totalMinutes - mm) * 60);
  if (ss === 60) {
    mm += 1;
    ss = 0;
  }
  return `${String(mm)}:${String(ss).padStart(2, "0")}`;
}

function formatKmh(value) {
  return Number(value).toFixed(1);
}

function formatIncline(value) {
  return Number(value).toFixed(1);
}

function secondsToDuration(seconds) {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function normalizeText(raw) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/\u2022/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function expandRepeatFollowing(text) {
  let output = text;
  const repeatRegex = /Repeat the following\s+(\d+)x:\s*-+\s*([\s\S]*?)\s*-+/i;

  while (repeatRegex.test(output)) {
    output = output.replace(repeatRegex, (_, countStr, block) => {
      const count = Number(countStr);
      if (!Number.isFinite(count) || count < 1) return block;
      return Array.from({ length: count }, () => block.trim()).join(" ");
    });
  }
  return output;
}

function expandReps(text) {
  let output = text;
  const repsRegex = /(\d+)\s+reps of:\s*([0-9.]+\s*(?:km|m)\s+at\s+\d{1,2}:\d{2}\/(?:km|mi|mile|miles)(?:\s*\([^)]*\))?(?:,\s*\d+\s*s\s+walking rest)?)/i;

  while (repsRegex.test(output)) {
    output = output.replace(repsRegex, (_, countStr, block) => {
      const count = Number(countStr);
      if (!Number.isFinite(count) || count < 1) return block;
      return Array.from({ length: count }, () => block.trim()).join(" ");
    });
  }
  return output;
}

function toKilometers(value, unit) {
  const n = Number(value);
  if (unit.toLowerCase() === "m") return n / 1000;
  return n;
}

function parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, options = {}) {
  const expanded = options.expand === false
    ? normalizeText(text)
    : expandReps(expandRepeatFollowing(normalizeText(text)));
  const rows = [];

  const tokenRegex = /(\d+(?:\.\d+)?)\s*km\s+warm up[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles))?|(\d+(?:\.\d+)?)\s*km\s+cool down[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles))?|(\d+(?:\.\d+)?)\s*(km|m)\s+at\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles)(?:\s*\([^)]*\))?|(\d+)\s*s\s+walking rest/gi;

  let match;
  while ((match = tokenRegex.exec(expanded)) !== null) {
    const source = match[0].trim();
    if (match[1]) {
      const distance = Number(match[1]);
      const capPace = match[2];
      const capUnit = match[3];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({ distance, speedKmh, type: "warmup", source, incline: defaultIncline });
      continue;
    }

    if (match[4]) {
      const distance = Number(match[4]);
      const capPace = match[5];
      const capUnit = match[6];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({ distance, speedKmh, type: "cooldown", source, incline: defaultIncline });
      continue;
    }

    if (match[7]) {
      const distance = toKilometers(match[7], match[8]);
      const pace = match[9];
      const paceUnit = match[10];
      const speedKmh = parsePaceToKmh(pace, paceUnit);
      if (speedKmh) {
        rows.push({
          distance: Number(distance.toFixed(3)),
          speedKmh,
          type: "run",
          source,
          incline: defaultIncline
        });
      }
      continue;
    }

    if (match[11]) {
      const seconds = Number(match[11]);
      rows.push({
        duration: secondsToDuration(seconds),
        speedKmh: walkingSpeedKmh,
        type: "walkrest",
        source
      });
    }
  }

  return rows;
}

function parseSegmentRows(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  if (!text || !text.trim()) return [];
  return parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, { expand: false });
}

function parseBlockItems(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const items = [];
  const block = normalizeText(text);
  if (!block) return items;

  const repsRegex = /(\d+)\s+reps of:\s*([\s\S]*)/i;
  const repsMatch = block.match(repsRegex);

  if (repsMatch) {
    const repsCount = Number(repsMatch[1]);
    const repsBody = repsMatch[2] || "";
    const parsedRows = parseSegmentRows(repsBody, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);

    // Runna "N reps of" usually means one run step (+ optional immediate rest) repeated N times.
    let consumeCount = 0;
    if (parsedRows[0]) {
      consumeCount = 1;
      if (parsedRows[1] && parsedRows[1].type === "walkrest") {
        consumeCount = 2;
      }
    }

    const innerRows = parsedRows
      .slice(0, consumeCount)
      .map((row) => ({ kind: "row", row }));
    if (innerRows.length) {
      items.push({ kind: "group", label: `Repeat x${repsCount}`, items: innerRows });
    }
    const tailRows = parsedRows
      .slice(consumeCount)
      .map((row) => ({ kind: "row", row }));
    return items.concat(tailRows);
  }

  return parseSegmentRows(block, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
    .map((row) => ({ kind: "row", row }));
}

function buildDisplayItems(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const normalized = normalizeText(text);
  const items = [];
  const repeatRegex = /Repeat the following\s+(\d+)x:\s*-+\s*([\s\S]*?)\s*-+/gi;
  let cursor = 0;
  let match;

  while ((match = repeatRegex.exec(normalized)) !== null) {
    const before = normalized.slice(cursor, match.index).trim();
    if (before) {
      items.push(
        ...parseSegmentRows(before, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
          .map((row) => ({ kind: "row", row }))
      );
    }

    const repeatCount = Number(match[1]);
    const blockText = match[2] || "";
    items.push({
      kind: "group",
      label: `Repeat x${repeatCount}`,
      items: parseBlockItems(blockText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
    });
    cursor = match.index + match[0].length;
  }

  const after = normalized.slice(cursor).trim();
  if (after) {
    items.push(
      ...parseSegmentRows(after, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
        .map((row) => ({ kind: "row", row }))
    );
  }

  return items;
}

function generateXml(rows) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<rows>"];
  for (const row of rows) {
    const speed = formatKmh(row.speedKmh);
    if (row.distance !== undefined) {
      const incline = Number.isFinite(row.incline) ? ` inclination="${formatIncline(row.incline)}"` : "";
      lines.push(`    <row distance="${row.distance}" speed="${speed}" forcespeed="1"${incline}/>`);
    } else {
      lines.push(`    <row duration="${row.duration}" speed="${speed}" forcespeed="1"/>`);
    }
  }
  lines.push("</rows>");
  return lines.join("\n");
}

function countDisplayRows(items) {
  let count = 0;
  for (const item of items) {
    if (item.kind === "row") {
      count += 1;
    } else if (item.kind === "group") {
      count += countDisplayRows(item.items || []);
    }
  }
  return count;
}

function renderRows(items, userUnit) {
  if (!items.length || !countDisplayRows(items)) {
    rowsOutput.innerHTML = "<p>No workout steps recognized. Try a simpler format first.</p>";
    return;
  }

  const paceSuffix = userUnit === "mi" ? "/mi" : "/km";
  let step = 1;

  function rowSectionLabel(type) {
    if (type === "warmup") return "Warm-Up";
    if (type === "cooldown") return "Cool Down";
    if (type === "walkrest") return "Rest";
    return "Run";
  }

  function groupRowsIntoSections(entryItems) {
    const grouped = [];
    let lastSection = null;

    for (const item of entryItems) {
      if (item.kind === "row") {
        const label = rowSectionLabel(item.row.type);
        if (lastSection && lastSection.kind === "section" && lastSection.label === label) {
          lastSection.items.push(item);
        } else {
          lastSection = { kind: "section", label, items: [item] };
          grouped.push(lastSection);
        }
      } else {
        lastSection = null;
        grouped.push(item);
      }
    }

    return grouped;
  }

  function renderRowItem(row) {
    const target = row.distance !== undefined ? `${row.distance} km` : row.duration;
    const incline = Number.isFinite(row.incline) ? ` | incline ${formatIncline(row.incline)}%` : "";
    const speedAndPace = `${formatKmh(row.speedKmh)} km/h | ${kmhToPace(row.speedKmh, userUnit)}${paceSuffix}`;
    const html = `<div class="row-item"><span>#${step}</span><span>${row.type}</span><span>${target}${incline}</span><span>${speedAndPace}</span><div class="row-source">${row.source}</div></div>`;
    step += 1;
    return html;
  }

  function renderItems(entryItems, depth = 0) {
    const groupedItems = groupRowsIntoSections(entryItems);

    return groupedItems.map((item) => {
      if (item.kind === "group") {
        return `<div class="repeat-block depth-${depth}"><div class="repeat-header repeat-header-repeat">${item.label}</div><div class="repeat-body">${renderItems(item.items || [], depth + 1)}</div></div>`;
      }

      if (item.kind === "section") {
        const sectionClass = `repeat-header-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
        const sectionRows = (item.items || []).map((entry) => renderRowItem(entry.row)).join("");
        return `<div class="repeat-block depth-${depth}"><div class="repeat-header ${sectionClass}">${item.label}</div><div class="repeat-body">${sectionRows}</div></div>`;
      }

      return renderRowItem(item.row);
    }).join("");
  }

  const html = renderItems(items);
  rowsOutput.innerHTML = html;
}

function setStatus(message, isError = false) {
  statusOutput.textContent = message;
  statusOutput.className = isError ? "status error" : "status";
}

function setInputMode(mode) {
  inputMode = mode;
  const modes = [
    { key: "text", button: modeTextBtn, section: textInputSection },
    { key: "image", button: modeImageBtn, section: imageInputSection },
    { key: "build", button: modeBuildBtn, section: buildInputSection }
  ];

  for (const item of modes) {
    const selected = item.key === mode;
    item.button.classList.toggle("active", selected);
    item.button.setAttribute("aria-selected", selected ? "true" : "false");
    item.section.classList.toggle("active", selected);
  }
}

function updatePaceLabels(unit) {
  const suffix = unit === "mi" ? "mi" : "km";
  walkingTargetLabel.textContent = `Walking pace (mm:ss/${suffix})`;
  conversationalTargetLabel.textContent = `Conversational pace (mm:ss/${suffix})`;
}

function convertUserPaceInputs(prevUnit, nextUnit) {
  const walkingKmh = parsePaceToKmh(walkingTargetInput.value.trim(), prevUnit);
  const conversationalKmh = parsePaceToKmh(conversationalTargetInput.value.trim(), prevUnit);
  if (Number.isFinite(walkingKmh)) {
    walkingTargetInput.value = kmhToPace(walkingKmh, nextUnit);
  }
  if (Number.isFinite(conversationalKmh)) {
    conversationalTargetInput.value = kmhToPace(conversationalKmh, nextUnit);
  }
}

function onUnitChange() {
  const nextUnit = currentUserUnit();
  const prevUnit = nextUnit === "mi" ? "km" : "mi";
  convertUserPaceInputs(prevUnit, nextUnit);
  updatePaceLabels(nextUnit);
}

unitKmInput.addEventListener("change", onUnitChange);
unitMilesInput.addEventListener("change", onUnitChange);
modeTextBtn.addEventListener("click", () => setInputMode("text"));
modeImageBtn.addEventListener("click", () => setInputMode("image"));
modeBuildBtn.addEventListener("click", () => setInputMode("build"));

parseBtn.addEventListener("click", () => {
  const text = inputMode === "text" ? workoutInput.value.trim() : buildInput.value.trim();
  const userUnit = currentUserUnit();
  const walkingSpeedKmh = parsePaceToKmh(walkingTargetInput.value.trim(), userUnit);
  const conversationalSpeedKmh = parsePaceToKmh(conversationalTargetInput.value.trim(), userUnit);
  const defaultInclineRaw = defaultInclineInput.value.trim();
  const defaultIncline = defaultInclineRaw === "" ? null : Number(defaultInclineRaw);

  if (inputMode === "image") {
    setStatus("Runna Workout Image mode is not implemented yet.", true);
    return;
  }

  if (inputMode === "build") {
    setStatus("Build your own mode is not implemented yet.", true);
    return;
  }

  if (!text) {
    setStatus("Paste a workout text first.", true);
    return;
  }

  if (!Number.isFinite(walkingSpeedKmh) || !Number.isFinite(conversationalSpeedKmh)) {
    setStatus("Provide valid walking and conversational paces in mm:ss format.", true);
    return;
  }

  if (defaultInclineRaw !== "" && !Number.isFinite(defaultIncline)) {
    setStatus("Default incline must be a number when provided.", true);
    return;
  }

  const rows = parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  const displayItems = buildDisplayItems(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  if (!rows.length) {
    renderRows([], userUnit);
    xmlOutput.value = "";
    downloadBtn.disabled = true;
    setStatus("No recognizable workout steps were found.", true);
    return;
  }

  const xml = generateXml(rows);
  renderRows(displayItems, userUnit);
  xmlOutput.value = xml;
  downloadBtn.disabled = false;
  setStatus(`Generated ${rows.length} rows.`);
});

downloadBtn.addEventListener("click", () => {
  const xml = xmlOutput.value.trim();
  if (!xml) return;

  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "workout.xml";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

workoutInput.value = `2km warm up at a conversational pace (no faster than 7:05/km)
90s walking rest

Repeat the following 2x:
----------
3 reps of:
400m at 5:35/km (5:25-5:45/km), 60s walking rest
60s walking rest
----------

2km cool down at a conversational pace (or slower!)`;
updatePaceLabels(currentUserUnit());
setInputMode("text");
