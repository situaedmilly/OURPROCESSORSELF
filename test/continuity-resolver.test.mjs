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
  payload: { sha256: digest, byte_count: bytes.length, content_key: `sha256:${digest}` },
  lifecycle: "INTEGRITY_VERIFIED",
};
const event = {
  schema: "ourdata.transition-event.v1",
  event_id: "event:guest-disk-001:create",
  object_id: envelope.object_id,
  reality_id: envelope.reality_id,
  instance_id: envelope.instance_id,
  target: { envelope_id: envelope.envelope_id },
};
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
      transition_event_refs: [event.event_id],
    },
  }],
};
const adapter = {
  resolveEnvelope: async (id) => id === envelope.envelope_id ? envelope : null,
  readPayload: async () => bytes,
  resolveTransitionEvent: async (id) => id === event.event_id ? event : null,
};

test("resolves canonical envelope, exact bytes and transition references", async () => {
  const result = await resolveContinuityEvidence(profile, adapter);
  assert.equal(result.resolved, true);
  assert.deepEqual(result.components, ["guest-disk-001"]);
  assert.ok(result.limitations.includes("TRANSITION_JOURNAL_COMPLETENESS_AND_HASH_CHAIN_NOT_VERIFIED"));
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
