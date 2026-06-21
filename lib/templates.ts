import { jigmaHeaderTemplate } from "./template-library/jigma-header.ts";
import { jigmaHeroTemplate } from "./template-library/jigma-hero.ts";
import { jigmaProofTemplate } from "./template-library/jigma-proof.ts";
import { template, type JigmaTemplate } from "./template-library/types.ts";

export type { JigmaTemplate } from "./template-library/types.ts";

export const templates: JigmaTemplate[] = [
  template(jigmaHeaderTemplate),
  template(jigmaHeroTemplate),
  template(jigmaProofTemplate),
];

export function getTemplateByKey(key: string) {
  return templates.find((templateItem) => templateItem.key === key) ?? null;
}
