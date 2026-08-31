import test from 'node:test';
import assert from 'node:assert/strict';
import { profiles, resolveProfile, validateProfile, DeterministicRNG, assignOutcome, analyzeStream, timingPlan, participantTarget, encodeExactToken, decodeExactToken } from '../src/engine.js';

test('shipped profiles validate and remain configuration-driven', () => { for (const p of Object.values(profiles)) assert.equal(validateProfile(p).valid, true, `${p.id} should validate`); assert.equal(resolveProfile('DRY_FOUR_OUTCOME_V1').outcomeSpace.values.length, 4); });
test('deterministic provider is repeatable and bounded through 30 bits', () => { const a = new DeterministicRNG('x'), b = new DeterministicRNG('x'); assert.deepEqual(Array.from({length:20}, () => a.bits(30)), Array.from({length:20}, () => b.bits(30))); });
test('mapping stays separate from objective state', () => { const p = resolveProfile('DRY_REVERSED_MAPPING_BINARY_V1'); assert.equal(participantTarget(p, 0), 'GOLD'); assert.equal(participantTarget(p, 1), 'BLUE'); });
test('stream analysis exposes primary and exploratory windows', () => { const r = analyzeStream({ requested: 1, values: [0,1,1,1,0,0], primary:[1,4], exploratory:[[0,1],[4,6]] }); assert.equal(r.primary.matches, 3); assert.equal(r.primary.proportion, 1); assert.equal(r.exploratory.length, 2); assert.equal(r.cumulative.at(-1), 0); });
test('relative and absolute timing plans are explicit', () => { const p = resolveProfile('DRY_RELATIVE_5MIN_BINARY_V1'); assert.equal(timingPlan(p, 1000).requestedDelayMs, 300000); const a = resolveProfile('DRY_ABSOLUTE_TIME_BINARY_V1'); a.timing.targetUtc = '2026-01-01T00:00:00Z'; assert.equal(timingPlan(a, 1000).scheduledUtc, '2026-01-01T00:00:00.000Z'); });
test('exact-token mapping is reversible at 30-bit boundaries', () => { for (const n of [0, 1, 2 ** 30 - 1]) assert.equal(decodeExactToken(encodeExactToken(n, 30)), n); });
