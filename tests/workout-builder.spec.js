const { test, expect } = require("@playwright/test");

test("shows km by default and updates labels on miles toggle", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#unitKm")).toBeChecked();
  await expect(page.locator("#walkingTargetLabel")).toHaveText("Walking pace (mm:ss/km)");
  await expect(page.locator("#conversationalTargetLabel")).toHaveText("Conversational pace (mm:ss/km)");

  await page.locator("#unitMiles").check();

  await expect(page.locator("#unitMiles")).toBeChecked();
  await expect(page.locator("#walkingTargetLabel")).toHaveText("Walking pace (mm:ss/mi)");
  await expect(page.locator("#conversationalTargetLabel")).toHaveText("Conversational pace (mm:ss/mi)");
});

test("converts user pace values when unit changes", async ({ page }) => {
  await page.goto("/");

  await page.fill("#walkingTarget", "15:00");
  await page.fill("#conversationalTarget", "8:06");

  await page.locator("#unitMiles").check();

  await expect(page.locator("#walkingTarget")).not.toHaveValue("15:00");
  await expect(page.locator("#conversationalTarget")).not.toHaveValue("8:06");

  await page.locator("#unitKm").check();
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
