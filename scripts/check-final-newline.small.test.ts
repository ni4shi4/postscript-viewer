import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkFile, finalNewlineViolation } from "./check-final-newline.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_SCRIPT = path.join(REPO_ROOT, "scripts", "check-final-newline.mjs");

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function runCheckScript(filePaths: string[]): Promise<{ code: number; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CHECK_SCRIPT, ...filePaths], { cwd: REPO_ROOT });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

describe("finalNewlineViolation", () => {
  it("accepts empty content", () => {
    expect(finalNewlineViolation("")).toBeUndefined();
  });

  it("accepts content ending with newline", () => {
    expect(finalNewlineViolation("hello\n")).toBeUndefined();
  });

  it("rejects content without final newline", () => {
    expect(finalNewlineViolation("hello")).toBe("file must end with a final newline");
  });
});

describe("check-final-newline.mjs", () => {
  it("passes when the file ends with a newline", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "final-newline-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "ok.md");
    await writeFile(filePath, "# ok\n", "utf8");

    expect(await checkFile(filePath)).toBeUndefined();

    const result = await runCheckScript([filePath]);
    expect(result.code).toBe(0);
  });

  it("fails when the file does not end with a newline", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "final-newline-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "bad.md");
    await writeFile(filePath, "# bad", "utf8");

    const message = await checkFile(filePath);
    expect(message).toContain("file must end with a final newline");

    const result = await runCheckScript([filePath]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("file must end with a final newline");
  });

  it("reports only violating paths among multiple files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "final-newline-"));
    tempDirs.push(dir);
    const okPath = path.join(dir, "ok.md");
    const badPath = path.join(dir, "bad.md");
    await writeFile(okPath, "ok\n", "utf8");
    await writeFile(badPath, "bad", "utf8");

    const result = await runCheckScript([okPath, badPath]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("bad.md");
    expect(result.stderr).not.toContain("ok.md");
  });
});