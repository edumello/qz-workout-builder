const workoutInput = document.getElementById("workoutInput");
const modeTextBtn = document.getElementById("modeTextBtn");
const modeImageBtn = document.getElementById("modeImageBtn");
const modeBuildBtn = document.getElementById("modeBuildBtn");
const textInputSection = document.getElementById("textInputSection");
const imageInputSection = document.getElementById("imageInputSection");
const buildInputSection = document.getElementById("buildInputSection");
const workoutImageInput = document.getElementById("workoutImageInput");
const ocrEngineSelect = document.getElementById("ocrEngineSelect");
const ocrPreprocessInput = document.getElementById("ocrPreprocess");
const ocrDebugWrap = document.getElementById("ocrDebugWrap");
const ocrDebugOutput = document.getElementById("ocrDebugOutput");
const unitKmInput = document.getElementById("unitKm");
const unitMilesInput = document.getElementById("unitMiles");
const walkingTargetInput = document.getElementById("walkingTarget");
const conversationalTargetInput = document.getElementById("conversationalTarget");
const defaultInclineInput = document.getElementById("defaultIncline");
const walkingTargetLabel = document.getElementById("walkingTargetLabel");
const conversationalTargetLabel = document.getElementById("conversationalTargetLabel");
const builderInputModeField = document.getElementById("builderInputModeField");
const buildInputPace = document.getElementById("buildInputPace");
const buildInputSpeed = document.getElementById("buildInputSpeed");
const parseBtn = document.getElementById("parseBtn");
const parseXmlBtn = document.getElementById("parseXmlBtn");
const downloadBtn = document.getElementById("downloadBtn");
const optionsGenerateWrap = document.getElementById("optionsGenerateWrap");
const editParsedBtn = document.getElementById("editParsedBtn");
const rowsOutput = document.getElementById("rowsOutput");
const xmlOutput = document.getElementById("xmlOutput");
const statusOutput = document.getElementById("status");
const xmlUnitKmInput = document.getElementById("xmlUnitKm");
const xmlUnitMilesInput = document.getElementById("xmlUnitMiles");

const KM_PER_MILE = 1.60934;
let scribeModulePromise = null;
let scribeUnavailable = false;
let inputMode = "text";
let builderIdCounter = 1;
let builderBlocks = [];
let builderSortables = [];
const lastParsedItemsByMode = {
  text: [],
  image: []
};
const MODE_PLACEHOLDERS = {
  text: "<p>Text mode active. Click Generate workout to preview parsed rows.</p>",
  image: "<p>Image mode active. Upload a screenshot and click Generate workout.</p>"
};
const modeSnapshots = {
  text: {
    rowsHtml: "",
    xml: "",
    statusMessage: "",
    statusError: false
  },
  image: {
    rowsHtml: "",
    xml: "",
    statusMessage: "",
    statusError: false
  },
  build: {
    xml: "",
    statusMessage: "",
    statusError: false
  }
};

function normalizePaceUnit(unitText) {
  if (!unitText) return "km";
  const unit = unitText.toLowerCase();
  return unit.startsWith("mi") ? "mi" : "km";
}

function currentUserUnit() {
  return unitMilesInput.checked ? "mi" : "km";
}

function currentXmlUnit() {
  return xmlUnitMilesInput.checked ? "mi" : "km";
}

function currentBuilderInputMode() {
  return buildInputSpeed.checked ? "speed" : "pace";
}

function getWorkoutTargetModeForMode(mode) {
  return mode === "build" && currentBuilderInputMode() === "speed" ? "speed" : "pace";
}

function parsePaceToKmh(paceText, unitText) {
  const match = paceText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  if (secs > 59) return null;
  const totalMinutes = mins + secs / 60;
  if (totalMinutes <= 0) return null;
  const unit = normalizePaceUnit(unitText);
  const distance = unit === "mi" ? KM_PER_MILE : 1;
  return (60 / totalMinutes) * distance;
}

function normalizePaceInput(paceText, unitText) {
  const kmh = parsePaceToKmh(String(paceText || "").trim(), unitText);
  if (!Number.isFinite(kmh)) return null;
  return kmhToPace(kmh, unitText);
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

function formatSpeedForUnit(kmh, unitText) {
  if (normalizePaceUnit(unitText) === "mi") {
    return `${(kmh / KM_PER_MILE).toFixed(1)} mph`;
  }
  return `${formatKmh(kmh)} km/h`;
}

function speedUnitLabel(unitText) {
  return normalizePaceUnit(unitText) === "mi" ? "mph" : "km/h";
}

function parseSpeedToKmh(speedText, unitText) {
  const text = String(speedText || "").trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return normalizePaceUnit(unitText) === "mi" ? value * KM_PER_MILE : value;
}

function parseWorkoutTargetToKmh(value, unitText, targetMode) {
  if (targetMode === "speed") {
    return parseSpeedToKmh(value, unitText);
  }
  return parsePaceToKmh(value, unitText);
}

function formatWorkoutTargetFromKmh(kmh, unitText, targetMode) {
  if (!Number.isFinite(kmh)) return "";
  if (targetMode === "speed") return formatBuilderSpeedValue(kmh, unitText);
  return kmhToPace(kmh, unitText);
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
    .replace(/[\u2022\u2023\u25e6\u2043\u2219\u25cf\u25aa]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOcrText(raw) {
  return String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u2023\u25e6\u2043\u2219\u25cf\u25aa]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function currentOcrEngine() {
  const value = String(ocrEngineSelect?.value || "auto").toLowerCase();
  if (value === "scribe" || value === "tesseract") return value;
  return "auto";
}

function shouldPreprocessOcr() {
  return Boolean(ocrPreprocessInput?.checked);
}

function scoreOcrText(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower.trim()) return 0;
  let score = 0;
  score += (lower.match(/\bwalking rest\b/g) || []).length * 3;
  score += (lower.match(/\bconversational pace\b/g) || []).length * 3;
  score += (lower.match(/\brepeat\b/g) || []).length * 4;
  score += (lower.match(/\b(?:warm-?\s*up|cool\s*down|session|rest)\b/g) || []).length * 2;
  score += (lower.match(/\b\d+(?:[.,]\d+)?\s*(?:km|mi|m)\b/g) || []).length * 2;
  score += (lower.match(/\b\d+(?:\.\d+)?\s*(?:kph|km\/h|mph)\b/g) || []).length * 2;
  score += Math.min(lower.length / 120, 10);
  return score;
}

function pickBestOcrResult(results) {
  if (!results.length) return { text: "", debug: "", engine: "none", pass: "none" };
  const ranked = results
    .map((entry) => ({
      ...entry,
      normalized: normalizeOcrText(entry.text || ""),
      score: scoreOcrText(normalizeOcrText(entry.text || ""))
    }))
    .sort((a, b) => b.score - a.score || b.normalized.length - a.normalized.length);

  const best = ranked[0];
  const debug = ranked
    .map((entry, index) => {
      const header = `[${index + 1}] engine=${entry.engine} pass=${entry.pass} score=${entry.score.toFixed(1)}`;
      return `${header}\n${entry.normalized}`;
    })
    .join("\n\n----------------\n\n");

  return { text: best.normalized, debug, engine: best.engine, pass: best.pass };
}

async function loadImageForProcessing(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createCanvasFromImage(image, options = {}) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const yStartRatio = Number.isFinite(options.yStartRatio) ? options.yStartRatio : 0;
  const scale = Number.isFinite(options.scale) ? options.scale : 1;
  const startY = Math.max(0, Math.floor(height * Math.min(Math.max(yStartRatio, 0), 0.9)));
  const cropHeight = Math.max(1, height - startY);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(cropHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, startY, width, cropHeight, 0, 0, canvas.width, canvas.height);

  if (options.enhance) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let sumGray = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      sumGray += gray;
    }
    const avgGray = sumGray / (data.length / 4);
    const threshold = Math.max(120, Math.min(180, Math.round(avgGray)));

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const contrast = Math.max(0, Math.min(255, Math.round((gray - avgGray) * 1.8 + avgGray)));
      const value = contrast >= threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

async function buildOcrInputs(file, preprocessEnabled) {
  const image = await loadImageForProcessing(file);
  const inputs = [{ pass: "full-original", image: file }];
  if (!preprocessEnabled) return inputs;

  inputs.push({
    pass: "full-enhanced",
    image: createCanvasFromImage(image, { scale: 2, yStartRatio: 0, enhance: true })
  });
  inputs.push({
    pass: "lower-enhanced",
    image: createCanvasFromImage(image, { scale: 2, yStartRatio: 0.3, enhance: true })
  });
  inputs.push({
    pass: "lower-clean",
    image: createCanvasFromImage(image, { scale: 1.8, yStartRatio: 0.35, enhance: false })
  });
  return inputs;
}

async function loadScribeApi() {
  if (scribeUnavailable) {
    throw new Error("Scribe OCR module is unavailable.");
  }
  if (scribeModulePromise) return scribeModulePromise;
  scribeModulePromise = (async () => {
    try {
      const mod = await import("./node_modules/scribe.js-ocr/scribe.js");
      const api = mod?.default || mod;
      if (!api || typeof api.extractText !== "function") {
        throw new Error("Scribe API is unavailable.");
      }
      return api;
    } catch (error) {
      scribeModulePromise = null;
      scribeUnavailable = true;
      throw error;
    }
  })();
  return scribeModulePromise;
}

function extractTextFromScribeResponse(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  if (Array.isArray(response)) {
    return response
      .map((item) => item?.text || item?.data?.text || (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join("\n");
  }
  return response.text || response.data?.text || "";
}

async function runTesseractOcr(imageInput, passLabel, progressPrefix) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract OCR library failed to load.");
  }
  const result = await Tesseract.recognize(imageInput, "eng", {
    logger: (message) => {
      if (message?.status === "recognizing text" && Number.isFinite(message.progress)) {
        const pct = Math.round(message.progress * 100);
        setStatus(`${progressPrefix} ${passLabel}... ${pct}%`);
      }
    }
  });
  return normalizeOcrText(result?.data?.text || "");
}

async function runScribeOcr(imageInput, passLabel, progressPrefix) {
  const scribe = await loadScribeApi();
  setStatus(`${progressPrefix} ${passLabel}...`);
  const input = imageInput instanceof HTMLCanvasElement ? imageInput.toDataURL("image/png") : imageInput;
  const response = await scribe.extractText([input], { ocr: true, checkOrientation: true });
  return normalizeOcrText(extractTextFromScribeResponse(response));
}

async function extractWorkoutTextFromImageFile(file, options = {}) {
  if (!file) return { text: "", debug: "" };

  const selectedEngine = String(options.engine || "auto").toLowerCase();
  const preprocessEnabled = Boolean(options.preprocess);
  const ocrInputs = await buildOcrInputs(file, preprocessEnabled);
  const engines = selectedEngine === "tesseract" ? ["tesseract"] : ["scribe", "tesseract"];
  const results = [];
  const errors = [];

  for (const engine of engines) {
    let engineSucceeded = false;
    for (const input of ocrInputs) {
      try {
        const text = engine === "scribe"
          ? await runScribeOcr(input.image, input.pass, "Reading image (Scribe)")
          : await runTesseractOcr(input.image, input.pass, "Reading image (Tesseract)");
        if (text.trim()) {
          results.push({ engine, pass: input.pass, text });
          engineSucceeded = true;
        }
      } catch (error) {
        errors.push(`${engine}:${input.pass}:${error instanceof Error ? error.message : String(error)}`);
        if (selectedEngine === "tesseract") {
          throw new Error("Tesseract OCR failed to process this image.");
        }
        break;
      }
    }
    if (selectedEngine === engine && engineSucceeded && selectedEngine !== "auto") {
      break;
    }
  }

  const best = pickBestOcrResult(results);
  if (!best.text) {
    if (errors.length) {
      throw new Error(`Could not extract text from the image. OCR errors: ${errors.join(" | ")}`);
    }
    throw new Error("Could not extract text from the image.");
  }
  return best;
}

function parseSpeedOrPaceToKmh(text, fallbackUnit = "km") {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return null;
  const normalizedValue = value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\bkmh\b/g, "km/h")
    .replace(/\bkpn\b/g, "kph")
    .replace(/\bkpr\b/g, "kph");

  const paceRangeMatch = normalizedValue.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*\/\s*(km|mi|mile|miles)/i);
  if (paceRangeMatch) {
    const slow = parsePaceToKmh(paceRangeMatch[1], paceRangeMatch[3]);
    const fast = parsePaceToKmh(paceRangeMatch[2], paceRangeMatch[3]);
    if (Number.isFinite(slow) && Number.isFinite(fast)) {
      return (slow + fast) / 2;
    }
  }

  const speedRangeMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(kph|km\/h|mph)\b/i);
  if (speedRangeMatch) {
    const a = Number(speedRangeMatch[1]);
    const b = Number(speedRangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      const avg = (a + b) / 2;
      return /mph/i.test(speedRangeMatch[3]) ? avg * KM_PER_MILE : avg;
    }
  }

  const paceMatch = normalizedValue.match(/(\d{1,2}:\d{2})\s*\/\s*(km|mi|mile|miles)/i);
  if (paceMatch) {
    return parsePaceToKmh(paceMatch[1], paceMatch[2]);
  }

  const speedMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*(kph|km\/h|mph)\b/i);
  if (speedMatch) {
    const n = Number(speedMatch[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return /mph/i.test(speedMatch[2]) ? n * KM_PER_MILE : n;
  }

  // Bare pace style without explicit unit uses current workout unit as fallback.
  const barePaceMatch = normalizedValue.match(/\b(\d{1,2}:\d{2})\b/);
  if (barePaceMatch) {
    return parsePaceToKmh(barePaceMatch[1], fallbackUnit);
  }

  return null;
}

function parseRunnaImageWorkout(ocrText, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const lines = String(ocrText || "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const descriptionIndex = lines.findIndex((line) => /^description\b/i.test(String(line).toLowerCase()));
  const workoutLines = descriptionIndex >= 0 ? lines.slice(descriptionIndex + 1) : lines;
  const hasStepMarkers = workoutLines.some((line) => /^\d{1,2}$/.test(String(line).trim()));

  const rows = [];
  const items = [];
  let currentSection = "run";
  let activeRepeat = null;
  let lastRunRow = null;
  let pendingDistanceRow = null;
  let sawFirstStepMarker = !hasStepMarkers;

  function closeRepeatIfNeeded() {
    if (activeRepeat && activeRepeat.items.length) {
      for (let i = 0; i < activeRepeat.count; i += 1) {
        for (const templateRow of activeRepeat.templateRows) {
          rows.push({ ...templateRow });
        }
      }
      items.push({
        kind: "group",
        label: `Repeat x${activeRepeat.count}`,
        items: activeRepeat.items
      });
    }
    activeRepeat = null;
  }

  function pushRow(row) {
    const item = { kind: "row", row };
    if (activeRepeat) {
      activeRepeat.items.push(item);
      activeRepeat.templateRows.push(row);
    } else {
      rows.push(row);
      items.push(item);
    }
    if (row.type !== "walkrest") {
      lastRunRow = row;
    }
  }

  function parseDistance(text) {
    const m = text.match(/(\d+(?:[.,]\d+)?)\s*(km|mi|mile|miles|m)(?=\b|at|@)/i);
    if (!m) return null;
    const value = Number(String(m[1]).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    const distanceKm = toKilometers(value, m[2]);
    return Number(distanceKm.toFixed(3));
  }

  function sectionTypeForCurrent() {
    if (currentSection === "warmup") return "warmup";
    if (currentSection === "cooldown") return "cooldown";
    if (currentSection === "rest") return "walkrest";
    return "run";
  }

  function finalizePendingDistanceRow(speedOverride = null) {
    if (!pendingDistanceRow) return false;
    const fallbackSpeed = Number.isFinite(speedOverride)
      ? speedOverride
      : (pendingDistanceRow.type === "warmup" || pendingDistanceRow.type === "cooldown")
        ? conversationalSpeedKmh
        : (Number.isFinite(lastRunRow?.speedKmh) ? lastRunRow.speedKmh : conversationalSpeedKmh);
    if (!Number.isFinite(fallbackSpeed)) return false;
    pendingDistanceRow.speedKmh = fallbackSpeed;
    pushRow(pendingDistanceRow);
    pendingDistanceRow = null;
    return true;
  }

  function resolvePendingFromLine(lowerLine, sourceLine) {
    if (!pendingDistanceRow) return false;
    const resolvedSpeed = parseSpeedOrPaceToKmh(lowerLine, userUnit);
    if (!Number.isFinite(resolvedSpeed)) return false;
    pendingDistanceRow.speedKmh = resolvedSpeed;
    pendingDistanceRow.source = `${pendingDistanceRow.source} ${sourceLine}`.trim();
    pushRow(pendingDistanceRow);
    pendingDistanceRow = null;
    return true;
  }

  function extractRepeatMarker(lineLower) {
    const normalized = lineLower
      .replace(/[\u00d7\u2715\u2716]/g, "x")
      .replace(/[\u2013\u2014]/g, "-");
    const fuzzy = normalized
      .replace(/[@]/g, "a")
      .replace(/[1|!]/g, "l")
      .replace(/[0]/g, "o");

    const patterns = [
      /\brepe?a?t(?:\s+the\s+following)?\s*x?\s*(\d{1,2})\b/i,
      /\b(?:x)\s*(\d{1,2})\b/i,
      /\b(\d{1,2})\s*(?:x)\b/i,
      /\bepeat(?:\s+the\s+following)?\s*x?\s*(\d{1,2})\b/i
    ];
    for (const pattern of patterns) {
      const match = normalized.match(pattern) || fuzzy.match(pattern);
      if (match && Number.isFinite(Number(match[1]))) {
        return {
          count: Math.max(1, Number(match[1])),
          endIndex: (match.index || 0) + match[0].length
        };
      }
    }

    if (/\bepe?a?t\b/i.test(fuzzy) || /\bepeat\b/i.test(fuzzy)) {
      const nearCount = normalized.match(/(?:x\s*)?(\d{1,2})\b/);
      if (nearCount && Number.isFinite(Number(nearCount[1]))) {
        return {
          count: Math.max(1, Number(nearCount[1])),
          endIndex: (nearCount.index || 0) + nearCount[0].length
        };
      }
    }
    return null;
  }
  for (const rawLine of workoutLines) {
    let line = rawLine
      .replace(/\s*\([^)]*\)/g, (m) => m.toLowerCase().includes("repeat") ? m : m)
      .trim();
    let lower = line.toLowerCase();

    if (/^\d{1,2}$/.test(lower)) {
      sawFirstStepMarker = true;
      continue;
    }

    if (
      /^(week\s+\d+|schedule|description|outdoor|treadmill|warm-up stretches|add route|link activity|skip workout|start workout|coach |workout notes|synced )/i.test(lower) ||
      /^(sources:|distance\b|time\b|avg pace\b)/i.test(lower) ||
      /^(feb|jan|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lower) ||
      /^\d{1,2}:\d{2}$/.test(lower)
    ) {
      continue;
    }

    const isSectionHeader = /^(warm[\-\u2013\u2014]?\s*up|cool\s*down|rest\b|session\b)/i.test(lower) || Boolean(extractRepeatMarker(lower));
    if (hasStepMarkers && !sawFirstStepMarker && !isSectionHeader) {
      continue;
    }

    const repeatMarker = extractRepeatMarker(lower);
    if (repeatMarker) {
      finalizePendingDistanceRow();
      closeRepeatIfNeeded();
      activeRepeat = {
        count: repeatMarker.count,
        items: [],
        templateRows: []
      };
      currentSection = "run";
      const tail = line.slice(repeatMarker.endIndex).trim();
      if (!tail) {
        continue;
      }
      line = tail;
      lower = line.toLowerCase();
    }

    if (/^warm[\-\u2013\u2014]?\s*up\b/i.test(lower)) {
      finalizePendingDistanceRow();
      closeRepeatIfNeeded();
      currentSection = "warmup";
      continue;
    }
    if (/^cool\s*down\b/i.test(lower)) {
      finalizePendingDistanceRow();
      closeRepeatIfNeeded();
      currentSection = "cooldown";
      continue;
    }
    if (/^rest\b/i.test(lower)) {
      finalizePendingDistanceRow();
      closeRepeatIfNeeded();
      currentSection = "rest";
      continue;
    }
    if (/^session\b/i.test(lower)) {
      finalizePendingDistanceRow();
      closeRepeatIfNeeded();
      currentSection = "run";
      continue;
    }

    if (/^no faster than\b/i.test(lower)) {
      if (resolvePendingFromLine(lower, line)) {
        continue;
      }
      const capKmh = parseSpeedOrPaceToKmh(lower, userUnit);
      if (lastRunRow && Number.isFinite(capKmh)) {
        lastRunRow.speedKmh = capKmh;
        lastRunRow.source = `${lastRunRow.source} ${line}`;
      }
      continue;
    }

    if (resolvePendingFromLine(lower, line)) {
      continue;
    }

    const restMatch = lower.match(/(\d+)\s*s?\s*walking rest/i);
    const distanceKm = parseDistance(lower);
    if (distanceKm) {
      if (!/\b(at|conversational|easy|run|warm|cool)\b|@/i.test(lower)) {
        continue;
      }

      finalizePendingDistanceRow();
      let speedKmh = null;
      if (/conversational(?:\s+pace)?/i.test(lower)) {
        speedKmh = conversationalSpeedKmh;
        const capKmh = parseSpeedOrPaceToKmh(lower, userUnit);
        if (Number.isFinite(capKmh)) speedKmh = capKmh;
      } else {
        speedKmh = parseSpeedOrPaceToKmh(lower, userUnit);
      }

      const rowType = sectionTypeForCurrent();
      const newRow = {
        type: rowType === "rest" ? "walkrest" : rowType,
        distance: distanceKm,
        speedKmh,
        source: line,
        incline: rowType === "walkrest" ? null : defaultIncline
      };

      if (Number.isFinite(speedKmh)) {
        pushRow(newRow);
      } else {
        pendingDistanceRow = { ...newRow, speedKmh: null };
      }
    }

    if (restMatch) {
      finalizePendingDistanceRow();
      const seconds = Number(restMatch[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        pushRow({
          type: "walkrest",
          duration: secondsToDuration(seconds),
          speedKmh: walkingSpeedKmh,
          source: line,
          incline: null
        });
      }
    }
  }

  finalizePendingDistanceRow();
  closeRepeatIfNeeded();
  return { rows, items };
}
function expandRepeatFollowing(text) {
  let output = text;
  const repeatRegex = /Repeat the following\s+(\d+)x:\s*-{5,}\s*([\s\S]*?)\s*-{5,}/i;

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
  const repsRegex = /(\d+)\s+reps of:\s*(?:[^0-9]*?)?([0-9]+(?:\.[0-9]+)?\s*(?:km|m|mi|mile|miles)\s+at\s+\d{1,2}:\d{2}\/(?:km|mi|mile|miles)(?:\s*\([^)]*\))?(?:,\s*\d+\s*s?\s+walking rest)?)/i;

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
  const normalized = String(unit || "").toLowerCase();
  if (normalized === "m") return n / 1000;
  if (normalized === "mi" || normalized === "mile" || normalized === "miles") return n * KM_PER_MILE;
  return n;
}

function formatUnitNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(decimals)).toString();
}

function formatBuilderDistanceValue(distanceInUserUnit, userUnit) {
  return formatUnitNumber(distanceInUserUnit, 3);
}

function formatBuilderSpeedValue(speedKmh, userUnit) {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return "";
  const speedInUnit = normalizePaceUnit(userUnit) === "mi" ? speedKmh / KM_PER_MILE : speedKmh;
  return formatUnitNumber(speedInUnit, 1);
}

function parseBuilderDistanceValue(rawValue, fallbackUnit) {
  const text = String(rawValue || "").trim().toLowerCase();
  const match = text.match(/^([0-9]*\.?[0-9]+)\s*(km|mi|mile|miles)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2] ? normalizePaceUnit(match[2]) : normalizePaceUnit(fallbackUnit);
  const distanceKm = unit === "mi" ? value * KM_PER_MILE : value;
  return {
    distanceKm,
    valueInUnit: unit === "mi" ? distanceKm / KM_PER_MILE : distanceKm,
    unit
  };
}

function convertBuilderUnits(blocks, prevUnit, nextUnit) {
  return blocks.map((block) => {
    if (block.type === "repeat") {
      return {
        ...block,
        children: convertBuilderUnits(block.children || [], prevUnit, nextUnit)
      };
    }

    let nextBlock = { ...block };
    if (nextBlock.targetType === "distance") {
      const parsed = parseBuilderDistanceValue(nextBlock.value, prevUnit);
      if (parsed) {
        const converted = normalizePaceUnit(nextUnit) === "mi"
          ? parsed.distanceKm / KM_PER_MILE
          : parsed.distanceKm;
        nextBlock.value = formatBuilderDistanceValue(converted, nextUnit);
      }
    }

    if (nextBlock.type !== "rest") {
      const kmh = parseSpeedToKmh(nextBlock.speed, prevUnit) || parsePaceToKmh(nextBlock.pace, prevUnit);
      if (Number.isFinite(kmh)) {
        nextBlock.pace = kmhToPace(kmh, nextUnit);
        nextBlock.speed = formatBuilderSpeedValue(kmh, nextUnit);
      }
    }
    return nextBlock;
  });
}

function newBuilderBlock(type = "run", userUnit = currentUserUnit()) {
  const id = `blk_${builderIdCounter++}`;
  if (type === "repeat") {
    return {
      id,
      type: "repeat",
      repeats: 2,
      children: []
    };
  }

  const defaultPace = "6:00";
  const defaultSpeedKmh = parsePaceToKmh(defaultPace, userUnit) || 10;
  return {
    id,
    type,
    targetType: type === "rest" ? "time" : "distance",
    value: type === "rest" ? "00:01:00" : formatBuilderDistanceValue(1, userUnit),
    pace: type === "rest" ? "" : defaultPace,
    speed: type === "rest" ? "" : formatBuilderSpeedValue(defaultSpeedKmh, userUnit)
  };
}

function cloneBuilderBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "repeat") {
      return {
        ...block,
        children: cloneBuilderBlocks(block.children || [])
      };
    }
    return { ...block };
  });
}

function parseDurationInputToSeconds(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  const match = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3]);
  if (mm > 59 || ss > 59) return null;
  return hh * 3600 + mm * 60 + ss;
}

function getBuilderBlockSpeedKmh(block, userUnit) {
  if (!block || block.type === "rest") return null;
  return parseSpeedToKmh(block.speed, userUnit) || parsePaceToKmh(block.pace || "", userUnit);
}

function getBlockTypeLabel(type) {
  if (type === "warmup") return "Warm-Up";
  if (type === "cooldown") return "Cool Down";
  if (type === "rest") return "Rest";
  if (type === "repeat") return "Repeat";
  return "Run";
}

function toRowType(blockType) {
  if (blockType === "warmup") return "warmup";
  if (blockType === "cooldown") return "cooldown";
  if (blockType === "rest") return "walkrest";
  return "run";
}

function findBlockById(blocks, id) {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type === "repeat") {
      const found = findBlockById(block.children || [], id);
      if (found) return found;
    }
  }
  return null;
}

function removeBlockById(blocks, id) {
  const result = [];
  let removed = null;
  for (const block of blocks) {
    if (block.id === id) {
      removed = block;
      continue;
    }
    if (block.type === "repeat") {
      const nested = removeBlockById(block.children || [], id);
      if (nested.removed) {
        removed = nested.removed;
      }
      result.push({
        ...block,
        children: nested.blocks
      });
    } else {
      result.push(block);
    }
  }
  return { blocks: result, removed };
}

function insertBlockByParentId(blocks, parentId, index, blockToInsert) {
  if (parentId === "root") {
    const copy = blocks.slice();
    copy.splice(index, 0, blockToInsert);
    return copy;
  }
  return blocks.map((block) => {
    if (block.id === parentId && block.type === "repeat") {
      const children = (block.children || []).slice();
      children.splice(index, 0, blockToInsert);
      return { ...block, children };
    }
    if (block.type === "repeat") {
      return {
        ...block,
        children: insertBlockByParentId(block.children || [], parentId, index, blockToInsert)
      };
    }
    return block;
  });
}

function updateBlockById(blocks, id, updater) {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (block.type === "repeat") {
      return {
        ...block,
        children: updateBlockById(block.children || [], id, updater)
      };
    }
    return block;
  });
}

function isDescendant(parentBlock, targetId) {
  if (!parentBlock || parentBlock.type !== "repeat") return false;
  for (const child of parentBlock.children || []) {
    if (child.id === targetId) return true;
    if (child.type === "repeat" && isDescendant(child, targetId)) return true;
  }
  return false;
}

function moveBuilderBlock(sourceParentId, sourceIndex, targetParentId, targetIndex, draggedId) {
  const rootClone = cloneBuilderBlocks(builderBlocks);
  const sourceList = sourceParentId === "root"
    ? rootClone
    : (findBlockById(rootClone, sourceParentId)?.children || []);
  if (!sourceList[sourceIndex]) return;
  const draggedBlock = sourceList[sourceIndex];

  if (draggedId && draggedBlock.id !== draggedId) return;
  if (draggedBlock.type === "repeat" && targetParentId !== "root" && isDescendant(draggedBlock, targetParentId)) {
    return;
  }

  sourceList.splice(sourceIndex, 1);
  const targetList = targetParentId === "root"
    ? rootClone
    : (findBlockById(rootClone, targetParentId)?.children || []);
  targetList.splice(targetIndex, 0, draggedBlock);
  builderBlocks = rootClone;
}

function blockToRows(block, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, inputMode) {
  if (block.type === "repeat") {
    const repeats = Math.max(1, Number(block.repeats) || 1);
    const rows = [];
    for (let i = 0; i < repeats; i += 1) {
      for (const child of block.children || []) {
        rows.push(...blockToRows(child, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, inputMode));
      }
    }
    return rows;
  }

  const rowType = toRowType(block.type);
  const targetType = block.targetType || (block.type === "rest" ? "time" : "distance");
  const paceSpeed = parsePaceToKmh(block.pace || "", userUnit);
  const speedInputSpeed = parseSpeedToKmh(block.speed, userUnit);
  const selectedInputSpeed = inputMode === "speed" ? speedInputSpeed : paceSpeed;
  const blockSpeed = selectedInputSpeed || speedInputSpeed || paceSpeed;
  const speedKmh = block.type === "rest"
    ? walkingSpeedKmh
    : (blockSpeed || conversationalSpeedKmh);

  if (targetType === "distance") {
    const parsedDistance = parseBuilderDistanceValue(block.value, userUnit);
    if (!parsedDistance) return [];
    const distanceKm = parsedDistance.distanceKm;
    const unitLabel = normalizePaceUnit(userUnit) === "mi" ? "mi" : "km";
    const speedLabel = speedUnitLabel(userUnit);
    const displayDistance = normalizePaceUnit(userUnit) === "mi"
      ? distanceKm / KM_PER_MILE
      : distanceKm;
    const effort = block.type === "rest"
      ? ""
      : (inputMode === "speed"
        ? ` at ${formatBuilderSpeedValue(speedKmh, userUnit)} ${speedLabel}`
        : ` at ${kmhToPace(speedKmh, userUnit)}/${unitLabel}`);
    const source = `${formatUnitNumber(displayDistance, 3)} ${unitLabel} ${getBlockTypeLabel(block.type).toLowerCase()}${effort}`;
    return [{
      type: rowType,
      distance: Number(distanceKm.toFixed(3)),
      speedKmh,
      source,
      incline: rowType === "walkrest" ? null : defaultIncline
    }];
  }

  const seconds = parseDurationInputToSeconds(block.value);
  if (!Number.isFinite(seconds) || seconds <= 0) return [];
  const unitLabel = normalizePaceUnit(userUnit) === "mi" ? "mi" : "km";
  const speedLabel = speedUnitLabel(userUnit);
  const effort = block.type === "rest"
    ? ""
    : (inputMode === "speed"
      ? ` at ${formatBuilderSpeedValue(speedKmh, userUnit)} ${speedLabel}`
      : ` at ${kmhToPace(speedKmh, userUnit)}/${unitLabel}`);
  const source = `${block.value} ${getBlockTypeLabel(block.type).toLowerCase()}${effort}`;
  return [{
    type: rowType,
    duration: secondsToDuration(seconds),
    speedKmh,
    source,
    incline: null
  }];
}

function buildRowsFromBuilder(userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, builderInputMode) {
  const rows = [];
  for (const block of builderBlocks) {
    rows.push(...blockToRows(block, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, builderInputMode));
  }
  return rows;
}

function findFirstInvalidBuilderInput(blocks, userUnit, builderInputMode) {
  for (const block of blocks) {
    if (block.type === "repeat") {
      const nested = findFirstInvalidBuilderInput(block.children || [], userUnit, builderInputMode);
      if (nested) return nested;
      continue;
    }
    if (block.type === "rest") continue;
    if (builderInputMode === "speed") {
      const validSpeed = parseSpeedToKmh(block.speed, userUnit) || parsePaceToKmh(block.pace || "", userUnit);
      if (!Number.isFinite(validSpeed)) return block;
    } else if (!normalizePaceInput(block.pace, userUnit)) {
      return block;
    }
  }
  return null;
}

function destroyBuilderSortables() {
  for (const sortable of builderSortables) {
    sortable.destroy();
  }
  builderSortables = [];
}

function getHeaderClassForBuilder(type) {
  if (type === "warmup") return "repeat-header-warm-up";
  if (type === "cooldown") return "repeat-header-cool-down";
  if (type === "rest") return "repeat-header-rest";
  if (type === "repeat") return "repeat-header-repeat";
  return "repeat-header-run";
}

function getBlockClassForBuilder(type) {
  if (type === "warmup") return "repeat-block-warm-up";
  if (type === "cooldown") return "repeat-block-cool-down";
  if (type === "rest") return "repeat-block-rest";
  if (type === "repeat") return "repeat-block-repeat";
  return "repeat-block-run";
}

function renderBuilderBlocks(blocks, parentId = "root") {
  if (!blocks.length) {
    return `<div class="builder-empty">No blocks yet. Click "Add block".</div>`;
  }

  return blocks.map((block) => {
    const headerClass = getHeaderClassForBuilder(block.type);
    const blockClass = getBlockClassForBuilder(block.type);
    const isRepeat = block.type === "repeat";

    const typeOptions = [
      ["warmup", "Warm-Up"],
      ["run", "Run"],
      ["rest", "Rest"],
      ["repeat", "Repeat"],
      ["cooldown", "Cool Down"]
    ]
      .map(([value, label]) => `<option value="${value}" ${block.type === value ? "selected" : ""}>${label}</option>`)
      .join("");

    const targetTypeOptions = `
      <option value="distance" ${block.targetType === "distance" ? "selected" : ""}>Distance</option>
      <option value="time" ${block.targetType === "time" ? "selected" : ""}>Time</option>
    `;
    const builderInputMode = currentBuilderInputMode();
    const speedLabel = speedUnitLabel(currentUserUnit());
    const speedValue = block.speed || formatBuilderSpeedValue(getBuilderBlockSpeedKmh(block, currentUserUnit()), currentUserUnit());

    const repeatControls = `
      <div class="builder-grid">
        <label class="builder-field">
          <span>Repeats</span>
          <input type="number" min="1" data-builder-id="${block.id}" data-field="repeats" value="${block.repeats || 2}">
        </label>
        <button class="btn btn-outline-primary btn-sm mt-auto" type="button" data-action="add-child" data-builder-id="${block.id}">Add inner block</button>
      </div>
      <div class="builder-children" data-parent-id="${block.id}">
        ${renderBuilderBlocks(block.children || [], block.id)}
      </div>
    `;

    const rowControls = `
      <div class="builder-grid">
        <label class="builder-field">
          <span>Distance / Time</span>
          <select data-builder-id="${block.id}" data-field="targetType">${targetTypeOptions}</select>
        </label>
        <label class="builder-field">
          <span>${block.targetType === "distance" ? `Distance value (${currentUserUnit()})` : "Time value (HH:MM:SS)"}</span>
          <input type="text" data-builder-id="${block.id}" data-field="value" value="${block.value || ""}" placeholder="${block.targetType === "distance" ? "e.g. 5" : "e.g. 00:05:00"}">
        </label>
        ${block.type !== "rest" ? `
        <label class="builder-field">
          <span>${builderInputMode === "speed" ? `Speed (${speedLabel})` : `Pace (mm:ss/${currentUserUnit()})`}</span>
          <input type="text" data-builder-id="${block.id}" data-field="${builderInputMode === "speed" ? "speed" : "pace"}" value="${builderInputMode === "speed" ? speedValue : (block.pace || "")}" placeholder="${builderInputMode === "speed" ? "e.g. 10.0" : "e.g. 6:00"}" ${builderInputMode === "speed" ? 'inputmode="decimal" title="Use a positive number."' : 'pattern="\\d{1,2}:[0-5]\\d" title="Use mm:ss (seconds 00-59)"'}>
        </label>` : ""}
      </div>
    `;

    return `
      <div class="repeat-block ${blockClass} builder-block" data-id="${block.id}" data-parent-id="${parentId}">
        <div class="repeat-header ${headerClass} builder-header">
          <div class="builder-header-controls">
            <select class="builder-type-select" data-builder-id="${block.id}" data-field="type" aria-label="Block type">
              ${typeOptions}
            </select>
            <button class="btn btn-sm btn-light builder-remove" type="button" data-action="remove" data-builder-id="${block.id}">Remove</button>
          </div>
          <span class="builder-drag-indicator" aria-hidden="true"></span>
        </div>
        <div class="repeat-body builder-body">
          ${isRepeat ? repeatControls : rowControls}
        </div>
      </div>
    `;
  }).join("");
}

function initializeBuilderSortables() {
  destroyBuilderSortables();
  if (typeof Sortable === "undefined") {
    setStatus("Drag and drop library did not load. Reload the page.", true);
    return;
  }
  const containers = rowsOutput.querySelectorAll(".builder-list, .builder-children");
  containers.forEach((container) => {
    const sortable = Sortable.create(container, {
      group: "builderBlocks",
      handle: ".builder-header",
      filter: ".builder-type-select, .builder-remove",
      preventOnFilter: false,
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onMove(evt) {
        const draggedId = evt.dragged?.dataset?.id;
        const toParent = evt.to?.dataset?.parentId || "root";
        const draggedBlock = findBlockById(builderBlocks, draggedId);
        if (!draggedBlock || draggedBlock.type !== "repeat") return true;
        return !isDescendant(draggedBlock, toParent);
      },
      onEnd(evt) {
        const sourceParentId = evt.from.dataset.parentId || "root";
        const targetParentId = evt.to.dataset.parentId || "root";
        moveBuilderBlock(sourceParentId, evt.oldIndex, targetParentId, evt.newIndex, evt.item.dataset.id);
        renderBuilderEditor();
      }
    });
    builderSortables.push(sortable);
  });
}

function renderBuilderEditor() {
  rowsOutput.setAttribute("data-view", "builder");
  const html = `
    <div class="builder-wrap">
      <div class="builder-toolbar">
        <button class="btn btn-primary btn-sm" type="button" id="addBlockInRowsBtn">Add block</button>
        <span class="mode-note">Drag blocks to reorder. Drop into Repeat blocks to nest.</span>
      </div>
      <div class="builder-list" data-parent-id="root">
        ${renderBuilderBlocks(builderBlocks)}
      </div>
    </div>
  `;
  rowsOutput.innerHTML = html;
  initializeBuilderSortables();
}

function parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, options = {}) {
  const expanded = options.expand === false
    ? normalizeText(text)
    : expandReps(expandRepeatFollowing(normalizeText(text)));
  const rows = [];

  const tokenRegex = /(\d+(?:\.\d+)?)\s*(km|m|mi|mile|miles)\s+warm up[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles))?|(\d+(?:\.\d+)?)\s*(km|m|mi|mile|miles)\s+cool down[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles))?|(\d+(?:\.\d+)?)\s*(km|m|mi|mile|miles)\s+at\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles)(?:\s*\([^)]*\))?|(\d+(?:\.\d+)?)\s*(km|m|mi|mile|miles)\s+(?:easy run|run)\s+at\s+a\s+conversational pace[^.]*?(?:no faster than\s+(\d{1,2}:\d{2})\/(km|mi|mile|miles))?|(\d+)\s*s\s+walking rest/gi;

  let match;
  while ((match = tokenRegex.exec(expanded)) !== null) {
    const source = match[0].trim();
    if (match[1]) {
      const distance = toKilometers(match[1], match[2]);
      const capPace = match[3];
      const capUnit = match[4];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({ distance: Number(distance.toFixed(3)), speedKmh, type: "warmup", source, incline: defaultIncline });
      continue;
    }

    if (match[5]) {
      const distance = toKilometers(match[5], match[6]);
      const capPace = match[7];
      const capUnit = match[8];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({ distance: Number(distance.toFixed(3)), speedKmh, type: "cooldown", source, incline: defaultIncline });
      continue;
    }

    if (match[9]) {
      const distance = toKilometers(match[9], match[10]);
      const pace = match[11];
      const paceUnit = match[12];
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

    if (match[13]) {
      const distance = toKilometers(match[13], match[14]);
      const capPace = match[15];
      const capUnit = match[16];
      const speedKmh = capPace ? parsePaceToKmh(capPace, capUnit) : conversationalSpeedKmh;
      rows.push({ distance: Number(distance.toFixed(3)), speedKmh, type: "run", source, incline: defaultIncline });
      continue;
    }

    if (match[17]) {
      const seconds = Number(match[17]);
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

function parseTopLevelItems(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const items = [];
  const repsRegex = /(\d+)\s+reps of:\s*(?:[^0-9]*?)?([0-9]+(?:\.[0-9]+)?\s*(?:km|m|mi|mile|miles)\s+at\s+\d{1,2}:\d{2}\/(?:km|mi|mile|miles)(?:\s*\([^)]*\))?(?:,\s*\d+\s*s?\s+walking rest)?)/gi;
  let cursor = 0;
  let match;

  while ((match = repsRegex.exec(normalized)) !== null) {
    const before = normalized.slice(cursor, match.index).trim();
    if (before) {
      items.push(
        ...parseSegmentRows(before, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
          .map((row) => ({ kind: "row", row }))
      );
    }

    const repsCount = Math.max(1, Number(match[1]) || 1);
    const repsBody = match[2] || "";
    const repsRows = parseSegmentRows(repsBody, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
    if (repsRows.length) {
      items.push({
        kind: "group",
        label: `Repeat x${repsCount}`,
        items: repsRows.map((row) => ({ kind: "row", row }))
      });
    }
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
  const repeatRegex = /Repeat the following\s+(\d+)x:\s*-{5,}\s*([\s\S]*?)\s*-{5,}/gi;
  let cursor = 0;
  let match;

  while ((match = repeatRegex.exec(normalized)) !== null) {
    const before = normalized.slice(cursor, match.index).trim();
    if (before) {
      items.push(...parseTopLevelItems(before, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline));
    }

    const repeatCount = Number(match[1]);
    const blockText = match[2] || "";
    const templateItems = parseBlockItems(blockText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);

    items.push({
      kind: "group",
      label: `Repeat x${repeatCount}`,
      items: templateItems
    });
    cursor = match.index + match[0].length;
  }

  const after = normalized.slice(cursor).trim();
  if (after) {
    items.push(...parseTopLevelItems(after, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline));
  }

  return items;
}

function generateXml(rows, xmlUnit) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<rows>"];
  const useMiles = normalizePaceUnit(xmlUnit) === "mi";
  for (const row of rows) {
    const speedValue = useMiles ? row.speedKmh / KM_PER_MILE : row.speedKmh;
    const speed = formatKmh(speedValue);
    if (row.distance !== undefined) {
      const distanceValue = useMiles ? row.distance / KM_PER_MILE : row.distance;
      const distance = useMiles ? Number(distanceValue.toFixed(3)) : row.distance;
      const incline = Number.isFinite(row.incline) ? ` inclination="${formatIncline(row.incline)}"` : "";
      lines.push(`    <row distance="${distance}" speed="${speed}" forcespeed="1"${incline}/>`);
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

function cloneDisplayItems(items) {
  return JSON.parse(JSON.stringify(items || []));
}

function rowTypeToBuilderType(rowType) {
  if (rowType === "warmup") return "warmup";
  if (rowType === "cooldown") return "cooldown";
  if (rowType === "walkrest") return "rest";
  return "run";
}

function parseRepeatCountLabel(label) {
  const match = String(label || "").match(/x\s*(\d+)/i);
  if (!match) return 1;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function rowToBuilderBlock(row, userUnit) {
  const type = rowTypeToBuilderType(row.type);
  const speedValue = type === "rest" ? "" : formatBuilderSpeedValue(row.speedKmh, userUnit);
  if (row.distance !== undefined) {
    const distanceInUnit = normalizePaceUnit(userUnit) === "mi"
      ? row.distance / KM_PER_MILE
      : row.distance;
    return {
      id: `blk_${builderIdCounter++}`,
      type,
      targetType: "distance",
      value: formatBuilderDistanceValue(distanceInUnit, userUnit),
      pace: type === "rest" ? "" : kmhToPace(row.speedKmh, userUnit),
      speed: speedValue
    };
  }
  return {
    id: `blk_${builderIdCounter++}`,
    type,
    targetType: "time",
    value: row.duration || "00:01:00",
    pace: type === "rest" ? "" : kmhToPace(row.speedKmh, userUnit),
    speed: speedValue
  };
}

function displayItemsToBuilderBlocks(items, userUnit) {
  const blocks = [];
  for (const item of items || []) {
    if (item.kind === "group") {
      blocks.push({
        id: `blk_${builderIdCounter++}`,
        type: "repeat",
        repeats: parseRepeatCountLabel(item.label),
        children: displayItemsToBuilderBlocks(item.items || [], userUnit)
      });
      continue;
    }
    if (item.kind === "row" && item.row) {
      blocks.push(rowToBuilderBlock(item.row, userUnit));
    }
  }
  return blocks;
}

function renderRows(items, userUnit) {
  rowsOutput.setAttribute("data-view", "parsed-text");
  if (!items.length || !countDisplayRows(items)) {
    rowsOutput.innerHTML = "<p>No workout steps recognized. Try a simpler format first.</p>";
    return;
  }

  const paceSuffix = userUnit === "mi" ? "/mi" : "/km";

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
    const targetLabel = row.distance !== undefined ? "Distance" : "Time";
    const target = row.distance !== undefined
      ? `${normalizePaceUnit(userUnit) === "mi" ? (row.distance / KM_PER_MILE).toFixed(2) : row.distance} ${normalizePaceUnit(userUnit) === "mi" ? "mi" : "km"}`
      : row.duration;
    const incline = Number.isFinite(row.incline) ? ` | incline ${formatIncline(row.incline)}%` : "";
    const speedAndPace = `${kmhToPace(row.speedKmh, userUnit)}${paceSuffix} | ${formatSpeedForUnit(row.speedKmh, userUnit)}`;
    return `<div class="row-item"><span><strong>${targetLabel}:</strong> ${target}${incline}</span><span><strong>Pace:</strong> ${speedAndPace}</span><div class="row-source">${row.source}</div></div>`;
  }

  function renderItems(entryItems, depth = 0) {
    const groupedItems = groupRowsIntoSections(entryItems);

    return groupedItems.map((item) => {
      if (item.kind === "group") {
        return `<div class="repeat-block repeat-block-repeat depth-${depth}"><div class="repeat-header repeat-header-repeat">${item.label}</div><div class="repeat-body">${renderItems(item.items || [], depth + 1)}</div></div>`;
      }

      if (item.kind === "section") {
        const sectionKey = item.label.toLowerCase().replace(/[^a-z]+/g, "-");
        const sectionClass = `repeat-header-${sectionKey}`;
        const sectionBlockClass = `repeat-block-${sectionKey}`;
        const sectionRows = (item.items || []).map((entry) => renderRowItem(entry.row)).join("");
        return `<div class="repeat-block ${sectionBlockClass} depth-${depth}"><div class="repeat-header ${sectionClass}">${item.label}</div><div class="repeat-body">${sectionRows}</div></div>`;
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

function setOcrDebugText(text) {
  if (!ocrDebugWrap || !ocrDebugOutput) return;
  const value = String(text || "").trim();
  ocrDebugOutput.value = value;
  ocrDebugWrap.hidden = !value;
  ocrDebugWrap.open = Boolean(value);
}

function updateEditParsedButton() {
  const editableMode = inputMode === "text" || inputMode === "image";
  const items = inputMode === "image" ? lastParsedItemsByMode.image : lastParsedItemsByMode.text;
  const hasParsed = countDisplayRows(items) > 0;
  editParsedBtn.hidden = !editableMode;
  editParsedBtn.disabled = !editableMode || !hasParsed;
}

function updateGenerateButtonPlacement() {
  const isBuild = inputMode === "build";
  optionsGenerateWrap.hidden = isBuild;
  parseXmlBtn.hidden = !isBuild;
  builderInputModeField.hidden = !isBuild;
}

function saveModeSnapshot(mode) {
  if (mode === "text") {
    modeSnapshots.text.rowsHtml = rowsOutput.innerHTML;
    modeSnapshots.text.xml = xmlOutput.value;
    modeSnapshots.text.statusMessage = statusOutput.textContent || "";
    modeSnapshots.text.statusError = statusOutput.classList.contains("error");
    return;
  }
  if (mode === "image") {
    modeSnapshots.image.rowsHtml = rowsOutput.innerHTML;
    modeSnapshots.image.xml = xmlOutput.value;
    modeSnapshots.image.statusMessage = statusOutput.textContent || "";
    modeSnapshots.image.statusError = statusOutput.classList.contains("error");
    return;
  }
  if (mode === "build") {
    modeSnapshots.build.xml = xmlOutput.value;
    modeSnapshots.build.statusMessage = statusOutput.textContent || "";
    modeSnapshots.build.statusError = statusOutput.classList.contains("error");
  }
}

function restoreModeSnapshot(mode) {
  if (mode === "text") {
    const hasRowsHtml = Boolean(modeSnapshots.text.rowsHtml && modeSnapshots.text.rowsHtml.trim());
    rowsOutput.innerHTML = hasRowsHtml ? modeSnapshots.text.rowsHtml : MODE_PLACEHOLDERS.text;
    xmlOutput.value = modeSnapshots.text.xml || "";
    downloadBtn.disabled = !xmlOutput.value.trim();
    if (modeSnapshots.text.statusMessage) {
      setStatus(modeSnapshots.text.statusMessage, modeSnapshots.text.statusError);
    } else {
      setStatus("Text mode active. Click Generate workout.");
    }
    return;
  }
  if (mode === "build") {
    renderBuilderEditor();
    xmlOutput.value = modeSnapshots.build.xml || "";
    downloadBtn.disabled = !xmlOutput.value.trim();
    if (modeSnapshots.build.statusMessage) {
      setStatus(modeSnapshots.build.statusMessage, modeSnapshots.build.statusError);
    } else {
      setStatus("Build mode active. Add/drag blocks, then click Generate XML.");
    }
    return;
  }

  const hasRowsHtml = Boolean(modeSnapshots.image.rowsHtml && modeSnapshots.image.rowsHtml.trim());
  rowsOutput.innerHTML = hasRowsHtml ? modeSnapshots.image.rowsHtml : MODE_PLACEHOLDERS.image;
  xmlOutput.value = modeSnapshots.image.xml || "";
  downloadBtn.disabled = !xmlOutput.value.trim();
  if (modeSnapshots.image.statusMessage) {
    setStatus(modeSnapshots.image.statusMessage, modeSnapshots.image.statusError);
  } else {
    setStatus("Image mode active. Upload screenshot and click Generate workout.");
  }
}

function setInputMode(mode) {
  const previousMode = inputMode;
  const prevTargetMode = getWorkoutTargetModeForMode(previousMode);
  if (previousMode && previousMode !== mode) {
    saveModeSnapshot(previousMode);
  }
  inputMode = mode;
  const nextTargetMode = getWorkoutTargetModeForMode(mode);
  if (previousMode && previousMode !== mode && prevTargetMode !== nextTargetMode) {
    const unit = currentUserUnit();
    convertUserPaceInputs(unit, unit, prevTargetMode, nextTargetMode);
  }
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

  if (mode === "build") {
    if (!builderBlocks.length) {
      const unit = currentUserUnit();
      builderBlocks = [newBuilderBlock("warmup", unit), newBuilderBlock("run", unit), newBuilderBlock("cooldown", unit)];
    }
    restoreModeSnapshot("build");
  } else if (mode === "text") {
    destroyBuilderSortables();
    rowsOutput.setAttribute("data-view", "parsed-text");
    restoreModeSnapshot("text");
  } else {
    destroyBuilderSortables();
    rowsOutput.setAttribute("data-view", "image");
    restoreModeSnapshot("image");
  }
  updatePaceLabels(currentUserUnit(), nextTargetMode);
  updateEditParsedButton();
  updateGenerateButtonPlacement();
}

function updatePaceLabels(unit, targetMode = getWorkoutTargetModeForMode(inputMode)) {
  if (targetMode === "speed") {
    const label = speedUnitLabel(unit);
    walkingTargetLabel.textContent = `Walking speed (${label})`;
    conversationalTargetLabel.textContent = `Conversational speed (${label})`;
    return;
  }
  const suffix = unit === "mi" ? "mi" : "km";
  walkingTargetLabel.textContent = `Walking pace (mm:ss/${suffix})`;
  conversationalTargetLabel.textContent = `Conversational pace (mm:ss/${suffix})`;
}

function convertUserPaceInputs(prevUnit, nextUnit, prevTargetMode = getWorkoutTargetModeForMode(inputMode), nextTargetMode = getWorkoutTargetModeForMode(inputMode)) {
  const walkingKmh = parseWorkoutTargetToKmh(walkingTargetInput.value.trim(), prevUnit, prevTargetMode);
  const conversationalKmh = parseWorkoutTargetToKmh(conversationalTargetInput.value.trim(), prevUnit, prevTargetMode);
  if (Number.isFinite(walkingKmh)) {
    walkingTargetInput.value = formatWorkoutTargetFromKmh(walkingKmh, nextUnit, nextTargetMode);
  }
  if (Number.isFinite(conversationalKmh)) {
    conversationalTargetInput.value = formatWorkoutTargetFromKmh(conversationalKmh, nextUnit, nextTargetMode);
  }
}

function onUnitChange() {
  const nextUnit = currentUserUnit();
  const prevUnit = nextUnit === "mi" ? "km" : "mi";
  const targetMode = getWorkoutTargetModeForMode(inputMode);
  convertUserPaceInputs(prevUnit, nextUnit, targetMode, targetMode);
  updatePaceLabels(nextUnit, targetMode);
  if (inputMode === "build" && builderBlocks.length) {
    builderBlocks = convertBuilderUnits(builderBlocks, prevUnit, nextUnit);
    renderBuilderEditor();
  }
}

function onBuilderInputModeChange() {
  const nextTargetMode = getWorkoutTargetModeForMode(inputMode);
  const prevTargetMode = nextTargetMode === "speed" ? "pace" : "speed";
  const unit = currentUserUnit();
  convertUserPaceInputs(unit, unit, prevTargetMode, nextTargetMode);
  updatePaceLabels(unit, nextTargetMode);
  if (inputMode === "build") {
    renderBuilderEditor();
  }
}

unitKmInput.addEventListener("change", onUnitChange);
unitMilesInput.addEventListener("change", onUnitChange);
buildInputPace.addEventListener("change", onBuilderInputModeChange);
buildInputSpeed.addEventListener("change", onBuilderInputModeChange);
modeTextBtn.addEventListener("click", () => setInputMode("text"));
modeImageBtn.addEventListener("click", () => setInputMode("image"));
modeBuildBtn.addEventListener("click", () => setInputMode("build"));
parseXmlBtn.addEventListener("click", () => parseBtn.click());
editParsedBtn.addEventListener("click", () => {
  const sourceMode = inputMode === "image" ? "image" : "text";
  const sourceItems = sourceMode === "image" ? lastParsedItemsByMode.image : lastParsedItemsByMode.text;
  if (countDisplayRows(sourceItems) === 0) {
    setStatus("Generate a workout in this tab first.", true);
    return;
  }

  const copiedBlocks = displayItemsToBuilderBlocks(sourceItems, currentUserUnit());
  if (!copiedBlocks.length) {
    setStatus("Could not convert parsed rows to builder blocks.", true);
    return;
  }

  builderBlocks = copiedBlocks;
  modeSnapshots.build.xml = "";
  modeSnapshots.build.statusMessage = sourceMode === "image"
    ? "Workout copied from Runna Workout Image. Review/edit blocks, then click Generate XML."
    : "Workout copied from Runna Workout Text. Review/edit blocks, then click Generate XML.";
  modeSnapshots.build.statusError = false;
  setInputMode("build");
});
xmlUnitKmInput.addEventListener("change", () => {
  if ((inputMode === "text" || inputMode === "build" || inputMode === "image") && xmlOutput.value.trim()) {
    parseBtn.click();
  }
});
xmlUnitMilesInput.addEventListener("change", () => {
  if ((inputMode === "text" || inputMode === "build" || inputMode === "image") && xmlOutput.value.trim()) {
    parseBtn.click();
  }
});

rowsOutput.addEventListener("click", (event) => {
  if (inputMode !== "build") return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.id === "addBlockInRowsBtn") {
    builderBlocks.push(newBuilderBlock("run", currentUserUnit()));
    renderBuilderEditor();
    return;
  }

  const action = target.dataset.action;
  const blockId = target.dataset.builderId;
  if (!action || !blockId) return;

  if (action === "remove") {
    builderBlocks = removeBlockById(builderBlocks, blockId).blocks;
    renderBuilderEditor();
    return;
  }

  if (action === "add-child") {
    builderBlocks = updateBlockById(builderBlocks, blockId, (block) => {
      if (block.type !== "repeat") return block;
      return { ...block, children: [...(block.children || []), newBuilderBlock("run", currentUserUnit())] };
    });
    renderBuilderEditor();
  }
});

function onBuilderFieldEdit(event) {
  if (inputMode !== "build") return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const blockId = target.dataset.builderId;
  const field = target.dataset.field;
  if (!blockId || !field) return;
  const deferRenderWhileTyping = event.type === "input" && (field === "value" || field === "pace" || field === "speed");

  builderBlocks = updateBlockById(builderBlocks, blockId, (block) => {
    const value = target.value;

    if (field === "type") {
      const nextType = value;
      if (nextType === "repeat") {
        return {
          id: block.id,
          type: "repeat",
          repeats: 2,
          children: block.type === "repeat" ? (block.children || []) : []
        };
      }
      const unit = currentUserUnit();
      const existingSpeedKmh = getBuilderBlockSpeedKmh(block, unit) || parsePaceToKmh("6:00", unit) || 10;
      return {
        id: block.id,
        type: nextType,
        targetType: nextType === "rest" ? "time" : (block.targetType || "distance"),
        value: nextType === "rest"
          ? (parseDurationInputToSeconds(block.value) ? block.value : "00:01:00")
          : (() => {
            const parsed = parseBuilderDistanceValue(block.value, currentUserUnit());
            if (!parsed) return formatBuilderDistanceValue(1, currentUserUnit());
            const distanceInCurrentUnit = normalizePaceUnit(currentUserUnit()) === "mi"
              ? parsed.distanceKm / KM_PER_MILE
              : parsed.distanceKm;
            return formatBuilderDistanceValue(distanceInCurrentUnit, currentUserUnit());
          })(),
        pace: nextType === "rest" ? "" : kmhToPace(existingSpeedKmh, unit),
        speed: nextType === "rest" ? "" : formatBuilderSpeedValue(existingSpeedKmh, unit)
      };
    }

    if (block.type === "repeat" && field === "repeats") {
      return { ...block, repeats: Math.max(1, Number(value) || 1) };
    }
    if (field === "targetType") {
      if (value === "time") {
        return {
          ...block,
          targetType: "time",
          value: parseDurationInputToSeconds(block.value) ? block.value : "00:01:00"
        };
      }
      const parsed = parseBuilderDistanceValue(block.value, currentUserUnit());
      return {
        ...block,
        targetType: "distance",
        value: parsed
          ? formatBuilderDistanceValue(
            normalizePaceUnit(currentUserUnit()) === "mi"
              ? parsed.distanceKm / KM_PER_MILE
              : parsed.distanceKm,
            currentUserUnit()
          )
          : formatBuilderDistanceValue(1, currentUserUnit())
      };
    }
    if (field === "value") {
      if (block.targetType === "distance") {
        if (event.type !== "change") return { ...block, value };
        const parsed = parseBuilderDistanceValue(value, currentUserUnit());
        if (!parsed) return { ...block, value };
        const distanceInCurrentUnit = normalizePaceUnit(currentUserUnit()) === "mi"
          ? parsed.distanceKm / KM_PER_MILE
          : parsed.distanceKm;
        return { ...block, value: formatBuilderDistanceValue(distanceInCurrentUnit, currentUserUnit()) };
      }
      if (block.targetType === "time" && event.type === "change") {
        return { ...block, value: parseDurationInputToSeconds(value) ? value : "00:01:00" };
      }
      return { ...block, value };
    }
    if (field === "pace") {
      if (event.type !== "change") return block;
      const normalizedPace = normalizePaceInput(value, currentUserUnit());
      if (!normalizedPace) {
        setStatus("Pace must be in mm:ss format with seconds between 00 and 59.", true);
        const fallbackPace = normalizePaceInput(block.pace, currentUserUnit()) || "6:00";
        const fallbackKmh = parsePaceToKmh(fallbackPace, currentUserUnit()) || 10;
        return { ...block, pace: fallbackPace, speed: formatBuilderSpeedValue(fallbackKmh, currentUserUnit()) };
      }
      const normalizedKmh = parsePaceToKmh(normalizedPace, currentUserUnit());
      return {
        ...block,
        pace: normalizedPace,
        speed: formatBuilderSpeedValue(normalizedKmh, currentUserUnit())
      };
    }
    if (field === "speed") {
      if (event.type !== "change") return block;
      const speedKmh = parseSpeedToKmh(value, currentUserUnit());
      if (!Number.isFinite(speedKmh)) {
        setStatus("Speed must be a positive number.", true);
        const fallbackKmh = parseSpeedToKmh(block.speed, currentUserUnit()) || parsePaceToKmh(block.pace || "", currentUserUnit()) || 10;
        return {
          ...block,
          speed: formatBuilderSpeedValue(fallbackKmh, currentUserUnit()),
          pace: kmhToPace(fallbackKmh, currentUserUnit())
        };
      }
      return {
        ...block,
        speed: formatBuilderSpeedValue(speedKmh, currentUserUnit()),
        pace: kmhToPace(speedKmh, currentUserUnit())
      };
    }
    return block;
  });

  if (!deferRenderWhileTyping) {
    renderBuilderEditor();
  }
}

rowsOutput.addEventListener("input", onBuilderFieldEdit);
rowsOutput.addEventListener("change", onBuilderFieldEdit);

parseBtn.addEventListener("click", async () => {
  const text = workoutInput.value.trim();
  const userUnit = currentUserUnit();
  const workoutTargetMode = getWorkoutTargetModeForMode(inputMode);
  const walkingSpeedKmh = parseWorkoutTargetToKmh(walkingTargetInput.value.trim(), userUnit, workoutTargetMode);
  const conversationalSpeedKmh = parseWorkoutTargetToKmh(conversationalTargetInput.value.trim(), userUnit, workoutTargetMode);
  const defaultInclineRaw = defaultInclineInput.value.trim();
  const defaultIncline = defaultInclineRaw === "" ? null : Number(defaultInclineRaw);

  if (!Number.isFinite(walkingSpeedKmh) || !Number.isFinite(conversationalSpeedKmh)) {
    setStatus(
      workoutTargetMode === "speed"
        ? "Provide valid walking and conversational speeds as positive numbers."
        : "Provide valid walking and conversational paces in mm:ss format (seconds 00-59).",
      true
    );
    return;
  }

  if (defaultInclineRaw !== "" && !Number.isFinite(defaultIncline)) {
    setStatus("Default incline must be a number when provided.", true);
    return;
  }

  let rows = [];
  let displayItems = [];
  let parsedSourceText = text;
  if (inputMode !== "image") {
    setOcrDebugText("");
  }

  if (inputMode === "build") {
    const builderInputMode = currentBuilderInputMode();
    const invalidInputBlock = findFirstInvalidBuilderInput(builderBlocks, userUnit, builderInputMode);
    if (invalidInputBlock) {
      renderBuilderEditor();
      setStatus(
        builderInputMode === "speed"
          ? `Invalid speed in ${getBlockTypeLabel(invalidInputBlock.type)} block. Use a positive number.`
          : `Invalid pace in ${getBlockTypeLabel(invalidInputBlock.type)} block. Use mm:ss with seconds 00-59.`,
        true
      );
      return;
    }
    rows = buildRowsFromBuilder(userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline, builderInputMode);
  } else if (inputMode === "image") {
    const imageFile = workoutImageInput?.files?.[0];
    if (!imageFile) {
      setOcrDebugText("");
      setStatus("Upload a workout screenshot first.", true);
      return;
    }
    try {
      const ocrResult = await extractWorkoutTextFromImageFile(imageFile, {
        engine: currentOcrEngine(),
        preprocess: shouldPreprocessOcr()
      });
      parsedSourceText = ocrResult.text || "";
      setOcrDebugText(ocrResult.debug || parsedSourceText);
    } catch (error) {
      setOcrDebugText("");
      setStatus(error instanceof Error ? error.message : "Failed to read workout image.", true);
      return;
    }
    if (!parsedSourceText) {
      setOcrDebugText("");
      setStatus("Could not extract text from the image.", true);
      return;
    }
    const parsedFromImage = parseRunnaImageWorkout(
      parsedSourceText,
      userUnit,
      walkingSpeedKmh,
      conversationalSpeedKmh,
      defaultIncline
    );
    rows = parsedFromImage.rows || [];
    displayItems = parsedFromImage.items || [];

    // Fallback to text parser when image-structured parsing cannot identify steps.
    if (!rows.length) {
      rows = parseWorkout(parsedSourceText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
      displayItems = buildDisplayItems(parsedSourceText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
    }
  } else {
    if (!parsedSourceText) {
      setStatus("Paste a workout text first.", true);
      return;
    }
    rows = parseWorkout(parsedSourceText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
    displayItems = buildDisplayItems(parsedSourceText, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  }

  const xmlUnit = currentXmlUnit();
  if (!rows.length) {
    if (inputMode === "build") {
      renderBuilderEditor();
    } else {
      renderRows([], userUnit);
      if (inputMode === "image") {
        lastParsedItemsByMode.image = [];
      } else {
        lastParsedItemsByMode.text = [];
      }
      updateEditParsedButton();
    }
    xmlOutput.value = "";
    downloadBtn.disabled = true;
    setStatus(inputMode === "build" ? "No valid builder blocks found. Fill block values." : "No recognizable workout steps were found.", true);
    return;
  }

  const xml = generateXml(rows, xmlUnit);
  if (inputMode === "build") {
    renderBuilderEditor();
  } else {
    renderRows(displayItems, userUnit);
    if (inputMode === "image") {
      lastParsedItemsByMode.image = cloneDisplayItems(displayItems);
    } else {
      lastParsedItemsByMode.text = cloneDisplayItems(displayItems);
    }
    updateEditParsedButton();
  }
  xmlOutput.value = xml;
  downloadBtn.disabled = false;
  setStatus(`Generated ${rows.length} rows (${xmlUnit === "mi" ? "mi/mph" : "km/kmh"} XML).`);
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
