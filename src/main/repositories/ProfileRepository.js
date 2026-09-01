import { canonical, sha256, validateProfile } from "../../engine.js";
import { clone, json, now, profileDto } from "../database/db.js";

const DTO_KEYS = new Set(["configHash", "status", "isDraft", "isActive", "identity", "repositoryProvenance"]);

function material(value) {
  return Object.fromEntries(Object.entries(clone(value || {})).filter(([key]) => !DTO_KEYS.has(key)));
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

  _ensureIdentity(id, provenance, identity = {}) {
    this.db.prepare("INSERT OR IGNORE INTO experiment_profiles(profile_id,name,provenance) VALUES(?,?,?)").run(id, identity.name || id, provenance || identity.provenance || "USER");
    this.db.prepare("INSERT OR IGNORE INTO profile_identities(profile_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc) VALUES(?,?,?,?,?,?,?)").run(id, identity.type || "USER", identity.label || identity.name || id, JSON.stringify(provenance || identity), identity.sourceKind || "USER", identity.sourceRef || null, now());
  }

  createDraft(profile, options = {}) {
    const draft = clone(profile);
    if (!draft.id) throw new Error("profile.id is required");
    const validation = validateProfile(draft);
    if (options.requireValid && !validation.valid) throw new Error(`Profile validation failed: ${validation.errors.join("; ")}`);
    const current = this.get(draft.id);
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
      this.db.prepare("INSERT INTO profile_version_metadata(profile_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?)").run(value.id, version, value.id, JSON.stringify(options.provenance || value.provenance || {}), options.activate ? "ACTIVE" : "DRAFT", options.activate ? 0 : 1, options.activate ? 1 : 0, options.parentVersion ?? latest ?? null, JSON.stringify(validation), createdUtc);
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
    delete copy.configHash;
    delete copy.isDraft;
    delete copy.isActive;
    return this.saveNewVersion(copy, { ...options, version: 1, activate: Boolean(options.activate), parentVersion: source.version, provenance: options.provenance || "USER_DUPLICATE" });
  }

  activate(id, version) {
    const value = Number(version);
    const row = this.db.prepare("SELECT v.config_json,m.validation_json FROM profile_versions v LEFT JOIN profile_version_metadata m ON m.profile_id=v.profile_id AND m.version=v.version WHERE v.profile_id=? AND v.version=?").get(id, value);
    if (!row) throw new Error(`Profile version not found: ${id} v${version}`);
    const validation = json(row.validation_json, null);
    if (validation && validation.valid === false) throw new Error(`Cannot activate invalid profile: ${id} v${version}`);
    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE profile_version_metadata SET is_active=0,status=CASE WHEN is_draft=1 THEN 'DRAFT' ELSE 'INACTIVE' END WHERE profile_id=?").run(id);
      this.db.prepare("UPDATE profile_version_metadata SET is_active=1,is_draft=0,status='ACTIVE' WHERE profile_id=? AND version=?").run(id, value);
    });
    tx();
    return this.get(id, value);
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
