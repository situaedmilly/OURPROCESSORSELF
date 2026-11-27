import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntime,
  createInstance,
  createWitness,
  runSovereignTransition
} from "../src/runtime/sovereign-runtime.mjs";

function makeHarness(host) {
  const state = { value: "C1" };
  const runtime = createRuntime({
    runtimeId: `runtime:${host}`,
    host,
    capabilities: ["SET_STATE"]
  });
  const instance = createInstance({
    instanceId: "instance:v0.8:canonical",
    constitution: "OURSELF-CONSTITUTION@0.8",
    processorIdentity: "OURPROCESSORSELF@0.8",
    authorityModel: "BOUNDED_UPDATE",
    selfgraph: { state: "C1" },
    capabilities: ["SET_STATE"],
    actuatorIds: ["state-actuator"]
  });
  const adapter = {
    admit: async ({ proposal }) => ({
      status: proposal.operation === "SET_STATE" ? "ADMITTED" : "REJECTED"
    })
  };
  const actuator = {
    capability: "SET_STATE",
    execute: async ({ admission, preimage }) => {
      state.value = preimage.desiredState.value;
      return Object.freeze({
        kind: "EFFECT",
        accepted: admission.status === "ADMITTED",
        value: state.value
      });
    }
  };
  const witness = createWitness({
    instance,
    runtime,
    readBack: async () => ({ value: state.value })
  });

  return { runtime, instance, adapter, actuator, witness };
}

async function execute(host) {
  const h = makeHarness(host);
  return runSovereignTransition({
    ...h,
    observedState: { value: "C1" },
    desiredState: { value: "C2" },
    proposal: { operation: "SET_STATE", target: "state" }
  });
}

test("v0.8 realizes a bounded transition through an independent read-back", async () => {
  const result = await execute("mac");
  assert.equal(result.status, "DESIRED_STATE_REALIZED");
  assert.equal(result.verified, true);
  assert.equal(result.actualState.value, "C2");
  assert.equal(result.receipt.kind, "SOVEREIGN_RUNTIME_WITNESS");
  assert.match(result.receipt.receiptHash, /^[0-9a-f]{64}$/);
});

test("host substitution preserves instance, processor, constitution, and authority semantics", async () => {
  const mac = await execute("mac");
  const pi = await execute("raspberry-pi");
  const linux = await execute("linux");
  const bubble = await execute("bubble");

  for (const result of [pi, linux, bubble]) {
    assert.equal(result.instanceId, mac.instanceId);
    assert.equal(result.processorIdentity, mac.processorIdentity);
    assert.equal(result.constitution, mac.constitution);
    assert.equal(result.authorityModel, mac.authorityModel);
    assert.equal(result.desiredState.value, "C2");
    assert.equal(result.verified, true);
  }

  assert.notEqual(mac.runtimeId, pi.runtimeId);
  assert.notEqual(mac.runtimeId, linux.runtimeId);
  assert.notEqual(mac.runtimeId, bubble.runtimeId);
});

test("substrate capability failure does not mutate constitutional identity", async () => {
  const h = makeHarness("restricted-host");
  const restricted = {
    ...h,
    runtime: createRuntime({
      runtimeId: "runtime:restricted",
      host: "restricted",
      capabilities: []
    })
  };

  const result = await runSovereignTransition({
    ...restricted,
    observedState: { value: "C1" },
    desiredState: { value: "C2" },
    proposal: { operation: "SET_STATE", target: "state" }
  });

  assert.equal(result.status, "SUBSTRATE_CAPABILITY_UNAVAILABLE");
  assert.equal(restricted.instance.processorIdentity, "OURPROCESSORSELF@0.8");
  assert.equal(restricted.instance.constitution, "OURSELF-CONSTITUTION@0.8");
});
