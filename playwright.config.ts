import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/visual",
  snapshotPathTemplate: "tests/visual-regression/{testFilePath}/{arg}{ext}",
  reporter: "list",
  use: {
    browserName: "chromium",
    headless: true,
  },
});
