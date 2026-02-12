const workoutInput = document.getElementById("workoutInput");
const addBlockBtn = document.getElementById("addBlockBtn");
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
const xmlUnitKmInput = document.getElementById("xmlUnitKm");
const xmlUnitMilesInput = document.getElementById("xmlUnitMiles");

const KM_PER_MILE = 1.60934;
let inputMode = "text";
let builderIdCounter = 1;
let builderBlocks = [];
let builderSortables = [];

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

function formatUnitNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(decimals)).toString();
}

function formatBuilderDistanceValue(distanceInUserUnit, userUnit) {
  return formatUnitNumber(distanceInUserUnit, 3);
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

    if (nextBlock.type !== "rest" && nextBlock.pace) {
      const kmh = parsePaceToKmh(nextBlock.pace, prevUnit);
      if (Number.isFinite(kmh)) {
        nextBlock.pace = kmhToPace(kmh, nextUnit);
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

  return {
    id,
    type,
    targetType: type === "rest" ? "time" : "distance",
    value: type === "rest" ? "00:01:00" : formatBuilderDistanceValue(1, userUnit),
    pace: type === "rest" ? "" : "6:00"
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

function blockToRows(block, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  if (block.type === "repeat") {
    const repeats = Math.max(1, Number(block.repeats) || 1);
    const rows = [];
    for (let i = 0; i < repeats; i += 1) {
      for (const child of block.children || []) {
        rows.push(...blockToRows(child, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline));
      }
    }
    return rows;
  }

  const rowType = toRowType(block.type);
  const targetType = block.targetType || (block.type === "rest" ? "time" : "distance");
  const pace = block.pace || "";
  const paceSpeed = parsePaceToKmh(pace, userUnit);
  const speedKmh = block.type === "rest"
    ? walkingSpeedKmh
    : (paceSpeed || (block.type === "run" ? conversationalSpeedKmh : conversationalSpeedKmh));

  if (targetType === "distance") {
    const parsedDistance = parseBuilderDistanceValue(block.value, userUnit);
    if (!parsedDistance) return [];
    const distanceKm = parsedDistance.distanceKm;
    const unitLabel = normalizePaceUnit(userUnit) === "mi" ? "mi" : "km";
    const displayDistance = normalizePaceUnit(userUnit) === "mi"
      ? distanceKm / KM_PER_MILE
      : distanceKm;
    const source = `${formatUnitNumber(displayDistance, 3)} ${unitLabel} ${getBlockTypeLabel(block.type).toLowerCase()}${block.type !== "rest" ? ` at ${pace}/${unitLabel}` : ""}`;
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
  const source = `${block.value} ${getBlockTypeLabel(block.type).toLowerCase()}${block.type !== "rest" ? ` at ${pace}/${unitLabel}` : ""}`;
  return [{
    type: rowType,
    duration: secondsToDuration(seconds),
    speedKmh,
    source,
    incline: null
  }];
}

function buildRowsFromBuilder(userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline) {
  const rows = [];
  for (const block of builderBlocks) {
    rows.push(...blockToRows(block, userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline));
  }
  return rows;
}

function findFirstInvalidBuilderPace(blocks, userUnit) {
  for (const block of blocks) {
    if (block.type === "repeat") {
      const nested = findFirstInvalidBuilderPace(block.children || [], userUnit);
      if (nested) return nested;
      continue;
    }
    if (block.type !== "rest" && !normalizePaceInput(block.pace, userUnit)) {
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
          <span>Pace (mm:ss/${currentUserUnit()})</span>
          <input type="text" data-builder-id="${block.id}" data-field="pace" value="${block.pace || ""}" placeholder="e.g. 6:00" pattern="\\d{1,2}:[0-5]\\d" title="Use mm:ss (seconds 00-59)">
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
  const repeatRegex = /Repeat the following\s+(\d+)x:\s*-{5,}\s*([\s\S]*?)\s*-{5,}/gi;
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
    items.push(
      ...parseSegmentRows(after, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline)
        .map((row) => ({ kind: "row", row }))
    );
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

function renderRows(items, userUnit) {
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

  if (mode === "build") {
    if (!builderBlocks.length) {
      const unit = currentUserUnit();
      builderBlocks = [newBuilderBlock("warmup", unit), newBuilderBlock("run", unit), newBuilderBlock("cooldown", unit)];
    }
    renderBuilderEditor();
    setStatus("Build mode active. Add/drag blocks, then click Generate workout.");
  } else if (mode === "text") {
    destroyBuilderSortables();
  } else {
    rowsOutput.innerHTML = "<p>Switch to text mode and click Generate workout to preview parsed rows.</p>";
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
  if (inputMode === "build" && builderBlocks.length) {
    builderBlocks = convertBuilderUnits(builderBlocks, prevUnit, nextUnit);
    renderBuilderEditor();
  }
}

unitKmInput.addEventListener("change", onUnitChange);
unitMilesInput.addEventListener("change", onUnitChange);
modeTextBtn.addEventListener("click", () => setInputMode("text"));
modeImageBtn.addEventListener("click", () => setInputMode("image"));
modeBuildBtn.addEventListener("click", () => setInputMode("build"));
addBlockBtn.addEventListener("click", () => {
  builderBlocks.push(newBuilderBlock("run", currentUserUnit()));
  if (inputMode === "build") {
    renderBuilderEditor();
  }
});
xmlUnitKmInput.addEventListener("change", () => {
  if ((inputMode === "text" || inputMode === "build") && xmlOutput.value.trim()) {
    parseBtn.click();
  }
});
xmlUnitMilesInput.addEventListener("change", () => {
  if ((inputMode === "text" || inputMode === "build") && xmlOutput.value.trim()) {
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
  const deferRenderWhileTyping = event.type === "input" && (field === "value" || field === "pace");

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
        pace: nextType === "rest" ? "" : (block.pace || "6:00")
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
        return { ...block, pace: normalizePaceInput(block.pace, currentUserUnit()) || "6:00" };
      }
      return { ...block, pace: normalizedPace };
    }
    return block;
  });

  if (!deferRenderWhileTyping) {
    renderBuilderEditor();
  }
}

rowsOutput.addEventListener("input", onBuilderFieldEdit);
rowsOutput.addEventListener("change", onBuilderFieldEdit);

parseBtn.addEventListener("click", () => {
  const text = workoutInput.value.trim();
  const userUnit = currentUserUnit();
  const walkingSpeedKmh = parsePaceToKmh(walkingTargetInput.value.trim(), userUnit);
  const conversationalSpeedKmh = parsePaceToKmh(conversationalTargetInput.value.trim(), userUnit);
  const defaultInclineRaw = defaultInclineInput.value.trim();
  const defaultIncline = defaultInclineRaw === "" ? null : Number(defaultInclineRaw);

  if (inputMode === "image") {
    setStatus("Runna Workout Image mode is not implemented yet.", true);
    return;
  }

  if (!Number.isFinite(walkingSpeedKmh) || !Number.isFinite(conversationalSpeedKmh)) {
    setStatus("Provide valid walking and conversational paces in mm:ss format (seconds 00-59).", true);
    return;
  }

  if (defaultInclineRaw !== "" && !Number.isFinite(defaultIncline)) {
    setStatus("Default incline must be a number when provided.", true);
    return;
  }

  let rows = [];
  let displayItems = [];

  if (inputMode === "build") {
    const invalidPaceBlock = findFirstInvalidBuilderPace(builderBlocks, userUnit);
    if (invalidPaceBlock) {
      renderBuilderEditor();
      setStatus(`Invalid pace in ${getBlockTypeLabel(invalidPaceBlock.type)} block. Use mm:ss with seconds 00-59.`, true);
      return;
    }
    rows = buildRowsFromBuilder(userUnit, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  } else {
    if (!text) {
      setStatus("Paste a workout text first.", true);
      return;
    }
    rows = parseWorkout(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
    displayItems = buildDisplayItems(text, walkingSpeedKmh, conversationalSpeedKmh, defaultIncline);
  }

  const xmlUnit = currentXmlUnit();
  if (!rows.length) {
    if (inputMode === "build") {
      renderBuilderEditor();
    } else {
      renderRows([], userUnit);
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
