import type { CodeFormatResult, EditorKind } from "../../types/jigma.ts";
import { getRenderableRoots } from "../parser/html.ts";

function indentLines(lines: string[]) {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatAttributes(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .map(([name, value]) => value === "" ? name : `${name}="${value.replaceAll('"', "&quot;")}"`)
    .join(" ");
}

export function formatHtmlCode(code: string): CodeFormatResult {
  const trimmed = code.trim();
  if (!trimmed) {
    return { code: "", warnings: [] };
  }

  const parsed = getRenderableRoots(trimmed);
  const lines: string[] = [];

  const writeElement = (
    element: ReturnType<typeof getRenderableRoots>["roots"][number],
    depth: number,
  ) => {
    const indent = "  ".repeat(depth);
    const attributeText = formatAttributes(element.attributes);
    const openTag = attributeText ? `<${element.tagName} ${attributeText}>` : `<${element.tagName}>`;
    const ownText = element.textSegments.join(" ").replace(/\s+/g, " ").trim();

    if (element.selfClosing || ["img", "br", "hr", "input", "meta", "link", "source"].includes(element.tagName)) {
      lines.push(attributeText ? `${indent}<${element.tagName} ${attributeText}>` : `${indent}<${element.tagName}>`);
      return;
    }

    if (element.children.length === 0 && ownText) {
      lines.push(`${indent}${openTag}${ownText}</${element.tagName}>`);
      return;
    }

    lines.push(`${indent}${openTag}`);
    if (ownText) {
      lines.push(`${"  ".repeat(depth + 1)}${ownText}`);
    }
    element.children.forEach((child) => writeElement(child, depth + 1));
    lines.push(`${indent}</${element.tagName}>`);
  };

  parsed.roots.forEach((element) => writeElement(element, 0));

  return {
    code: indentLines(lines),
    warnings: parsed.warnings,
  };
}

export function sanitizeCssInput(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().replace(/\*\*/g, "").replace(/:$/, "").trim().toLowerCase();
      return !/^```[a-z0-9_-]*\s*$/i.test(line.trim()) &&
        trimmed !== ":::" &&
        !/^:::writing\b/i.test(trimmed) &&
        trimmed !== "css" &&
        !/^\d+\.\s*css$/.test(trimmed);
    })
    .join("\n")
    .trim();
}

export function sanitizeJsInput(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().replace(/\*\*/g, "").replace(/:$/, "").trim().toLowerCase();
      return !/^```[a-z0-9_-]*\s*$/i.test(line.trim()) &&
        trimmed !== ":::" &&
        !/^:::writing\b/i.test(trimmed) &&
        trimmed !== "javascript" &&
        trimmed !== "js" &&
        !/^\d+\.\s*(javascript|js)$/.test(trimmed);
    })
    .join("\n")
    .trim();
}

function hasBalancedBraces(code: string) {
  let depth = 0;
  for (const char of code) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

export function formatCssCode(code: string): CodeFormatResult {
  const cleaned = sanitizeCssInput(code);
  if (!cleaned) {
    return { code: "", warnings: [] };
  }

  if (!hasBalancedBraces(cleaned)) {
    return {
      code: cleaned,
      warnings: ["CSS has unbalanced braces, so formatting was skipped."],
    };
  }

  let output = "";
  let depth = 0;
  let token = "";
  const pushToken = () => {
    const value = token.trim();
    if (value) {
      output += `${"  ".repeat(depth)}${value}\n`;
    }
    token = "";
  };

  for (const char of cleaned) {
    if (char === "{") {
      const selector = token.trim();
      if (selector) {
        output += `${"  ".repeat(depth)}${selector} {\n`;
      }
      token = "";
      depth += 1;
      continue;
    }

    if (char === "}") {
      pushToken();
      depth = Math.max(0, depth - 1);
      output += `${"  ".repeat(depth)}}\n\n`;
      continue;
    }

    if (char === ";") {
      token += ";";
      pushToken();
      continue;
    }

    token += char;
  }

  pushToken();

  return {
    code: output.trim(),
    warnings: [],
  };
}

export function formatJsCode(code: string): CodeFormatResult {
  const cleaned = sanitizeJsInput(code);
  if (!cleaned) {
    return { code: "", warnings: [] };
  }

  if (!hasBalancedBraces(cleaned)) {
    return {
      code: cleaned,
      warnings: ["JavaScript has unbalanced braces, so formatting was skipped."],
    };
  }

  const lines: string[] = [];
  let current = "";
  let depth = 0;
  let inString: "'" | '"' | "`" | null = null;
  let escaped = false;

  const pushLine = () => {
    const line = current.trim();
    if (line) {
      lines.push(`${"  ".repeat(Math.max(0, depth))}${line}`);
    }
    current = "";
  };

  for (const char of cleaned) {
    current += char;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }

    if (char === "{") {
      pushLine();
      depth += 1;
    } else if (char === "}") {
      const line = current.trim();
      current = "";
      depth = Math.max(0, depth - 1);
      lines.push(`${"  ".repeat(depth)}${line}`);
    } else if (char === ";") {
      pushLine();
    }
  }

  pushLine();

  return {
    code: indentLines(lines),
    warnings: [],
  };
}

export function formatEditorCode(kind: EditorKind, code: string): CodeFormatResult {
  if (kind === "html") {
    return formatHtmlCode(code);
  }

  if (kind === "css") {
    return formatCssCode(code);
  }

  return formatJsCode(code);
}
