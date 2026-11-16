import test from "node:test";
import assert from "node:assert/strict";
import { validateContinuityProfile } from "../src/continuity/profile.mjs";

function binding(id) {
  const digest = "a".repeat(64);
  return {
    envelope_id: id,
    object_id: `object:${id}`,
    reality_id: "OURSELF_RUNTIME",
    instance_id: "WINDOWS_ARM64_ORIGINAL",
    payload_sha256: digest,
    byte_count: 4096,
    content_key: `sha256:${digest}`,
    lifecycle: "INTEGRITY_VERIFIED",
    transition_event_refs: [`event:${id}:create`],
  };
}
function component(id, role) {
  const envelopeId = `envelope:${id}`;
  return {
    component_id: id,
    role,
    envelope_ref: envelopeId,
    envelope_binding: binding(envelopeId),
    payload_state: "INTEGRITY_VERIFIED",
  };
}
function profile(overrides = {}) {
  return {
    schema: "ourself.reverself.continuity-profile.v1",
    continuity_id: "REVERSELF-WINDOWS-MT5-001",
    subject: {
      vm_name: "Windows",
      vm_uuid: "195DFC9A-5C29-4AD5-87B3-C2241E820DBA",
      backend: "QEMU",
      guest_architecture: "aarch64",
      application_context: "MetaTrader 5",
    },
    components: [
      component("vm-config-001", "VM_CONFIGURATION"),
      component("guest-disk-001", "GUEST_DISK"),
      component("qemu-runtime-001", "QEMU_RUNTIME"),
      component("preserve-copy-001", "PRESERVATION_COPY"),
    ],
    recovery: {
      target_reality: "SELFPI",
      source_immutable: true,
      restore_authority: "ADMITTED",
      status: "PRESERVATION",
    },
    limitations: [],
    ...overrides,
  };
}

test("structurally consistent profile never self-asserts restore readiness", () => {
  const result = validateContinuityProfile(profile());
  assert.equal(result.valid, true);
  assert.equal(result.restore_gate.ready, false);
  assert.ok(result.restore_gate.blockers.includes("EXTERNAL_ENVELOPE_RESOLUTION_NOT_PERFORMED"));
  assert.ok(result.restore_gate.blockers.includes("PAYLOAD_BYTE_VERIFICATION_NOT_PERFORMED"));
  assert.ok(result.restore_gate.blockers.includes("TRANSITION_LINEAGE_VERIFICATION_NOT_PERFORMED"));
});

test("ADMITTED is not interchangeable with INTEGRITY_VERIFIED", () => {
  const components = profile().components;
  components[1] = { ...components[1], payload_state: "ADMITTED" };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, true);
  assert.equal(result.restore_gate.ready, false);
  assert.ok(result.restore_gate.blockers.includes("ADMISSION_IS_NOT_INTEGRITY:guest-disk-001"));
});

test("missing original guest disk blocks restoration", () => {
  const components = profile().components.filter((item) => item.role !== "GUEST_DISK");
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, true);
  assert.ok(result.restore_gate.blockers.includes("REQUIRED_COMPONENT_ABSENT:GUEST_DISK"));
});

test("duplicate component identities fail structural validation", () => {
  const components = profile().components;
  components[1] = { ...components[1], component_id: components[0].component_id };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("DUPLICATE_COMPONENT_ID"));
});

test("unresolved component dependencies fail closed", () => {
  const components = profile().components;
  components[0] = { ...components[0], depends_on: ["missing-firmware-000"] };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("UNRESOLVED_COMPONENT_DEPENDENCY"));
});

test("envelope reference must match the bound canonical envelope identity", () => {
  const components = profile().components;
  components[0] = { ...components[0], envelope_ref: "envelope:other-object" };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("ENVELOPE_REFERENCE_MISMATCH"));
});

test("content key must bind the declared payload digest", () => {
  const components = profile().components;
  components[0] = {
    ...components[0],
    envelope_binding: { ...components[0].envelope_binding, content_key: "sha256:" + "b".repeat(64) },
  };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("CONTENT_KEY_DIGEST_MISMATCH"));
});

test("every component in a required role is evaluated", () => {
  const components = profile().components;
  components.push({
    ...component("guest-disk-002", "GUEST_DISK"),
    payload_state: "DECLARED",
  });
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, true);
  assert.ok(result.restore_gate.blockers.includes("COMPONENT_BYTES_NOT_VERIFIED:guest-disk-002"));
});

test("unresolved transition event references block external lineage verification", () => {
  const components = profile().components;
  components[0] = {
    ...components[0],
    envelope_binding: { ...components[0].envelope_binding, transition_event_refs: [] },
  };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("INVALID_TRANSITION_EVENT_REFS"));
});

test("unverified recovered status is rejected as a readiness claim", () => {
  const recovery = { ...profile().recovery, status: "RECOVERED" };
  const result = validateContinuityProfile(profile({ recovery }));
  assert.equal(result.valid, true);
  assert.ok(result.restore_gate.blockers.includes("UNVERIFIED_RECOVERY_STATUS_CLAIM"));
});

test("source immutability is mandatory", () => {
  const recovery = { ...profile().recovery, source_immutable: false };
  const result = validateContinuityProfile(profile({ recovery }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("SOURCE_MUST_REMAIN_IMMUTABLE"));
});

test("quarantined payload blocks restoration", () => {
  const components = profile().components;
  components[1] = { ...components[1], payload_state: "QUARANTINED" };
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, true);
  assert.ok(result.restore_gate.blockers.some((item) => item.startsWith("COMPONENT_QUARANTINED:")));
});

test("missing envelope binding fails structural validation", () => {
  const components = profile().components;
  delete components[0].envelope_binding;
  const result = validateContinuityProfile(profile({ components }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("ENVELOPE_BINDING_REQUIRED"));
});
