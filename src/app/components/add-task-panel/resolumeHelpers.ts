export type ResolumeMasterAction = '+' | '-' | '=';
export type ResolumeCompositionChangeFunction =
  | 'Composition Master Change'
  | 'Composition Opacity Change'
  | 'Composition Speed Change'
  | 'Composition Volume Change';
export type ResolumeClipChangeFunction =
  | 'Clip Opacity Change'
  | 'Clip Speed Change'
  | 'Clip Volume Change';
export type ResolumeClipSelectionFunction = 'Select Clip' | 'Trigger Clip';
export type ResolumeColumnActionFunction =
  | 'Connect Column'
  | 'Connect Layer Group Column'
  | 'Select Column'
  | 'Select Layer Group Column';
export type ResolumeLayerColumnStepFunction =
  | 'Layer Next Column'
  | 'Layer Previous Column';
export type ResolumeLayerGroupColumnStepFunction =
  | 'Layer Group Next Column'
  | 'Layer Group Previous Column';
export type ResolumeToggleFunction =
  | 'Bypass Layer'
  | 'Bypass Layer Group'
  | 'Solo Layer'
  | 'Solo Layer Group';
export type ResolumeToggleAction = 'toggle' | 'on' | 'off';
export type ResolumeLayerChangeFunction =
  | 'Layer Master Change'
  | 'Layer Opacity Change'
  | 'Layer Transition Duration Change'
  | 'Layer Volume Change';
export type ResolumeLayerGroupChangeFunction =
  | 'Layer Group Master Change'
  | 'Layer Group Opacity Change'
  | 'Layer Group Speed Change'
  | 'Layer Group Volume Change';
export type ResolumeLayerSelectFunction = 'Select Layer' | 'Select Layer Group';
export type ResolumeLayerClearFunction =
  | 'Clear All Layers'
  | 'Clear Layer'
  | 'Clear Layer Group';
export type ResolumeCompositionColumnStepFunction =
  | 'Composition Next Column'
  | 'Composition Previous Column';
export type ResolumeDeckSelectFunction = 'Select Deck';
export type ResolumeDeckStepFunction = 'Select Next Deck' | 'Select Previous Deck';
export type ResolumeCustomOscFunction = 'Custom OSC Command';

export function isResolumeCompositionChangeFunction(
  funcName: string
): funcName is ResolumeCompositionChangeFunction {
  return [
    'Composition Master Change',
    'Composition Opacity Change',
    'Composition Speed Change',
    'Composition Volume Change',
  ].includes(funcName);
}

export function isResolumeClipChangeFunction(
  funcName: string
): funcName is ResolumeClipChangeFunction {
  return [
    'Clip Opacity Change',
    'Clip Speed Change',
    'Clip Volume Change',
  ].includes(funcName);
}

export function isResolumeClipSelectionFunction(
  funcName: string
): funcName is ResolumeClipSelectionFunction {
  return ['Select Clip', 'Trigger Clip'].includes(funcName);
}

export function isResolumeColumnActionFunction(
  funcName: string
): funcName is ResolumeColumnActionFunction {
  return [
    'Connect Column',
    'Connect Layer Group Column',
    'Select Column',
    'Select Layer Group Column',
  ].includes(funcName);
}

export function isResolumeLayerColumnStepFunction(
  funcName: string
): funcName is ResolumeLayerColumnStepFunction {
  return ['Layer Next Column', 'Layer Previous Column'].includes(funcName);
}

export function isResolumeLayerGroupColumnStepFunction(
  funcName: string
): funcName is ResolumeLayerGroupColumnStepFunction {
  return ['Layer Group Next Column', 'Layer Group Previous Column'].includes(
    funcName
  );
}

export function isResolumeToggleFunction(
  funcName: string
): funcName is ResolumeToggleFunction {
  return [
    'Bypass Layer',
    'Bypass Layer Group',
    'Solo Layer',
    'Solo Layer Group',
  ].includes(funcName);
}

export function isResolumeLayerChangeFunction(
  funcName: string
): funcName is ResolumeLayerChangeFunction {
  return [
    'Layer Master Change',
    'Layer Opacity Change',
    'Layer Transition Duration Change',
    'Layer Volume Change',
  ].includes(funcName);
}

export function isResolumeLayerGroupChangeFunction(
  funcName: string
): funcName is ResolumeLayerGroupChangeFunction {
  return [
    'Layer Group Master Change',
    'Layer Group Opacity Change',
    'Layer Group Speed Change',
    'Layer Group Volume Change',
  ].includes(funcName);
}

export function isResolumeLayerSelectFunction(
  funcName: string
): funcName is ResolumeLayerSelectFunction {
  return ['Select Layer', 'Select Layer Group'].includes(funcName);
}

export function isResolumeLayerClearFunction(
  funcName: string
): funcName is ResolumeLayerClearFunction {
  return ['Clear All Layers', 'Clear Layer', 'Clear Layer Group'].includes(
    funcName
  );
}

export function isResolumeCompositionColumnStepFunction(
  funcName: string
): funcName is ResolumeCompositionColumnStepFunction {
  return ['Composition Next Column', 'Composition Previous Column'].includes(
    funcName
  );
}

export function isResolumeDeckSelectFunction(
  funcName: string
): funcName is ResolumeDeckSelectFunction {
  return funcName === 'Select Deck';
}

export function isResolumeDeckStepFunction(
  funcName: string
): funcName is ResolumeDeckStepFunction {
  return ['Select Next Deck', 'Select Previous Deck'].includes(funcName);
}

export function isResolumeCustomOscFunction(
  funcName: string
): funcName is ResolumeCustomOscFunction {
  return funcName === 'Custom OSC Command';
}

export function isLayerGroupSelectFunction(
  funcName: ResolumeLayerSelectFunction
): boolean {
  return funcName === 'Select Layer Group';
}

export function isLayerGroupClearFunction(
  funcName: ResolumeLayerClearFunction
): boolean {
  return funcName === 'Clear Layer Group';
}

export function isLayerGroupToggleFunction(funcName: ResolumeToggleFunction): boolean {
  return funcName === 'Bypass Layer Group' || funcName === 'Solo Layer Group';
}

export function toggleBaseAddress(
  funcName: ResolumeToggleFunction,
  target: number
): string {
  const scope = isLayerGroupToggleFunction(funcName)
    ? `/composition/layergroups/${target}`
    : `/composition/layers/${target}`;
  const suffix = funcName.includes('Bypass') ? 'bypass' : 'solo';
  return `${scope}/${suffix}`;
}

export function resolveToggleAddress(
  funcName: ResolumeToggleFunction,
  target: number,
  action: ResolumeToggleAction
): string {
  const base = toggleBaseAddress(funcName, target);
  if (action === 'toggle') return `${base}/toggle`;
  return base;
}

export function resolveToggleArgs(action: ResolumeToggleAction): unknown[] {
  if (action === 'on') return [1];
  if (action === 'off') return [0];
  return [];
}

export function resolveLayerChangeAddress(
  funcName: ResolumeLayerChangeFunction,
  layer: number,
  action: ResolumeMasterAction
): string {
  const base =
    funcName === 'Layer Master Change'
      ? `/composition/layers/${layer}/master`
      : funcName === 'Layer Opacity Change'
        ? `/composition/layers/${layer}/opacity`
        : funcName === 'Layer Transition Duration Change'
          ? `/composition/layers/${layer}/transition/duration`
          : `/composition/layers/${layer}/volume`;
  if (action === '+') return `${base}/increase`;
  if (action === '-') return `${base}/decrease`;
  return base;
}

export function resolveLayerGroupChangeAddress(
  funcName: ResolumeLayerGroupChangeFunction,
  group: number,
  action: ResolumeMasterAction
): string {
  const base =
    funcName === 'Layer Group Master Change'
      ? `/composition/layergroups/${group}/master`
      : funcName === 'Layer Group Opacity Change'
        ? `/composition/layergroups/${group}/opacity`
        : funcName === 'Layer Group Speed Change'
          ? `/composition/layergroups/${group}/speed`
          : `/composition/layergroups/${group}/volume`;
  if (action === '+') return `${base}/increase`;
  if (action === '-') return `${base}/decrease`;
  return base;
}

export function resolveLayerSelectAddress(
  funcName: ResolumeLayerSelectFunction,
  target: number
): string {
  if (isLayerGroupSelectFunction(funcName)) {
    return `/composition/layergroups/${target}/select`;
  }
  return `/composition/layers/${target}/select`;
}

export function resolveLayerClearAddress(
  funcName: ResolumeLayerClearFunction,
  target: number | null
): string {
  if (funcName === 'Clear All Layers') return '/composition/layers/clear';
  if (isLayerGroupClearFunction(funcName))
    return `/composition/layergroups/${target ?? 1}/clear`;
  return `/composition/layers/${target ?? 1}/clear`;
}

export function resolveCompositionColumnStepAddress(
  funcName: ResolumeCompositionColumnStepFunction
): string {
  if (funcName === 'Composition Next Column')
    return '/composition/columns/next/connect';
  return '/composition/columns/previous/connect';
}

export function resolveDeckSelectAddress(
  action: ResolumeMasterAction,
  value: number
): string {
  if (action === '+') return '/composition/decks/next/select';
  if (action === '-') return '/composition/decks/previous/select';
  return `/composition/decks/${value}/select`;
}

export function resolveDeckStepAddress(funcName: ResolumeDeckStepFunction): string {
  if (funcName === 'Select Next Deck') return '/composition/decks/next/select';
  return '/composition/decks/previous/select';
}


export function parseCustomOscArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [trimmed];
  }
}


export function clipBaseAddress(layer: number, clip: number): string {
  return `/composition/layers/${layer}/clips/${clip}`;
}

export function isLayerGroupColumnAction(
  funcName: ResolumeColumnActionFunction
): boolean {
  return (
    funcName === 'Connect Layer Group Column' ||
    funcName === 'Select Layer Group Column'
  );
}

export function resolveColumnActionAddress(
  funcName: ResolumeColumnActionFunction,
  action: ResolumeMasterAction,
  value: number,
  layerGroup: number | null
): string {
  const suffix = funcName.includes('Select') ? 'select' : 'connect';
  if (isLayerGroupColumnAction(funcName)) {
    const group = layerGroup ?? 1;
    if (action === '+')
      return `/composition/layergroups/${group}/columns/next/${suffix}`;
    if (action === '-')
      return `/composition/layergroups/${group}/columns/previous/${suffix}`;
    return `/composition/layergroups/${group}/columns/${value}/${suffix}`;
  }

  if (action === '+') return `/composition/columns/next/${suffix}`;
  if (action === '-') return `/composition/columns/previous/${suffix}`;
  return `/composition/columns/${value}/${suffix}`;
}

export function resolveLayerColumnStepAddress(
  funcName: ResolumeLayerColumnStepFunction,
  layer: number
): string {
  if (funcName === 'Layer Next Column') {
    return `/composition/layers/${layer}/columns/next/connect`;
  }
  return `/composition/layers/${layer}/columns/previous/connect`;
}

export function resolveLayerGroupColumnStepAddress(
  funcName: ResolumeLayerGroupColumnStepFunction,
  layerGroup: number
): string {
  if (funcName === 'Layer Group Next Column') {
    return `/composition/layergroups/${layerGroup}/columns/next/connect`;
  }
  return `/composition/layergroups/${layerGroup}/columns/previous/connect`;
}

export function resolveCompositionChangeAddress(
  funcName: ResolumeCompositionChangeFunction,
  action: ResolumeMasterAction
): string {
  const base =
    funcName === 'Composition Master Change'
      ? '/composition/master'
      : funcName === 'Composition Opacity Change'
        ? '/composition/opacity'
        : funcName === 'Composition Speed Change'
          ? '/composition/speed'
          : '/composition/volume';

  if (action === '+') return `${base}/increase`;
  if (action === '-') return `${base}/decrease`;
  return base;
}

export function resolveClipChangeAddress(
  funcName: ResolumeClipChangeFunction,
  layer: number,
  clip: number,
  action: ResolumeMasterAction
): string {
  const base =
    funcName === 'Clip Opacity Change'
      ? `${clipBaseAddress(layer, clip)}/opacity`
      : funcName === 'Clip Speed Change'
        ? `${clipBaseAddress(layer, clip)}/speed`
        : `${clipBaseAddress(layer, clip)}/volume`;

  if (action === '+') return `${base}/increase`;
  if (action === '-') return `${base}/decrease`;
  return base;
}

export function resolveClipSelectionAddress(
  funcName: ResolumeClipSelectionFunction,
  layer: number,
  clip: number
): string {
  if (funcName === 'Select Clip')
    return `${clipBaseAddress(layer, clip)}/select`;
  return `${clipBaseAddress(layer, clip)}/connect`;
}

export function extractLayerClipFromAddress(
  value: unknown
): { layer: number; clip: number } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/composition\/layers\/(\d+)\/clips\/(\d+)/i);
  if (!match) return null;
  const layer = Number.parseInt(match[1], 10);
  const clip = Number.parseInt(match[2], 10);
  if (
    !Number.isInteger(layer) ||
    layer < 1 ||
    !Number.isInteger(clip) ||
    clip < 1
  ) {
    return null;
  }
  return { layer, clip };
}

export function detectColumnActionFromAddress(
  value: unknown
): ResolumeMasterAction | null {
  if (typeof value !== 'string') return null;
  if (/\/columns\/next\//i.test(value)) return '+';
  if (/\/columns\/previous\//i.test(value)) return '-';
  if (/\/columns\/\d+\//i.test(value)) return '=';
  return null;
}

export function detectDeltaActionFromAddress(
  value: unknown
): ResolumeMasterAction | null {
  if (typeof value !== 'string') return null;
  if (/\/increase$/i.test(value)) return '+';
  if (/\/decrease$/i.test(value)) return '-';
  if (value.trim().length > 0) return '=';
  return null;
}

export function detectDeckActionFromAddress(
  value: unknown
): ResolumeMasterAction | null {
  if (typeof value !== 'string') return null;
  if (/\/decks\/next\//i.test(value)) return '+';
  if (/\/decks\/previous\//i.test(value)) return '-';
  if (/\/decks\/\d+\//i.test(value)) return '=';
  return null;
}

export function extractDeckValueFromAddress(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/decks\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function extractColumnValueFromAddress(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/columns\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function extractLayerGroupFromAddress(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/layergroups\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function extractLayerFromAddress(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/layers\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseToggleActionFromAddressAndArgs(
  address: unknown,
  args: unknown
): ResolumeToggleAction | null {
  if (typeof address === 'string' && /\/toggle$/i.test(address.trim())) {
    return 'toggle';
  }
  if (Array.isArray(args) && args.length > 0) {
    const first = args[0];
    if (typeof first === 'number') return first > 0 ? 'on' : 'off';
    if (typeof first === 'boolean') return first ? 'on' : 'off';
    if (typeof first === 'string') {
      const normalized = first.trim().toLowerCase();
      if (['1', 'true', 'on'].includes(normalized)) return 'on';
      if (['0', 'false', 'off'].includes(normalized)) return 'off';
    }
  }
  return null;
}

// ── Field sub-component ────────────────────────────────────────────────────────

