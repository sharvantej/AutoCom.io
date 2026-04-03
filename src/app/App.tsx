import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
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

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.16 * motionScale, ease: EASE }}
    >
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
