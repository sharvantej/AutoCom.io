import { useEffect, useState } from "react";
import {
  fetchDeviceStatusSnapshot,
  subscribeToDeviceStatusUpdate,
  type DeviceStatusPayload,
} from "../services/events";

function statusesEqual(
  left: Record<string, DeviceStatusPayload>,
  right: Record<string, DeviceStatusPayload>,
): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!(key in right)) return false;
    const a = left[key];
    const b = right[key];
    if (!a && !b) continue;
    if (!a || !b) return false;
    if (
      a.status !== b.status ||
      a.type !== b.type ||
      a.protocol !== b.protocol ||
      a.enabled !== b.enabled ||
      a.host !== b.host ||
      a.port !== b.port ||
      a.lastError !== b.lastError ||
      a.lastSeen !== b.lastSeen ||
      a.httpStatus !== b.httpStatus
    ) {
      return false;
    }
  }
  return true;
}

export function useDeviceStatuses(): Record<string, DeviceStatusPayload> {
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusPayload>>({});

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void fetchDeviceStatusSnapshot().then((snapshot) => {
      if (disposed) return;
      setDeviceStatuses((previous) => (statusesEqual(previous, snapshot) ? previous : snapshot));
    });

    void subscribeToDeviceStatusUpdate((statuses) => {
      if (disposed) return;
      const next = statuses ?? {};
      setDeviceStatuses((previous) => (statusesEqual(previous, next) ? previous : next));
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      })
      .catch((error) => {
        console.error("Failed to subscribe to device status updates:", error);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return deviceStatuses;
}
