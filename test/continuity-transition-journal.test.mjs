import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyTransitionJournal } from "../src/continuity/transition-journal.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}
function seal(event) {
  const { event_sha256, ...preimage } = event;
  return { ...event, event_sha256: createHash("sha256").update(JSON.stringify(canonical(preimage))).digest("hex") };
}
function proposed({ id = "event:00000001", transition = "transition:0001", nonce = "a".repeat(64), sequence = 0, previous = null } = {}) {
  return seal({
    schema: "ourdata.transition-event.v1",
    event_id: id,
    transition_id: transition,
    reality_id: "OURSELF_RUNTIME",
    instance_id: "WINDOWS_ARM64_ORIGINAL",
    object_id: "object:vm-config",
    event_type: "PROPOSED",
    operation: "CREATE",
    journal_sequence: sequence,
    previous_event_sha256: previous,
    nonce,
    target: { storage_adapter: "DATASELF", object_key: "sha256:" + "b".repeat(64), envelope_id: "envelope:vm-config" },
    preimage: { expected_sha256: null, expected_object_sequence: 0 },
    result: { payload_sha256: null, envelope_sha256: null, object_sequence: null },
    authority: { authority_ref: null, admission_ref: null, capability: "data.create" },
    actor_id: "founder-proposal",
    occurred_at: "2026-11-16T12:00:00Z",
    evidence: { observation_refs: [], receipt_refs: [], witness_refs: [] },
    attestation_ref: null,
  });
}

test("accepts a correctly hashed journal beginning at sequence zero", () => {
  const result = verifyTransitionJournal([proposed()]);
  assert.equal(result.valid, true);
});

test("rejects a journal that does not begin at sequence zero", () => {
  const event = proposed({ sequence: 1 });
  const result = verifyTransitionJournal([event]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("JOURNAL_SEQUENCE_GAP:event:00000001"));
});

test("rejects nonce reuse across transition identities", () => {
  const first = proposed();
  const second = proposed({ id: "event:00000002", transition: "transition:0002", sequence: 1, previous: first.event_sha256 });
  const result = verifyTransitionJournal([first, second]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("NONCE_REPLAY:event:00000002"));
});

test("rejects altered event bytes when digest is not recomputed", () => {
  const event = { ...proposed(), actor_id: "tampered-actor" };
  const result = verifyTransitionJournal([event]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("EVENT_DIGEST_MISMATCH:event:00000001"));
});
