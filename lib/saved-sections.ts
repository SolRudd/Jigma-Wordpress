import type { OutputOptions } from "../types/jigma.ts";

export const SAVED_SECTION_SCHEMA_VERSION = 1;
export const LOCAL_SAVED_SECTIONS_STORAGE_KEY = "jigma.savedSections.v1";

export interface LocalSavedSection {
  version: number;
  id: string;
  name: string;
  html: string;
  css: string;
  javascript: string;
  prefix: string;
  projectPrefix: string;
  blockName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSectionSource {
  html: string;
  css: string;
  javascript: string;
  projectPrefix: string;
  blockName: string;
}

function cleanPart(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || fallback;
}

function cleanName(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function makeSavedSectionId(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `section_${(hash >>> 0).toString(36)}`;
}

export function createLocalSavedSection(
  source: SavedSectionSource,
  now = new Date(),
  name = "Untitled section",
): LocalSavedSection {
  const prefix = cleanPart(source.projectPrefix, "jg");
  const blockName = cleanPart(source.blockName, "section");
  const sectionName = cleanName(name, `${prefix} / ${blockName}`);
  const timestamp = now.toISOString();

  return {
    version: SAVED_SECTION_SCHEMA_VERSION,
    id: makeSavedSectionId(`${sectionName}:${prefix}:${blockName}:${timestamp}`),
    name: sectionName,
    html: source.html,
    css: source.css,
    javascript: source.javascript,
    prefix,
    projectPrefix: prefix,
    blockName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeSavedSection(value: unknown): LocalSavedSection | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const section = value as Partial<LocalSavedSection>;
  const html = typeof section.html === "string" ? section.html : "";
  const css = typeof section.css === "string" ? section.css : "";
  const javascript = typeof section.javascript === "string" ? section.javascript : "";
  const prefix = cleanPart(section.prefix ?? section.projectPrefix ?? "", "jg");
  const blockName = cleanPart(section.blockName ?? "", "section");
  const updatedAt = typeof section.updatedAt === "string" ? section.updatedAt : new Date(0).toISOString();
  const createdAt = typeof section.createdAt === "string" ? section.createdAt : updatedAt;
  const name = cleanName(section.name ?? `${prefix} / ${blockName}`, `${prefix} / ${blockName}`);
  const id = typeof section.id === "string" && section.id
    ? section.id
    : makeSavedSectionId(`${name}:${prefix}:${blockName}:${createdAt}`);

  return {
    version: SAVED_SECTION_SCHEMA_VERSION,
    id,
    name,
    html,
    css,
    javascript,
    prefix,
    projectPrefix: prefix,
    blockName,
    createdAt,
    updatedAt,
  };
}

export function validateSavedSectionImport(value: unknown) {
  const section = normalizeSavedSection(value);
  if (!section) {
    return {
      valid: false,
      errors: ["Saved section JSON is missing required fields."],
      section: null,
    };
  }

  return {
    valid: true,
    errors: [],
    section,
  };
}

export function normalizeSavedSections(value: unknown): LocalSavedSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => validateSavedSectionImport(item))
    .filter((result) => result.valid && result.section)
    .map((result) => result.section as LocalSavedSection);
}

export function parseSavedSections(rawValue: string | null): LocalSavedSection[] {
  if (!rawValue) {
    return [];
  }

  try {
    return normalizeSavedSections(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function serializeSavedSections(sections: LocalSavedSection[]) {
  return JSON.stringify(sections);
}

export function upsertSavedSection(
  sections: LocalSavedSection[],
  nextSection: LocalSavedSection,
) {
  return [
    nextSection,
    ...sections.filter((section) => section.id !== nextSection.id),
  ].slice(0, 20);
}

export function renameSavedSection(
  sections: LocalSavedSection[],
  sectionId: string,
  nextName: string,
  now = new Date(),
) {
  return sections.map((section) =>
    section.id === sectionId
      ? {
        ...section,
        name: cleanName(nextName, section.name),
        updatedAt: now.toISOString(),
      }
      : section
  );
}

export function deleteSavedSection(sections: LocalSavedSection[], sectionId: string) {
  return sections.filter((section) => section.id !== sectionId);
}

export function duplicateSavedSection(
  sections: LocalSavedSection[],
  sectionId: string,
  now = new Date(),
) {
  const section = sections.find((item) => item.id === sectionId);
  if (!section) {
    return sections;
  }

  const duplicate = {
    ...section,
    id: makeSavedSectionId(`${section.name}:copy:${now.toISOString()}`),
    name: `${section.name} Copy`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return upsertSavedSection(sections, duplicate);
}

export function exportSavedSectionJson(section: LocalSavedSection) {
  return JSON.stringify(section, null, 2);
}

export function importSavedSectionJson(rawValue: string, now = new Date()) {
  try {
    const parsed = JSON.parse(rawValue);
    const result = validateSavedSectionImport(parsed);
    if (!result.valid || !result.section) {
      return result;
    }

    return {
      valid: true,
      errors: [],
      section: {
        ...result.section,
        updatedAt: now.toISOString(),
      },
    };
  } catch {
    return {
      valid: false,
      errors: ["Saved section JSON could not be parsed."],
      section: null,
    };
  }
}

export function createSavedSectionSource(
  html: string,
  css: string,
  javascript: string,
  options: Pick<OutputOptions, "projectPrefix" | "blockName">,
): SavedSectionSource {
  return {
    html,
    css,
    javascript,
    projectPrefix: options.projectPrefix,
    blockName: options.blockName,
  };
}
