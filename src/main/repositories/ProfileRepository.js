import { canonical, sha256, validateProfile, OPERATIONAL_PROFILE_IDS } from "../../engine.js";
import { clone, json, now, profileDto } from "../database/db.js";

const DTO_KEYS = new Set(["configHash", "status", "isDraft", "isActive", "identity", "repositoryProvenance"]);
const OWNER_EXPERIMENTAL_ID_PREFIX = "OWNER_EXPERIMENTAL";
const OWNER_EXPERIMENTAL_VISIBILITY = "EXPERIMENTAL";
const OWNER_SELECTABLE_FROZEN_FIELDS = Object.freeze([
  "schemaVersion",
  "mode",
  "experimentMode",
  "outcomeSpace",
  "mapping",
  "encoding",
  "output",
  "rng",
  "protocol",
  "analysis",
  "reveal",
  "reporting",
  "timing",
  "targetAssignment",
]);

function material(value) {
  return Object.fromEntries(Object.entries(clone(value || {})).filter(([key]) => !DTO_KEYS.has(key)));
}

function ownerFrozenProjection(value) {
  const source = clone(value || {});
  return Object.fromEntries(OWNER_SELECTABLE_FROZEN_FIELDS.map((key) => [key, source[key] ?? null]));
}

function ownerSelectable(value) {
  return value?.catalog?.selectableForOwner === true;
}

export class ProfileRepository {
  constructor(owner) {
    this.owner = owner;
    this.db = owner.db || owner;
  }

  _rows(where = "", params = []) {
    return this.db.prepare(`SELECT p.profile_id,p.name,p.provenance,v.version,v.config_json,v.config_hash,m.status,m.is_draft,m.is_active,m.validation_json,i.provenance_json AS identity_json FROM experiment_profiles p JOIN profile_versions v ON v.profile_id=p.profile_id LEFT JOIN profile_version_metadata m ON m.profile_id=v.profile_id AND m.version=v.version LEFT JOIN profile_identities i ON i.profile_id=p.profile_id ${where} ORDER BY p.name,v.version DESC`).all(...params);
  }

  list(options = {}) {
    const clauses = [];
    const params = [];
    if (options.id || options.profileId) {
      clauses.push("p.profile_id=?");
      params.push(options.id || options.profileId);
    }
    if (options.status) {
      clauses.push("COALESCE(m.status,'ACTIVE')=?");
      params.push(options.status);
    }
    if (options.activeOnly) clauses.push("COALESCE(m.is_active,0)=1");
    if (options.search) {
      clauses.push("(p.profile_id LIKE ? OR p.name LIKE ? OR COALESCE(p.provenance,'') LIKE ?)");
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }
    const rows = this._rows(clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params);
    if (options.allVersions) return rows.map((row) => profileDto(row, options.redacted !== true));
    const seen = new Set();
    return rows
      .filter((row) => {
        if (seen.has(row.profile_id)) return false;
        seen.add(row.profile_id);
        return true;
      })
      .map((row) => profileDto(row, options.redacted !== true));
  }

  listFull(options = {}) { return this.list({ ...options, redacted: false }); }
  listVersions(id, options = {}) { return this.list({ ...options, id, allVersions: true }); }
  listVersionSummaries(id) { return this.list({ id, allVersions: true, redacted: true }); }

  get(id, version) {
    const params = [id];
    const where = version === undefined || version === null
      ? "WHERE p.profile_id=? AND v.version=COALESCE((SELECT version FROM profile_version_metadata WHERE profile_id=p.profile_id AND is_active=1 ORDER BY version DESC LIMIT 1),(SELECT MAX(v2.version) FROM profile_versions v2 WHERE v2.profile_id=p.profile_id))"
      : "WHERE p.profile_id=? AND v.version=?";
    if (version !== undefined && version !== null) params.push(Number(version));
    const row = this._rows(where, params)[0];
    return row ? profileDto(row, true) : null;
  }

  getRedacted(id, version) {
    const value = this.get(id, version);
    if (!value) return null;
    const { configHash, id: profileId, version: profileVersion, name, provenance, status, isDraft, isActive } = value;
    return { id: profileId, version: profileVersion, name, provenance, status, isDraft, isActive, configHash };
  }

  getVersion(id, version) { return this.get(id, version); }
  validate(profile) { return validateProfile(profile); }

  _assertOperationalFrozen(id, operation = "edit") {
    if (OPERATIONAL_PROFILE_IDS.includes(String(id)))
      throw new Error(`Operational pilot profile ${id} is frozen; duplicate it to create an internal validation profile before ${operation}.`);
  }

  _assertOwnerSelectableFrozen(proposed, parent, { ownerCreation = false } = {}) {
    // An existing owner-created profile cannot opt out of the owner catalog
    // through the generic version editor.  Deactivation is an explicit
    // archive operation so it cannot be combined with a semantic edit that
    // bypasses the frozen-protocol guard.  Built-in duplicates are exempt:
    // duplicate() deliberately marks those internal validation copies as
    // non-selectable.
    const parentIsOwnerExperimental = parent && !OPERATIONAL_PROFILE_IDS.includes(String(parent.id)) && ownerSelectable(parent);
    if (parentIsOwnerExperimental && !ownerSelectable(proposed))
      throw new Error("Owner-created experimental profiles remain selectableForOwner; use Archive/Deactivate instead of changing catalog visibility.");
    if (!ownerSelectable(proposed)) return;
    if (ownerCreation) return;
    if (!parent || !ownerSelectable(parent))
      throw new Error("Owner-selectable experimental profiles must be created from one of the three frozen pilot templates.");
    if (canonical(ownerFrozenProjection(proposed)) !== canonical(ownerFrozenProjection(parent)))
      throw new Error("Owner-selectable experimental profiles inherit frozen binary participant-paced protocol semantics; edit only name, purpose, notes, catalog, provenance, and audio recipe.");
    if (proposed.catalog?.condition !== parent.catalog?.condition)
      throw new Error("Owner-selectable experimental profiles must retain the template condition.");
    proposed.catalog = {
      ...clone(parent.catalog),
      visibility: OWNER_EXPERIMENTAL_VISIBILITY,
      selectableForOwner: true,
    };
  }

  _nextExperimentalId() {
    let suffix = Date.now().toString(36).toUpperCase();
    let candidate = `${OWNER_EXPERIMENTAL_ID_PREFIX}_${suffix}`;
    let attempt = 0;
    while (this.db.prepare("SELECT 1 FROM experiment_profiles WHERE profile_id=?").get(candidate)) {
      attempt += 1;
      candidate = `${OWNER_EXPERIMENTAL_ID_PREFIX}_${suffix}_${attempt}`;
    }
    return candidate;
  }

  _buildExperimental(input = {}) {
    const baseId = String(input.baseProfileId || input.baseId || "");
    if (!OPERATIONAL_PROFILE_IDS.includes(baseId))
      throw new Error("Experimental profiles must use one of the three frozen pilot profiles as their base template.");
    const base = this.get(baseId, 1);
    if (!base || base.isDraft || base.isActive !== true || String(base.status).toUpperCase() !== "ACTIVE")
      throw new Error(`Frozen base profile is not active: ${baseId} v1.`);

    const name = String(input.name || "").trim();
    if (name.length < 1 || name.length > 200) throw new Error("Experimental profile name must contain 1-200 characters.");
    const purpose = input.purpose === undefined || input.purpose === null || String(input.purpose).trim() === ""
      ? base.purpose
      : String(input.purpose).trim();
    if (purpose.length > 500) throw new Error("Experimental profile purpose must be at most 500 characters.");
    const notes = input.notes === undefined || input.notes === null ? "" : String(input.notes).trim();
    if (notes.length > 2_000) throw new Error("Experimental profile notes must be at most 2000 characters.");

    const recipeId = String(input.recipeId || input.audio?.recipeId || "").trim();
    if (!recipeId || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(recipeId)) throw new Error("A valid audio recipe id is required.");
    const recipeVersion = Number(input.recipeVersion ?? input.audio?.version ?? input.audio?.recipeVersion);
    if (!Number.isSafeInteger(recipeVersion) || recipeVersion < 1) throw new Error("A valid positive audio recipe version is required.");
    const recipe = this.owner.recipes?.getVersion(recipeId, recipeVersion);
    if (!recipe) throw new Error(`Audio recipe version is not available in SQLite: ${recipeId} v${recipeVersion}.`);
    const recipeValidation = this.owner.recipes.validate(recipe);
    if (!recipeValidation.valid) throw new Error(`Audio recipe validation failed: ${recipeValidation.errors.join("; ")}`);
    if (recipe.isDraft || recipe.status !== "ACTIVE" || recipe.isActive !== true || recipe.incomplete)
      throw new Error(`Experimental profiles require an active, complete audio recipe: ${recipeId} v${recipeVersion}.`);
    if (recipe.formalOperationalEligibility !== true)
      throw new Error(`Audio recipe is not formally operationally eligible: ${recipeId} v${recipeVersion}. ${recipe.formalEligibilityReason || "Review its provenance and verification gates."}`);

    const requestedId = input.newId || input.profileId;
    const id = requestedId === undefined || requestedId === null || String(requestedId).trim() === ""
      ? this._nextExperimentalId()
      : String(requestedId).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/.test(id) || id.length > 128) throw new Error("Experimental profile id has an invalid format.");
    if (OPERATIONAL_PROFILE_IDS.includes(id)) throw new Error(`Cannot overwrite frozen operational profile ${id}.`);
    if (this.db.prepare("SELECT 1 FROM experiment_profiles WHERE profile_id=?").get(id)) throw new Error(`Profile already exists: ${id}`);

    const profile = clone(base);
    profile.id = id;
    profile.version = 1;
    profile.name = name;
    profile.purpose = purpose;
    if (notes) profile.notes = notes;
    else delete profile.notes;
    profile.provenance = "USER_EXPERIMENTAL";
    profile.audio = { ...clone(base.audio), recipeId, version: recipeVersion };
    profile.catalog = {
      visibility: OWNER_EXPERIMENTAL_VISIBILITY,
      selectableForOwner: true,
      condition: base.catalog?.condition || "REQUEST",
      displayOrder: 10,
    };
    delete profile.configHash;
    delete profile.status;
    delete profile.isDraft;
    delete profile.isActive;
    const validation = validateProfile(profile);
    return { profile, base, recipe, validation };
  }

  validateExperimental(input = {}) {
    const candidate = this._buildExperimental(input);
    return {
      profile: candidate.profile,
      baseProfileId: candidate.base.id,
      audio: {
        recipeId: candidate.recipe.recipeId,
        version: candidate.recipe.version,
        name: candidate.recipe.name || candidate.recipe.recipeId,
        provenance: candidate.recipe.provenance,
        historicalStatus: candidate.recipe.historicalStatus,
        formalOperationalEligibility: candidate.recipe.formalOperationalEligibility === true,
      },
      validation: candidate.validation,
      canSave: candidate.validation.valid === true,
    };
  }

  createExperimental(input = {}, options = {}) {
    const candidate = this._buildExperimental(input);
    if (!candidate.validation.valid)
      throw new Error(`Profile validation failed: ${candidate.validation.errors.join("; ")}`);
    const saved = this.saveNewVersion(candidate.profile, {
      version: 1,
      parentVersion: null,
      activate: options.activate === true,
      provenance: "USER_EXPERIMENTAL",
      ownerCreation: true,
    });
    return saved;
  }

  _ensureIdentity(id, provenance, identity = {}) {
    this.db.prepare("INSERT OR IGNORE INTO experiment_profiles(profile_id,name,provenance) VALUES(?,?,?)").run(id, identity.name || id, provenance || identity.provenance || "USER");
    this.db.prepare("INSERT OR IGNORE INTO profile_identities(profile_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc) VALUES(?,?,?,?,?,?,?)").run(id, identity.type || "USER", identity.label || identity.name || id, JSON.stringify(provenance || identity), identity.sourceKind || "USER", identity.sourceRef || null, now());
  }

  createDraft(profile, options = {}) {
    const draft = clone(profile);
    if (!draft.id) throw new Error("profile.id is required");
    this._assertOperationalFrozen(draft.id, "editing");
    const current = this.get(draft.id);
    this._assertOwnerSelectableFrozen(draft, current);
    const validation = validateProfile(draft);
    if (options.requireValid && !validation.valid) throw new Error(`Profile validation failed: ${validation.errors.join("; ")}`);
    this._ensureIdentity(draft.id, options.provenance || draft.provenance || "USER", options.identity || {});
    const baseVersion = options.baseVersion ?? current?.version ?? null;
    this.db.prepare("INSERT INTO profile_drafts(profile_id,base_version,draft_json,validation_json,updated_utc) VALUES(?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET base_version=excluded.base_version,draft_json=excluded.draft_json,validation_json=excluded.validation_json,updated_utc=excluded.updated_utc").run(draft.id, baseVersion, JSON.stringify(draft), JSON.stringify(validation), now());
    return { profile: draft, validation, baseVersion, isDraft: true };
  }

  getDraft(id) {
    const row = this.db.prepare("SELECT * FROM profile_drafts WHERE profile_id=?").get(id);
    return row ? { profile: json(row.draft_json, {}), baseVersion: row.base_version, validation: json(row.validation_json, null), updatedUtc: row.updated_utc, isDraft: true } : null;
  }

  editDraft(id, patch = {}) {
    const existing = this.getDraft(id);
    const current = existing?.profile || this.get(id);
    if (!current) throw new Error(`Profile not found: ${id}`);
    return this.createDraft({ ...clone(current), ...clone(patch), id }, { baseVersion: existing?.baseVersion ?? current.version, provenance: current.provenance });
  }

  validateDraft(id) {
    const draft = this.getDraft(id);
    return draft ? validateProfile(draft.profile) : { valid: false, errors: ["Profile draft not found"] };
  }

  saveNewVersion(profile, options = {}) {
    const value = material(profile);
    if (!value.id) throw new Error("profile.id is required");
    this._assertOperationalFrozen(value.id, "saving a new version");
    const parentVersion = options.parentVersion ?? (this.db.prepare("SELECT MAX(version) AS version FROM profile_versions WHERE profile_id=?").get(value.id)?.version ?? null);
    const parent = options.parentProfile || (parentVersion ? this.get(value.id, parentVersion) : null);
    this._assertOwnerSelectableFrozen(value, parent, { ownerCreation: options.ownerCreation === true });
    const validation = validateProfile(value);
    if (!validation.valid) throw new Error(`Profile validation failed: ${validation.errors.join("; ")}`);
    const latest = this.db.prepare("SELECT MAX(version) AS version FROM profile_versions WHERE profile_id=?").get(value.id)?.version;
    const version = Number(options.version ?? (latest || 0) + 1);
    if (!Number.isInteger(version) || version < 1) throw new Error("Profile version must be a positive integer");
    if (latest !== null && latest !== undefined && version <= Number(latest)) throw new Error(`Profile version must increase beyond v${latest}`);
    if (this.db.prepare("SELECT 1 FROM profile_versions WHERE profile_id=? AND version=?").get(value.id, version)) throw new Error(`Profile version already exists: ${value.id} v${version}`);
    this._ensureIdentity(value.id, options.provenance || value.provenance || "USER", options.identity || {});
    const stored = { ...value, version };
    const createdUtc = now();
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO profile_versions(profile_id,version,config_json,config_hash,created_utc,immutable) VALUES(?,?,?,?,?,1)").run(value.id, version, JSON.stringify(stored), sha256(canonical(stored)), createdUtc);
      this.db.prepare("INSERT INTO profile_version_metadata(profile_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?)").run(value.id, version, value.id, JSON.stringify(options.provenance || value.provenance || {}), options.activate ? "ACTIVE" : "DRAFT", options.activate ? 0 : 1, options.activate ? 1 : 0, parentVersion ?? latest ?? null, JSON.stringify(validation), createdUtc);
      if (options.activate) this.activate(value.id, version);
    });
    tx();
    this.db.prepare("DELETE FROM profile_drafts WHERE profile_id=?").run(value.id);
    return this.get(value.id, version);
  }

  saveVersion(profile, options = {}) { return this.saveNewVersion(profile, options); }

  duplicate(id, newId, options = {}) {
    const source = this.get(id, options.version);
    if (!source) throw new Error(`Profile not found: ${id}${options.version ? ` v${options.version}` : ""}`);
    const copyId = newId || `${id}_COPY_${Date.now()}`;
    const copy = { ...clone(source), id: copyId, version: 1, name: options.name || `${source.name} Copy`, status: "Draft" };
    // Operational pilot catalog membership is an explicit allow-list. A
    // duplicate is a new owner-defined profile and therefore must not inherit
    // the frozen three-profile owner selector, even when its source is one of
    // the built-ins.
    if (OPERATIONAL_PROFILE_IDS.includes(source.id) || source.catalog?.visibility === "OPERATIONAL")
      copy.catalog = { visibility: "INTERNAL_VALIDATION", selectableForOwner: false };
    delete copy.configHash;
    delete copy.isDraft;
    delete copy.isActive;
    return this.saveNewVersion(copy, { ...options, version: 1, activate: Boolean(options.activate), parentVersion: source.version, provenance: options.provenance || "USER_DUPLICATE" });
  }

  activate(id, version) {
    const value = Number(version);
    if (OPERATIONAL_PROFILE_IDS.includes(String(id)) && value !== 1)
      throw new Error(`Operational pilot profile ${id} is frozen at v1; duplicate it before activating another version.`);
    const row = this.db.prepare("SELECT v.config_json,m.validation_json FROM profile_versions v LEFT JOIN profile_version_metadata m ON m.profile_id=v.profile_id AND m.version=v.version WHERE v.profile_id=? AND v.version=?").get(id, value);
    if (!row) throw new Error(`Profile version not found: ${id} v${version}`);
    const validation = json(row.validation_json, null);
    const currentValidation = validateProfile(json(row.config_json, {}));
    if (!currentValidation.valid || validation?.valid === false) throw new Error(`Cannot activate invalid profile: ${id} v${version}`);
    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE profile_version_metadata SET is_active=0,status=CASE WHEN is_draft=1 THEN 'DRAFT' ELSE 'INACTIVE' END WHERE profile_id=?").run(id);
      this.db.prepare("UPDATE profile_version_metadata SET is_active=1,is_draft=0,status='ACTIVE' WHERE profile_id=? AND version=?").run(id, value);
    });
    tx();
    return this.get(id, value);
  }

  archive(id, version) {
    const profileId = String(id);
    if (OPERATIONAL_PROFILE_IDS.includes(profileId)) throw new Error(`Operational pilot profile ${profileId} is immutable and cannot be archived.`);
    const selectedVersion = version === undefined || version === null
      ? this.get(profileId)?.version
      : Number(version);
    if (!Number.isSafeInteger(Number(selectedVersion)) || Number(selectedVersion) < 1) throw new Error("Profile version must be a positive integer.");
    const profile = this.get(profileId, Number(selectedVersion));
    if (!profile) throw new Error(`Profile version not found: ${profileId} v${selectedVersion}`);
    if (!ownerSelectable(profile)) throw new Error("Only owner-created experimental profiles can be archived.");
    this.db.transaction(() => {
      this.db.prepare("UPDATE profile_version_metadata SET is_active=0,status=CASE WHEN is_draft=1 THEN 'DRAFT' ELSE 'ARCHIVED' END WHERE profile_id=?").run(profileId);
    })();
    return this.get(profileId, Number(selectedVersion));
  }

  materialDiff(id, leftVersion, rightVersion) {
    const left = this.get(id, leftVersion);
    const right = this.get(id, rightVersion);
    if (!left || !right) throw new Error("Both profile versions are required");
    const leftMaterial = material(left);
    const rightMaterial = material(right);
    const keys = new Set([...Object.keys(leftMaterial), ...Object.keys(rightMaterial)]);
    return [...keys].sort().filter((key) => JSON.stringify(leftMaterial[key]) !== JSON.stringify(rightMaterial[key])).map((key) => ({ field: key, before: leftMaterial[key], after: rightMaterial[key] }));
  }
}
