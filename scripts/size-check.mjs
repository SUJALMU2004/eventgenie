import { statSync } from "node:fs";
import { repositoryFiles } from "./repository-files.mjs";
const files = repositoryFiles();
const size = (list) =>
  list.reduce((total, file) => total + statSync(file).size, 0);
const tracked = size(files.tracked),
  candidate = size(files.candidates);
console.log(
  `Tracked content: ${tracked.toLocaleString()} bytes. Source including untracked candidates: ${candidate.toLocaleString()} bytes.`,
);
if (!files.git)
  console.log("Git has not been initialised; measured source candidates only.");
console.log(
  "Release threshold: <9,000,000 bytes; evaluator hard limit: <10,000,000 bytes. Dependencies and build outputs are excluded.",
);
if (Math.max(tracked, candidate) >= 9000000) {
  console.error("Repository content exceeds the release size threshold.");
  process.exitCode = 1;
}
