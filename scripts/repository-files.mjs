import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const excluded = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  "artifacts",
  ".cache",
]);
function walk(directory = ".") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      excluded.has(entry.name) ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example") ||
      /\.(?:log|tsbuildinfo|zip|tgz)$/.test(entry.name)
    )
      return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walk(filename)
      : entry.isFile()
        ? [filename]
        : [];
  });
}
export function repositoryFiles() {
  try {
    const tracked = execFileSync("git", ["ls-files", "-z", "--cached"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
    const untracked = execFileSync(
      "git",
      ["ls-files", "-z", "--others", "--exclude-standard"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean);
    return {
      tracked,
      candidates: [...new Set([...tracked, ...untracked])],
      git: true,
    };
  } catch {
    const candidates = walk();
    return { tracked: [], candidates, git: false };
  }
}
