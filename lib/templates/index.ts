import { template, type JigmaTemplate } from "../template-library/types.ts";
import { jigmaHeaderTemplate } from "./jigma-header.ts";
import { jigmaHeroTemplate } from "./jigma-hero.ts";
import { jigmaHeroFidelityTemplate } from "./jigma-hero-fidelity.ts";
import { jigmaHeaderHeroComposition } from "./compositions.ts";

export type { JigmaTemplate } from "../template-library/types.ts";
export { jigmaHeaderTemplate } from "./jigma-header.ts";
export { jigmaHeroTemplate } from "./jigma-hero.ts";
export { jigmaHeroFidelityTemplate } from "./jigma-hero-fidelity.ts";
export {
  composeTemplateSources,
  jigmaHeaderHeroComposition,
  type JigmaTemplateComposition,
} from "./compositions.ts";

export const templateSources = [
  jigmaHeaderTemplate,
  jigmaHeroTemplate,
];

export const templates: JigmaTemplate[] = templateSources.map((source) => template(source));

export const advancedTemplates: JigmaTemplate[] = [
  template(jigmaHeroFidelityTemplate),
];

export const templateCompositions = [
  jigmaHeaderHeroComposition,
];

export function getTemplateByKey(key: string) {
  return templates.find((templateItem) => templateItem.key === key) ?? null;
}

export function getAdvancedTemplateByKey(key: string) {
  return advancedTemplates.find((templateItem) => templateItem.key === key) ?? null;
}

export function getTemplateCompositionByKey(key: string) {
  return templateCompositions.find((composition) => composition.id === key) ?? null;
}
