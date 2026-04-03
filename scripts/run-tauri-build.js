import { execSync, spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

function gitValue(args, fallback) {
  try {
    return execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const env = {
  ...process.env,
  VITE_BUILD_DATE: new Date().toISOString().slice(0, 10),
  VITE_GIT_BRANCH: gitValue("rev-parse --abbrev-ref HEAD", "unknown"),
  VITE_GIT_COMMIT: gitValue("rev-parse --short HEAD", "unknown"),
};

const tauriCommand = process.platform === "win32"
  ? path.join(ROOT, "node_modules", ".bin", "tauri.cmd")
  : path.join(ROOT, "node_modules", ".bin", "tauri");

const child = process.platform === "win32"
  ? spawn(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/c", tauriCommand, "build"],
      {
        cwd: ROOT,
        env,
        stdio: "inherit",
      },
    )
  : spawn(tauriCommand, ["build"], {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
