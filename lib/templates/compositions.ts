import type { JigmaTemplateSource } from "../template-library/types.ts";
import { jigmaHeaderTemplate } from "./jigma-header.ts";
import { jigmaHeroTemplate } from "./jigma-hero.ts";

export interface JigmaTemplateComposition {
  id: string;
  name: string;
  sources: readonly JigmaTemplateSource[];
  html: string;
  css: string;
  javascript: string;
}

function uniqueJoin(parts: readonly string[]) {
  return Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean))).join("\n\n");
}

export function composeTemplateSources(
  id: string,
  name: string,
  sources: readonly JigmaTemplateSource[],
): JigmaTemplateComposition {
  return {
    id,
    name,
    sources,
    html: uniqueJoin(sources.map((source) => source.html)),
    css: uniqueJoin(sources.map((source) => source.css)),
    javascript: uniqueJoin(sources.map((source) => source.javascript)),
  };
}

export const jigmaHeaderHeroComposition = composeTemplateSources(
  "jigma-header-hero",
  "Jigma Header + Hero",
  [jigmaHeaderTemplate, jigmaHeroTemplate],
);
