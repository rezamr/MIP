import {
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  PROCESSOR_VERSION,
  PROVENANCE_CLASSES,
  normalizeRecipe,
} from "../../../public/audio-core.js";

// This module is the single policy boundary for recipe-version material
// comparisons, provenance invalidation, and engineering-verification binding.
// UI code must not infer any of these rules from convenience aliases.

export const AUDIO_CORE_VERSION = "mip-audio-core-2.0";
export const ENGINEERING_VERIFICATION_VERSION = "AUDIO_ENGINEERING_FIXTURES_V1";
export const VERIFICATION_NOT_RUN = "REFERENCE VERIFICATION NOT RUN";
export const VERIFICATION_STALE = "STALE";

const MATERIAL_KEYS = Object.freeze([
  "sampleRate",
  "channels",
  "synthesisMode",
  "carriers",
  "monauralLayers",
  "septon",
  "binauralRelationships",
  "envelope",
  "noise",
  "delay",
  "comb",
  "lowFrequencySweep",
  "cues",
  "protocolCueVersion",
  "protocolCues",
  "voiceReferences",
  "masterGain",
  "headroomDb",
  "rampSeconds",
  "execution",
]);

const CONVENIENCE_KEYS = new Set([
  "id",
  "recipeId",
  "recipeVersion",
  "version",
  "name",
  "provenance",
  "architecture",
  "schemaVersion",
  "mode",
  "durationMode",
  "targetFrames",
  "leftHz",
  "rightHz",
  "centerHz",
  "beatHz",
  "gain",
  "developmentFixture",
  "metadata",
  "configFingerprint",
  "parameterProvenance",
  "provenanceByParameter",
  "historicalStatus",
  "historicalExactness",
  "formalEligibility",
  "formalEligibilityReason",
  "provenanceEligibility",
  "engineeringVerification",
  "provenanceAudit",
]);

const REFERENCE_BINDINGS = Object.freeze({
  A_U396_4: { recipeId: "A-U396-4", fixtureId: "PURE_394_398" },
  A_P100_104: { recipeId: "A-P100-104", fixtureId: "PURE_100_104" },
  A_SHAM_0: { recipeId: "A-SHAM-0", fixtureId: "PURE_SHAM_396_396" },
  MIP_LAYERED_EXPERIMENTAL_V1: { recipeId: "MIP_LAYERED_EXPERIMENTAL_V1", fixtureId: "LAYERED_MIP_EXPERIMENTAL" },
});

const clone = (value) => {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
};

const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
};

function canonicalRecipe(recipe) {
  try {
    return normalizeRecipe(recipe);
  } catch {
    try { return normalizeRecipe(recipe, { developmentFixture: true }); }
    catch { return clone(recipe || {}); }
  }
}

export function materialProjection(recipe) {
  const value = canonicalRecipe(recipe);
  return Object.fromEntries(MATERIAL_KEYS.map((key) => [key, clone(value?.[key] ?? null)]));
}

function diffWalk(before, after, pathName, changes) {
  const beforeIsObject = Boolean(before && typeof before === "object");
  const afterIsObject = Boolean(after && typeof after === "object");
  if (beforeIsObject && afterIsObject && Array.isArray(before) === Array.isArray(after)) {
    if (Array.isArray(before)) {
      const length = Math.max(before.length, after.length);
      for (let index = 0; index < length; index += 1)
        diffWalk(before[index], after[index], `${pathName}[${index}]`, changes);
      return;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort())
      diffWalk(before[key], after[key], pathName ? `${pathName}.${key}` : key, changes);
    return;
  }
  // When an object/array is added or removed, descend into its leaves so the
  // provenance policy can invalidate the exact material parameters rather
  // than attaching one ineffective claim to the container path.
  if (beforeIsObject !== afterIsObject) {
    const present = beforeIsObject ? before : after;
    if (Array.isArray(present)) {
      for (let index = 0; index < present.length; index += 1)
        diffWalk(beforeIsObject ? before[index] : undefined, afterIsObject ? after[index] : undefined, `${pathName}[${index}]`, changes);
    } else {
      for (const key of Object.keys(present).sort())
        diffWalk(beforeIsObject ? before[key] : undefined, afterIsObject ? after[key] : undefined, pathName ? `${pathName}.${key}` : key, changes);
    }
    // A replacement by a non-null scalar is itself material in addition to
    // the removed object leaves; null/undefined are represented by the leaves.
    if ((beforeIsObject && after !== null && after !== undefined) || (afterIsObject && before !== null && before !== undefined))
      changes.push({ path: pathName, before: clone(before), after: clone(after) });
    return;
  }
  if (canonical(before) !== canonical(after)) changes.push({ path: pathName, before: clone(before), after: clone(after) });
}

export function materialDiff(parentRecipe, proposedRecipe) {
  const before = materialProjection(parentRecipe);
  const after = materialProjection(proposedRecipe);
  const changes = [];
  diffWalk(before, after, "", changes);
  return changes.map((change) => ({ ...change, path: change.path.replace(/^\./, "") }));
}

function entryClass(entry) {
  return String(entry?.provenanceClass ?? entry?.class ?? entry?.status ?? "UNKNOWN_BLOCKED").toUpperCase();
}

function provenanceMap(recipe) {
  return recipe?.parameterProvenance && typeof recipe.parameterProvenance === "object" && !Array.isArray(recipe.parameterProvenance)
    ? recipe.parameterProvenance
    : {};
}

function lookupEntry(map, pathName) {
  const wildcard = pathName.replace(/\[\d+\]/g, "[*]");
  return map[pathName] ?? map[wildcard] ?? map["*"] ?? null;
}

function isNewExplicitEntry(submittedMap, pathName, parentEntry) {
  const wildcard = pathName.replace(/\[\d+\]/g, "[*]");
  const key = Object.prototype.hasOwnProperty.call(submittedMap, pathName)
    ? pathName
    : Object.prototype.hasOwnProperty.call(submittedMap, wildcard)
      ? wildcard
      : Object.prototype.hasOwnProperty.call(submittedMap, "*") ? "*" : null;
  if (!key) return false;
  return canonical(submittedMap[key]) !== canonical(parentEntry || null);
}

function validateEntry(entry, pathName) {
  const cls = entryClass(entry);
  if (!PROVENANCE_CLASSES.includes(cls)) return { valid: false, reason: `unsupported provenance class ${cls}` };
  if (cls === "PRIMARY_SOURCE_VERIFIED" && (
    !entry?.sourceRef ||
    !(entry?.newlyValidated === true || entry?.validatedAt || entry?.validationRef || entry?.validationRecord || entry?.sourceValidation)
  ))
    return { valid: false, reason: `${pathName} PRIMARY_SOURCE_VERIFIED requires a newly validated source record` };
  if (cls === "PRIMARY_SOURCE_DERIVED" && (!entry?.sourceRef || !entry?.derivationRule || entry?.inputValues === null || entry?.inputValues === undefined || entry?.derivedValue === null || entry?.derivedValue === undefined || !entry?.derivationVersion))
    return { valid: false, reason: `${pathName} PRIMARY_SOURCE_DERIVED requires a complete derivation record` };
  if (cls === "MIP_RECONSTRUCTION_PARAMETER" && (!entry?.reconstructionReason || !entry?.reconstructionVersion))
    return { valid: false, reason: `${pathName} MIP_RECONSTRUCTION_PARAMETER requires reconstruction metadata` };
  return { valid: true };
}

function fallbackEntry(parentEntry, pathName, parentRecipe = null) {
  const parentClass = parentEntry ? entryClass(parentEntry) : null;
  const top = `${parentRecipe?.provenance || ""} ${parentRecipe?.historicalStatus || ""}`.toUpperCase();
  const reconstruction = parentClass === "MIP_RECONSTRUCTION_PARAMETER" || (
    top.includes("RECONSTRUCTION") && !["UNKNOWN_BLOCKED", "PRIMARY_SOURCE_VERIFIED", "PRIMARY_SOURCE_DERIVED"].includes(parentClass)
  );
  const nextClass = parentClass === "UNKNOWN_BLOCKED"
    ? "UNKNOWN_BLOCKED"
    : reconstruction
      ? "MIP_RECONSTRUCTION_PARAMETER"
      : "USER_DEFINED";
  const entry = {
    provenanceClass: nextClass,
    class: nextClass,
    path: pathName,
    sourceRef: "MIP recipe version editor",
  };
  if (nextClass === "UNKNOWN_BLOCKED") {
    entry.sourceStatus = "Historical semantics remain unresolved; formal use is blocked.";
  } else if (nextClass === "MIP_RECONSTRUCTION_PARAMETER") {
    entry.reconstructionReason = "Material value changed without a newly validated primary-source record; retain reconstruction status.";
    entry.reconstructionVersion = "MIP_AUDIO_RECONSTRUCTION_V1";
  } else {
    entry.sourceStatus = "Owner-edited value without a newly validated source record.";
  }
  return entry;
}

export function applyMaterialProvenancePolicy({ parentRecipe = null, proposedRecipe, submittedRecipe = proposedRecipe, parentVersion = null } = {}) {
  const proposed = canonicalRecipe(proposedRecipe);
  const parent = parentRecipe ? canonicalRecipe(parentRecipe) : null;
  const changes = parent ? materialDiff(parent, proposed) : [];
  const submittedMap = provenanceMap(submittedRecipe);
  const parentMap = provenanceMap(parent);
  const nextMap = clone(provenanceMap(proposed));
  const pathIsChanged = (pathName) => changes.some((change) =>
    pathName === change.path || pathName.startsWith(`${change.path}.`) || change.path.startsWith(`${pathName}.`));
  // A caller may submit a complete recipe with a sparse provenance map. Keep
  // the parent's claims for every material path that did not change rather
  // than replacing them with normalizeRecipe's conservative UNKNOWN default.
  for (const [pathName, entry] of Object.entries(parentMap))
    if (!pathIsChanged(pathName)) nextMap[pathName] = clone(entry);
  const invalidated = [];
  const newlyValidated = [];
  const errors = [];
  for (const change of changes) {
    const parentEntry = lookupEntry(parentMap, change.path);
    const submittedEntry = lookupEntry(submittedMap, change.path);
    if (isNewExplicitEntry(submittedMap, change.path, parentEntry)) {
      const explicit = {
        ...(typeof submittedEntry === "string" ? { provenanceClass: submittedEntry } : clone(submittedEntry || {})),
        path: change.path,
      };
      const validation = validateEntry(explicit, change.path);
      if (validation.valid) {
        nextMap[change.path] = explicit;
        newlyValidated.push(change.path);
        continue;
      }
      errors.push(validation.reason);
      nextMap[change.path] = { ...fallbackEntry({ provenanceClass: "UNKNOWN_BLOCKED" }, change.path, parent), sourceStatus: validation.reason };
      invalidated.push(change.path);
      continue;
    }
    nextMap[change.path] = fallbackEntry(parentEntry, change.path, parent);
    invalidated.push(change.path);
  }
  proposed.parameterProvenance = nextMap;
  proposed.provenanceAudit = {
    policyVersion: "AUDIO_RECIPE_VERSION_POLICY_V1",
    parentVersion,
    changedMaterialPaths: changes.map((change) => change.path),
    invalidatedPaths: invalidated,
    newlyValidatedPaths: newlyValidated,
    errors,
  };
  return { recipe: proposed, changes, invalidated, newlyValidated, errors };
}

function expectedReference(recipe) {
  const binding = REFERENCE_BINDINGS[String(recipe?.recipeId || recipe?.id || "").replaceAll("-", "_")];
  if (!binding) return null;
  const source = BUILTIN_RECIPES[binding.recipeId] || EXPERIMENTAL_RECIPES[binding.recipeId];
  return source ? { ...binding, configFingerprint: source.configFingerprint } : null;
}

function statusMap(value, status) {
  const source = value || {};
  const result = { ...source, status };
  if (status !== "PASS") {
    for (const key of ["deterministicFixture", "channelAssignment", "carrierVerification", "noiseVerification", "sweepVerification", "amVerification", "fmVerification", "continuity", "clipping", "pcmDigestFixture"])
      if (result[key] === "PASS") result[key] = status;
  }
  return result;
}

export function bindEngineeringVerification(recipe, incoming = null, { materialChanged = false, valid = true } = {}) {
  const value = canonicalRecipe(recipe);
  const source = clone(incoming || value.engineeringVerification || {});
  const expected = expectedReference(value);
  const fixtureMatches = Boolean(expected && source.fixtureId === expected.fixtureId && value.configFingerprint === expected.configFingerprint);
  const versionsMatch = source.audioCoreVersion === AUDIO_CORE_VERSION && source.processorVersion === PROCESSOR_VERSION && source.verificationVersion === ENGINEERING_VERIFICATION_VERSION;
  const referencePass = valid && fixtureMatches && versionsMatch;
  let status;
  if (!valid) status = "NOT_RUN";
  else if (referencePass) status = "PASS";
  else if (!expected) status = VERIFICATION_NOT_RUN;
  else if (materialChanged && String(source.status || "").toUpperCase() === "PASS") status = VERIFICATION_STALE;
  else if (source.status && [VERIFICATION_STALE, "NOT_RUN"].includes(String(source.status).toUpperCase())) status = source.status;
  else status = VERIFICATION_NOT_RUN;
  const bound = statusMap(source, status);
  bound.configFingerprint = value.configFingerprint || null;
  bound.audioCoreVersion = AUDIO_CORE_VERSION;
  bound.processorVersion = PROCESSOR_VERSION;
  // The bound record describes the evaluator that produced this state. Never
  // carry an arbitrary caller-supplied verifier version into a current DTO.
  bound.verificationVersion = ENGINEERING_VERIFICATION_VERSION;
  // A custom owner recipe has no applicable golden fixture.  Do not expose a
  // fixture identifier inherited from a duplicated preset, since that would
  // look like a copied assertion even though no reference was executed.
  bound.fixtureId = expected ? (source.fixtureId || expected.fixtureId || null) : null;
  bound.referenceConfigFingerprint = expected?.configFingerprint || null;
  bound.referenceMatch = referencePass;
  bound.configurationValidation = valid ? "PASS" : "FAIL";
  if (status === VERIFICATION_NOT_RUN) {
    bound.deterministicFixture = "NOT_RUN";
    bound.pcmDigestFixture = "NOT_RUN";
  }
  return bound;
}

export function resolveEngineeringVerification(recipe, incoming = null, options = {}) {
  const value = canonicalRecipe(recipe);
  const validation = options.valid === undefined ? Boolean(value && value.recipeId) : options.valid === true;
  return bindEngineeringVerification(value, incoming || value.engineeringVerification, {
    valid: validation,
    materialChanged: options.materialChanged === true,
  });
}

export function canonicalEditorRecipe(recipe) {
  const value = clone(recipe || {});
  // Canonical material fields are the only editable fields.  Removing aliases
  // lets normalizeRecipe derive all convenience projections consistently.
  if (Array.isArray(value.carriers) && value.carriers[0]) {
    for (const key of ["leftHz", "rightHz", "leftFrequencyHz", "rightFrequencyHz", "frequencyHz", "hz", "centerHz", "beatHz", "gain"]) delete value[key];
  }
  if (value.execution && typeof value.execution === "object") {
    delete value.durationMode;
    delete value.targetFrames;
  }
  if (value.synthesisMode !== undefined) delete value.mode;
  return value;
}

export const MATERIAL_CONVENIENCE_KEYS = Object.freeze([...CONVENIENCE_KEYS]);
