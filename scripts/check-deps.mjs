/**
 * Hexagonal dependency rules for src/ (main.ts is exempt).
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");

const CORE_ALLOWED_PACKAGES = new Set(["pako"]);
const CORE_TEST_ALLOWED_PACKAGES = new Set(["vitest"]);

const IMPORT_SPECIFIER_RE = /import\s+(?:type\s+)?(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/g;
const BANNED_GLOBAL_RE = /\b(window|document|Worker)\b/g;

/**
 * @param {string} absPath
 */
function classifySourceFile(absPath) {
  const rel = path.relative(srcRoot, absPath).replaceAll("\\", "/");
  if (rel === "main.ts") {
    return { kind: "exempt" };
  }
  if (rel.startsWith("core/")) {
    return { kind: "core", rel };
  }
  const drivingMatch = /^adapters\/driving\/([^/]+)\//.exec(rel);
  if (drivingMatch) {
    return { kind: "driving", adapter: drivingMatch[1], rel };
  }
  const drivenMatch = /^adapters\/driven\/([^/]+)\//.exec(rel);
  if (drivenMatch) {
    return { kind: "driven", adapter: drivenMatch[1], rel };
  }
  return { kind: "other", rel };
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectTypeScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(fullPath)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function extractImportSpecifiers(content) {
  const specifiers = [];
  for (const match of content.matchAll(IMPORT_SPECIFIER_RE)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * @param {string} fromFile
 * @param {string} specifier
 */
function resolveRelativeImport(fromFile, specifier) {
  const withoutSuffix = specifier.replace(/(\.(ts|js))?$/, "");
  return path.resolve(path.dirname(fromFile), withoutSuffix);
}

/**
 * @param {string} absPath
 */
function relativeFromSrc(absPath) {
  return path.relative(srcRoot, absPath).replaceAll("\\", "/");
}

/**
 * @param {string} resolvedPath
 */
function adapterTarget(resolvedPath) {
  const rel = relativeFromSrc(resolvedPath);
  const match = /^adapters\/(driving|driven)\/([^/]+)\//.exec(rel);
  if (!match) {
    return undefined;
  }
  return { side: match[1], name: match[2] };
}

/**
 * @param {string} file
 * @param {string} specifier
 * @param {ReturnType<typeof classifySourceFile>} classification
 * @returns {string | undefined}
 */
function checkImportViolation(file, specifier, classification) {
  if (classification.kind === "exempt" || classification.kind === "other") {
    return undefined;
  }

  if (specifier.startsWith(".")) {
    const resolved = resolveRelativeImport(file, specifier);
    const rel = relativeFromSrc(resolved);

    if (classification.kind === "core" && rel.startsWith("adapters/")) {
      return `core must not import adapters (${specifier})`;
    }

    if (classification.kind === "driving" || classification.kind === "driven") {
      const target = adapterTarget(resolved);
      if (target === undefined) {
        return undefined;
      }
      const fromSide = classification.kind === "driving" ? "driving" : "driven";
      if (target.side !== fromSide) {
        return `${fromSide} adapter must not import ${target.side} adapter (${specifier})`;
      }
      if (target.name !== classification.adapter) {
        return `adapters must not import a sibling adapter directory (${specifier})`;
      }
    }
    return undefined;
  }

  if (classification.kind === "core") {
    const isTestFile = file.endsWith(".test.ts");
    const allowedPackages = isTestFile
      ? new Set([...CORE_ALLOWED_PACKAGES, ...CORE_TEST_ALLOWED_PACKAGES])
      : CORE_ALLOWED_PACKAGES;
    if (!allowedPackages.has(specifier)) {
      return `core may only import pako from npm; got "${specifier}"`;
    }
  }

  return undefined;
}

/**
 * @param {string} file
 * @param {string} content
 * @param {ReturnType<typeof classifySourceFile>} classification
 * @returns {string[]}
 */
function stripStringLiterals(content) {
  return content
    .replaceAll(/"(?:\\.|[^"\\])*"/g, '""')
    .replaceAll(/'(?:\\.|[^'\\])*'/g, "''")
    .replaceAll(/`(?:\\.|[^`\\])*`/g, "``");
}

function checkBannedGlobals(file, content, classification) {
  if (classification.kind !== "core" || file.endsWith(".test.ts")) {
    return [];
  }
  const rel = path.relative(srcRoot, file).replaceAll("\\", "/");
  const violations = [];
  const codeWithoutStrings = stripStringLiterals(content);
  for (const match of codeWithoutStrings.matchAll(BANNED_GLOBAL_RE)) {
    violations.push(`${rel}: core must not reference ${match[1]}`);
  }
  return violations;
}

/**
 * @param {string} file
 * @param {string} content
 */
function checkFile(file, content) {
  const classification = classifySourceFile(file);
  const violations = [];

  for (const specifier of extractImportSpecifiers(content)) {
    const message = checkImportViolation(file, specifier, classification);
    if (message !== undefined) {
      const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
      violations.push(`${rel}: ${message}`);
    }
  }

  violations.push(...checkBannedGlobals(file, content, classification));
  return violations;
}

const files = await collectTypeScriptFiles(srcRoot);
const allViolations = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  allViolations.push(...checkFile(file, content));
}

if (allViolations.length > 0) {
  for (const violation of allViolations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log("dependency rules OK");
