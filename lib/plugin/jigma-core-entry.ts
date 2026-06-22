import {
  convertToBricksCompatibility,
  detectPageLevelCss,
} from "./jigma-core.ts";
import {
  BRICKS_COMPATIBILITY_SCHEMA_VERSION,
  TARGET_BRICKS_VERSION,
} from "../bricks/export.ts";

declare global {
  interface Window {
    JigmaCore?: {
      schemaVersion: typeof BRICKS_COMPATIBILITY_SCHEMA_VERSION;
      targetBricksVersion: typeof TARGET_BRICKS_VERSION;
      convertToBricksCompatibility: typeof convertToBricksCompatibility;
      detectPageLevelCss: typeof detectPageLevelCss;
    };
  }
}

window.JigmaCore = {
  schemaVersion: BRICKS_COMPATIBILITY_SCHEMA_VERSION,
  targetBricksVersion: TARGET_BRICKS_VERSION,
  convertToBricksCompatibility,
  detectPageLevelCss,
};
