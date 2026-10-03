import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {bootstrapMachineState} from "../src/repository-machine/surfaces.mjs";
import {proposeTransition, executeTransition} from "../src/repository-machine/transition.mjs";
import {admitUpdateRef, executeUpdateRef} from "../src/repository-actuator/update-ref.mjs";
import {createGitCliAdapter} from "../src/repository-actuator/git-cli.mjs";

const exec = promisify(execFile);

async function git(cwd, ...args) {
  return exec("git", args, {cwd});
}

async function fixture() {
  const cwd = await mkdtemp(`${tmpdir()}/ourself-actuator-`);
  await git(cwd, "init", "-q");
  await git(cwd, "config", "user.email", "ourself@example.invalid");
  await git(cwd, "config", "user.name", "OURSELF actuator test");
  await writeFile(`${cwd}/state.txt`, "C1\n");
  await git(cwd, "add", "state.txt");
  await git(cwd, "commit", "-q", "-m", "C1");
  const c1 = (await git(cwd, "rev-parse", "HEAD")).stdout.trim();
  await writeFile(`${cwd}/state.txt`, "C2\n");
  await git(cwd, "add", "state.txt");
  await git(cwd, "commit", "-q", "-m", "C2");
  const c2 = (await git(cwd, "rev-parse", "HEAD")).stdout.trim();
  await git(cwd, "branch", "cpu", c1);
  await git(cwd, "update-ref", "refs/heads/cpu", c1);
  return {cwd, c1, c2};
}

test("actuator rejects unauthorized UPDATE_REF before mutation", async () => {
  const f = await fixture();
  try {
    const machine = bootstrapMachineState(f.c1);
    const proposal = proposeTransition({machine, from:"input", to:"cpu", operation:"UPDATE_REF", authorized:false, bounded:true, metadata:{messageId:"MSG-ACT-REJECT"}});
    assert.equal(proposal.admission, "REJECTED");
    const transition = {receipt:{schema:"OURSELF.GITHUBCOMPUTERMORPH.TRANSITION_RECEIPT.v0.2", from:"input", to:"cpu", operation:"UPDATE_REF", preCommit:f.c1, postCommit:f.c2, receiptHash:"x", causalBinding:{messageId:"MSG-ACT-REJECT"}}};
    const admission = admitUpdateRef({machine, transition, authorized:false, bounded:true});
    assert.equal(admission.status, "REJECTED");
    assert.equal((await git(f.cwd, "rev-parse", "refs/heads/cpu")).stdout.trim(), f.c1);
  } finally { await rm(f.cwd, {recursive:true, force:true}); }
});

test("admitted UPDATE_REF mutates and independently reads back actual ref", async () => {
  const f = await fixture();
  try {
    const machine = bootstrapMachineState(f.c1);
    const proposal = proposeTransition({machine, from:"input", to:"cpu", operation:"UPDATE_REF", authorized:true, bounded:true, metadata:{messageId:"MSG-ACT-001"}});
    assert.equal(proposal.admission, "ADMITTED");
    const transition = executeTransition({machine, proposal, targetCommit:f.c2, causalBinding:{messageId:"MSG-ACT-001", proposalId:"proposal_x", admissionId:"admission_x", instanceId:"instance_x", executionId:"execution_x", evidenceHash:"e".repeat(64), processorReceiptId:"receipt_x", processorFinalReceiptHash:"f".repeat(64)}});
    const admission = admitUpdateRef({machine, transition, authorized:true, bounded:true});
    assert.equal(admission.status, "ACTUATOR_ADMITTED");
    const result = await executeUpdateRef({admission, adapter:createGitCliAdapter({cwd:f.cwd})});
    assert.equal(result.status, "ACTUATOR_EXECUTED");
    assert.equal(result.preCommit, f.c1);
    assert.equal(result.requestedPostCommit, f.c2);
    assert.equal(result.actualPostCommit, f.c2);
    assert.equal(result.refMutation, true);
    assert.equal(result.readback.verified, true);
    assert.match(result.receiptHash, /^[0-9a-f]{64}$/);
    assert.equal((await git(f.cwd, "rev-parse", "refs/heads/cpu")).stdout.trim(), f.c2);
  } finally { await rm(f.cwd, {recursive:true, force:true}); }
});

test("pre-state mismatch fails without mutation", async () => {
  const f = await fixture();
  try {
    const machine = bootstrapMachineState(f.c1);
    const transition = {receipt:{schema:"OURSELF.GITHUBCOMPUTERMORPH.TRANSITION_RECEIPT.v0.2", from:"input", to:"cpu", operation:"UPDATE_REF", preCommit:"d".repeat(40), postCommit:f.c2, receiptHash:"x", causalBinding:{messageId:"MSG-ACT-002"}}};
    const admission = admitUpdateRef({machine, transition, authorized:true, bounded:true});
    assert.equal(admission.status, "REJECTED");
    assert.equal((await git(f.cwd, "rev-parse", "refs/heads/cpu")).stdout.trim(), f.c1);
  } finally { await rm(f.cwd, {recursive:true, force:true}); }
});

test("mutation acknowledgement without state change yields ACTUATOR_FAILED", async () => {
  const f = await fixture();
  try {
    const machine = bootstrapMachineState(f.c1);
    const proposal = proposeTransition({machine, from:"input", to:"cpu", operation:"UPDATE_REF", authorized:true, bounded:true, metadata:{messageId:"MSG-ACT-003"}});
    const transition = executeTransition({machine, proposal, targetCommit:f.c2, causalBinding:{messageId:"MSG-ACT-003", proposalId:"proposal_x", admissionId:"admission_x", instanceId:"instance_x", executionId:"execution_x", evidenceHash:"e".repeat(64), processorReceiptId:"receipt_x", processorFinalReceiptHash:"f".repeat(64)}});
    const admission = admitUpdateRef({machine, transition, authorized:true, bounded:true});
    assert.equal(admission.status, "ACTUATOR_ADMITTED");
    const result = await executeUpdateRef({
      admission,
      adapter: {
        async readRef(ref) { return {ref, commit:f.c1}; },
        async updateRef() { return {acknowledged:true, mutated:false}; },
      },
    });
    assert.equal(result.status, "ACTUATOR_FAILED");
    assert.equal(result.requestedPostCommit, f.c2);
    assert.equal(result.actualPostCommit, f.c1);
    assert.equal(result.refMutation, false);
    assert.equal(result.readback.verified, false);
    assert.match(result.receiptHash, /^[0-9a-f]{64}$/);
  } finally { await rm(f.cwd, {recursive:true, force:true}); }
});
