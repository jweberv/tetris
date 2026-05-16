import { test, expect } from "@playwright/test";

test("home loads Tetris start screen", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "START GAME" }),
  ).toBeVisible();
});
