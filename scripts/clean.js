import { rm } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  path.join(ROOT, "dist"),
  path.join(ROOT, "src-tauri", "target"),
];

await Promise.all(
  TARGETS.map(async (targetPath) => {
    await rm(targetPath, { recursive: true, force: true });
    console.log(`Removed ${path.relative(ROOT, targetPath)}`);
  }),
);
