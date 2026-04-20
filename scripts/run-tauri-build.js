import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RELEASE_DIR = path.join(ROOT, "src-tauri", "target", "release");
const BUNDLE_DIR = path.join(RELEASE_DIR, "bundle");
const SIMPLE_BUILD_DIR = path.join(ROOT, "build");
const EXTRA_ARGS = process.argv.slice(2).filter((arg) => arg !== "--");

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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  ensureDir(dirPath);
}

function copyIfExists(fromPath, toPath) {
  if (!fs.existsSync(fromPath)) return false;
  ensureDir(path.dirname(toPath));
  fs.copyFileSync(fromPath, toPath);
  return true;
}

function copyMatchingFiles(fromDir, matcher, toDir) {
  if (!fs.existsSync(fromDir)) return [];
  ensureDir(toDir);
  const copied = [];
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!matcher(entry.name)) continue;
    const source = path.join(fromDir, entry.name);
    const target = path.join(toDir, entry.name);
    fs.copyFileSync(source, target);
    copied.push(target);
  }
  return copied;
}

function collectBuildArtifacts() {
  const platformKey = process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "macos"
      : "linux";
  const outputDir = path.join(SIMPLE_BUILD_DIR, platformKey);
  clearDir(outputDir);

  const copied = [];

  if (platformKey === "windows") {
    copied.push(
      ...copyMatchingFiles(
        path.join(BUNDLE_DIR, "nsis"),
        (name) => name.toLowerCase().endsWith(".exe"),
        outputDir,
      ),
    );
    const appExe = path.join(RELEASE_DIR, "auto-osc-tauri.exe");
    if (copyIfExists(appExe, path.join(outputDir, "Autocom.exe"))) {
      copied.push(path.join(outputDir, "Autocom.exe"));
    }
  }

  if (platformKey === "macos") {
    copied.push(
      ...copyMatchingFiles(
        path.join(BUNDLE_DIR, "dmg"),
        (name) => name.toLowerCase().endsWith(".dmg"),
        outputDir,
      ),
    );
  }

  if (platformKey === "linux") {
    copied.push(
      ...copyMatchingFiles(
        path.join(BUNDLE_DIR, "appimage"),
        (name) => name.toLowerCase().endsWith(".appimage"),
        outputDir,
      ),
    );
    copied.push(
      ...copyMatchingFiles(
        path.join(BUNDLE_DIR, "deb"),
        (name) => name.toLowerCase().endsWith(".deb"),
        outputDir,
      ),
    );
  }

  if (!copied.length) {
    console.log(`[build] No distributable artifacts found under ${BUNDLE_DIR}`);
    return;
  }

  console.log("\n[build] Copied distributable artifacts to:");
  for (const file of copied) {
    console.log(`- ${path.relative(ROOT, file)}`);
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
      ["/d", "/c", tauriCommand, "build", ...EXTRA_ARGS],
      {
        cwd: ROOT,
        env,
        stdio: "inherit",
      },
    )
  : spawn(tauriCommand, ["build", ...EXTRA_ARGS], {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });

child.on("exit", (code) => {
  if ((code ?? 1) === 0) {
    try {
      collectBuildArtifacts();
    } catch (error) {
      console.error(`[build] Artifact collection failed: ${String(error)}`);
      process.exit(1);
    }
  }
  process.exit(code ?? 1);
});
