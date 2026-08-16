import { defineConfig, devices } from "@playwright/test";

const E2E_SERVER_PORT = 5050;
const E2E_CLIENT_PORT = 5174;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run test:e2e-server",
      cwd: "../server",
      port: E2E_SERVER_PORT,
      timeout: 60000,
      reuseExistingServer: false,
      env: { PORT: String(E2E_SERVER_PORT) },
    },
    {
      command: `npx vite --port ${E2E_CLIENT_PORT} --strictPort`,
      cwd: ".",
      port: E2E_CLIENT_PORT,
      timeout: 60000,
      reuseExistingServer: false,
      env: { VITE_API_URL: `http://localhost:${E2E_SERVER_PORT}/api` },
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
