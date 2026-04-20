import type { Connection } from "../types";

export type ObsRuntimeCatalogue = {
  scenes: string[];
  sceneItemsByScene: Record<string, Array<{ sceneItemId: number; sourceName: string }>>;
  inputs: string[];
  transitions: string[];
  profiles: string[];
  sceneCollections: string[];
  outputs: string[];
  hotkeys: string[];
};

type ObsRequestPayload = {
  op: number;
  d?: Record<string, unknown>;
};

const OBS_RPC_VERSION = 1;
const OBS_REQUEST_TIMEOUT_MS = 2200;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getConnectionHost(connection: Connection): string {
  return String(connection.ip ?? "").trim();
}

function getConnectionPort(connection: Connection): number {
  const parsed = Number.parseInt(String(connection.port ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4455;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

async function sha256Base64(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64(new Uint8Array(digest));
}

async function buildObsAuthentication(password: string, salt: string, challenge: string): Promise<string> {
  const secret = await sha256Base64(`${password}${salt}`);
  return sha256Base64(`${secret}${challenge}`);
}

async function waitForObsMessage(socket: WebSocket): Promise<ObsRequestPayload> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("OBS websocket timeout"));
    }, OBS_REQUEST_TIMEOUT_MS);

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as ObsRequestPayload;
        cleanup();
        resolve(parsed);
      } catch {
        cleanup();
        reject(new Error("OBS websocket sent invalid JSON"));
      }
    };

    const handleError = () => {
      cleanup();
      reject(new Error("OBS websocket error"));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.removeEventListener("message", handleMessage as EventListener);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("message", handleMessage as EventListener, { once: true });
    socket.addEventListener("error", handleError, { once: true });
  });
}

async function sendObsRequest(
  socket: WebSocket,
  requestType: string,
  requestData?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const requestId = `obs_${requestType}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const payload: ObsRequestPayload = {
    op: 6,
    d: {
      requestType,
      requestId,
    },
  };
  if (requestData && Object.keys(requestData).length) {
    payload.d = { ...payload.d, requestData };
  }

  socket.send(JSON.stringify(payload));

  // Skip non-request messages until our requestId arrives.
  // OBS may emit events while connected.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const msg = await waitForObsMessage(socket);
    if (msg.op !== 7) continue;
    const body = asRecord(msg.d) ?? {};
    if (asString(body.requestId) !== requestId) continue;
    const status = asRecord(body.requestStatus) ?? {};
    if (status.result === false) {
      throw new Error(asString(status.comment) || `${requestType} failed`);
    }
    return asRecord(body.responseData) ?? {};
  }
}

async function identifyObsSocket(socket: WebSocket, password: string): Promise<void> {
  const hello = await waitForObsMessage(socket);
  if (hello.op !== 0) {
    throw new Error("OBS websocket handshake failed");
  }
  const helloBody = asRecord(hello.d) ?? {};
  const authBlock = asRecord(helloBody.authentication);
  const identifyPayload: Record<string, unknown> = {
    rpcVersion: OBS_RPC_VERSION,
  };

  if (authBlock) {
    const salt = asString(authBlock.salt);
    const challenge = asString(authBlock.challenge);
    if (salt && challenge) {
      identifyPayload.authentication = await buildObsAuthentication(password, salt, challenge);
    }
  }

  socket.send(JSON.stringify({ op: 1, d: identifyPayload }));

  // Wait until Identified.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const msg = await waitForObsMessage(socket);
    if (msg.op === 2) return;
    if (msg.op === 5) continue;
  }
}

export async function fetchObsRuntimeCatalogue(connection: Connection): Promise<ObsRuntimeCatalogue> {
  const host = getConnectionHost(connection);
  const port = getConnectionPort(connection);
  const password = String(connection.password ?? "");
  if (!host) {
    throw new Error("OBS connection host is empty");
  }

  const socket = new WebSocket(`ws://${host}:${port}`);

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("OBS websocket connect timeout"));
    }, OBS_REQUEST_TIMEOUT_MS);

    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Unable to connect to OBS websocket"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("open", handleOpen, { once: true });
    socket.addEventListener("error", handleError, { once: true });
  });

  try {
    await identifyObsSocket(socket, password);

    const sceneListResponse = await sendObsRequest(socket, "GetSceneList");
    const inputListResponse = await sendObsRequest(socket, "GetInputList");
    const transitionResponse = await sendObsRequest(socket, "GetTransitionKindList");
    const profileResponse = await sendObsRequest(socket, "GetProfileList");
    const sceneCollectionResponse = await sendObsRequest(socket, "GetSceneCollectionList");
    const outputResponse = await sendObsRequest(socket, "GetOutputList");
    const hotkeyResponse = await sendObsRequest(socket, "GetHotkeyList");

    const scenes = uniqueSorted(
      ((sceneListResponse.scenes as unknown[]) ?? [])
        .map((scene) => asString(asRecord(scene)?.sceneName))
        .filter(Boolean),
    );
    const sceneItemsByScene: Record<string, Array<{ sceneItemId: number; sourceName: string }>> = {};
    for (const sceneName of scenes) {
      const sceneItemsResponse = await sendObsRequest(socket, "GetSceneItemList", { sceneName });
      const rawItems = Array.isArray(sceneItemsResponse.sceneItems)
        ? sceneItemsResponse.sceneItems
        : [];
      sceneItemsByScene[sceneName] = rawItems
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          sceneItemId: Number(item.sceneItemId ?? 0),
          sourceName: asString(item.sourceName),
        }))
        .filter((item) => Number.isFinite(item.sceneItemId) && item.sceneItemId > 0 && item.sourceName);
    }
    const inputs = uniqueSorted(
      ((inputListResponse.inputs as unknown[]) ?? [])
        .map((input) => asString(asRecord(input)?.inputName))
        .filter(Boolean),
    );
    const transitions = uniqueSorted(asStringArray(transitionResponse.transitionKinds));
    const profiles = uniqueSorted(asStringArray(profileResponse.profiles));
    const sceneCollections = uniqueSorted(asStringArray(sceneCollectionResponse.sceneCollections));
    const outputs = uniqueSorted(
      ((outputResponse.outputs as unknown[]) ?? [])
        .map((output) => asString(asRecord(output)?.outputName))
        .filter(Boolean),
    );
    const hotkeys = uniqueSorted(asStringArray(hotkeyResponse.hotkeys));

    return {
      scenes,
      sceneItemsByScene,
      inputs,
      transitions,
      profiles,
      sceneCollections,
      outputs,
      hotkeys,
    };
  } finally {
    try {
      socket.close();
    } catch {
      // no-op
    }
  }
}
