import assert from "node:assert/strict";
import test from "node:test";
import {bootstrapMachineState} from "../src/repository-machine/surfaces.mjs";
import {executeCausalLineage} from "../src/causal/lineage.mjs";

const machine = bootstrapMachineState("a".repeat(40));
const program = new Uint8Array([
  1,0,0,7,
  1,1,0,5,
  2,2,0,1,
  0,0,0,0,
]);

test("causal binding rejects before processor execution", () => {
  const result = executeCausalLineage({
    machine,
    messageId: "MSG-REJECT-001",
    program,
    targetCommit: "b".repeat(40),
    authorized: false,
    bounded: true,
  });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.proposal.admission, "REJECTED");
  assert.ok(result.proposal.proposalId);
  assert.ok(result.admission.admissionId);
  assert.equal(result.executionId, undefined);
});

test("causal lineage binds MCP → admission → instance → processor → evidence → repository state", () => {
  const result = executeCausalLineage({
    machine,
    messageId: "MSG-CAUSAL-001",
    program,
    targetCommit: "b".repeat(40),
    authorized: true,
    bounded: true,
  });

  assert.equal(result.status, "WITNESSED");
  assert.equal(result.message.messageId, "MSG-CAUSAL-001");
  assert.equal(result.proposal.proposalId.length, 32);
  assert.match(result.proposal.proposalHash, /^[0-9a-f]{64}$/);
  assert.match(result.admission.admissionId, /^admission_[0-9a-f]{24}$/);
  assert.match(result.instanceId, /^instance_[0-9a-f]{24}$/);
  assert.match(result.executionId, /^execution_[0-9a-f]{24}$/);

  assert.equal(result.lineage.stages.MCP_MESSAGE.messageId, result.message.messageId);
  assert.equal(result.lineage.stages.PROPOSAL.proposalId, result.proposal.proposalId);
  assert.equal(result.lineage.stages.ADMISSION.admissionId, result.admission.admissionId);
  assert.equal(result.lineage.stages.INSTANCE.instanceId, result.instanceId);
  assert.equal(result.lineage.stages.REPOSITORY_TRANSITION.transitionId.startsWith("transition_"), true);
  assert.equal(result.lineage.stages.LEVEL_0_EXECUTION.executionId, result.executionId);
  assert.equal(result.lineage.stages.SEALED_EVIDENCE.evidenceHash, result.processorEvidence.evidenceHash);
  assert.equal(result.lineage.stages.REPOSITORY_STATE.commit, "b".repeat(40));
  assert.equal(result.lineage.stages.REPOSITORY_STATE.surface, "cpu");

  assert.equal(result.processorEvidence.receiptHashes.length, 4);
  assert.match(result.processorEvidence.evidenceHash, /^[0-9a-f]{64}$/);
  assert.match(result.transition.receipt.receiptHash, /^[0-9a-f]{64}$/);
  assert.equal(result.transition.receipt.preCommit, "a".repeat(40));
  assert.equal(result.transition.receipt.postCommit, "b".repeat(40));
});
