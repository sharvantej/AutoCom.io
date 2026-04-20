import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router";
import { preloadRouteChunks, router } from "./routes";
import { readMotionScale, subscribeMotionSpeedChange } from "./services/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * App is intentionally thin — all context and state live inside the
 * router tree (see routes.tsx → AppRoot) so every route component is
 * guaranteed to be a descendant of AppProvider.
 */
export default function App() {
  const [motionScale, setMotionScale] = useState(() => readMotionScale());

  useEffect(() => subscribeMotionSpeedChange((scale) => setMotionScale(scale)), []);
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      void preloadRouteChunks();
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => preload(), { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(preload, 200);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.16 * motionScale, ease: EASE }}
    >
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
