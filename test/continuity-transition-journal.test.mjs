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

function fullTransition({
  transition = "transition:full-0001",
  objectId = "object:vm-config",
  operation = "CREATE",
  expectedSha = null,
  expectedSequence = 0,
  startSequence = 0,
  previousDigest = null,
  payloadDigest = "b".repeat(64),
  envelopeDigest = "c".repeat(64),
  envelopeId = "envelope:vm-config"
} = {}) {
  const phases = ["PROPOSED", "AUTHORIZED", "ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"];
  const events = [];
  let previous = previousDigest;
  for (let index = 0; index < phases.length; index++) {
    const eventType = phases[index];
    const authorityRef = index >= 1 ? "authority:founder:001" : null;
    const admissionRef = index >= 2 ? "admission:transition:001" : null;
    const hasResult = index >= 3;
    const raw = {
      schema: "ourdata.transition-event.v1",
      event_id: `event:${transition}:${eventType}`,
      transition_id: transition,
      reality_id: "OURSELF_RUNTIME",
      instance_id: "WINDOWS_ARM64_ORIGINAL",
      object_id: objectId,
      event_type: eventType,
      operation,
      journal_sequence: startSequence + index,
      previous_event_sha256: previous,
      nonce: (transition.includes("0002") ? "d" : "a").repeat(64),
      target: { storage_adapter: "DATASELF", object_key: `sha256:${payloadDigest}`, envelope_id: envelopeId },
      preimage: { expected_sha256: expectedSha, expected_object_sequence: expectedSequence },
      result: {
        payload_sha256: hasResult ? payloadDigest : null,
        envelope_sha256: hasResult ? envelopeDigest : null,
        object_sequence: hasResult ? expectedSequence + 1 : null
      },
      authority: { authority_ref: authorityRef, admission_ref: admissionRef, capability: operation === "CREATE" ? "data.create" : "data.update" },
      actor_id: "founder-proposal",
      occurred_at: "2026-11-16T12:00:00Z",
      evidence: {
        observation_refs: eventType === "OBSERVED" ? ["observation:verified"] : [],
        receipt_refs: eventType === "RECONTACTED" ? ["receipt:recontacted"] : [],
        witness_refs: []
      },
      attestation_ref: null
    };
    const event = seal(raw);
    events.push(event);
    previous = event.event_sha256;
  }
  return events;
}

function resealChain(events, initialPrevious = null) {
  let previous = initialPrevious;
  return events.map((event) => {
    const { event_sha256: _old, ...body } = event;
    const sealed = seal({ ...body, previous_event_sha256: previous });
    previous = sealed.event_sha256;
    return sealed;
  });
}

test("rejects missing canonical transition properties and forbidden properties", () => {
  const incomplete = { ...proposed() };
  delete incomplete.actor_id;
  const missing = verifyTransitionJournal([seal(incomplete)]);
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((error) => error.includes("REQUIRED:actor_id")));
  const forbidden = seal({ ...proposed(), forged_authority: true });
  const additional = verifyTransitionJournal([forbidden]);
  assert.equal(additional.valid, false);
  assert.ok(additional.errors.some((error) => error.includes("ADDITIONAL_PROPERTY:forged_authority")));
});

test("rejects invalid transition patterns and enumerations", () => {
  const invalid = seal({ ...proposed(), transition_id: "bad id", operation: "MAGIC" });
  const result = verifyTransitionJournal([invalid]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("PATTERN")));
  assert.ok(result.errors.some((error) => error.includes("ENUM")));
});

test("a complete canonical lifecycle resolves in order", () => {
  const result = verifyTransitionJournal(fullTransition());
  assert.equal(result.valid, true, result.errors.join(","));
});

test("rejects a journal whose first event is not PROPOSED", () => {
  const event = seal({ ...proposed(), event_type: "AUTHORIZED" });
  const result = verifyTransitionJournal([event]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("TRANSITION_MUST_BEGIN_PROPOSED:transition:0001"));
});

test("rejects skipped or unauthorized lifecycle transitions", () => {
  const first = proposed();
  const observed = seal({
    ...proposed({ id: "event:00000002", sequence: 1, previous: first.event_sha256 }),
    event_type: "OBSERVED"
  });
  const result = verifyTransitionJournal([first, observed]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("TRANSITION_PHASE_GAP_OR_REORDER:transition:0001"));
  assert.ok(result.errors.includes("AUTHORITY_REFERENCE_REQUIRED:event:00000002"));
});

test("authority and admission bindings cannot mutate after authorization", () => {
  const valid = fullTransition();
  const authorityChanged = valid.map((event, index) => index === 4 ? { ...event, authority: { ...event.authority, authority_ref: "authority:other" } } : event);
  const authorityResult = verifyTransitionJournal(resealChain(authorityChanged));
  assert.ok(authorityResult.errors.includes("AUTHORITY_BINDING_CHANGED:event:transition:full-0001:OBSERVED"));
  const admissionChanged = valid.map((event, index) => index === 4 ? { ...event, authority: { ...event.authority, admission_ref: "admission:other" } } : event);
  const admissionResult = verifyTransitionJournal(resealChain(admissionChanged));
  assert.ok(admissionResult.errors.includes("ADMISSION_BINDING_CHANGED:event:transition:full-0001:OBSERVED"));
});

test("result bindings cannot mutate after actuation", () => {
  const valid = fullTransition();
  const changed = valid.map((event, index) => index === 4 ? { ...event, result: { ...event.result, payload_sha256: "e".repeat(64) } } : event);
  const result = verifyTransitionJournal(resealChain(changed));
  assert.ok(result.errors.includes("RESULT_BINDING_CHANGED:event:transition:full-0001:OBSERVED"));
});

test("same-object update requires the exact prior recontacted digest and sequence", () => {
  const first = fullTransition();
  const last = first.at(-1);
  const second = fullTransition({
    transition: "transition:full-0002",
    operation: "UPDATE",
    expectedSha: "b".repeat(64),
    expectedSequence: 1,
    startSequence: 6,
    previousDigest: last.event_sha256,
    payloadDigest: "e".repeat(64),
    envelopeDigest: "f".repeat(64),
    envelopeId: "envelope:vm-config-successor"
  });
  const valid = verifyTransitionJournal([...first, ...second]);
  assert.equal(valid.valid, true, valid.errors.join(","));
  const invalidSecond = second.map((event, index) => index === 0 ? {
    ...event,
    preimage: { expected_sha256: "9".repeat(64), expected_object_sequence: 0 }
  } : event);
  const invalid = verifyTransitionJournal([...first, ...resealChain(invalidSecond, last.event_sha256)]);
  assert.ok(invalid.errors.includes("OBJECT_PREIMAGE_DIGEST_MISMATCH:transition:full-0002"));
  assert.ok(invalid.errors.includes("OBJECT_PREIMAGE_SEQUENCE_MISMATCH:transition:full-0002"));
});

test("conflicting terminal events cannot coexist in one transition", () => {
  const first = proposed();
  const rejected = seal({ ...proposed({ id: "event:00000002", sequence: 1, previous: first.event_sha256 }), event_type: "REJECTED" });
  const quarantined = seal({ ...proposed({ id: "event:00000003", sequence: 2, previous: rejected.event_sha256 }), event_type: "QUARANTINED" });
  const result = verifyTransitionJournal([first, rejected, quarantined]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("CONFLICTING_TERMINAL_EVENTS:transition:0001"));
  assert.ok(result.errors.includes("TERMINAL_EVENT_NOT_FINAL:transition:0001"));
});
