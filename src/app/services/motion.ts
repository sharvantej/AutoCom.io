const MOTION_SPEED_EVENT = "autocom:motion-speed";
const MOTION_EASE_STANDARD = "cubic-bezier(0.22, 1, 0.36, 1)";
const TAILWIND_BASE_DURATION_MS = 150;
const TRANSITION_BASE_DURATION_MS = 140;

export const MOTION_SPEED_STORAGE_KEY = "settings.editor.speed";

export type MotionSpeed = "fast" | "normal" | "slow";

type MotionSpeedDetail = {
  speed: MotionSpeed;
  scale: number;
};

function asMotionSpeed(value: string | null | undefined): MotionSpeed {
  if (value === "fast" || value === "slow") return value;
  return "normal";
}

export function getMotionScale(speed: MotionSpeed): number {
  if (speed === "fast") return 0.68;
  if (speed === "slow") return 1.05;
  return 0.82;
}

export function readMotionSpeed(): MotionSpeed {
  if (typeof window === "undefined") return "normal";
  try {
    return asMotionSpeed(window.localStorage.getItem(MOTION_SPEED_STORAGE_KEY));
  } catch {
    return "normal";
  }
}

export function readMotionScale(): number {
  return getMotionScale(readMotionSpeed());
}

export function applyMotionPreferences(speed: MotionSpeed = readMotionSpeed()): number {
  const scale = getMotionScale(speed);
  if (typeof document === "undefined") return scale;

  const root = document.documentElement;
  root.style.setProperty("--motion-scale", String(scale));
  root.style.setProperty(
    "--tw-duration",
    `${Math.round(TAILWIND_BASE_DURATION_MS * scale)}ms`,
  );
  root.style.setProperty(
    "--default-transition-duration",
    `${Math.round(TRANSITION_BASE_DURATION_MS * scale)}ms`,
  );
  root.style.setProperty("--default-transition-timing-function", MOTION_EASE_STANDARD);
  root.style.setProperty("--tw-ease", MOTION_EASE_STANDARD);
  return scale;
}

export function setMotionSpeed(speed: MotionSpeed): number {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MOTION_SPEED_STORAGE_KEY, speed);
    } catch {
      // Ignore localStorage write failures (quota/private mode).
    }
  }

  const scale = applyMotionPreferences(speed);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<MotionSpeedDetail>(MOTION_SPEED_EVENT, {
        detail: { speed, scale },
      }),
    );
  }
  return scale;
}

export function subscribeMotionSpeedChange(
  listener: (scale: number, speed: MotionSpeed) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onMotionChange = (event: Event) => {
    const detail = (event as CustomEvent<MotionSpeedDetail>).detail;
    listener(detail?.scale ?? readMotionScale(), detail?.speed ?? readMotionSpeed());
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== MOTION_SPEED_STORAGE_KEY) return;
    const speed = asMotionSpeed(event.newValue);
    const scale = applyMotionPreferences(speed);
    listener(scale, speed);
  };

  window.addEventListener(MOTION_SPEED_EVENT, onMotionChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MOTION_SPEED_EVENT, onMotionChange);
    window.removeEventListener("storage", onStorage);
  };
}
