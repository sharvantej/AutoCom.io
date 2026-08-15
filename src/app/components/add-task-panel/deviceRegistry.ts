import type { Connection } from '../../types';
import type { TaskCatalogue } from '../../services/dashboardTasks';

/**
 * Fields threaded into extracted per-device modules from AddTaskPanel's shared
 * state. Extracted device files live outside AddTaskPanel's closure, so anything
 * shared they need (rather than their own local device state) has to come in
 * explicitly through this context instead of being captured implicitly.
 */
export interface SharedFormCtx {
  conn: string;
  selectedConnection: Connection | undefined;
  connections: Connection[];
  category: string;
  setCategory: (v: string) => void;
  cat: TaskCatalogue;
  funcName: string;
  setFuncName: (v: string) => void;
  mode: string;
  setMode: (v: string) => void;
  input: string;
  setInput: (v: string) => void;
  value: string;
  setValue: (v: string) => void;
  isWorkspace: boolean;
}

/** What an extracted device's buildParams() contributes to the drafted TaskEntry. */
export interface DeviceParamsResult {
  label: string;
  params: Record<string, unknown>;
  input?: string;
  value?: string;
  mode?: string;
}
