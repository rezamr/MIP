import { canonical, sha256, APP_VERSION, ENGINE_VERSION } from "../../engine.js";
import { AUDIO_VERSION } from "../../audio.js";
import { json, now } from "../database/db.js";
import { normalizeOutcomeSpace, createCompatibilityFingerprint } from "../../domain/research-model.js";

const component = (valid, details = {}, errors = []) => ({ valid: Boolean(valid), ...details, errors });
const safeJson = (value, fallback = null) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

export class IntegrityService {
  constructor(owner) {
    this.owner = owner;
    this.db = owner.db || owner;
  }

  _session(sessionId) { return this.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(sessionId); }

  _events(sessionId) { return this.db.prepare("SELECT * FROM evidence_events WHERE session_id=? ORDER BY seq").all(sessionId); }

  _outputs(sessionId) { return this.db.prepare("SELECT * FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(sessionId); }

  _verifyProtocolStages(sessionId, errors) {
    const rows = this.db.prepare("SELECT * FROM protocol_stage_events WHERE session_id=? ORDER BY stage_seq").all(sessionId);
    const invalid = [];
    for (const row of rows) {
      const payload = safeJson(row.payload_json, undefined);
      const core = {
        sessionId: row.session_id,
        trialId: row.trial_id || null,
        stageSeq: row.stage_seq,
        stageType: row.stage_type,
        plannedUtc: row.planned_utc || null,
        plannedMonotonicNs: row.planned_monotonic_ns || null,
        actualUtc: row.actual_utc,
        actualMonotonicNs: row.actual_monotonic_ns,
        status: row.status,
        cueId: row.cue_id || null,
        payload,
      };
      if (payload === undefined || sha256(canonical(core)) !== row.stage_hash)
        invalid.push(`Protocol stage ${row.stage_seq} hash mismatch`);
    }
    if (invalid.length) errors.push(...invalid);
    return component(invalid.length === 0, { count: rows.length, stageTypes: rows.map((row) => row.stage_type) }, invalid);
  }

  _verifyEvents(sessionId, session, errors) {
    const rows = this._events(sessionId);
    const eventErrors = [];
    let previousHash = "GENESIS";
    let ordered = true;
    let linked = true;
    for (const [index, row] of rows.entries()) {
      if (row.seq !== index + 1) ordered = false;
      if (row.trial_id !== null) {
        const trial = this.db.prepare("SELECT session_id FROM trials WHERE trial_id=?").get(row.trial_id);
        if (!trial || trial.session_id !== sessionId) linked = false;
      }
      const payload = safeJson(row.payload_json, undefined);
      const base = {
        sessionId: row.session_id,
        trialId: row.trial_id || null,
        seq: row.seq,
        eventId: row.event_id,
        eventType: row.event_type,
        occurredUtc: row.occurred_utc,
        monotonicNs: row.monotonic_ns,
        payload,
        previousHash: row.previous_hash,
      };
      const legacyBase = { ...base };
      delete legacyBase.trialId;
      delete legacyBase.eventId;
      const hashValid = payload !== undefined && [sha256(canonical(base)), sha256(canonical(legacyBase))].includes(row.event_hash);
      if (row.previous_hash !== previousHash || !hashValid) eventErrors.push(`Event ${row.seq} hash mismatch`);
      previousHash = row.event_hash;
    }
    if (eventErrors.length) errors.push(...eventErrors);
    const trials = this.db.prepare("SELECT trial_id FROM trials WHERE session_id=?").all(sessionId);
    const trialIds = new Set(trials.map((row) => row.trial_id));
    const allTrialIdsValid = rows.every((row) => row.trial_id === null || trialIds.has(row.trial_id));
    return {
      trialEventLinkage: component(Boolean(session) && linked && allTrialIdsValid, { eventCount: rows.length, trialCount: trials.length, allTrialIdsValid }),
      eventOrderHashChain: component(ordered && eventErrors.length === 0, { ordered, chainValid: eventErrors.length === 0, lastHash: previousHash, eventCount: rows.length }, eventErrors),
      rows,
    };
  }

  _verifyOutputs(sessionId, errors) {
    const rows = this._outputs(sessionId);
    const sequenceValid = rows.every((row, index) => row.output_seq === index);
    const hashErrors = [];
    for (const row of rows) {
      const value = safeJson(row.value_json, undefined);
      const core = {
        sessionId,
        trialId: row.trial_id || null,
        outputSeq: row.output_seq,
        generatedUtc: row.generated_utc,
        monotonicNs: row.monotonic_ns,
        value,
        region: row.region || null,
        scheduledUtc: row.scheduled_utc || null,
        scheduledMonotonicNs: row.scheduled_monotonic_ns || null,
        actualUtc: row.actual_utc || row.generated_utc,
        actualMonotonicNs: row.actual_monotonic_ns || row.monotonic_ns,
        latenessMs: row.lateness_ms ?? null,
        timingStatus: row.timing_status || null,
      };
      const legacyHashes = [
        sha256(canonical({ id: sessionId, i: row.output_seq, value })),
        sha256(canonical({ sessionId, outputSeq: row.output_seq, value })),
      ];
      const accepted = value !== undefined && [sha256(canonical(core)), ...legacyHashes].includes(row.record_hash);
      if (!accepted) hashErrors.push(`Machine output ${row.output_seq} record hash mismatch`);
    }
    const finalization = this.db.prepare("SELECT * FROM output_finalizations WHERE session_id=?").get(sessionId);
    const format = safeJson(finalization?.format_json, null);
    const calculatedFingerprint = rows.length ? sha256(rows.map((row) => row.record_hash).join("")) : null;
    const calculatedOutputHash = sha256(canonical(rows.map((row) => ({ outputSeq: row.output_seq, recordHash: row.record_hash }))));
    const fingerprintValid = !finalization || finalization.final_fingerprint === calculatedFingerprint;
    const outputHashValid = !finalization || finalization.output_hash === calculatedOutputHash;
    const finalErrors = [];
    if (!sequenceValid) finalErrors.push("Machine output sequence is not contiguous from zero");
    finalErrors.push(...hashErrors);
    if (!fingerprintValid) finalErrors.push("Machine output final fingerprint mismatch");
    if (!outputHashValid) finalErrors.push("Machine output hash mismatch");
    if (finalization) {
      const finalizationValue = { sessionId, outputHash: finalization.output_hash, finalFingerprint: finalization.final_fingerprint, finalStreamDigest: finalization.final_stream_digest, frameCount: finalization.frame_count, format, finalizedUtc: finalization.finalized_utc };
      if (sha256(canonical(finalizationValue)) !== finalization.finalization_hash) finalErrors.push("Output finalization hash mismatch");
    }
    if (finalErrors.length) errors.push(...finalErrors);
    return component(finalErrors.length === 0, {
      sequenceValid,
      recordHashesValid: hashErrors.length === 0,
      finalizationPresent: Boolean(finalization),
      finalFingerprint: finalization?.final_fingerprint || calculatedFingerprint,
      calculatedFinalFingerprint: calculatedFingerprint,
      finalFingerprintValid: fingerprintValid,
      outputHash: finalization?.output_hash || calculatedOutputHash,
      outputHashValid,
      count: rows.length,
    }, finalErrors);
  }

  _verifyAnnotations(sessionId, errors) {
    const rows = this.db.prepare("SELECT * FROM late_annotations WHERE session_id=? ORDER BY id").all(sessionId);
    const invalid = [];
    for (const row of rows) {
      const payload = safeJson(row.payload_json, undefined);
      const expected = payload === undefined ? null : sha256(canonical({ sessionId, kind: row.kind, payload, createdUtc: row.created_utc }));
      if (expected !== row.annotation_hash) invalid.push(`Late annotation ${row.id} hash mismatch`);
    }
    if (invalid.length) errors.push(...invalid);
    return component(invalid.length === 0, { count: rows.length }, invalid);
  }

  _verifyTransitions(sessionId, errors) {
    const projections = this.db.prepare("SELECT * FROM transition_projections WHERE session_id=? ORDER BY seq").all(sessionId);
    const evidence = this.db.prepare("SELECT * FROM transition_evidence WHERE session_id=? ORDER BY created_utc,evidence_id").all(sessionId);
    const transitionErrors = [];
    for (const [index, row] of projections.entries()) {
      const value = { sessionId: row.session_id, trialId: row.trial_id, seq: row.seq, fromState: row.from_state, toState: row.to_state, projectedUtc: row.projected_utc, projectedMonotonicNs: row.projected_monotonic_ns, evidenceEventId: row.evidence_event_id };
      if (row.seq !== index + 1 || sha256(canonical(value)) !== row.projection_hash) transitionErrors.push(`Transition projection ${row.projection_id} hash/order mismatch`);
    }
    for (const row of evidence) {
      const value = { sessionId: row.session_id, trialId: row.trial_id, projectionId: row.projection_id, evidenceEventId: row.evidence_event_id, evidenceType: row.evidence_type, evidence: safeJson(row.evidence_json, undefined) };
      if (value.evidence === undefined || sha256(canonical(value)) !== row.evidence_hash) transitionErrors.push(`Transition evidence ${row.evidence_id} hash mismatch`);
    }
    if (transitionErrors.length) errors.push(...transitionErrors);
    return component(transitionErrors.length === 0, { projectionCount: projections.length, evidenceCount: evidence.length }, transitionErrors);
  }

  _verifyAudio(sessionId, errors) {
    const commit = this.db.prepare("SELECT * FROM audio_commits WHERE session_id=?").get(sessionId);
    const finalization = this.db.prepare("SELECT * FROM output_finalizations WHERE session_id=?").get(sessionId);
    if (!commit && !finalization) return component(true, { commitPresent: false, finalizationPresent: false, finalStreamDigestPresent: false, finalStreamFormatPresent: false });
    const config = safeJson(commit?.config_json, undefined);
    const configForHash = config && typeof config === "object" ? { ...config } : config;
    if (configForHash && typeof configForHash === "object") delete configForHash.configFingerprint;
    const configHashValid = !commit || (config !== undefined && sha256(canonical(configForHash)) === commit.config_hash);
    const committedFingerprint = config?.configFingerprint;
    const configFingerprintPresent = !commit || (typeof committedFingerprint === "string" && /^[a-f0-9]{64}$/i.test(committedFingerprint));
    const configFingerprintValid = !commit || (configFingerprintPresent && sha256(canonical(configForHash)) === committedFingerprint);
    const format = safeJson(finalization?.format_json, null);
    const digestPresent = !finalization ? false : typeof finalization.final_stream_digest === "string" && /^[a-f0-9]{64}$/i.test(finalization.final_stream_digest);
    const formatPresent = !finalization ? false : Boolean(format && typeof format === "object" && Object.keys(format).length > 0);
    const audioErrors = [];
    if (!configHashValid) audioErrors.push("Committed audio configuration hash mismatch");
    if (!configFingerprintPresent) audioErrors.push("Committed audio configuration fingerprint is missing or malformed");
    else if (!configFingerprintValid) audioErrors.push("Committed audio configuration fingerprint mismatch");
    if (finalization && !digestPresent) audioErrors.push("Final stream digest is missing or malformed");
    if (finalization && !formatPresent) audioErrors.push("Final stream format is missing");
    if (audioErrors.length) errors.push(...audioErrors);
    return component(audioErrors.length === 0, { commitPresent: Boolean(commit), configHash: commit?.config_hash || null, configHashValid, configFingerprint: committedFingerprint || null, configFingerprintPresent, configFingerprintValid, recipeId: commit?.recipe_id || null, recipeVersion: commit?.recipe_version ?? null, finalizationPresent: Boolean(finalization), finalStreamDigest: finalization?.final_stream_digest || null, finalStreamDigestPresent: digestPresent, finalStreamFormat: format, finalStreamFormatPresent: formatPresent }, audioErrors);
  }

  _verifyResearch(sessionId, errors) {
    const definition = this.db.prepare("SELECT * FROM research_definitions WHERE session_id=?").get(sessionId);
    const definitionErrors = [];
    if (definition) {
      const value = json(definition.definition_json, undefined);
      if (value === undefined || sha256(canonical(value)) !== definition.config_hash)
        definitionErrors.push("Research definition hash mismatch");
      try {
        const expectedFingerprint = createCompatibilityFingerprint(value || {});
        if (definition.compatibility_fingerprint !== expectedFingerprint)
          definitionErrors.push("Research compatibility fingerprint mismatch");
        const space = normalizeOutcomeSpace(json(definition.outcome_space_json, null));
        const cardinality = space.type === "INTEGER_RANGE"
          ? Number(BigInt(space.maxInclusive) - BigInt(space.minInclusive) + 1n)
          : space.values.length;
        if (cardinality !== Number(definition.cardinality)) definitionErrors.push("Research outcome cardinality mismatch");
      } catch (error) {
        definitionErrors.push(`Research definition is invalid: ${error.message}`);
      }
    }
    const occurrenceErrors = [];
    const occurrences = this.db.prepare("SELECT * FROM target_occurrences WHERE session_id=? ORDER BY output_seq,occurrence_id").all(sessionId);
    for (const row of occurrences) {
      const value = json(row.value_json, undefined);
      const core = {
        sessionId: row.session_id,
        trialId: row.trial_id || null,
        outputSeq: row.output_seq,
        value,
        region: row.region || null,
        scheduledUtc: row.scheduled_utc || null,
        scheduledMonotonicNs: row.scheduled_monotonic_ns === null ? null : String(row.scheduled_monotonic_ns),
        actualUtc: row.actual_utc || null,
        actualMonotonicNs: row.actual_monotonic_ns === null ? null : String(row.actual_monotonic_ns),
        scheduledLatencyMs: row.scheduled_latency_ms ?? null,
        signedLatencyMs: row.signed_latency_ms ?? null,
        timingClassification: row.timing_classification || null,
      };
      if (value === undefined || sha256(canonical(core)) !== row.record_hash)
        occurrenceErrors.push(`Target occurrence ${row.occurrence_id} hash mismatch`);
    }
    const futureErrors = [];
    const future = this.db.prepare("SELECT * FROM future_target_events WHERE session_id=?").get(sessionId);
    if (future) {
      const payload = {
        sessionId: future.session_id,
        prediction: json(future.prediction_json, null),
        target: json(future.target_json, null),
        scheduledUtc: future.scheduled_utc || null,
        scheduledMonotonicNs: future.scheduled_monotonic_ns === null ? null : String(future.scheduled_monotonic_ns),
        actualUtc: future.actual_utc || null,
        actualMonotonicNs: future.actual_monotonic_ns === null ? null : String(future.actual_monotonic_ns),
        rng: json(future.rng_metadata_json, null),
        status: future.status,
        generated: future.target_json !== null,
      };
      if (sha256(canonical(payload)) !== future.event_hash) futureErrors.push("Future target event hash mismatch");
    }
    const aggregateErrors = [];
    const aggregates = this.db.prepare("SELECT * FROM cross_session_analyses WHERE aggregate_id IN (SELECT aggregate_id FROM cross_session_analyses)").all();
    for (const row of aggregates) {
      const value = json(row.analysis_json, undefined);
      if (value === undefined || sha256(canonical(value)) !== row.analysis_hash)
        aggregateErrors.push(`Cross-session analysis ${row.aggregate_id} hash mismatch`);
    }
    const allErrors = [...definitionErrors, ...occurrenceErrors, ...futureErrors, ...aggregateErrors];
    if (allErrors.length) errors.push(...allErrors);
    return component(allErrors.length === 0, {
      definitionPresent: Boolean(definition),
      targetOccurrenceCount: occurrences.length,
      futureTargetPresent: Boolean(future),
      aggregateCount: aggregates.length,
    }, allErrors);
  }

  verifySession(sessionId, options = {}) {
    const errors = [];
    const session = this._session(sessionId);
    if (!session) return { valid: false, errors: [`Session not found: ${sessionId}`], sessionId, components: { session: component(false, {}, [`Session not found: ${sessionId}`]) } };
    const commitment = this.db.prepare("SELECT * FROM session_commitments WHERE session_id=?").get(sessionId);
    const commitmentConfig = safeJson(commitment?.canonical_config, undefined);
    const commitmentValid = Boolean(commitment) && commitmentConfig !== undefined && sha256(canonical(commitmentConfig)) === commitment.config_hash;
    const commitmentErrors = commitmentValid ? [] : ["Session commitment is missing or its canonical hash does not match"];
    if (commitmentErrors.length) errors.push(...commitmentErrors);

    const details = this.db.prepare("SELECT * FROM session_details WHERE session_id=?").get(sessionId);
    const snapshot = safeJson(details?.session_snapshot_json, undefined);
    const snapshotValid = Boolean(details) && snapshot !== undefined && sha256(canonical(snapshot)) === details.session_snapshot_hash;
    const snapshotErrors = snapshotValid ? [] : ["Session snapshot is missing or its hash does not match"];
    if (snapshotErrors.length) errors.push(...snapshotErrors);

    const eventResult = this._verifyEvents(sessionId, session, errors);
    const output = this._verifyOutputs(sessionId, errors);
    const locked = this.db.prepare("SELECT * FROM raw_reports_locked WHERE session_id=?").get(sessionId);
    const rawPayload = safeJson(locked?.payload_json, undefined);
    const rawValid = !locked || (rawPayload !== undefined && sha256(locked.payload_json) === locked.lock_hash);
    const rawErrors = rawValid ? [] : ["Locked raw report hash mismatch"];
    if (rawErrors.length) errors.push(...rawErrors);
    const annotations = this._verifyAnnotations(sessionId, errors);
    const transitions = this._verifyTransitions(sessionId, errors);
    const protocolStages = this._verifyProtocolStages(sessionId, errors);
    const analysis = this.db.prepare("SELECT * FROM analyses WHERE session_id=?").get(sessionId);
    const analysisPayload = safeJson(analysis?.payload_json, undefined);
    const analysisInput = safeJson(analysis?.input_json, undefined);
    const analysisInputHashValid = !analysis || (
      typeof analysis.input_hash === "string" &&
      /^[a-f0-9]{64}$/i.test(analysis.input_hash) &&
      analysisInput !== undefined &&
      sha256(canonical(analysisInput)) === analysis.input_hash
    );
    const analysisResultHashValid = !analysis || (
      typeof analysis.analysis_hash === "string" &&
      /^[a-f0-9]{64}$/i.test(analysis.analysis_hash) &&
      analysisPayload !== undefined &&
      sha256(canonical(analysisPayload)) === analysis.analysis_hash
    );
    const analysisVersions = this.db.prepare("SELECT * FROM analysis_versions WHERE session_id=? ORDER BY version").all(sessionId);
    const analysisVersionErrors = [];
    for (const row of analysisVersions) {
      const versionInput = safeJson(row.input_json, undefined);
      const versionPayload = safeJson(row.payload_json, undefined);
      if (versionInput === undefined || typeof row.input_hash !== "string" || !/^[a-f0-9]{64}$/i.test(row.input_hash) || sha256(canonical(versionInput)) !== row.input_hash)
        analysisVersionErrors.push(`Analysis version ${row.version} input hash mismatch`);
      if (versionPayload === undefined || typeof row.analysis_hash !== "string" || !/^[a-f0-9]{64}$/i.test(row.analysis_hash) || sha256(canonical(versionPayload)) !== row.analysis_hash)
        analysisVersionErrors.push(`Analysis version ${row.version} result hash mismatch`);
    }
    const analysisValid = analysisInputHashValid && analysisResultHashValid && analysisVersionErrors.length === 0;
    const analysisErrors = analysisValid ? [] : [
      ...(analysisInputHashValid ? [] : ["Analysis input hash is missing or does not match the stored input"]),
      ...(analysisResultHashValid ? [] : ["Analysis result hash is missing or does not match the stored result"]),
      ...analysisVersionErrors,
    ];
    if (analysisErrors.length) errors.push(...analysisErrors);
    const audio = this._verifyAudio(sessionId, errors);
    const research = this._verifyResearch(sessionId, errors);
    const versionErrors = [];
    const versionValues = [details?.app_version, details?.engine_version, details?.audio_version];
    if (versionValues.some((value) => value !== null && value !== undefined && typeof value !== "string")) versionErrors.push("Application, engine, and audio versions must be strings");
    const versions = component(versionErrors.length === 0 && versionValues.every((value) => value !== null && value !== undefined && value !== ""), { appVersion: details?.app_version || null, engineVersion: details?.engine_version || null, audioVersion: details?.audio_version || null, expectedAppVersion: APP_VERSION, expectedEngineVersion: ENGINE_VERSION, expectedAudioVersion: AUDIO_VERSION }, versionErrors);
    if (versionErrors.length) errors.push(...versionErrors);
    const fkRows = this.db.prepare("PRAGMA foreign_key_check").all();
    const explicitRefs = [
      ...this.db.prepare("SELECT session_id FROM trials WHERE session_id=?").all(sessionId),
      ...this.db.prepare("SELECT session_id FROM evidence_events WHERE session_id=?").all(sessionId),
      ...this.db.prepare("SELECT session_id FROM machine_outputs WHERE session_id=?").all(sessionId),
    ];
    const fkErrors = fkRows.length ? [`SQLite foreign_key_check returned ${fkRows.length} violation(s)`] : [];
    if (!explicitRefs.every((row) => row.session_id === sessionId)) fkErrors.push("Session references are inconsistent");
    const foreignKeys = component(fkErrors.length === 0, { sqliteViolations: fkRows, checkedReferences: explicitRefs.length }, fkErrors);
    if (fkErrors.length) errors.push(...fkErrors);

    const components = {
      commitment: component(commitmentValid, { present: Boolean(commitment), canonicalHash: commitment?.config_hash || null, calculatedHash: commitmentConfig === undefined ? null : sha256(canonical(commitmentConfig)) }, commitmentErrors),
      sessionSnapshot: component(snapshotValid, { present: Boolean(details), snapshotHash: details?.session_snapshot_hash || null, calculatedHash: snapshot === undefined ? null : sha256(canonical(snapshot)) }, snapshotErrors),
      trialEventLinkage: eventResult.trialEventLinkage,
      eventOrderHashChain: eventResult.eventOrderHashChain,
      machineOutput: output,
      rawReport: component(rawValid, { present: Boolean(locked), lockHash: locked?.lock_hash || null }, rawErrors),
      lateAnnotations: annotations,
      transitionProjectionsEvidence: transitions,
      protocolStages,
      analysisInput: component(analysisValid, {
        present: Boolean(analysis),
        inputHash: analysis?.input_hash || null,
        inputHashValid: analysisInputHashValid,
        analysisHash: analysis?.analysis_hash || null,
        analysisResultHashValid,
        versionCount: analysisVersions.length,
      }, analysisErrors),
      committedAudio: audio,
      research,
      versions,
      foreignKeyReferentialIntegrity: foreignKeys,
    };
    components.commitmentCanonicalHash = components.commitment;
    components.sessionSnapshotHash = components.sessionSnapshot;
    components.eventOrder = component(eventResult.eventOrderHashChain.ordered, { eventCount: eventResult.rows.length }, eventResult.eventOrderHashChain.ordered ? [] : ["Event sequence is not contiguous"]);
    components.eventHashChain = components.eventOrderHashChain;
    components.machineOutputSequence = component(output.sequenceValid, { count: output.count }, output.sequenceValid ? [] : ["Machine output sequence is not contiguous from zero"]);
    components.machineOutputRecordHashes = component(output.recordHashesValid, { count: output.count }, output.recordHashesValid ? [] : ["Machine output record hash mismatch"]);
    components.machineOutputFinalFingerprint = component(output.finalFingerprintValid, { finalFingerprint: output.finalFingerprint, calculatedFinalFingerprint: output.calculatedFinalFingerprint }, output.finalFingerprintValid ? [] : ["Machine output final fingerprint mismatch"]);
    components.rawReportLock = components.rawReport;
    const finalizationExpected = audio.finalizationPresent;
    components.finalStreamDigest = component(!finalizationExpected || audio.finalStreamDigestPresent, { value: audio.finalStreamDigest, required: finalizationExpected }, !finalizationExpected || audio.finalStreamDigestPresent ? [] : ["Final stream digest is not present"]);
    components.finalStreamFormat = component(!finalizationExpected || audio.finalStreamFormatPresent, { value: audio.finalStreamFormat, required: finalizationExpected }, !finalizationExpected || audio.finalStreamFormatPresent ? [] : ["Final stream format is not present"]);
    components.appEngineAudioVersions = components.versions;
    const valid = Object.values(components).every((value) => value.valid);
    const result = {
      valid,
      sessionId,
      schemaVersion: Number(this.db.prepare("SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations").get().version),
      errors: [...new Set(errors)],
      eventCount: eventResult.rows.length,
      machineOutputCount: output.count,
      configFingerprint: commitment?.config_hash || null,
      machineOutputFingerprint: output.finalFingerprint,
      streamDigest: audio.finalStreamDigest || null,
      components,
    };
    if (options.persist !== false) this.db.prepare("INSERT INTO integrity_metadata(session_id,verified_utc,valid,details_json) VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET verified_utc=excluded.verified_utc,valid=excluded.valid,details_json=excluded.details_json").run(sessionId, now(), valid ? 1 : 0, JSON.stringify(result));
    return result;
  }

  summary(sessionId) {
    const session = this._session(sessionId);
    if (!session) return { valid: false, sessionId, redacted: true, errors: [`Session not found: ${sessionId}`] };
    const result = this.verifySession(sessionId, { persist: false });
    return {
      valid: result.valid,
      sessionId,
      redacted: true,
      schemaVersion: result.schemaVersion,
      eventCount: result.eventCount,
      machineOutputCount: result.machineOutputCount,
      components: Object.fromEntries(Object.entries(result.components).map(([key, value]) => [key, {
        valid: value.valid,
        errors: value.errors,
        present: value.present,
        count: value.count,
        stageTypes: key === "protocolStages" ? value.stageTypes : undefined,
      }])) ,
      errors: result.errors,
    };
  }

  verifyDatabase(options = {}) {
    const sessions = this.db.prepare("SELECT session_id FROM sessions ORDER BY session_id").all();
    const results = sessions.map(({ session_id: id }) => this.verifySession(id, { persist: options.persist }));
    const legacyIds = new Set(this.db.prepare("SELECT session_id FROM sessions WHERE status='LEGACY_IMPORTED'").all().map((row) => row.session_id));
    const foreignKeys = this.db.prepare("PRAGMA foreign_key_check").all();
    const currentResults = options.allowLegacy ? results.filter((result) => !legacyIds.has(result.sessionId)) : results;
    return { valid: foreignKeys.length === 0 && currentResults.every((result) => result.valid), schemaVersion: Number(this.db.prepare("SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations").get().version), sessionCount: results.length, legacySessionCount: legacyIds.size, foreignKeyViolations: foreignKeys, sessions: results };
  }
}
