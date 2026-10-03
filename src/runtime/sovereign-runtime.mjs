import { createHash } from "node:crypto";

export const V08_PRIMITIVES = Object.freeze([
  "RUNTIME",
  "INSTANCE",
  "ADAPTER",
  "ACTUATOR",
  "WITNESS",
  "CONTINUATION"
]);

export const INVARIANTS = Object.freeze([
  "HOST != INSTANCE",
  "INSTANCE != PROCESSOR",
  "PROCESSOR != AUTHORITY",
  "AUTHORITY != ACTUATOR",
  "ACTUATOR != WITNESS",
  "WITNESS != REALITY",
  "RECEIPT != EFFECT",
  "EFFECT != OBSERVATION",
  "OBSERVATION != VERIFICATION"
]);

const stable = (value) => JSON.stringify(value, Object.keys(value).sort());

export function createRuntime({ runtimeId, host, capabilities = [] }) {
  if (!runtimeId || !host) throw new Error("runtime requires runtimeId and host");
  return Object.freeze({
    kind: "RUNTIME",
    runtimeId,
    host,
    capabilities: Object.freeze([...capabilities])
  });
}

export function createInstance({
  instanceId,
  constitution,
  processorIdentity,
  authorityModel,
  selfgraph,
  capabilities = [],
  actuatorIds = []
}) {
  if (!instanceId) throw new Error("instance requires instanceId");
  if (!constitution) throw new Error("instance requires constitution");
  if (!processorIdentity) throw new Error("instance requires processorIdentity");
  if (!authorityModel) throw new Error("instance requires authorityModel");

  return Object.freeze({
    kind: "INSTANCE",
    instanceId,
    constitution,
    processorIdentity,
    authorityModel,
    selfgraph: structuredClone(selfgraph ?? {}),
    capabilities: Object.freeze([...capabilities]),
    actuatorIds: Object.freeze([...actuatorIds])
  });
}

export function createWitness({ instance, runtime, readBack }) {
  if (!instance || !runtime || typeof readBack !== "function") {
    throw new Error("witness requires instance, runtime, and readBack");
  }

  return Object.freeze({
    kind: "WITNESS",
    witnessId: `witness:${instance.instanceId}:${runtime.runtimeId}`,
    readBack
  });
}

export async function runSovereignTransition({
  runtime,
  instance,
  adapter,
  actuator,
  witness,
  observedState,
  desiredState,
  proposal,
  authorize = () => true,
  continuePredicate = () => false
}) {
  if (runtime.capabilities.includes(actuator.capability) === false) {
    return Object.freeze({ status: "SUBSTRATE_CAPABILITY_UNAVAILABLE", runtime: runtime.runtimeId });
  }
  if (!instance.capabilities.includes(actuator.capability)) {
    return Object.freeze({ status: "INSTANCE_CAPABILITY_UNAVAILABLE", instance: instance.instanceId });
  }
  if (!authorize({ instance, proposal })) {
    return Object.freeze({ status: "AUTHORITY_REJECTED", instance: instance.instanceId });
  }

  const preimage = Object.freeze({
    observedState,
    desiredState,
    proposal,
    processorIdentity: instance.processorIdentity,
    constitution: instance.constitution,
    authorityModel: instance.authorityModel
  });

  const admission = await adapter.admit({
    instance,
    proposal,
    observedState,
    desiredState
  });

  if (admission.status !== "ADMITTED") {
    return Object.freeze({ status: "ADAPTER_REJECTED", admission });
  }

  const effect = await actuator.execute({
    admission,
    preimage,
    instance,
    runtime
  });

  const actualState = await witness.readBack({
    effect,
    preimage,
    instance,
    runtime
  });

  const verified = JSON.stringify(actualState) === JSON.stringify(desiredState);
  const receiptPayload = {
    instanceId: instance.instanceId,
    runtimeId: runtime.runtimeId,
    preimage,
    admission,
    effect,
    actualState,
    verified
  };
  const receiptHash = createHash("sha256")
    .update(JSON.stringify(receiptPayload))
    .digest("hex");

  const result = Object.freeze({
    status: verified ? "DESIRED_STATE_REALIZED" : "VERIFICATION_FAILED",
    instanceId: instance.instanceId,
    runtimeId: runtime.runtimeId,
    processorIdentity: instance.processorIdentity,
    constitution: instance.constitution,
    authorityModel: instance.authorityModel,
    observedState,
    desiredState,
    actualState,
    verified,
    receipt: Object.freeze({
      kind: "SOVEREIGN_RUNTIME_WITNESS",
      receiptHash
    }),
    continuation: continuePredicate({ actualState, desiredState })
      ? "CONTINUE"
      : verified
        ? "TERMINATE_REALIZED"
        : "TERMINATE_VERIFICATION_FAILED"
  });

  return result;
}
