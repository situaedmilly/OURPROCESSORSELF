import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolveContinuityEvidence } from "../src/continuity/resolver.mjs";

const bytes = Buffer.from("immutable-original-vm-artifact");
const digest = createHash("sha256").update(bytes).digest("hex");
const envelope = {
  schema: "ourdata.envelope.v1",
  envelope_id: "envelope:guest-disk-001",
  object_id: "object:guest-disk-001",
  reality_id: "OURSELF_RUNTIME",
  instance_id: "WINDOWS_ARM64_ORIGINAL",
  object_class: "EVIDENCE_ARTIFACT",
  payload: { media_type: "application/octet-stream", encoding: "identity", byte_count: bytes.length, sha256: digest, content_key: `sha256:${digest}` },
  provenance: { origin_kind: "RUNTIME_OBSERVED", source_ref: "fixture:guest-disk", created_at: "2026-11-16T12:00:00Z", observed_at: "2026-11-16T12:00:00Z" },
  jurisdiction: { governing_reality: "OURSELF_RUNTIME", data_classification: "INTERNAL", allowed_processors: ["OURPROCESSORSELF"] },
  custody: { storage_adapter: "DATASELF", custodian_refs: ["custodian:founder"], replica_refs: [], independent_custody: false, independence_evidence_refs: [] },
  lineage: { sequence: 0, predecessor_envelope_id: null, predecessor_sha256: null, journal_ref: "journal:guest-disk" },
  authority: { authority_ref: null, admission_ref: null, capability: "data.read", decision_state: "NOT_REQUESTED" },
  verification: { integrity: "MATCH", observed: true, persisted: true, recontact: "NOT_TESTED", witness: "NONE", receipt_refs: [], observation_refs: ["observation:guest-disk"], witness_refs: [] },
  lifecycle: "INTEGRITY_VERIFIED"
};
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function seal(event) {
  const { event_sha256: _omitted, ...preimage } = event;
  return { ...event, event_sha256: createHash("sha256").update(JSON.stringify(canonical(preimage))).digest("hex") };
}
const event = seal({
  schema: "ourdata.transition-event.v1",
  event_id: "event:guest-disk-001:create",
  transition_id: "transition:guest-disk-001",
  reality_id: envelope.reality_id,
  instance_id: envelope.instance_id,
  object_id: envelope.object_id,
  event_type: "PROPOSED",
  operation: "CREATE",
  journal_sequence: 0,
  previous_event_sha256: null,
  nonce: "a".repeat(64),
  target: { storage_adapter: "DATASELF", object_key: `sha256:${digest}`, envelope_id: envelope.envelope_id },
  preimage: { expected_sha256: null, expected_object_sequence: 0 },
  result: { payload_sha256: null, envelope_sha256: null, object_sequence: null },
  authority: { authority_ref: null, admission_ref: null, capability: "data.create" },
  actor_id: "founder-proposal",
  occurred_at: "2026-11-16T12:00:00Z",
  evidence: { observation_refs: [], receipt_refs: [], witness_refs: [] },
  attestation_ref: null,
  event_sha256: "0".repeat(64)
});
const profile = {
  components: [{
    component_id: "guest-disk-001",
    envelope_binding: {
      envelope_id: envelope.envelope_id,
      object_id: envelope.object_id,
      reality_id: envelope.reality_id,
      instance_id: envelope.instance_id,
      payload_sha256: digest,
      byte_count: bytes.length,
      content_key: `sha256:${digest}`,
      lifecycle: "INTEGRITY_VERIFIED",
      transition_event_refs: [event.event_id]
    }
  }]
};
const adapter = {
  resolveEnvelope: async (id) => id === envelope.envelope_id ? envelope : null,
  readPayload: async () => bytes,
  resolveTransitionEvent: async (id) => id === event.event_id ? event : null
};

test("resolves a complete canonical DATASELF envelope, exact bytes and transition event", async () => {
  const result = await resolveContinuityEvidence(profile, adapter);
  assert.equal(result.resolved, true);
  assert.deepEqual(result.components, ["guest-disk-001"]);
  assert.ok(result.limitations.includes("TRANSITION_JOURNAL_COMPLETENESS_AND_HASH_CHAIN_NOT_VERIFIED"));
});

test("incomplete canonical envelope cannot resolve", async () => {
  const incomplete = { ...envelope };
  delete incomplete.jurisdiction;
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveEnvelope: async () => incomplete });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.some((error) => error.startsWith("ENVELOPE_CANONICAL_SCHEMA_INVALID:guest-disk-001:$.REQUIRED")));
});

test("forbidden additional envelope properties cannot resolve", async () => {
  const invalid = { ...envelope, forged_authority: true };
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveEnvelope: async () => invalid });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.some((error) => error.includes("ADDITIONAL_PROPERTY:forged_authority")));
});

test("invalid envelope patterns and enum values cannot resolve", async () => {
  const invalid = { ...envelope, envelope_id: "bad id", object_class: "UNRECOGNIZED" };
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveEnvelope: async () => invalid });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.some((error) => error.includes("PATTERN")));
  assert.ok(result.errors.some((error) => error.includes("ENUM")));
});

test("incomplete transition event cannot resolve", async () => {
  const incomplete = { ...event };
  delete incomplete.authority;
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveTransitionEvent: async () => incomplete });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.some((error) => error.startsWith("TRANSITION_CANONICAL_SCHEMA_INVALID:")));
});

test("forbidden transition event properties cannot resolve", async () => {
  const invalid = { ...event, authority_override: true };
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveTransitionEvent: async () => invalid });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.some((error) => error.includes("ADDITIONAL_PROPERTY:authority_override")));
});

test("missing DATASELF envelope does not resolve", async () => {
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveEnvelope: async () => null });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.includes("ENVELOPE_NOT_FOUND:guest-disk-001"));
});

test("payload bytes are hashed rather than trusting envelope declarations", async () => {
  const result = await resolveContinuityEvidence(profile, { ...adapter, readPayload: async () => Buffer.from("different bytes") });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.includes("PAYLOAD_INTEGRITY_MISMATCH:guest-disk-001"));
});

test("unresolved transition reference blocks resolution", async () => {
  const result = await resolveContinuityEvidence(profile, { ...adapter, resolveTransitionEvent: async () => null });
  assert.equal(result.resolved, false);
  assert.ok(result.errors.includes(`TRANSITION_EVENT_NOT_FOUND:${event.event_id}`));
});

test("missing read-only adapter fails closed", async () => {
  const result = await resolveContinuityEvidence(profile, {});
  assert.equal(result.resolved, false);
  assert.ok(result.errors.includes("READ_ONLY_DATASELF_ADAPTER_REQUIRED"));
});
