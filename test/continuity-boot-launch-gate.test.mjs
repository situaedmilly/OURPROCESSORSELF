import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBootLaunchGate } from "../src/continuity/boot-launch-gate.mjs";

const names = [
  "payload_resolution", "payload_integrity", "journal_lineage",
  "source_immutability", "preservation_copy", "independent_custody",
  "operation_authority", "runtime_compatibility", "launch_scope",
];
const complete = Object.fromEntries(names.map((name) => [name, async () => ({ verified: true, evidence_ref: `evidence:${name}` })]));

test("boot launch gate remains blocked when evidence verifiers are absent", async () => {
  const result = await evaluateBootLaunchGate({});
  assert.equal(result.ready, false);
  assert.equal(result.state, "BOOT_LAUNCH_BLOCKED");
  assert.equal(result.effect_performed, false);
  assert.equal(result.blockers.length, names.length);
});

test("boot launch gate requires evidence references, not boolean claims", async () => {
  const result = await evaluateBootLaunchGate(Object.fromEntries(names.map((name) => [name, async () => ({ verified: true })])));
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("EVIDENCE_NOT_VERIFIED:operation_authority"));
});

test("complete independently supplied evidence can authorize the software gate but performs no effect", async () => {
  const result = await evaluateBootLaunchGate(complete);
  assert.equal(result.ready, true);
  assert.equal(result.state, "BOOT_LAUNCH_AUTHORIZED");
  assert.equal(result.effect_performed, false);
});
