import crypto from "node:crypto";

export const RANDOM_SOURCES = Object.freeze({
  TARGET_ASSIGNMENT: "TARGET_ASSIGNMENT",
  MACHINE_OUTPUT: "MACHINE_OUTPUT",
  AUDIO_NOISE: "AUDIO_NOISE",
});

export const RANDOM_DOMAINS = RANDOM_SOURCES;
const DOMAIN_VERSION = "hmac-sha256-domain-v1";
const DOMAIN_PREFIX = "MIP_RANDOM_DOMAIN";
const domainSet = new Set(Object.values(RANDOM_SOURCES));

function assertDomain(domain) {
  if (!domainSet.has(domain))
    throw new Error(`Unknown random source domain ${String(domain)}`);
}

function rootBytes(rootSeed) {
  if (Buffer.isBuffer(rootSeed)) {
    if (!rootSeed.length) throw new Error("rootSeed must not be empty");
    return Buffer.from(rootSeed);
  }
  if (rootSeed === undefined || rootSeed === null || String(rootSeed).length === 0)
    throw new Error("rootSeed must not be empty");
  return Buffer.from(String(rootSeed));
}

/** Derive a domain key without exposing it in any renderer-facing metadata. */
export function deriveDomainSeed(rootSeed, domain) {
  assertDomain(domain);
  return crypto
    .createHmac("sha256", rootBytes(rootSeed))
    .update(`${DOMAIN_PREFIX}:${DOMAIN_VERSION}:${domain}`, "utf8")
    .digest();
}

function readUint64(buffer, offset = 0) {
  return buffer.readBigUInt64BE(offset);
}

function publicMetadata(source) {
  return Object.freeze({
    domain: source.domain,
    provider: source.provider,
    id: source.id,
    version: source.version,
    deterministic: source.deterministic,
    seedPresent: source.deterministic,
  });
}

export class DeterministicDomainSource {
  constructor(rootSeed, domain) {
    assertDomain(domain);
    this.domain = domain;
    this.provider = "DETERMINISTIC_PRNG_TEST";
    this.id = "HMAC_SHA256_DOMAIN_STREAM";
    this.version = DOMAIN_VERSION;
    this.deterministic = true;
    this.#key = deriveDomainSeed(rootSeed, domain);
    this.#counter = 0n;
  }

  #key;
  #counter;

  bytes(size) {
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("size must be a non-negative safe integer");
    const result = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const block = crypto
        .createHmac("sha256", this.#key)
        .update(Buffer.from(`block:${this.#counter++}:`, "utf8"))
        .digest();
      const take = Math.min(block.length, size - offset);
      block.copy(result, offset, 0, take);
      offset += take;
    }
    return result;
  }

  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1)
      throw new Error("maxExclusive must be a positive safe integer");
    const bound = 1n << 64n;
    const limit = bound - (bound % BigInt(maxExclusive));
    let value;
    do value = readUint64(this.bytes(8)); while (value >= limit);
    return Number(value % BigInt(maxExclusive));
  }

  bits(width) {
    if (!Number.isInteger(width) || width < 1 || width > 30)
      throw new Error("bit width must be 1..30");
    return this.int(2 ** width);
  }

  metadata() {
    return publicMetadata(this);
  }

  toRendererDTO() {
    return this.metadata();
  }
}

/**
 * Every OS source owns its own provider object. The provider is injectable in
 * tests, while production defaults to node:crypto's OS-backed primitives.
 */
export class OsCsprngDomainSource {
  constructor(domain, cryptoProvider = crypto) {
    assertDomain(domain);
    this.domain = domain;
    this.provider = "OS_CSPRNG";
    this.id = "OS_CSPRNG";
    this.version = "node-crypto";
    this.deterministic = false;
    // Each domain gets its own provider facade even when production delegates
    // to node:crypto. This makes source ownership explicit to integrations.
    this.cryptoProvider = {
      randomBytes: (...args) => cryptoProvider.randomBytes(...args),
      randomInt: typeof cryptoProvider.randomInt === "function"
        ? (...args) => cryptoProvider.randomInt(...args)
        : undefined,
    };
  }

  bytes(size) {
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("size must be a non-negative safe integer");
    return this.cryptoProvider.randomBytes(size);
  }

  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1)
      throw new Error("maxExclusive must be a positive safe integer");
    if (typeof this.cryptoProvider.randomInt === "function")
      return this.cryptoProvider.randomInt(maxExclusive);
    const limit = 2 ** 32 - (2 ** 32 % maxExclusive);
    let value;
    do value = this.bytes(4).readUInt32BE(0); while (value >= limit);
    return value % maxExclusive;
  }

  bits(width) {
    if (!Number.isInteger(width) || width < 1 || width > 30)
      throw new Error("bit width must be 1..30");
    return this.int(2 ** width);
  }

  metadata() {
    return publicMetadata(this);
  }

  toRendererDTO() {
    return this.metadata();
  }
}

export function createRandomSource(domain, options = {}) {
  assertDomain(domain);
  const provider = options.provider || (options.deterministic ? "DETERMINISTIC_PRNG_TEST" : "OS_CSPRNG");
  if (provider === "DETERMINISTIC_PRNG_TEST" || provider === "DETERMINISTIC")
    return new DeterministicDomainSource(options.rootSeed ?? options.seed, domain);
  if (provider === "OS_CSPRNG") return new OsCsprngDomainSource(domain, options.cryptoProvider);
  throw new Error(`Unsupported random provider ${provider}`);
}

export function createRandomSources(rootSeed, options = {}) {
  const sourceOptions = { ...options, rootSeed };
  return Object.freeze(
    Object.fromEntries(
      Object.values(RANDOM_SOURCES).map((domain) => [domain, createRandomSource(domain, sourceOptions)]),
    ),
  );
}

export function randomSourcesMetadata(sources) {
  const values = sources && typeof sources === "object" ? Object.values(sources) : [];
  return Object.freeze(values.map((source) => source.metadata()));
}

export function toRendererRandomDTO(sources) {
  return { randomSources: randomSourcesMetadata(sources) };
}

export const createDomainSources = createRandomSources;
