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
