import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Repo has one shared .env at the monorepo root (see .env.example),
  // not a separate frontend/.env - point Vite's env loading there.
  envDir: "..",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
