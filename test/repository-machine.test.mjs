import assert from "node:assert/strict";
import test from "node:test";
import {bootstrapMachineState} from "../src/repository-machine/surfaces.mjs";
import {evaluateTransition, evaluatePurge} from "../src/repository-machine/admission.mjs";
import {proposeTransition, executeTransition} from "../src/repository-machine/transition.mjs";
import {planPurge} from "../src/repository-machine/purge.mjs";

const machine = bootstrapMachineState("a".repeat(40));

test("repository machine has seven semantic surfaces", () => {
  assert.deepEqual(Object.keys(machine.surfaces), ["main","input","cache","cpu","ram","storage","output"]);
  assert.equal(machine.surfaces.cpu.ref, "refs/heads/cpu");
  assert.equal(machine.surfaces.cache.commit, "a".repeat(40));
});

test("transition cannot bypass admission", () => {
  const rejected = evaluateTransition({from:"cache",to:"cpu",operation:"COMPUTE",authorized:false,bounded:true});
  assert.equal(rejected.status, "REJECTED");

  const proposal = proposeTransition({
    machine,
    from:"cache",
    to:"cpu",
    operation:"COMPUTE",
    authorized:true,
    bounded:true,
    metadata:{reason:"known-hot candidate"},
  });
  assert.equal(proposal.admission, "ADMITTED");
  assert.match(proposal.proposalHash, /^[0-9a-f]{64}$/);

  const result = executeTransition({machine,proposal,targetCommit:"b".repeat(40)});
  assert.equal(result.state.commit, "b".repeat(40));
  assert.equal(result.state.surface, "cpu");
  assert.match(result.receipt.receiptHash, /^[0-9a-f]{64}$/);
  assert.equal(result.receipt.preCommit, "a".repeat(40));
});

test("purge is an admitted state normalization plan, not deletion", () => {
  const rejected = evaluatePurge({authorized:false,bounded:true});
  assert.equal(rejected.status, "REJECTED");

  const plan = planPurge({
    machine,
    canonicalCommit:"c".repeat(40),
    authorized:true,
    bounded:true,
  });
  assert.equal(plan.admission.status, "ADMITTED");
  assert.equal(plan.admission.invariant, "PURGE_IS_STATE_TRANSITION_NOT_DELETE");
  assert.equal(plan.targets.cpu.toCommit, "c".repeat(40));
  assert.equal(plan.targets.cache.toCommit, "c".repeat(40));
  assert.equal(plan.targets.output.toCommit, "c".repeat(40));
});
