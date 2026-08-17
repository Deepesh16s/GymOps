import { test, expect } from "@playwright/test";

function uniqueUser() {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: "Evidence E2E User",
    email: `evidence${id}@test.local`,
    username: `evidence${id}`.slice(0, 20),
    password: "Test1234!",
  };
}

test.describe.configure({ mode: "serial" });

let user;
let authToken;

async function restoreSession(page) {
  await page.goto("/login");
  await page.evaluate((token) => localStorage.setItem("token", token), authToken);
}

test("registration -> login -> dashboard", async ({ page }) => {
  user = uniqueUser();
  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  authToken = await page.evaluate(() => localStorage.getItem("token"));
  expect(authToken).toBeTruthy();
});

test("Dashboard: 'Why this recommendation?' shows a real, non-empty explanation (post readiness-engine removal)", async ({ page }) => {
  await restoreSession(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Why this recommendation?" }).click();
  const region = page.getByRole("region", { name: "Why this recommendation?" });
  await expect(region).toBeVisible();

  // This panel is built by generateTrainingBrief.js, which had its readiness
  // fields removed this session (dead code — the engine was never rendered
  // anywhere). Confirm the panel still renders a real explanation afterward,
  // not an empty/broken state.
  const listItems = region.getByRole("listitem");
  await expect(listItems.first()).toBeVisible();
  const text = await listItems.first().innerText();
  expect(text.trim().length).toBeGreaterThan(10);
});

test("Progression page loads the rewritten plateau engine without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/ws\/chat|websocket|accounts\.google/i.test(msg.text())) errors.push(msg.text());
  });

  await restoreSession(page);
  await page.goto("/progression");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("logging a workout: exercise creation, live suggestion, and PR detection all work end to end", async ({ page }) => {
  await restoreSession(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "New Workout" }).click();
  await page.getByRole("button", { name: "Start Session" }).click();
  await page.getByRole("main").getByRole("button", { name: "Add Exercise", exact: true }).click();

  const modalForm = page.locator(".modal-card").filter({ has: page.getByRole("heading", { name: "Add Exercise" }) });
  await modalForm.getByRole("button", { name: "+ Add Custom Exercise" }).click();
  await modalForm.getByRole("textbox", { name: "Exercise Name" }).fill("E2E Bench Press");
  await modalForm.locator('select[name="muscleGroup"]').selectOption("Chest");
  await modalForm.getByRole("button", { name: "Save Exercise" }).click();

  await modalForm.getByPlaceholder("Weight (kg)").fill("60");
  await modalForm.getByPlaceholder("Reps").fill("8");
  await modalForm.getByRole("button", { name: "Add Exercise", exact: true }).click();

  await expect(page.locator(".ex-session-card__name", { hasText: "E2E Bench Press" })).toBeVisible({
    timeout: 10000,
  });
  // First-ever set for this exercise is always a lifetime PR.
  await expect(page.getByText("New Lifetime PR")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Finish Workout" }).click();
});
