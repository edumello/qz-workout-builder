const workoutInput = document.getElementById("workoutInput");
const unitModeInput = document.getElementById("unitMode");
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
let previousMode = unitModeInput.value;

function normalizePaceUnit(unitText) {
  if (!unitText) return "km";
  const unit = unitText.toLowerCase();
  return unit.startsWith("mi") ? "mi" : "km";
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
  const mm = Math.floor(totalMinutes);
  const ss = Math.round((totalMinutes - mm) * 60);
  if (ss === 60) {
    return `${String(mm + 1)}:00`;
  }
  return `${String(mm)}:${String(ss).padStart(2, "0")}`;
}

function formatKmh(value) {
  return Number(value).toFixed(1);
}

function formatMphFromKmh(value) {
  return (Number(value) / KM_PER_MILE).toFixed(1);
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

function parseTargetToKmh(targetText, mode) {
  if (mode === "speed_kmh") {
    const value = Number(targetText);
    return Number.isFinite(value) ? value : null;
  }
  if (mode === "speed_mph") {
    const value = Number(targetText);
    return Number.isFinite(value) ? value * KM_PER_MILE : null;
  }
  if (mode === "pace_km") {
    return parsePaceToKmh(targetText, "km");
  }
  if (mode === "pace_mile") {
    return parsePaceToKmh(targetText, "mi");
  }
  return null;
}

function formatSpeedForDisplay(kmh, mode) {
  if (mode === "speed_mph") return `${formatMphFromKmh(kmh)} mph`;
  if (mode === "pace_km") return `${kmhToPace(kmh, "km")}/km`;
  if (mode === "pace_mile") return `${kmhToPace(kmh, "mi")}/mi`;
  return `${formatKmh(kmh)} km/h`;
}

function formatTargetFromKmh(kmh, mode) {
  if (mode === "speed_mph") return formatMphFromKmh(kmh);
  if (mode === "pace_km") return kmhToPace(kmh, "km");
  if (mode === "pace_mile") return kmhToPace(kmh, "mi");
  return formatKmh(kmh);
}

function parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const expanded = expandReps(expandRepeatFollowing(normalizeText(text)));
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
      rows.push({
        distance,
        speedKmh,
        type: "warmup",
        source,
        incline: defaultIncline
      });
      continue;
    }

    if (match[4]) {
      const distance = Number(match[4]);
      const capPace = match[5];
      const capUnit = match[6];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({
        distance,
        speedKmh,
        type: "cooldown",
        source,
        incline: defaultIncline
      });
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

function renderRows(rows, mode) {
  if (!rows.length) {
    rowsOutput.innerHTML = "<p>No workout steps recognized. Try a simpler format first.</p>";
    return;
  }

  const html = rows
    .map((row, idx) => {
      const target = row.distance !== undefined ? `${row.distance} km` : row.duration;
      const incline = Number.isFinite(row.incline) ? ` | incline ${formatIncline(row.incline)}%` : "";
      return `<div class="row-item"><span>#${idx + 1}</span><span>${row.type}</span><span>${target}${incline}</span><span>${formatSpeedForDisplay(row.speedKmh, mode)}</span><div class="row-source">${row.source}</div></div>`;
    })
    .join("");
  rowsOutput.innerHTML = html;
}

function setStatus(message, isError = false) {
  statusOutput.textContent = message;
  statusOutput.className = isError ? "status error" : "status";
}

function updateTargetLabels() {
  const mode = unitModeInput.value;
  if (mode === "pace_km") {
    walkingTargetLabel.textContent = "Walking pace (mm:ss/km)";
    conversationalTargetLabel.textContent = "Conversational pace (mm:ss/km)";
    return;
  }
  if (mode === "pace_mile") {
    walkingTargetLabel.textContent = "Walking pace (mm:ss/mi)";
    conversationalTargetLabel.textContent = "Conversational pace (mm:ss/mi)";
    return;
  }
  if (mode === "speed_mph") {
    walkingTargetLabel.textContent = "Walking speed (mph)";
    conversationalTargetLabel.textContent = "Conversational pace (mph)";
    return;
  }
  walkingTargetLabel.textContent = "Walking speed (km/h)";
  conversationalTargetLabel.textContent = "Conversational pace (km/h)";
}

unitModeInput.addEventListener("change", () => {
  const nextMode = unitModeInput.value;
  const walkingKmh = parseTargetToKmh(walkingTargetInput.value.trim(), previousMode);
  const conversationalKmh = parseTargetToKmh(conversationalTargetInput.value.trim(), previousMode);
  if (Number.isFinite(walkingKmh)) {
    walkingTargetInput.value = formatTargetFromKmh(walkingKmh, nextMode);
  }
  if (Number.isFinite(conversationalKmh)) {
    conversationalTargetInput.value = formatTargetFromKmh(conversationalKmh, nextMode);
  }
  previousMode = nextMode;
  updateTargetLabels();
});

parseBtn.addEventListener("click", () => {
  const text = workoutInput.value.trim();
  const mode = unitModeInput.value;
  const walkingSpeedKmh = parseTargetToKmh(walkingTargetInput.value.trim(), mode);
  const conversationalSpeedKmh = parseTargetToKmh(conversationalTargetInput.value.trim(), mode);
  const defaultInclineRaw = defaultInclineInput.value.trim();
  const defaultIncline = defaultInclineRaw === "" ? null : Number(defaultInclineRaw);

  if (!text) {
    setStatus("Paste a workout text first.", true);
    return;
  }

  if (!Number.isFinite(walkingSpeedKmh) || !Number.isFinite(conversationalSpeedKmh)) {
    setStatus("Provide valid walking and conversational targets for the selected mode.", true);
    return;
  }

  if (defaultInclineRaw !== "" && !Number.isFinite(defaultIncline)) {
    setStatus("Default incline must be a number when provided.", true);
    return;
  }

  const rows = parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  if (!rows.length) {
    renderRows([], mode);
    xmlOutput.value = "";
    downloadBtn.disabled = true;
    setStatus("No recognizable workout steps were found.", true);
    return;
  }

  const xml = generateXml(rows);
  renderRows(rows, mode);
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

workoutInput.value = "2km warm up at a conversational pace (no faster than 7:05/km), 90s walking rest Repeat the following 2x: ---------- 3 reps of: 400m at 5:35/km (5:25-5:45/km), 60s walking rest 60s walking rest ---------- 2km cool down at a conversational pace (or slower!)";
updateTargetLabels();
