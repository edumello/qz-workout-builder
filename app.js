const workoutInput = document.getElementById("workoutInput");
const walkingSpeedInput = document.getElementById("walkingSpeed");
const easySpeedInput = document.getElementById("easySpeed");
const parseBtn = document.getElementById("parseBtn");
const downloadBtn = document.getElementById("downloadBtn");
const rowsOutput = document.getElementById("rowsOutput");
const xmlOutput = document.getElementById("xmlOutput");
const statusOutput = document.getElementById("status");

function parsePaceToKmh(paceText) {
  const match = paceText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const totalMinutes = mins + secs / 60;
  if (totalMinutes <= 0) return null;
  return 60 / totalMinutes;
}

function formatKmh(value) {
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
  const repsRegex = /(\d+)\s+reps of:\s*([0-9.]+\s*(?:km|m)\s+at\s+\d{1,2}:\d{2}\/km(?:\s*\([^)]*\))?(?:,\s*\d+\s*s\s+walking rest)?)/i;

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

function parseWorkout(text, walkingSpeed, easySpeed) {
  const expanded = expandReps(expandRepeatFollowing(normalizeText(text)));
  const rows = [];

  const tokenRegex = /(\d+(?:\.\d+)?)\s*km\s+warm up[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/km)?|(\d+(?:\.\d+)?)\s*km\s+cool down[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/km)?|(\d+(?:\.\d+)?)\s*(km|m)\s+at\s+(\d{1,2}:\d{2})\/km(?:\s*\([^)]*\))?|(\d+)\s*s\s+walking rest/gi;

  let match;
  while ((match = tokenRegex.exec(expanded)) !== null) {
    if (match[1]) {
      const distance = Number(match[1]);
      const capPace = match[2];
      const speed = capPace ? parsePaceToKmh(capPace) : easySpeed;
      rows.push({ distance, speed: formatKmh(speed), type: "warmup" });
      continue;
    }

    if (match[3]) {
      const distance = Number(match[3]);
      const capPace = match[4];
      const speed = capPace ? parsePaceToKmh(capPace) : easySpeed;
      rows.push({ distance, speed: formatKmh(speed), type: "cooldown" });
      continue;
    }

    if (match[5]) {
      const distance = toKilometers(match[5], match[6]);
      const pace = match[7];
      const speed = parsePaceToKmh(pace);
      if (speed) {
        rows.push({ distance: Number(distance.toFixed(3)), speed: formatKmh(speed), type: "run" });
      }
      continue;
    }

    if (match[8]) {
      const seconds = Number(match[8]);
      rows.push({ duration: secondsToDuration(seconds), speed: formatKmh(walkingSpeed), type: "walkrest" });
    }
  }

  return rows;
}

function generateXml(rows) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<rows>"];
  for (const row of rows) {
    if (row.distance !== undefined) {
      lines.push(`    <row distance="${row.distance}" speed="${row.speed}" forcespeed="1"/>`);
    } else {
      lines.push(`    <row duration="${row.duration}" speed="${row.speed}" forcespeed="1"/>`);
    }
  }
  lines.push("</rows>");
  return lines.join("\n");
}

function renderRows(rows) {
  if (!rows.length) {
    rowsOutput.innerHTML = "<p>No workout steps recognized. Try a simpler format first.</p>";
    return;
  }

  const html = rows
    .map((row, idx) => {
      const target = row.distance !== undefined ? `${row.distance} km` : row.duration;
      return `<div class="row-item"><span>#${idx + 1}</span><span>${row.type}</span><span>${target}</span><span>${row.speed} km/h</span></div>`;
    })
    .join("");
  rowsOutput.innerHTML = html;
}

function setStatus(message, isError = false) {
  statusOutput.textContent = message;
  statusOutput.className = isError ? "status error" : "status";
}

parseBtn.addEventListener("click", () => {
  const text = workoutInput.value.trim();
  const walkingSpeed = Number(walkingSpeedInput.value);
  const easySpeed = Number(easySpeedInput.value);

  if (!text) {
    setStatus("Paste a workout text first.", true);
    return;
  }

  if (!Number.isFinite(walkingSpeed) || !Number.isFinite(easySpeed)) {
    setStatus("Provide valid speeds.", true);
    return;
  }

  const rows = parseWorkout(text, walkingSpeed, easySpeed);
  if (!rows.length) {
    renderRows([]);
    xmlOutput.value = "";
    downloadBtn.disabled = true;
    setStatus("No recognizable workout steps were found.", true);
    return;
  }

  const xml = generateXml(rows);
  renderRows(rows);
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

workoutInput.value = `2km warm up at a conversational pace (no faster than 7:05/km), 90s walking rest Repeat the following 2x: ---------- 3 reps of: 400m at 5:35/km (5:25-5:45/km), 60s walking rest 60s walking rest ---------- 2km cool down at a conversational pace (or slower!)`;
