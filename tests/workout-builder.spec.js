const { test, expect } = require("@playwright/test");

test("shows km by default and updates labels on miles toggle", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#unitKm")).toBeChecked();
  await expect(page.locator("#walkingTargetLabel")).toHaveText("Walking pace (mm:ss/km)");
  await expect(page.locator("#conversationalTargetLabel")).toHaveText("Conversational pace (mm:ss/km)");

  await page.locator('label[for="unitMiles"]').click();

  await expect(page.locator("#unitMiles")).toBeChecked();
  await expect(page.locator("#walkingTargetLabel")).toHaveText("Walking pace (mm:ss/mi)");
  await expect(page.locator("#conversationalTargetLabel")).toHaveText("Conversational pace (mm:ss/mi)");
});

test("converts user pace values when unit changes", async ({ page }) => {
  await page.goto("/");

  await page.fill("#walkingTarget", "15:00");
  await page.fill("#conversationalTarget", "8:06");

  await page.locator('label[for="unitMiles"]').click();

  await expect(page.locator("#walkingTarget")).not.toHaveValue("15:00");
  await expect(page.locator("#conversationalTarget")).not.toHaveValue("8:06");

  await page.locator('label[for="unitKm"]').click();
  await expect(page.locator("#walkingTarget")).toHaveValue("15:00");
  await expect(page.locator("#conversationalTarget")).toHaveValue("8:06");
});

test("generates parsed rows and XML", async ({ page }) => {
  await page.goto("/");

  await page.fill(
    "#workoutInput",
    "1km warm up at a conversational pace (no faster than 7:00/km), 60s walking rest 1km at 6:00/km, 60s walking rest 1km cool down at a conversational pace"
  );
  await page.fill("#walkingTarget", "15:00");
  await page.fill("#conversationalTarget", "8:06");

  await page.click("#parseBtn");

  await expect(page.locator("#status")).toContainText("Generated");
  await expect(page.locator(".row-item")).toHaveCount(5);

  const xml = await page.locator("#xmlOutput").inputValue();
  expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(xml).toContain("<rows>");
  expect(xml).toContain('forcespeed="1"');
  expect(xml).toContain("</rows>");
});

test("parses miles image workouts with repeat blocks", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "2:36",
      "Week 9",
      "Description",
      "Warm-Up",
      "1.1mi at a conversational pace",
      "No faster than 11:20/mi",
      "90s walking rest",
      "Repeat x3",
      "0.62mi at 9:40/mi",
      "9:20-10:00/mi",
      "90s walking rest",
      "Cool Down",
      "0.75mi at a conversational pace",
      "or slower!"
    ].join("\n"),
    "mi",
    4.0,
    7.4,
    null
  ));

  expect(parsed.rows).toHaveLength(9);
  expect(parsed.rows.map((row) => row.type)).toEqual([
    "warmup",
    "walkrest",
    "run",
    "walkrest",
    "run",
    "walkrest",
    "run",
    "walkrest",
    "cooldown"
  ]);
  expect(parsed.rows[0].distance).toBeCloseTo(1.77, 2);
  expect(parsed.rows[2].distance).toBeCloseTo(0.998, 2);
  expect(parsed.rows[2].speedKmh).toBeCloseTo(10.0, 1);

  const repeatGroup = parsed.items.find((item) => item.kind === "group");
  expect(repeatGroup).toBeTruthy();
  expect(repeatGroup.label).toBe("Repeat x3");
});

test("ignores pre-description stat card noise in image parsing", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "DISTANCE TIME AVG PACE",
      "3.32 mi",
      "39:52",
      "11:59 /mi",
      "Sources: Garmin Forerunner 955, Strava",
      "Description",
      "Warm-Up",
      "1mi at a conversational pace",
      "No faster than 11:25/mi",
      "Session",
      "2mi at 10:10/mi",
      "150s walking rest",
      "Cool Down",
      "0.5mi at a conversational pace",
      "or slower!"
    ].join("\n"),
    "mi",
    4.0,
    7.4,
    null
  ));

  expect(parsed.rows).toHaveLength(4);
  expect(parsed.rows.map((row) => row.type)).toEqual(["warmup", "run", "walkrest", "cooldown"]);
  expect(parsed.rows.some((row) => Number(row.distance || 0).toFixed(2) === "5.34")).toBeFalsy();
});

test("parses split interval speed lines from OCR-like screenshot text", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "Description",
      "Warm-Up",
      "2km at a conversational pace",
      "No faster than 8.5kph",
      "90s walking rest",
      "Repeat x3",
      "400m at",
      "10.4-11.0kph",
      "60s walking rest",
      "Rest",
      "60s walking rest",
      "Repeat x3",
      "400m at",
      "10.4-11.0kph",
      "60s walking rest",
      "Rest",
      "60s walking rest",
      "Cool Down",
      "2km at a conversational pace",
      "or slower!"
    ].join("\n"),
    "km",
    4.0,
    7.4,
    null
  ));

  expect(parsed.rows).toHaveLength(17);
  expect(parsed.rows[0].type).toBe("warmup");
  expect(parsed.rows[0].speedKmh).toBeCloseTo(8.5, 1);
  const runRows = parsed.rows.filter((row) => row.type === "run");
  expect(runRows).toHaveLength(6);
  expect(runRows[0].distance).toBeCloseTo(0.4, 2);
  expect(runRows[0].speedKmh).toBeCloseTo(10.7, 1);
});

test("uses step-number anchors when present in OCR text", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "400m Repeats",
      "Description",
      "Warm-Up",
      "1",
      "2km at a conversational pace",
      "No faster than 8.5kph",
      "2",
      "90s walking rest",
      "Repeat x3",
      "3",
      "400m at",
      "10.4-11.0kph",
      "60s walking rest",
      "Cool Down",
      "4",
      "2km at a conversational pace"
    ].join("\n"),
    "km",
    4.0,
    7.4,
    null
  ));

  expect(parsed.rows.some((row) => row.type === "run")).toBeTruthy();
  expect(parsed.rows.some((row) => row.type === "warmup")).toBeTruthy();
  expect(parsed.rows.some((row) => row.type === "cooldown")).toBeTruthy();
  expect(parsed.rows.some((row) => row.type === "walkrest")).toBeTruthy();
});

test("detects repeat markers written as xN in OCR text", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "Description",
      "Warm-Up",
      "1",
      "2km at a conversational pace",
      "2",
      "90s walking rest",
      "x3",
      "3",
      "400m at 10.7kph",
      "60s walking rest",
      "Cool Down",
      "4",
      "2km at a conversational pace"
    ].join("\n"),
    "km",
    4.0,
    7.4,
    null
  ));

  const repeatGroup = parsed.items.find((item) => item.kind === "group" && item.label === "Repeat x3");
  expect(repeatGroup).toBeTruthy();
});

test("detects OCR-mangled repeat labels", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "Description",
      "Warm-Up",
      "1",
      "2km at a conversational pace",
      "2",
      "90s walking rest",
      "epeat x3",
      "3",
      "400m at 10.7kph",
      "60s walking rest",
      "Cool Down",
      "4",
      "2km at a conversational pace"
    ].join("\n"),
    "km",
    4.0,
    7.4,
    null
  ));

  const repeatGroup = parsed.items.find((item) => item.kind === "group" && item.label === "Repeat x3");
  expect(repeatGroup).toBeTruthy();
});

test("does not invent repeat blocks when OCR misses repeat header text", async ({ page }) => {
  await page.goto("/");

  const parsed = await page.evaluate(() => parseRunnaImageWorkout(
    [
      "Description",
      "1",
      "2km at a conversational pace",
      "2",
      "90s walking rest",
      "3",
      "400m at 10.7kph",
      "60s walking rest",
      "4",
      "60s walking rest",
      "5",
      "400m at 10.7kph",
      "60s walking rest",
      "(5)",
      "60s walking rest",
      "7",
      "2km at a conversational pace"
    ].join("\n"),
    "km",
    4.0,
    7.4,
    null
  ));

  const inferredGroups = parsed.items.filter((item) => item.kind === "group" && item.label === "Repeat");
  expect(inferredGroups).toHaveLength(0);
});
