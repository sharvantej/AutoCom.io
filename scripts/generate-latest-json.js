// Builds the `latest.json` manifest tauri-plugin-updater polls for new releases.
// Run from the directory containing the downloaded release assets
// (installer + .sig files for each platform), with GITHUB_REF_NAME and
// GITHUB_REPOSITORY set (both provided automatically by GitHub Actions).
import fs from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const tag = process.env.GITHUB_REF_NAME;
const repo = process.env.GITHUB_REPOSITORY;

if (!tag || !repo) {
  console.error("[latest.json] GITHUB_REF_NAME and GITHUB_REPOSITORY must be set.");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const releaseBaseUrl = `https://github.com/${repo}/releases/download/${tag}`;

function findSig(matcher) {
  const files = fs.readdirSync(CWD);
  const sigFile = files.find((name) => name.toLowerCase().endsWith(".sig") && matcher(name));
  if (!sigFile) return null;
  const installerFile = sigFile.slice(0, -".sig".length);
  if (!files.includes(installerFile)) return null;
  return {
    signature: fs.readFileSync(path.join(CWD, sigFile), "utf8").trim(),
    url: `${releaseBaseUrl}/${installerFile}`,
  };
}

const platforms = {};

const windows = findSig((name) => name.toLowerCase().endsWith(".exe.sig"));
if (windows) platforms["windows-x86_64"] = windows;

const macos = findSig((name) => name.toLowerCase().endsWith(".dmg.sig"));
if (macos) platforms["darwin-aarch64"] = macos;

// Tauri's updater only supports AppImage on Linux (not .deb) — the .deb is
// a plain install-once package with no self-update support.
const linux = findSig((name) => name.toLowerCase().endsWith(".appimage.sig"));
if (linux) platforms["linux-x86_64"] = linux;

if (Object.keys(platforms).length === 0) {
  console.error("[latest.json] No signed installers found in " + CWD);
  process.exit(1);
}

const manifest = {
  version,
  notes: `See release notes: https://github.com/${repo}/releases/tag/${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};

fs.writeFileSync(path.join(CWD, "latest.json"), JSON.stringify(manifest, null, 2));
console.log(`[latest.json] Wrote manifest for ${Object.keys(platforms).join(", ")}`);
