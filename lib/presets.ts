import type { ExportMode, OutputOptions } from "../types/jigma.ts";

export const PRESET_SCHEMA_VERSION = 2;
export const LOCAL_PRESETS_STORAGE_KEY = "jigma.localPresets.v2";
export const LEGACY_LOCAL_PRESETS_STORAGE_KEY = "jigma.localPresets.v1";

export interface LocalJigmaPreset {
  version: number;
  id: string;
  name: string;
  prefix: string;
  projectPrefix: string;
  blockName: string;
  outputAdapter: "bricks";
  exportMode: ExportMode;
  tokenMappings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

type PresetOptions = Pick<OutputOptions, "projectPrefix" | "blockName"> &
  Partial<Pick<OutputOptions, "exportMode">>;

function cleanPresetPart(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || fallback;
}

function cleanPresetName(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function makePresetId(prefix: string, blockName: string, name = "") {
  const seed = `${prefix}:${blockName}:${name}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `preset_${(hash >>> 0).toString(36)}`;
}

export function createLocalPreset(
  options: PresetOptions,
  now = new Date(),
  name?: string,
): LocalJigmaPreset {
  const prefix = cleanPresetPart(options.projectPrefix, "jg");
  const blockName = cleanPresetPart(options.blockName, "section");
  const timestamp = now.toISOString();
  const presetName = cleanPresetName(name ?? `${prefix} / ${blockName}`, `${prefix} / ${blockName}`);

  return {
    version: PRESET_SCHEMA_VERSION,
    id: makePresetId(prefix, blockName, presetName),
    name: presetName,
    prefix,
    projectPrefix: prefix,
    blockName,
    outputAdapter: "bricks",
    exportMode: options.exportMode ?? "native-bem-classes",
    tokenMappings: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function migratePreset(value: unknown): LocalJigmaPreset | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const preset = value as Partial<LocalJigmaPreset> & {
    projectPrefix?: string;
    updatedAt?: string;
  };
  if (!(preset.prefix ?? preset.projectPrefix) || !preset.blockName) {
    return null;
  }

  const prefix = cleanPresetPart(preset.prefix ?? preset.projectPrefix ?? "", "jg");
  const blockName = cleanPresetPart(preset.blockName ?? "", "section");
  const updatedAt = typeof preset.updatedAt === "string" ? preset.updatedAt : new Date(0).toISOString();
  const createdAt = typeof preset.createdAt === "string" ? preset.createdAt : updatedAt;
  const name = cleanPresetName(preset.name ?? `${prefix} / ${blockName}`, `${prefix} / ${blockName}`);
  const id = typeof preset.id === "string" && preset.id ? preset.id : makePresetId(prefix, blockName, name);
  const exportMode: ExportMode = preset.exportMode ?? "native-bem-classes";

  if (!prefix || !blockName) {
    return null;
  }

  return {
    version: PRESET_SCHEMA_VERSION,
    id,
    name,
    prefix,
    projectPrefix: prefix,
    blockName,
    outputAdapter: "bricks",
    exportMode,
    tokenMappings: preset.tokenMappings && typeof preset.tokenMappings === "object"
      ? preset.tokenMappings as Record<string, string>
      : {},
    createdAt,
    updatedAt,
  };
}

export function validatePresetImport(value: unknown) {
  const preset = migratePreset(value);
  if (!preset) {
    return {
      valid: false,
      errors: ["Preset JSON is missing required naming fields."],
      preset: null,
    };
  }

  const errors: string[] = [];
  if (preset.outputAdapter !== "bricks") {
    errors.push("Only Bricks presets are supported in this MVP.");
  }
  if (!["native-bem-classes", "element-styles", "structure-only", "scoped-css-block", "global-classes"].includes(preset.exportMode)) {
    errors.push("Preset export mode is not supported.");
  }

  return {
    valid: errors.length === 0,
    errors,
    preset,
  };
}

export function normalizeLocalPresets(value: unknown): LocalJigmaPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => validatePresetImport(item))
    .filter((result) => result.valid && result.preset)
    .map((result) => result.preset as LocalJigmaPreset);
}

export function parseLocalPresets(rawValue: string | null): LocalJigmaPreset[] {
  if (!rawValue) {
    return [];
  }

  try {
    return normalizeLocalPresets(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function serializeLocalPresets(presets: LocalJigmaPreset[]) {
  return JSON.stringify(presets);
}

export function upsertLocalPreset(
  presets: LocalJigmaPreset[],
  nextPreset: LocalJigmaPreset,
) {
  return [
    nextPreset,
    ...presets.filter((preset) => preset.id !== nextPreset.id),
  ].slice(0, 12);
}

export function renameLocalPreset(
  presets: LocalJigmaPreset[],
  presetId: string,
  nextName: string,
  now = new Date(),
) {
  return presets.map((preset) =>
    preset.id === presetId
      ? {
        ...preset,
        name: cleanPresetName(nextName, preset.name),
        updatedAt: now.toISOString(),
      }
      : preset
  );
}

export function deleteLocalPreset(presets: LocalJigmaPreset[], presetId: string) {
  return presets.filter((preset) => preset.id !== presetId);
}

export function duplicateLocalPreset(
  presets: LocalJigmaPreset[],
  presetId: string,
  now = new Date(),
) {
  const preset = presets.find((item) => item.id === presetId);
  if (!preset) {
    return presets;
  }

  const duplicate = {
    ...preset,
    id: makePresetId(preset.prefix, preset.blockName, `${preset.name} copy ${now.toISOString()}`),
    name: `${preset.name} Copy`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return upsertLocalPreset(presets, duplicate);
}

export function exportLocalPresetJson(preset: LocalJigmaPreset) {
  return JSON.stringify(preset, null, 2);
}

export function importLocalPresetJson(rawValue: string, now = new Date()) {
  try {
    const parsed = JSON.parse(rawValue);
    const result = validatePresetImport(parsed);
    if (!result.valid || !result.preset) {
      return result;
    }

    return {
      valid: true,
      errors: [],
      preset: {
        ...result.preset,
        updatedAt: now.toISOString(),
      },
    };
  } catch {
    return {
      valid: false,
      errors: ["Preset JSON could not be parsed."],
      preset: null,
    };
  }
}
