import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const fromRoot = (path: string) => decodeURI(new URL(path, import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/commands",
    ],
    alias: {
      "@codemirror/state": fromRoot("./node_modules/@codemirror/state"),
      "@codemirror/view": fromRoot("./node_modules/@codemirror/view"),
      "@codemirror/language": fromRoot("./node_modules/@codemirror/language"),
      "@codemirror/commands": fromRoot("./node_modules/@codemirror/commands"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*_test.ts"],
  },
});
