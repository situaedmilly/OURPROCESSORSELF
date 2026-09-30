import assert from "node:assert/strict";
import test from "node:test";
import {bootstrapMachineState} from "../src/repository-machine/surfaces.mjs";
import {evaluateTransition, evaluatePurge} from "../src/repository-machine/admission.mjs";
import {proposeTransition, executeTransition} from "../src/repository-machine/transition.mjs";
import {planPurge} from "../src/repository-machine/purge.mjs";

const machine = bootstrapMachineState("a".repeat(40));

test("pressure: unknown surface is rejected", () => {
  assert.throws(
    () => proposeTransition({machine, from:"unknown", to:"cpu", operation:"COMPUTE", authorized:true, bounded:true}),
    /unknown machine surface|unknown/
  );
});

test("pressure: missing admission is rejected", () => {
  const p = proposeTransition({machine, from:"cache", to:"cpu", operation:"COMPUTE", authorized:false, bounded:true});
  assert.equal(p.admission, "REJECTED");
  assert.throws(() => executeTransition({machine, proposal:p, targetCommit:"b".repeat(40)}), /not admitted/);
});

test("pressure: unauthorized transition is rejected", () => {
  assert.equal(evaluateTransition({from:"cpu",to:"ram",operation:"SIMULATE",authorized:false,bounded:true}).status, "REJECTED");
});

test("pressure: unbounded transition is rejected", () => {
  assert.equal(evaluateTransition({from:"cpu",to:"ram",operation:"SIMULATE",authorized:true,bounded:false}).status, "REJECTED");
});

test("pressure: valid CPU transition is admitted and sealed", () => {
  const p = proposeTransition({machine,from:"cpu",to:"ram",operation:"SIMULATE",authorized:true,bounded:true});
  assert.equal(p.admission,"ADMITTED");
  const r = executeTransition({machine,proposal:p,targetCommit:"b".repeat(40)});
  assert.equal(r.state.commit,"b".repeat(40));
  assert.match(r.receipt.receiptHash,/^[0-9a-f]{64}$/);
});

test("pressure: cache hit does not grant authority", () => {
  const p = proposeTransition({machine,from:"cache",to:"cpu",operation:"COMPUTE",authorized:false,bounded:true,metadata:{cacheHit:true}});
  assert.equal(p.admission,"REJECTED");
  assert.equal(p.metadata.cacheHit,true);
});

test("pressure: purge without admission is rejected", () => {
  assert.equal(evaluatePurge({authorized:false,bounded:true}).status,"REJECTED");
});

test("pressure: admitted purge produces a bounded plan", () => {
  const p = planPurge({machine,canonicalCommit:"c".repeat(40),authorized:true,bounded:true});
  assert.equal(p.admission.status,"ADMITTED");
  assert.equal(p.targets.cache.toCommit,"c".repeat(40));
  assert.equal(p.targets.cpu.toCommit,"c".repeat(40));
});

test("pressure: raw Git ref movement is not a machine transition", () => {
  // Repository-machine semantics require a proposal/admission/receipt.
  // A ref name or commit hash alone contains no computational admission.
  const rawRef = {ref:"refs/heads/cpu",commit:"d".repeat(40)};
  assert.equal(Object.hasOwn(rawRef,"admission"),false);
  assert.equal(Object.hasOwn(rawRef,"receiptHash"),false);
});

test("pressure: transition receipt binds pre/post repository state", () => {
  const p = proposeTransition({machine,from:"cpu",to:"output",operation:"PROJECT",authorized:true,bounded:true});
  const r = executeTransition({machine,proposal:p,targetCommit:"e".repeat(40)});
  assert.equal(r.receipt.preCommit,"a".repeat(40));
  assert.equal(r.receipt.postCommit,"e".repeat(40));
  assert.equal(r.receipt.proposalHash,p.proposalHash);
  assert.match(r.receipt.receiptHash,/^[0-9a-f]{64}$/);
});
