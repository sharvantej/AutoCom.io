import { isTauri } from "./tauri";
import { pickNewProjectFile, pickOpenProjectFile, pickSaveProjectAs } from "./runtimeState";

/** Browser-mode (non-Tauri) approximation of the native file dialogs, for
 *  local dev testing only — a plain browser tab has no real filesystem-path
 *  concept, so the entered name is used as a synthetic "path" string,
 *  consistent with how the rest of the app keys browser-mode storage. Real
 *  projects (Tauri) are files the user picks/saves via the OS dialog. */
function promptForProjectName(message: string): string | null {
  if (typeof window === "undefined") return null;
  const name = window.prompt(message)?.trim();
  return name ? name : null;
}

export async function openProjectFile(): Promise<string | null> {
  if (isTauri()) return pickOpenProjectFile();
  return promptForProjectName("Open project (enter a name):");
}

export async function newProjectFile(): Promise<string | null> {
  if (isTauri()) return pickNewProjectFile();
  return promptForProjectName("New project name:");
}

export async function saveProjectAs(): Promise<string | null> {
  if (isTauri()) return pickSaveProjectAs();
  return promptForProjectName("Save project as (enter a name):");
}

/** Display name for a project — just the file's basename, since the path
 *  itself is the project's identity now (no separate stored display name
 *  to disambiguate from). */
export function projectDisplayName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
