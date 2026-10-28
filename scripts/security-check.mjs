import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import path from "node:path";
import { repositoryFiles } from "./repository-files.mjs";
const { candidates, tracked, git } = repositoryFiles();
const problems = [];
const credentialPattern =
  /AIza[0-9A-Za-z_-]{35}|\bAQ\.[A-Za-z0-9_-]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b/;
function inspect(file, text) {
  const normalized = file.replaceAll("\\", "/");
  if (
    /(^|\/)\.env(?:\.|$)/.test(normalized) &&
    !normalized.endsWith(".env.example")
  )
    problems.push(`${file}: environment file must not be tracked`);
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/"))
    problems.push(`${file}: generated content must not be tracked`);
  if (normalized === ".env.example") {
    const value = text
      .split(/\r?\n/)
      .find((line) => line.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
      ?.split("=")
      .slice(1)
      .join("=")
      .trim();
    if (value && value !== "YOUR_GEMINI_API_KEY")
      problems.push(
        `${file}: use the documented placeholder; keep credentials in ignored local configuration`,
      );
  }
  if (credentialPattern.test(text))
    problems.push(`${file}: potential credential detected`);
  if (
    normalized.startsWith("src/") &&
    /NEXT_PUBLIC_\w*(?:KEY|TOKEN|SECRET)/.test(text)
  )
    problems.push(`${file}: public credential variable detected`);
}
for (const file of candidates) inspect(file, readFileSync(file, "utf8"));
if (git) {
  for (const file of tracked) {
    // A clean working file cannot hide a credential left in the staging area.
    const staged = execFileSync("git", ["show", `:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    inspect(file, staged);
  }
  const indicators = execFileSync(
    "git",
    [
      "log",
      "--all",
      "--format=",
      "--name-only",
      "-G",
      "AIza[0-9A-Za-z_-]{35}|AQ[.][A-Za-z0-9_-]{40,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
  if (indicators)
    problems.push(
      "Git history contains potential credential indicators. Review privately and rotate affected credentials; do not rewrite history automatically.",
    );
  const commits = execFileSync("git", ["rev-list", "--all", "--count"], {
    encoding: "utf8",
  }).trim();
  console.log(
    `Staged content inspected. Available committed revisions: ${commits}; historical indicator scan completed. No secret values are printed.`,
  );
}
if (process.argv.includes("--bundles")) {
  const directory = ".next/static";
  if (!existsSync(directory))
    throw new Error(
      "Build first: client bundle verification requires .next/static.",
    );
  const local = existsSync(".env.local")
    ? parseEnv(readFileSync(".env.local", "utf8"))
    : {};
  const secrets = [
    local.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((value) => value && value !== "YOUR_GEMINI_API_KEY");
  let count = 0;
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.name.endsWith(".js")) {
        count++;
        const content = readFileSync(filename, "utf8");
        if (
          credentialPattern.test(content) ||
          secrets.some((secret) => content.includes(secret))
        )
          problems.push(
            `${filename}: possible client-bundle credential exposure`,
          );
      }
    }
  }
  visit(directory);
  console.log(
    `Client JavaScript checked: ${count} files; exact configured-key comparison ${secrets.length ? "included" : "unavailable (no local key)"}.`,
  );
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Credential and generated-content checks passed for ${candidates.length} source files. Pattern scanning complements manual review; it cannot identify every secret.`,
  );
