import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: "jigma-bricks/assets",
    lib: {
      entry: "lib/plugin/jigma-core-entry.ts",
      name: "JigmaCoreBundle",
      formats: ["iife"],
      fileName: () => "jigma-core.js",
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
