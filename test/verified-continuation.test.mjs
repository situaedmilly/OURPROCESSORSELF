import assert from "node:assert/strict";
import test from "node:test";
import {createSelfGraph, differentiateSelfGraph} from "../src/continuation/differentiate.mjs";
import {generateNextProposal} from "../src/continuation/proposal.mjs";
import {runVerifiedContinuation} from "../src/continuation/verified-continuation.mjs";

const auth = {jurisdiction:"repository",capabilities:["UPDATE_REF"],constraints:["bounded"],termination:["realized","failure","authority"]};
const caps = {capabilities:["UPDATE_REF"]};
const mutation = {operation:"UPDATE_REF",authority:"repository",capability:"UPDATE_REF",target:"refs/heads/cpu"};
const admitted = async () => ({status:"ADMITTED"});

test("v0.7 success closes the cycle and terminates on verified realization", async () => {
  const result = await runVerifiedContinuation({
    observedState:{ref:"refs/heads/cpu",commit:"Y"},
    desiredState:{ref:"refs/heads/cpu",commit:"X"},
    authorityContext:auth, capabilityContext:caps, mutation,
    admitProposal: admitted,
    executeProposal: async () => ({status:"ACTUATION_EXECUTED",actualState:{ref:"refs/heads/cpu",commit:"X"},receipt:{receiptHash:"r1"}}),
  });
  assert.equal(result.status,"DESIRED_STATE_REALIZED");
  assert.equal(result.cycles.length,1);
  assert.equal(result.graph.state.actual.commit,"X");
});

test("v0.7 actuator failure stops without asserting a false actual state", async () => {
  const result = await runVerifiedContinuation({
    observedState:{ref:"refs/heads/cpu",commit:"Y"},
    desiredState:{ref:"refs/heads/cpu",commit:"X"},
    authorityContext:auth, capabilityContext:caps, mutation,
    admitProposal: admitted,
    executeProposal: async () => ({status:"ACTUATION_FAILED",reason:"READ_BACK_MISMATCH"}),
  });
  assert.equal(result.status,"BOUNDARY_UPRISE");
  assert.equal(result.reason,"READ_BACK_MISMATCH");
  assert.equal(result.graph.state.actual,null);
});

test("v0.7 insufficient authority stops before execution", async () => {
  let executed = false;
  const result = await runVerifiedContinuation({
    observedState:{ref:"refs/heads/cpu",commit:"Y"},
    desiredState:{ref:"refs/heads/cpu",commit:"X"},
    authorityContext:{jurisdiction:"repository",capabilities:[],constraints:[],termination:["authority"]},
    capabilityContext:caps, mutation,
    admitProposal: admitted,
    executeProposal: async () => { executed = true; return {status:"ACTUATION_EXECUTED"}; },
  });
  assert.equal(result.status,"BOUNDARY_UPRISE");
  assert.equal(result.reason,"INSUFFICIENT_AUTHORITY");
  assert.equal(executed,false);
});

test("v0.7 admission rejection stops before execution", async () => {
  let executed = false;
  const result = await runVerifiedContinuation({
    observedState:{ref:"refs/heads/cpu",commit:"Y"},
    desiredState:{ref:"refs/heads/cpu",commit:"X"},
    authorityContext:auth, capabilityContext:caps, mutation,
    admitProposal: async () => ({status:"REJECTED",reason:"BOUNDARY_UPRISE"}),
    executeProposal: async () => { executed = true; return {status:"ACTUATION_EXECUTED"}; },
  });
  assert.equal(result.status,"BOUNDARY_UPRISE");
  assert.equal(result.reason,"BOUNDARY_UPRISE");
  assert.equal(executed,false);
});

test("v0.7 empty delta produces no proposal", () => {
  const graph = createSelfGraph({observedState:{commit:"X"},desiredState:{commit:"X"},authorityContext:auth,capabilityContext:caps});
  const d = differentiateSelfGraph(graph);
  const p = generateNextProposal(d.delta,{mutation});
  assert.equal(d.realized,true);
  assert.equal(p.status,"REALIZED");
});
