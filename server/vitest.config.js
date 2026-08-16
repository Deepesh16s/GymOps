const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js"],
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: ["./tests/globalSetup.js"],
    fileParallelism: false,
  },
});
