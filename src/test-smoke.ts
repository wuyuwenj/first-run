// Quick smoke test — run with: npx tsx src/test-smoke.ts <repo-path>

import { scanRepo } from "./scanner/files.js";
import { resolveRequirements } from "./scanner/requirements.js";
import { profileMachine } from "./profiler/machine.js";

const repoPath = process.argv[2] || process.cwd();

console.log(`\n=== Scanning repo: ${repoPath} ===\n`);

const scan = await scanRepo(repoPath);
console.log("Scan result:", JSON.stringify(scan, null, 2));

console.log(`\n=== Resolving requirements ===\n`);

const { requirements, contradictions } = await resolveRequirements(repoPath, scan);
console.log("Requirements:", JSON.stringify(requirements, null, 2));
if (contradictions.length > 0) {
  console.log("Contradictions:", JSON.stringify(contradictions, null, 2));
} else {
  console.log("No contradictions found.");
}

console.log(`\n=== Profiling machine ===\n`);

const machine = await profileMachine();
console.log("Machine:", JSON.stringify(machine, null, 2));
