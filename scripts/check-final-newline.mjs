/**
 * Requires a final newline on text files that oxfmt does not cover in pre-commit.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRACKED_EXTENSIONS = /\.(md|yml|yaml|ps)$/i;

/**
 * @param {string} content
 * @returns {string | undefined}
 */
export function finalNewlineViolation(content) {
  if (content.length === 0) {
    return undefined;
  }
  if (!content.endsWith("\n")) {
    return "file must end with a final newline";
  }
  return undefined;
}

/**
 * @param {string} filePath
 * @returns {Promise<string | undefined>}
 */
export async function checkFile(filePath) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err) {
    return `could not read: ${err instanceof Error ? err.message : String(err)}`;
  }
  const violation = finalNewlineViolation(content);
  if (violation === undefined) {
    return undefined;
  }
  const rel = path.isAbsolute(filePath)
    ? path.relative(repoRoot, filePath).replaceAll("\\", "/")
    : filePath.replaceAll("\\", "/");
  return `${rel}: ${violation}`;
}

/**
 * @returns {Promise<string[]>}
 */
async function listTrackedTargetFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: repoRoot });
  return stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0 && TRACKED_EXTENSIONS.test(line));
}

async function main() {
  const argv = process.argv.slice(2);
  const files =
    argv.length > 0
      ? argv.map((file) => path.resolve(process.cwd(), file))
      : (await listTrackedTargetFiles()).map((file) => path.join(repoRoot, file));

  const violations = [];
  for (const file of files) {
    const message = await checkFile(file);
    if (message !== undefined) {
      violations.push(message);
    }
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exit(1);
  }

  if (argv.length === 0) {
    console.log("final newline OK");
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === scriptPath) {
  await main();
}