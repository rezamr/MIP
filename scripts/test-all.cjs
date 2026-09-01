/*
 * Run the complete verification matrix without mixing Node and Electron
 * native-module ABIs in one process. better-sqlite3 is compiled once for the
 * host Node test run and once for Electron's renderer/main-process harness.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const node = process.execPath;
const tests = fs.readdirSync(path.join(root, "test"))
  .filter((name) => name.endsWith(".test.js") && name !== "electron-e2e.test.js")
  .sort()
  .map((name) => path.join(root, "test", name));

function run(command, args, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let status = run(node, ["scripts/rebuild-native.cjs", "node"], "Rebuild better-sqlite3 for Node");
if (status !== 0) process.exit(status);
status = run(node, ["--test", ...tests], "Node unit/integration tests");
if (status !== 0) process.exit(status);

let verificationStatus = 0;
try {
  verificationStatus = run(node, ["scripts/rebuild-native.cjs", "electron"], "Rebuild better-sqlite3 for Electron");
  if (verificationStatus === 0)
    verificationStatus = run(node, ["--test", "test/electron-e2e.test.js"], "Electron end-to-end test");
} finally {
  // Leave the checkout usable for ordinary Node tooling even when the E2E
  // child fails. Release scripts rebuild the Electron ABI before packaging.
  const restore = spawnSync(node, ["scripts/rebuild-native.cjs", "node"], { cwd: root, stdio: "inherit", env: process.env });
  if (verificationStatus === 0 && restore.status !== 0) verificationStatus = restore.status ?? 1;
}
process.exit(verificationStatus);
