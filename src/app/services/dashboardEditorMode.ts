const DASHBOARD_EDIT_MODE_EVENT = "autocom:dashboard-edit-mode";

export function publishDashboardEditMode(active: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(DASHBOARD_EDIT_MODE_EVENT, { detail: active }),
  );
}

export function subscribeDashboardEditMode(
  listener: (active: boolean) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    listener(Boolean((event as CustomEvent<boolean>).detail));
  };

  window.addEventListener(DASHBOARD_EDIT_MODE_EVENT, handleEvent);
  return () => {
    window.removeEventListener(DASHBOARD_EDIT_MODE_EVENT, handleEvent);
  };
}
