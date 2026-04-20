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

export async function syncStreamDeckSurface(payload: SyncSurfacePayload): Promise<void> {
  await tauriInvoke("streamdeck_sync_surface", { payload });
}

export async function pollStreamDeckButtonEvents(payload: StreamDeckPollRequest): Promise<StreamDeckButtonEvent[]> {
  return tauriInvoke<StreamDeckButtonEvent[]>("streamdeck_poll_button_events", { payload });
}
