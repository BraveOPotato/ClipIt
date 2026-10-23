import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/core"] },
  server: { port: 5173, strictPort: true },
});
