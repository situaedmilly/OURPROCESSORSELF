import test from "node:test";
import assert from "node:assert/strict";
import { validateContinuityProfile } from "../src/continuity/profile.mjs";

function profile(overrides = {}) {
  return {
    schema: "ourself.reverself.continuity-profile.v1",
    continuity_id: "REVERSELF-WINDOWS-MT5-001",
    subject: {
      vm_name: "Windows",
      vm_uuid: "195DFC9A-5C29-4AD5-87B3-C2241E820DBA",
      backend: "QEMU",
      guest_architecture: "aarch64",
      application_context: "MetaTrader 5"
    },
    components: [
      { component_id: "vm-config-001", role: "VM_CONFIGURATION", envelope_ref: "env:vm-config", payload_state: "INTEGRITY_VERIFIED" },
      { component_id: "guest-disk-001", role: "GUEST_DISK", envelope_ref: "env:guest-disk", payload_state: "INTEGRITY_VERIFIED" },
      { component_id: "qemu-runtime-001", role: "QEMU_RUNTIME", envelope_ref: "env:qemu", payload_state: "INTEGRITY_VERIFIED" },
      { component_id: "preserve-copy-001", role: "PRESERVATION_COPY", envelope_ref: "env:preservation", payload_state: "INTEGRITY_VERIFIED" }
    ],
    recovery: {
      target_reality: "SELFPI",
      source_immutable: true,
      restore_authority: "ADMITTED",
      status: "RESTORE_READY"
    },
    limitations: [],
    ...overrides
  };
}

test("valid continuity profile passes the structural and restore gates", () => {
  const result = validateContinuityProfile(profile());
  assert.equal(result.valid, true);
  assert.equal(result.restore_gate.ready, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.restore_gate.blockers, []);
});

test("missing original guest disk blocks restoration", () => {
  const value = profile({
    components: profile().components.filter((item) => item.role !== "GUEST_DISK")
  });
  const result = validateContinuityProfile(value);
  assert.equal(result.valid, true);
  assert.equal(result.restore_gate.ready, false);
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

test("unadmitted restore authority blocks restoration", () => {
  const recovery = { ...profile().recovery, restore_authority: "PENDING" };
  const result = validateContinuityProfile(profile({ recovery }));
  assert.equal(result.valid, true);
  assert.equal(result.restore_gate.ready, false);
  assert.ok(result.restore_gate.blockers.includes("RESTORE_AUTHORITY_NOT_ADMITTED"));
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
  assert.equal(result.restore_gate.ready, false);
  assert.ok(result.restore_gate.blockers.some((item) => item.startsWith("COMPONENT_QUARANTINED:")));
});
