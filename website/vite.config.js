import { resolve } from "node:path";
import { defineConfig } from "vite";

const pages = ["index", "compare", "landscape", "methods", "item-explorer"];

export default defineConfig({
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, "src", `${p}.html`)]))
    }
  },
  server: { host: true }
});
