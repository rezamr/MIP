import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MipDatabase } from '../src/main/database/db.js';
import { resolveProfile } from '../src/engine.js';

test('Electron SQLite authority migrates, chains evidence, and protects immutable rows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mip-electron-test-'));
  const db = new MipDatabase(root);
  const session = db.beginSession(resolveProfile('BASELINE_NOW_BINARY_V1'));
  assert.equal(db.verify(session.id).valid, true);
  db.appendEvent(session.id, session.trial, 'TEST_EVENT', { ok: true });
  assert.equal(db.verify(session.id).valid, true);
  assert.throws(() => db.db.prepare('DELETE FROM evidence_events WHERE session_id=?').run(session.id), /immutable/);
  assert.equal(db.listSessions()[0].sessionId, session.id);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
