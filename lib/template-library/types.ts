export interface JigmaTemplate {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  version: number;
  builderTarget: "bricks";
  html: string;
  css: string;
  javascript: string;
  js: string;
  prefix: string;
  blockName: string;
  thumbnail: string;
  expectedWarnings: string[];
  testedBreakpoints: string[];
}

export type JigmaTemplateSource = Omit<JigmaTemplate, "key" | "js">;

export function template(input: JigmaTemplateSource): JigmaTemplate {
  return {
    ...input,
    key: input.id,
    js: input.javascript,
  };
}

