import { canonical, sha256 } from "../../engine.js";
import { clone, json, now, recipeDto } from "../database/db.js";
import { validateRecipe } from "../../audio.js";
import { validateRecipeProvenance } from "../../../public/audio-core.js";
import {
  applyMaterialProvenancePolicy,
  bindEngineeringVerification,
  materialDiff as authoritativeMaterialDiff,
} from "./AudioRecipeVersionPolicy.js";

const DTO_KEYS = new Set(["configHash", "status", "isDraft", "isActive", "incomplete", "repositoryProvenance", "formalOperationalEligibility"]);

function material(value) {
  return Object.fromEntries(Object.entries(clone(value || {})).filter(([key]) => !DTO_KEYS.has(key)));
}

function gainAliasPair(value) {
  if (value && typeof value === "object" && !Array.isArray(value))
    return { left: Number(value.left ?? value.l), right: Number(value.right ?? value.r) };
  const n = Number(value);
  return { left: n, right: n };
}

function sameGainPair(left, right) {
  return Number.isFinite(left?.left) && Number.isFinite(left?.right) &&
    Number.isFinite(right?.left) && Number.isFinite(right?.right) &&
    left.left === right.left && left.right === right.right;
}

/** Translate the legacy repository `{ gain }` patch to canonical carrier data. */
function canonicalizeLegacyGain(value, parent) {
  const draft = clone(value || {});
  const carrier = Array.isArray(draft.carriers) ? draft.carriers[0] : null;
  if (!carrier || draft.gain === undefined) return draft;
  const canonicalPair = gainAliasPair(
    carrier.gain ?? (carrier.gainLeft !== undefined || carrier.gainRight !== undefined
      ? { left: carrier.gainLeft, right: carrier.gainRight }
      : undefined),
  );
  if (!Number.isFinite(canonicalPair.left) || !Number.isFinite(canonicalPair.right)) return draft;
  const parentCarrier = Array.isArray(parent?.carriers) ? parent.carriers[0] : null;
  const parentPair = parentCarrier
    ? gainAliasPair(parentCarrier.gain ?? { left: parentCarrier.gainLeft, right: parentCarrier.gainRight })
    : null;
  const aliasPair = gainAliasPair(draft.gain);
  const aliasChanged = !parentPair || !sameGainPair(aliasPair, parentPair);
  const canonicalChanged = !parentPair || !sameGainPair(canonicalPair, parentPair);
  if (aliasChanged && !canonicalChanged && (carrier.gainLeft !== undefined || carrier.gainRight !== undefined)) {
    carrier.gainLeft = aliasPair.left;
    carrier.gainRight = aliasPair.right;
    delete carrier.gain;
    delete draft.gain;
  } else if (!aliasChanged || sameGainPair(aliasPair, canonicalPair)) {
    // The top-level field is only a projection; drop an agreeing alias before
    // strict normalization so it cannot become a second source of truth.
    delete draft.gain;
  }
  return draft;
}

export class AudioRecipeRepository {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  _rows(where = "", params = []) {
    return this.db.prepare(`SELECT r.recipe_id,r.provenance,v.version,v.config_json,v.config_hash,m.status,m.is_draft,m.is_active,m.incomplete,m.validation_json,m.provenance_json FROM audio_recipes r JOIN audio_recipe_versions v ON v.recipe_id=r.recipe_id LEFT JOIN audio_recipe_version_metadata m ON m.recipe_id=v.recipe_id AND m.version=v.version ${where} ORDER BY r.recipe_id,v.version DESC`).all(...params);
  }

  list(options = {}) {
    const clauses = [], params = [];
    if (options.id || options.recipeId) { clauses.push("r.recipe_id=?"); params.push(options.id || options.recipeId); }
    if (options.status) { clauses.push("COALESCE(m.status,'ACTIVE')=?"); params.push(options.status); }
    if (options.activeOnly) clauses.push("COALESCE(m.is_active,0)=1");
    if (options.search) { clauses.push("(r.recipe_id LIKE ? OR COALESCE(r.provenance,'') LIKE ? OR v.config_json LIKE ?)"); const term = `%${options.search}%`; params.push(term, term, term); }
    const rows = this._rows(clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params);
    if (options.allVersions) return rows.map((row) => recipeDto(row, options.redacted !== true));
    const seen = new Set();
    return rows.filter((row) => { if (seen.has(row.recipe_id)) return false; seen.add(row.recipe_id); return true; }).map((row) => recipeDto(row, options.redacted !== true));
  }

  listVersions(id, options = {}) { return this.list({ ...options, id, allVersions: true }); }

  get(id, version) {
    const params = [id];
    const where = version === undefined || version === null ? "WHERE r.recipe_id=? AND v.version=COALESCE((SELECT version FROM audio_recipe_version_metadata WHERE recipe_id=r.recipe_id AND is_active=1 ORDER BY version DESC LIMIT 1),(SELECT MAX(v2.version) FROM audio_recipe_versions v2 WHERE v2.recipe_id=r.recipe_id))" : "WHERE r.recipe_id=? AND v.version=?";
    if (version !== undefined && version !== null) params.push(Number(version));
    const row = this._rows(where, params)[0];
    return row ? recipeDto(row, true) : null;
  }

  getVersion(id, version) { return this.get(id, version); }
  validate(recipe) { return validateRecipe(recipe); }

  _ensureRecipe(id, provenance) { this.db.prepare("INSERT OR IGNORE INTO audio_recipes(recipe_id,provenance) VALUES(?,?)").run(id, provenance || "USER"); }

  createDraft(recipe, options = {}) {
    const draft = clone(recipe);
    draft.recipeId = draft.recipeId || draft.id;
    draft.id = draft.recipeId;
    if (!draft.recipeId) throw new Error("recipeId is required");
    const validation = validateRecipe(draft);
    if (options.requireValid && !validation.valid) throw new Error(`Recipe validation failed: ${validation.errors.join("; ")}`);
    const current = this.get(draft.recipeId);
    this._ensureRecipe(draft.recipeId, options.provenance || draft.provenance || "USER");
    this.db.prepare("INSERT INTO audio_recipe_drafts(recipe_id,base_version,draft_json,validation_json,updated_utc) VALUES(?,?,?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET base_version=excluded.base_version,draft_json=excluded.draft_json,validation_json=excluded.validation_json,updated_utc=excluded.updated_utc").run(draft.recipeId, options.baseVersion ?? current?.version ?? null, JSON.stringify(draft), JSON.stringify(validation), now());
    return { recipe: draft, validation, baseVersion: options.baseVersion ?? current?.version ?? null, isDraft: true };
  }

  editDraft(id, patch = {}) {
    const row = this.db.prepare("SELECT draft_json,base_version FROM audio_recipe_drafts WHERE recipe_id=?").get(id);
    const current = row ? json(row.draft_json, {}) : this.get(id);
    if (!current) throw new Error(`Recipe not found: ${id}`);
    const proposed = canonicalizeLegacyGain({ ...clone(current), ...patch, recipeId: id, id }, current);
    return this.createDraft(proposed, { baseVersion: row?.base_version ?? current.version, provenance: current.provenance });
  }

  validateDraft(id) {
    const row = this.db.prepare("SELECT draft_json FROM audio_recipe_drafts WHERE recipe_id=?").get(id);
    return row ? validateRecipe(json(row.draft_json, {})) : { valid: false, errors: ["Audio recipe draft not found"] };
  }

  saveNewVersion(recipe, options = {}) {
    const rawRecipe = clone(recipe || {});
    const submittedId = rawRecipe.recipeId || rawRecipe.id;
    const latestBefore = submittedId
      ? this.db.prepare("SELECT MAX(version) AS version FROM audio_recipe_versions WHERE recipe_id=?").get(submittedId)?.version
      : null;
    const parentVersion = options.parentVersion ?? latestBefore ?? null;
    const parentRecipe = options.parentRecipe || (submittedId && parentVersion
      ? this.get(submittedId, parentVersion)
      : null);
    const submitted = material(canonicalizeLegacyGain(rawRecipe, parentRecipe));
    const initialValidation = validateRecipe(submitted);
    let value = material(initialValidation.recipe || submitted);
    value.recipeId = value.recipeId || value.id;
    value.id = value.recipeId;
    if (!value.recipeId) throw new Error("recipeId is required");
    const policy = applyMaterialProvenancePolicy({
      parentRecipe,
      proposedRecipe: value,
      submittedRecipe: submitted,
      parentVersion,
    });
    const validation = validateRecipe(policy.recipe);
    const normalizedValue = material(validation.recipe || policy.recipe);
    const provenanceValidation = validateRecipeProvenance(validation.recipe || normalizedValue);
    validation.provenance = provenanceValidation;
    const verification = bindEngineeringVerification(
      normalizedValue,
      normalizedValue.engineeringVerification,
      {
        materialChanged: policy.changes.length > 0,
        valid: validation.valid && provenanceValidation.valid && policy.errors.length === 0,
      },
    );
    normalizedValue.engineeringVerification = verification;
    // Persist provenance completeness separately from repository/activation
    // gates.  A custom immutable recipe may be operationally eligible without
    // having a golden reference fixture; recipeDto applies the active-version
    // gate when it is reopened.
    normalizedValue.formalEligibility = provenanceValidation.valid && provenanceValidation.summary.provenanceEligible === true;
    normalizedValue.formalOperationalEligibility = verification.formalOperationalEligibility === true;
    normalizedValue.formalEligibilityReason = verification.referenceStatus === "NOT_APPLICABLE"
      ? "No golden reference fixture applies to this custom recipe; repository activation and operational checks are evaluated separately."
      : verification.referenceStatus === "STALE"
        ? "Engineering verification is stale after a material recipe change."
        : verification.referenceStatus === "PASS"
          ? "Applicable reference and operational checks passed; repository activation is evaluated separately."
          : "Current applicable reference verification has not been run for this effective recipe.";
    value = normalizedValue;
    const provenanceIncomplete = !provenanceValidation.valid || provenanceValidation.summary.provenanceEligible !== true;
    const incomplete = options.incomplete === true || options.allowIncomplete === true || !validation.valid || provenanceIncomplete || policy.errors.length > 0;
    if ((!validation.valid || !provenanceValidation.valid || policy.errors.length) && !options.allowIncomplete && !options.incomplete) throw new Error(`Recipe validation failed: ${[...(validation.errors || []), ...(provenanceValidation.errors || []), ...policy.errors].join("; ")}`);
    const latest = latestBefore;
    const version = Number(options.version ?? (latest || 0) + 1);
    if (this.db.prepare("SELECT 1 FROM audio_recipe_versions WHERE recipe_id=? AND version=?").get(value.recipeId, version)) throw new Error(`Audio recipe version already exists: ${value.recipeId} v${version}`);
    if (latest !== null && latest !== undefined && version <= Number(latest)) throw new Error(`Audio recipe version must increase beyond v${latest}`);
    if (incomplete && options.activate) throw new Error(`Cannot activate incomplete audio recipe: ${value.recipeId}`);
    if (options.activate && String(value.provenance || "").toUpperCase().includes("PRIMARY_SOURCE_VERIFIED") && provenanceValidation.summary.mixed)
      throw new Error(`Cannot activate a mixed-provenance recipe as PRIMARY_SOURCE_VERIFIED: ${value.recipeId}`);
    this._ensureRecipe(value.recipeId, options.provenance || value.provenance || "USER");
    const createdUtc = now();
    // The immutable row version and the recipe's canonical version alias are
    // one identity. Persist both together so reopening v2 cannot normalize
    // the config back to a stale recipeVersion carried by the editor draft.
    const stored = { ...value, version, recipeVersion: version };
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO audio_recipe_versions(recipe_id,version,config_json,config_hash,created_utc,immutable) VALUES(?,?,?,?,?,1)").run(value.recipeId, version, JSON.stringify(stored), sha256(canonical(stored)), createdUtc);
      this.db.prepare("INSERT INTO audio_recipe_version_metadata(recipe_id,version,identity_id,provenance_json,status,is_draft,is_active,incomplete,parent_version,validation_json,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(value.recipeId, version, value.recipeId, JSON.stringify({ recipeProvenance: options.provenance || value.provenance || {}, parameterProvenance: value.parameterProvenance || {}, historicalStatus: value.historicalStatus, historicalExactness: value.historicalExactness, engineeringVerification: value.engineeringVerification, provenanceAudit: value.provenanceAudit || null }), options.activate ? "ACTIVE" : "DRAFT", options.activate ? 0 : 1, options.activate ? 1 : 0, incomplete ? 1 : 0, parentVersion, JSON.stringify(validation), createdUtc);
      if (options.activate) this.activate(value.recipeId, version);
    });
    tx();
    this.db.prepare("DELETE FROM audio_recipe_drafts WHERE recipe_id=?").run(value.recipeId);
    return this.get(value.recipeId, version);
  }

  saveVersion(recipe, options = {}) { return this.saveNewVersion(recipe, options); }

  duplicate(id, newId, options = {}) {
    const source = this.get(id, options.version);
    if (!source) throw new Error(`Audio recipe not found: ${id}${options.version ? ` v${options.version}` : ""}`);
    const copyId = newId || `${id}_COPY_${Date.now()}`;
    const copy = { ...clone(source), id: copyId, recipeId: copyId, version: 1, provenance: options.provenance || "USER_DUPLICATE" };
    delete copy.configHash; delete copy.isDraft; delete copy.isActive; delete copy.status;
    return this.saveNewVersion(copy, { ...options, version: 1, parentVersion: source.version, parentRecipe: source });
  }

  activate(id, version) {
    const value = Number(version);
    const row = this.db.prepare("SELECT v.config_json,m.validation_json,m.incomplete FROM audio_recipe_versions v LEFT JOIN audio_recipe_version_metadata m ON m.recipe_id=v.recipe_id AND m.version=v.version WHERE v.recipe_id=? AND v.version=?").get(id, value);
    if (!row) throw new Error(`Audio recipe version not found: ${id} v${version}`);
    const config = json(row.config_json, {});
    const validation = validateRecipe(config);
    const effective = validation.recipe || config;
    const provenanceValidation = validateRecipeProvenance(effective);
    if (row.incomplete || !validation.valid || !provenanceValidation.valid || !provenanceValidation.summary.provenanceEligible || json(row.validation_json, {})?.valid === false)
      throw new Error(`Cannot activate incomplete audio recipe: ${id} v${version}`);
    if (String(config.provenance || "").toUpperCase().includes("PRIMARY_SOURCE_VERIFIED") && provenanceValidation.summary.mixed)
      throw new Error(`Cannot activate a mixed-provenance recipe as PRIMARY_SOURCE_VERIFIED: ${id} v${version}`);
    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE audio_recipe_version_metadata SET is_active=0,status=CASE WHEN is_draft=1 THEN 'DRAFT' ELSE 'INACTIVE' END WHERE recipe_id=?").run(id);
      this.db.prepare("UPDATE audio_recipe_version_metadata SET is_active=1,is_draft=0,status='ACTIVE' WHERE recipe_id=? AND version=?").run(id, value);
    });
    tx();
    return this.get(id, version);
  }

  materialDiff(id, leftVersion, rightVersion) {
    const left = this.get(id, leftVersion), right = this.get(id, rightVersion);
    if (!left || !right) throw new Error("Both audio recipe versions are required");
    return authoritativeMaterialDiff(left, right).map((change) => ({
      field: change.path,
      path: change.path,
      before: change.before,
      after: change.after,
    }));
  }
}
