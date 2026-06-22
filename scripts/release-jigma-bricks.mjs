#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const PLUGIN_DIR = join(ROOT, "jigma-bricks");
const PLUGIN_FILE = join(PLUGIN_DIR, "jigma-bricks.php");
const VERSIONS_FILE = join(ROOT, "release", "versions.json");
const RELEASE_DIR = join(ROOT, "releases", "jigma-bricks");
const UPDATE_BASE_URL = "https://jigma.co.uk/releases/jigma-bricks";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...options,
  });
}

function commandExists(command) {
  return spawnSync("sh", ["-lc", `command -v ${command}`], {
    cwd: ROOT,
    stdio: "ignore",
  }).status === 0;
}

function assertCleanWorkingTree() {
  const status = execFileSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();

  if (status) {
    throw new Error("Working tree must be clean before creating a Jigma Bricks release.");
  }
}

function assertVersion(version) {
  if (!/^\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(version)) {
    throw new Error(`Invalid plugin version: ${version}`);
  }
}

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Could not update ${label}.`);
  }
  return source.replace(pattern, replacement);
}

function updateVersionFiles(version) {
  let pluginSource = readFileSync(PLUGIN_FILE, "utf8");
  pluginSource = replaceOrFail(pluginSource, /Version:\s*[^\n]+/, `Version: ${version}`, "plugin header version");
  pluginSource = replaceOrFail(
    pluginSource,
    /define\(\s*'JIGMA_BRICKS_VERSION',\s*'[^']+'\s*\);/,
    `define( 'JIGMA_BRICKS_VERSION', '${version}' );`,
    "JIGMA_BRICKS_VERSION",
  );
  writeFileSync(PLUGIN_FILE, pluginSource);

  const versions = JSON.parse(readFileSync(VERSIONS_FILE, "utf8"));
  versions.generatedAt = new Date().toISOString();
  versions.plugin = versions.plugin || {};
  versions.plugin.version = version;
  writeFileSync(VERSIONS_FILE, `${JSON.stringify(versions, null, 2)}\n`);
}

function readPluginVersions() {
  const source = readFileSync(PLUGIN_FILE, "utf8");
  const header = source.match(/Version:\s*([^\n]+)/)?.[1]?.trim() || "";
  const constant = source.match(/define\(\s*'JIGMA_BRICKS_VERSION',\s*'([^']+)'\s*\);/)?.[1] || "";
  const versions = JSON.parse(readFileSync(VERSIONS_FILE, "utf8"));
  return {
    header,
    constant,
    release: versions.plugin?.version || "",
  };
}

function assertVersionsAgree(version) {
  const versions = readPluginVersions();
  const mismatches = Object.entries(versions).filter(([, value]) => value !== version);
  if (mismatches.length) {
    throw new Error(`Version mismatch: ${JSON.stringify(versions)} expected ${version}`);
  }
}

function lintPhpIfAvailable() {
  if (!commandExists("php")) {
    console.log("> php unavailable; PHP lint skipped");
    return;
  }

  [
    "jigma-bricks/jigma-bricks.php",
    "jigma-bricks/includes/class-jigma-plugin-updater.php",
    "jigma-bricks/includes/class-jigma-media-importer.php",
    "jigma-bricks/includes/class-jigma-asset-security.php",
  ].forEach((file) => run("php", ["-l", file]));
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function verifyZipTopLevel(zipPath) {
  const listing = execFileSync("unzip", ["-Z1", zipPath], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim().split(/\r?\n/).filter(Boolean);

  const topLevel = new Set(listing.map((entry) => entry.split("/")[0]).filter(Boolean));
  if (topLevel.size !== 1 || !topLevel.has("jigma-bricks")) {
    throw new Error(`ZIP must contain exactly one top-level jigma-bricks/ folder: ${Array.from(topLevel).join(", ")}`);
  }

  [
    "jigma-bricks/jigma-bricks.php",
    "jigma-bricks/assets/jigma-core.js",
    "jigma-bricks/assets/jigma-bricks.js",
    "jigma-bricks/assets/jigma-bricks.css",
    "jigma-bricks/includes/class-jigma-plugin-updater.php",
  ].forEach((required) => {
    if (!listing.includes(required)) {
      throw new Error(`ZIP missing required file: ${required}`);
    }
  });
}

function writeLatestJson(version, checksum, changelog) {
  const metadata = {
    name: "Jigma Bricks",
    slug: "jigma-bricks",
    version,
    download_url: `${UPDATE_BASE_URL}/jigma-bricks-${version}.zip`,
    homepage: "https://jigma.co.uk/",
    requires: "6.4",
    requires_php: "7.4",
    tested: "",
    sha256: checksum,
    changelog,
  };

  writeFileSync(join(RELEASE_DIR, "latest.json"), `${JSON.stringify(metadata, null, 2)}\n`);
}

function createReleasePackage(version, changelog) {
  mkdirSync(RELEASE_DIR, { recursive: true });
  const zipName = `jigma-bricks-${version}.zip`;
  const zipPath = join(RELEASE_DIR, zipName);
  if (existsSync(zipPath)) {
    run("rm", ["-f", zipPath]);
  }

  run("zip", [
    "-qr",
    zipPath,
    "jigma-bricks",
    "-x",
    "jigma-bricks/.DS_Store",
    "jigma-bricks/**/.DS_Store",
    "jigma-bricks/**/node_modules/**",
    "jigma-bricks/**/.git/**",
    "jigma-bricks/**/tests/**",
    "jigma-bricks/**/*.env",
  ]);
  verifyZipTopLevel(zipPath);

  const checksum = sha256(zipPath);
  writeLatestJson(version, checksum, changelog);
  copyFileSync(zipPath, join(ROOT, "jigma-bricks.zip"));

  return { zipName, checksum };
}

function main() {
  const version = argValue("--version");
  const changelog = argValue("--changelog") || `Jigma Bricks ${version} beta release.`;
  if (!version) {
    throw new Error("Usage: npm run release:jigma-bricks -- --version 0.2.3-beta");
  }

  assertVersion(version);
  assertCleanWorkingTree();
  updateVersionFiles(version);
  assertVersionsAgree(version);

  run("npm", ["run", "build:plugin-core"]);
  createReleasePackage(version, changelog);
  run("npm", ["run", "test"]);
  run("npm", ["run", "build"]);
  run(process.execPath, ["--check", "jigma-bricks/assets/jigma-bricks.js"]);
  run(process.execPath, ["--check", "jigma-bricks/assets/jigma-core.js"]);
  lintPhpIfAvailable();
  const { zipName, checksum } = createReleasePackage(version, changelog);

  console.log(`Created ${zipName}`);
  console.log(`SHA-256 ${checksum}`);
  console.log("Updated releases/jigma-bricks/latest.json");
}

main();
