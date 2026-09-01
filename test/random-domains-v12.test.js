import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RANDOM_SOURCES,
  createRandomSource,
  createRandomSources,
  deriveDomainSeed,
  toRendererRandomDTO,
} from "../src/main/random/random-domains.js";

test("HMAC domain sources are reproducible and domain-separated", () => {
  const a = createRandomSources("root-fixture", { provider: "DETERMINISTIC_PRNG_TEST" });
  const b = createRandomSources("root-fixture", { provider: "DETERMINISTIC_PRNG_TEST" });
  for (const domain of Object.values(RANDOM_SOURCES)) {
    assert.deepEqual(a[domain].bytes(64), b[domain].bytes(64));
    assert.equal(a[domain].metadata().domain, domain);
  }
  assert.notDeepEqual(deriveDomainSeed("root-fixture", RANDOM_SOURCES.TARGET_ASSIGNMENT), deriveDomainSeed("root-fixture", RANDOM_SOURCES.MACHINE_OUTPUT));
});

test("OS_CSPRNG sources are separate providers and renderer metadata excludes seeds", () => {
  const provider = { randomBytes: (size) => Buffer.alloc(size, 7), randomInt: () => 3 };
  const target = createRandomSource(RANDOM_SOURCES.TARGET_ASSIGNMENT, { provider: "OS_CSPRNG", cryptoProvider: provider });
  const machine = createRandomSource(RANDOM_SOURCES.MACHINE_OUTPUT, { provider: "OS_CSPRNG", cryptoProvider: provider });
  assert.notEqual(target, machine);
  assert.equal(target.int(10), 3);
  const dto = toRendererRandomDTO({ target, machine });
  assert.equal(JSON.stringify(dto).includes("root-fixture"), false);
  assert.equal(JSON.stringify(dto).includes("seed"), true);
  assert.equal(dto.randomSources[0].seed, undefined);
});

test("critical formal modules do not use Math.random", () => {
  const files = [
    "src/main/sessions/session-controller.js",
    "src/main/sessions/session-scheduler.js",
    "src/main/random/random-domains.js",
    "src/main/power/power-manager.js",
  ];
  for (const file of files) assert.equal(fs.readFileSync(file, "utf8").includes("Math.random"), false, file);
});
