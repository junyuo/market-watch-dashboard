import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/market-watch-dashboard/",
  plugins: [react()],
});
