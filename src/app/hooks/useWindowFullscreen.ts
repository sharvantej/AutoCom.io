import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../services/tauri";

export function useWindowFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pendingRef = useRef(false);

  const syncState = useCallback(async () => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const state = await win.isFullscreen();
    setIsFullscreen(state);
    return state;
  }, []);

  const setFullscreen = useCallback(async (next: boolean) => {
    if (!isTauri()) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const win = getCurrentWindow();
      await win.setFullscreen(next);
      await syncState();
      window.setTimeout(() => { void syncState(); }, 60);
      window.setTimeout(() => { void syncState(); }, 220);
    } finally {
      pendingRef.current = false;
    }
  }, [syncState]);

  const toggleFullscreen = useCallback(async () => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    await setFullscreen(!current);
  }, [setFullscreen]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;
    let mounted = true;

    const setup = async () => {
      const win = getCurrentWindow();
      if (!mounted) return;
      await syncState();
      if (!mounted) return;
      // Listen for OS-level resize/fullscreen changes to keep state in sync
      unlisten = await win.onResized(syncState);
    };

    const onWindowResize = () => { void syncState(); };
    window.addEventListener("resize", onWindowResize);
    void setup();
    return () => {
      mounted = false;
      if (unlisten) unlisten();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [syncState]);

  return { isFullscreen, setFullscreen, toggleFullscreen };
}
