// react-ai-assistant/vite.config.ts

import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// IMPORTANT: base must match your GitHub Pages repo name: /ScribeAI/
export default defineConfig({
  base: "/ScribeAI/",

  server: {
    host: "0.0.0.0",
    port: 8080,
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
