import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPackage = path.dirname(require.resolve("electron/package.json"));
const electronBinary = process.platform === "win32"
  ? path.join(electronPackage, "dist", "electron.exe")
  : path.join(electronPackage, "dist", "electron");
const installer = path.join(projectRoot, "dist", "MIP-1.2.0-win-x64.exe");

function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: projectRoot, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Command timed out: ${file} ${args.join(" ")}\n${stdout}\n${stderr}`)); }, options.timeoutMs || 120_000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
  });
}

async function install(target) {
  const result = await run(installer, ["/S", `/D=${target}`], { timeoutMs: 180_000 });
  assert.equal(result.code, 0, `installer failed\n${result.stdout}\n${result.stderr}`);
  assert.ok(fs.existsSync(path.join(target, "MIP.exe")), `installed executable missing under ${target}`);
}

async function launchPackaged(executable, root, phase, expectedSessionId = null) {
  const resultPath = path.join(root, `${phase}.json`);
  const userData = path.join(root, "user-data");
  const environment = {
    ...process.env,
    MIP_E2E_RESULT: resultPath,
    MIP_E2E_USER_DATA: userData,
    MIP_E2E_PHASE: phase,
    ...(expectedSessionId ? { MIP_E2E_EXPECT_SESSION: expectedSessionId } : {}),
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  };
  const result = await run(executable, ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"], { env: environment, timeoutMs: 120_000 });
  assert.equal(result.code, 0, `packaged app failed\n${result.stdout}\n${result.stderr}`);
  assert.ok(fs.existsSync(resultPath), `packaged app produced no ${phase} result\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(fs.readFileSync(resultPath, "utf8"));
}

function createV1Fixture(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sql = fs.readFileSync(path.join(projectRoot, "test", "fixtures", "legacy-schema-v1.sql"), "utf8");
  const result = spawnSync("sqlite3.exe", [file], { cwd: projectRoot, env: process.env, input: sql, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `schema-v1 fixture creation failed\n${result.stdout}\n${result.stderr}`);
  assert.ok(fs.existsSync(file));
}

test("Windows installer clean install, upgrade migration, uninstall retention, and rediscovery", async (t) => {
  if (process.platform !== "win32") {
    t.skip("The requested installer lifecycle is Windows-specific.");
    return;
  }
  if (process.env.MIP_RUN_INSTALLER_TEST !== "1") {
    t.skip("Set MIP_RUN_INSTALLER_TEST=1 after npm run dist to execute the destructive-in-temp lifecycle check.");
    return;
  }
  assert.ok(fs.existsSync(installer), `build installer first: ${installer}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mip-installer-lifecycle-"));
  const installRoot = path.join(root, "installed");
  const migrationRoot = path.join(root, "migration");
  try {
    await install(installRoot);
    const packaged = path.join(installRoot, "MIP.exe");
    const first = await launchPackaged(packaged, root, "initial");
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.integrity.valid, true, JSON.stringify(first.integrity));
    assert.equal(first.restore.restored, true);

    const v1Database = path.join(migrationRoot, "user-data", "MIP", "data", "mip.sqlite3");
    createV1Fixture(v1Database);
    const migration = await launchPackaged(packaged, migrationRoot, "migration", "V1-SESSION");
    assert.equal(migration.ok, true, JSON.stringify(migration));
    assert.ok(migration.schemaVersion >= 12);
    assert.equal(migration.sessionPersisted, true);
    assert.equal(migration.migrationSession.sessionId, "V1-SESSION");
    assert.ok(migration.migrationIntegrity && Array.isArray(migration.migrationIntegrity.errors));

    const uninstaller = path.join(installRoot, "Uninstall MIP.exe");
    assert.ok(fs.existsSync(uninstaller));
    const removed = await run(uninstaller, ["/S"], { timeoutMs: 180_000 });
    assert.equal(removed.code, 0, `uninstaller failed\n${removed.stdout}\n${removed.stderr}`);
    assert.equal(fs.existsSync(path.join(root, "user-data", "MIP", "data", "mip.sqlite3")), true, "user data must survive uninstall");

    await install(installRoot);
    const rediscovered = await launchPackaged(path.join(installRoot, "MIP.exe"), root, "restart", first.sessionId);
    assert.equal(rediscovered.ok, true, JSON.stringify(rediscovered));
    assert.equal(rediscovered.sessionPersisted, true);
    assert.equal(rediscovered.persistedReport.locked, true);
    assert.ok(rediscovered.persistedOutputCount > 0);

    const asar = path.join(installRoot, "resources", "app.asar");
    assert.ok(fs.existsSync(asar));
    const listed = spawnSync(path.join(projectRoot, "node_modules", ".bin", "asar.cmd"), ["list", asar], { cwd: projectRoot, encoding: "utf8", windowsHide: true, shell: true });
    assert.equal(listed.status, 0, listed.stderr || listed.error?.message);
    assert.match(listed.stdout, /\\Logo\.svg/);
    assert.match(listed.stdout, /\\renderer\\/);
  } finally {
    // The root is a unique temporary directory created above; cleanup is
    // intentionally limited to that exact lifecycle sandbox.
    fs.rmSync(root, { recursive: true, force: true });
  }
});
