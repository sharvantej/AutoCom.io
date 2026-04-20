import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { execSync } from "node:child_process";

function safeGit(command, fallback = "N/A") {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim() || fallback;
  } catch {
    return fallback;
  }
}

const buildDate = new Date().toISOString();
const gitBranch = safeGit("git rev-parse --abbrev-ref HEAD");
const gitCommit = safeGit("git rev-parse --short HEAD");

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_BUILD_DATE": JSON.stringify(buildDate),
    "import.meta.env.VITE_GIT_BRANCH": JSON.stringify(gitBranch),
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(gitCommit),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }
          if (id.includes("lucide-react") || id.includes("@hugeicons")) {
            return "icons-vendor";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts-vendor";
          }
          return "vendor";
        },
      },
    },
  },
  clearScreen: false,
  server: {
    host: true,
    port: 1430,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
