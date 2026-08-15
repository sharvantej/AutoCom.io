import { tauriInvoke } from "./tauri";

export type StreamDeckDevice = {
  serialNumber: string;
  productName: string;
  keyCount: number;
  rows: number;
  cols: number;
};

export type StreamDeckSyncKey = {
  row: number;
  col: number;
  address?: string;
  label?: string;
  mapped: boolean;
  selected?: boolean;
  textSize?: number;
  textColor?: [number, number, number];
  bgColor?: [number, number, number];
  topbarColor?: [number, number, number];
  textAlign?: "left" | "center" | "right";
  topbarEnabled?: boolean;
};

export type StreamDeckButtonEvent = {
  row: number;
  col: number;
  pressed: boolean;
};

type SyncSurfacePayload = {
  serialNumber?: string;
  cols: number;
  keys: StreamDeckSyncKey[];
};

type StreamDeckPollRequest = {
  serialNumber?: string;
};

export async function listStreamDeckDevices(): Promise<StreamDeckDevice[]> {
  return tauriInvoke<StreamDeckDevice[]>("streamdeck_list_devices");
}

type DeviceListListener = (devices: StreamDeckDevice[]) => void;

let cachedDevices: StreamDeckDevice[] = [];
let devicePollTimerId: number | null = null;
let devicePollInFlight = false;
const deviceListeners = new Set<DeviceListListener>();

async function pollDeviceListOnce(): Promise<void> {
  if (devicePollInFlight) return;
  devicePollInFlight = true;
  try {
    cachedDevices = await listStreamDeckDevices();
  } catch {
    cachedDevices = [];
  } finally {
    devicePollInFlight = false;
  }
  deviceListeners.forEach((listener) => listener(cachedDevices));
}

function onDevicePollFocus(): void {
  void pollDeviceListOnce();
}

/** Fans a single shared device-enumeration poll out to every subscriber
 *  instead of each caller (topbar widget, Button Mapping page) running its
 *  own interval. Concurrent `streamdeck_list_devices` calls re-enumerate the
 *  HID subsystem while a device connection may already be open for polling
 *  button presses / syncing images — on Windows that's a real source of the
 *  intermittent I/O errors the transient-disconnect handling works around,
 *  so cutting the redundant enumeration calls down to one reduces it at the
 *  source. */
export function subscribeStreamDeckDevices(listener: DeviceListListener): () => void {
  deviceListeners.add(listener);
  listener(cachedDevices);
  if (deviceListeners.size === 1 && typeof window !== "undefined") {
    void pollDeviceListOnce();
    devicePollTimerId = window.setInterval(() => void pollDeviceListOnce(), 2000);
    window.addEventListener("focus", onDevicePollFocus);
  }
  return () => {
    deviceListeners.delete(listener);
    if (deviceListeners.size === 0 && typeof window !== "undefined") {
      if (devicePollTimerId !== null) window.clearInterval(devicePollTimerId);
      devicePollTimerId = null;
      window.removeEventListener("focus", onDevicePollFocus);
    }
  };
}

export async function syncStreamDeckSurface(payload: SyncSurfacePayload): Promise<void> {
  await tauriInvoke("streamdeck_sync_surface", { payload });
}

export async function pollStreamDeckButtonEvents(payload: StreamDeckPollRequest): Promise<StreamDeckButtonEvent[]> {
  return tauriInvoke<StreamDeckButtonEvent[]>("streamdeck_poll_button_events", { payload });
}
