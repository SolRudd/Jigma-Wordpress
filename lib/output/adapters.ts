import type { BricksExport, ConversionInput } from "../../types/jigma.ts";
import {
  createBricksExport,
  serializeBricksClipboardPayload,
  serializeJigmaDebugReport,
  TARGET_BRICKS_VERSION,
} from "../bricks/export.ts";

export type OutputTarget = "bricks";
export type OutputFormat = "bricks-json";

export interface OutputAdapter {
  target: OutputTarget;
  targetLabel: string;
  format: OutputFormat;
  formatLabel: string;
  copyLabel: string;
  targetVersion: string;
  createExport: (input: ConversionInput) => BricksExport;
}

export const BRICKS_OUTPUT_ADAPTER: OutputAdapter = {
  target: "bricks",
  targetLabel: "Bricks",
  format: "bricks-json",
  formatLabel: "Bricks JSON",
  copyLabel: "Copy Bricks Structure",
  targetVersion: TARGET_BRICKS_VERSION,
  createExport: createBricksExport,
};

export const DEFAULT_OUTPUT_ADAPTER = BRICKS_OUTPUT_ADAPTER;

export function createOutputExport(
  input: ConversionInput,
  adapter: OutputAdapter = DEFAULT_OUTPUT_ADAPTER,
) {
  return adapter.createExport(input);
}

export function serializeOutputClipboardPayload(
  exportResult: BricksExport,
  adapter: OutputAdapter = DEFAULT_OUTPUT_ADAPTER,
) {
  if (adapter.target === "bricks") {
    return serializeBricksClipboardPayload(exportResult);
  }

  return exportResult;
}

export function serializeOutputDebugReport(
  exportResult: BricksExport,
  adapter: OutputAdapter = DEFAULT_OUTPUT_ADAPTER,
) {
  if (adapter.target === "bricks") {
    return serializeJigmaDebugReport(exportResult);
  }

  return exportResult;
}
