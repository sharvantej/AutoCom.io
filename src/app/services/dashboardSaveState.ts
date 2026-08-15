// Lets ProjectDashboard (which owns the canvas items / undo stack / save
// flow) tell the rest of the app — namely Layout's heading — whether the
// currently open dashboard has unsaved changes, without threading that
// state through props or context. Mirrors the existing
// services/dashboardEditorMode.ts pub-sub convention.

const DASHBOARD_UNSAVED_EVENT = "autocom:dashboard-unsaved-changes";

export function publishDashboardUnsavedChanges(hasUnsavedChanges: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(DASHBOARD_UNSAVED_EVENT, { detail: hasUnsavedChanges }),
  );
}

export function subscribeDashboardUnsavedChanges(
  listener: (hasUnsavedChanges: boolean) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    listener(Boolean((event as CustomEvent<boolean>).detail));
  };

  window.addEventListener(DASHBOARD_UNSAVED_EVENT, handleEvent);
  return () => {
    window.removeEventListener(DASHBOARD_UNSAVED_EVENT, handleEvent);
  };
}
