import {createHash} from "node:crypto";
import {ACTUATOR_OPERATION, ACTUATOR_STATUS, REPOSITORY_ACTUATOR_SCHEMA, assertUpdateRefPlan} from "../../contracts/repository-actuator.mjs";
import {SURFACE_ROLE} from "../../contracts/repository-machine.mjs";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function sha256(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function admitUpdateRef({machine, transition, authorized=false, bounded=false}={}) {
  if (!transition?.receipt || transition.receipt.schema !== "OURSELF.GITHUBCOMPUTERMORPH.TRANSITION_RECEIPT.v0.2") {
    return Object.freeze({status: "REJECTED", reason: "INVALID_TRANSITION_RECEIPT"});
  }
  const {to, operation, preCommit, postCommit} = transition.receipt;
  const targetSurface = to;
  if (!machine?.surfaces?.[targetSurface] || !Object.hasOwn(SURFACE_ROLE, targetSurface)) {
    return Object.freeze({status: "REJECTED", reason: "UNDECLARED_TARGET_SURFACE"});
  }
  if (operation !== ACTUATOR_OPERATION.UPDATE_REF) {
    return Object.freeze({status: "REJECTED", reason: "OPERATION_NOT_BOUNDED"});
  }
  if (!authorized) return Object.freeze({status: "REJECTED", reason: "UNAUTHORIZED"});
  if (!bounded) return Object.freeze({status: "REJECTED", reason: "UNBOUNDED"});
  if (machine.surfaces[targetSurface].commit !== preCommit) {
    return Object.freeze({status: "REJECTED", reason: "MACHINE_PRESTATE_MISMATCH"});
  }
  const plan = {
    schema: REPOSITORY_ACTUATOR_SCHEMA,
    operation: ACTUATOR_OPERATION.UPDATE_REF,
    targetSurface,
    preRef: machine.surfaces[targetSurface].ref,
    preCommit: machine.surfaces[targetSurface].commit,
    requestedPostCommit: postCommit,
    transitionReceiptHash: transition.receipt.receiptHash,
    causalBinding: transition.receipt.causalBinding,
  };
  try { assertUpdateRefPlan(plan); } catch (error) {
    return Object.freeze({status: "REJECTED", reason: error.message});
  }
  return Object.freeze({
    status: ACTUATOR_STATUS.ADMITTED,
    plan: Object.freeze({...plan, planHash: sha256(plan)}),
  });
}

export async function executeUpdateRef({admission, adapter}={}) {
  if (admission?.status !== ACTUATOR_STATUS.ADMITTED) throw new Error("actuator admission is required");
  if (!adapter || typeof adapter.readRef !== "function" || typeof adapter.updateRef !== "function") {
    throw new TypeError("adapter.readRef and adapter.updateRef are required");
  }

  const plan = admission.plan;
  const observedPre = await adapter.readRef(plan.preRef);
  const preCommit = observedPre?.commit ?? null;

  if (preCommit !== plan.preCommit) {
    return sealFailure({plan, observedPre, reason: "PRESTATE_READBACK_MISMATCH"});
  }

  let mutationResult;
  try {
    mutationResult = await adapter.updateRef(plan.preRef, plan.requestedPostCommit, plan.preCommit);
  } catch (error) {
    return sealFailure({plan, observedPre, reason: "REF_MUTATION_FAILED", error: String(error?.message ?? error)});
  }

  const observedPost = await adapter.readRef(plan.preRef);
  const actualPostCommit = observedPost?.commit ?? null;
  const refMutation = actualPostCommit === plan.requestedPostCommit;
  const status = refMutation ? ACTUATOR_STATUS.EXECUTED : ACTUATOR_STATUS.FAILED;

  const body = {
    schema: "OURSELF.GITHUBCOMPUTERMORPH.ACTUATOR_RECEIPT.v0.1",
    status,
    operation: plan.operation,
    targetSurface: plan.targetSurface,
    preRef: observedPre?.ref ?? plan.preRef,
    preCommit: observedPre?.commit ?? null,
    requestedPostCommit: plan.requestedPostCommit,
    actualPostCommit,
    refMutation,
    readback: {
      pre: observedPre,
      post: observedPost,
      verified: refMutation,
    },
    transitionReceiptHash: plan.transitionReceiptHash,
    causalBinding: plan.causalBinding,
    mutationResult: mutationResult ?? null,
  };
  return seal(body);
}

function sealFailure({plan, observedPre, reason, error=null}) {
  return seal({
    schema: "OURSELF.GITHUBCOMPUTERMORPH.ACTUATOR_RECEIPT.v0.1",
    status: ACTUATOR_STATUS.FAILED,
    operation: plan.operation,
    targetSurface: plan.targetSurface,
    preRef: plan.preRef,
    preCommit: observedPre?.commit ?? null,
    requestedPostCommit: plan.requestedPostCommit,
    actualPostCommit: observedPre?.commit ?? null,
    refMutation: false,
    readback: {pre: observedPre, post: observedPre, verified: false},
    transitionReceiptHash: plan.transitionReceiptHash,
    causalBinding: plan.causalBinding,
    failure: {reason, error},
  });
}

function seal(body) {
  return Object.freeze({...body, receiptHash: sha256(body)});
}
