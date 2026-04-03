export type AtemModelProfile = {
  id: string;
  label: string;
  mixEffects: number;
  upstreamKeyers: number;
  downstreamKeyers: number;
  multiviewers: number;
  superSources: number;
  mediaPlayers: number;
  auxOutputs: number;
  inputCount: number;
  multiviewerFullGrid: boolean;
};

export const ATEM_MODEL_PROFILES: AtemModelProfile[] = [
  { id: "auto", label: "Auto Detect", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 3, inputCount: 6, multiviewerFullGrid: false },
  { id: "mini_extreme_iso_g2", label: "Mini Extreme ISO G2", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 3, inputCount: 8, multiviewerFullGrid: true },
  { id: "television_studio_4k8", label: "Television Studio 4K8", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 10, inputCount: 8, multiviewerFullGrid: true },
  { id: "constellation_4k_4me_plus", label: "4 M/E Constellation 4K Plus", mixEffects: 4, upstreamKeyers: 4, downstreamKeyers: 4, multiviewers: 4, superSources: 2, mediaPlayers: 4, auxOutputs: 48, inputCount: 80, multiviewerFullGrid: true },
  { id: "constellation_4k_4me", label: "4 M/E Constellation 4K", mixEffects: 4, upstreamKeyers: 4, downstreamKeyers: 4, multiviewers: 4, superSources: 2, mediaPlayers: 4, auxOutputs: 24, inputCount: 40, multiviewerFullGrid: true },
  { id: "constellation_4k_2me", label: "2 M/E Constellation 4K", mixEffects: 2, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 2, superSources: 1, mediaPlayers: 2, auxOutputs: 12, inputCount: 20, multiviewerFullGrid: true },
  { id: "constellation_4k_1me", label: "1 M/E Constellation 4K", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 1, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 6, inputCount: 10, multiviewerFullGrid: true },
  { id: "television_studio_hd8_iso", label: "Television Studio HD8 ISO", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 2, inputCount: 8, multiviewerFullGrid: true },
  { id: "television_studio_hd8", label: "Television Studio HD8", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 2, inputCount: 8, multiviewerFullGrid: true },
  { id: "sdi_extreme_iso", label: "SDI Extreme ISO", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 4, inputCount: 8, multiviewerFullGrid: true },
  { id: "sdi_pro_iso", label: "SDI Pro ISO", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 1, multiviewers: 1, superSources: 0, mediaPlayers: 1, auxOutputs: 2, inputCount: 4, multiviewerFullGrid: true },
  { id: "sdi", label: "SDI", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 1, multiviewers: 0, superSources: 0, mediaPlayers: 1, auxOutputs: 2, inputCount: 4, multiviewerFullGrid: false },
  { id: "constellation_hd_4me", label: "4 M/E Constellation HD", mixEffects: 4, upstreamKeyers: 4, downstreamKeyers: 4, multiviewers: 4, superSources: 2, mediaPlayers: 4, auxOutputs: 24, inputCount: 40, multiviewerFullGrid: true },
  { id: "constellation_hd_2me", label: "2 M/E Constellation HD", mixEffects: 2, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 2, superSources: 1, mediaPlayers: 2, auxOutputs: 12, inputCount: 20, multiviewerFullGrid: true },
  { id: "constellation_hd_1me", label: "1 M/E Constellation HD", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 1, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 6, inputCount: 10, multiviewerFullGrid: true },
  { id: "mini_extreme_iso", label: "Mini Extreme ISO", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 2, inputCount: 8, multiviewerFullGrid: true },
  { id: "mini_extreme", label: "Mini Extreme", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 2, auxOutputs: 2, inputCount: 8, multiviewerFullGrid: true },
  { id: "mini_pro_iso", label: "Mini Pro ISO", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 1, multiviewers: 1, superSources: 0, mediaPlayers: 1, auxOutputs: 1, inputCount: 4, multiviewerFullGrid: false },
  { id: "mini_pro", label: "Mini Pro", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 1, multiviewers: 1, superSources: 0, mediaPlayers: 1, auxOutputs: 1, inputCount: 4, multiviewerFullGrid: false },
  { id: "mini", label: "Mini", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 1, multiviewers: 0, superSources: 0, mediaPlayers: 1, auxOutputs: 1, inputCount: 4, multiviewerFullGrid: false },
  { id: "constellation_8k_8k_mode", label: "Constellation 8K (8K Mode)", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 1, mediaPlayers: 1, auxOutputs: 6, inputCount: 10, multiviewerFullGrid: true },
  { id: "constellation_8k_hd_4k_mode", label: "Constellation 8K (HD/4K Mode)", mixEffects: 4, upstreamKeyers: 4, downstreamKeyers: 4, multiviewers: 4, superSources: 2, mediaPlayers: 4, auxOutputs: 24, inputCount: 40, multiviewerFullGrid: true },
  { id: "tv_studio_pro_4k", label: "TV Studio Pro 4K", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 1, inputCount: 8, multiviewerFullGrid: false },
  { id: "tv_studio_pro_hd", label: "TV Studio Pro HD", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 1, inputCount: 8, multiviewerFullGrid: false },
  { id: "tv_studio_hd", label: "TV Studio HD", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 1, inputCount: 8, multiviewerFullGrid: false },
  { id: "broadcast_4me_4k", label: "4 ME Broadcast 4K", mixEffects: 4, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 2, superSources: 1, mediaPlayers: 4, auxOutputs: 6, inputCount: 20, multiviewerFullGrid: true },
  { id: "production_2me_4k", label: "2 ME Production 4K", mixEffects: 2, upstreamKeyers: 2, downstreamKeyers: 2, multiviewers: 2, superSources: 1, mediaPlayers: 2, auxOutputs: 6, inputCount: 20, multiviewerFullGrid: true },
  { id: "production_1me_4k", label: "1 ME Production 4K", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 3, inputCount: 10, multiviewerFullGrid: false },
  { id: "production_studio_4k", label: "Production Studio 4K", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 1, inputCount: 8, multiviewerFullGrid: false },
  { id: "production_2me", label: "2 ME Production", mixEffects: 2, upstreamKeyers: 2, downstreamKeyers: 2, multiviewers: 2, superSources: 1, mediaPlayers: 2, auxOutputs: 6, inputCount: 16, multiviewerFullGrid: true },
  { id: "production_1me", label: "1 ME Production", mixEffects: 1, upstreamKeyers: 4, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 3, inputCount: 8, multiviewerFullGrid: false },
  { id: "tv_studio", label: "TV Studio", mixEffects: 1, upstreamKeyers: 1, downstreamKeyers: 2, multiviewers: 1, superSources: 0, mediaPlayers: 2, auxOutputs: 1, inputCount: 6, multiviewerFullGrid: false },
];

export const DEFAULT_ATEM_MODEL_ID = "auto";

const ATEM_MODEL_PROFILE_BY_ID = new Map<string, AtemModelProfile>(
  ATEM_MODEL_PROFILES.map((model) => [model.id, model]),
);

const ATEM_MODEL_PROFILE_BY_LABEL = new Map<string, AtemModelProfile>(
  ATEM_MODEL_PROFILES.map((model) => [model.label.trim().toLowerCase(), model]),
);

export function normalizeAtemModelId(value: unknown): string {
  if (typeof value === "string" && ATEM_MODEL_PROFILE_BY_ID.has(value)) {
    return value;
  }

  if (typeof value === "string") {
    const byLabel = ATEM_MODEL_PROFILE_BY_LABEL.get(value.trim().toLowerCase());
    if (byLabel) return byLabel.id;
  }

  return DEFAULT_ATEM_MODEL_ID;
}

export function getAtemModelProfile(modelId: unknown): AtemModelProfile {
  const normalizedId = normalizeAtemModelId(modelId);
  return ATEM_MODEL_PROFILE_BY_ID.get(normalizedId) ?? ATEM_MODEL_PROFILES[0];
}
