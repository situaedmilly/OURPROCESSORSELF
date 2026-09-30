import {sha256} from "../evidence/hash.mjs";
import {createMessage} from "../../mcp/message.mjs";
import {proposeTransition, executeTransition} from "../repository-machine/transition.mjs";
import {OurselfProcessor} from "../processor.mjs";
import {createCausalLineage, CAUSAL_STAGE} from "../../contracts/causal-lineage.mjs";

export const CAUSAL_LINEAGE_RUNTIME_SCHEMA = "OURSELF.CAUSAL.LINEAGE.RUNTIME.v0.1";

function id(prefix, value) {
  return `${prefix}_${sha256(value).slice(0, 24)}`;
}

export function executeCausalLineage({
  machine,
  messageId,
  topic = "ourself.compute",
  payload = {},
  from = "input",
  to = "cpu",
  operation = "COMPUTE",
  authorized = true,
  bounded = true,
  instanceId = null,
  program = new Uint8Array([1,0,0,1, 1,1,0,1, 2,2,0,1, 0,0,0,0]),
  targetCommit,
} = {}) {
  const message = createMessage({messageId, topic, payload});
  const proposal = proposeTransition({
    machine, from, to, operation, authorized, bounded,
    metadata: {messageId: message.messageId},
  });

  const proposalId = id("proposal", proposal);
  const admissionId = id("admission", {
    proposalId,
    status: proposal.admission,
    from,
    to,
    operation,
  });

  if (proposal.admission !== "ADMITTED") {
    return Object.freeze({
      schema: CAUSAL_LINEAGE_RUNTIME_SCHEMA,
      status: "REJECTED",
      message,
      proposal: Object.freeze({...proposal, proposalId}),
      admission: Object.freeze({admissionId, status: proposal.admission}),
    });
  }

  const resolvedInstanceId = instanceId ?? id("instance", {
    messageId: message.messageId,
    proposalId,
    admissionId,
  });

  const processor = new OurselfProcessor({program});
  const executionId = id("execution", {
    instanceId: resolvedInstanceId,
    programHash: sha256(Array.from(program)),
  });
  const executionReceipts = processor.run();
  const processorEvidence = processor.sealEvidence();

  const finalProcessorReceiptHash = executionReceipts.at(-1)?.receiptHash ?? null;
  const receiptId = id("receipt", finalProcessorReceiptHash);
  const causalBinding = Object.freeze({
    messageId: message.messageId,
    proposalId,
    admissionId,
    instanceId: resolvedInstanceId,
    executionId,
    evidenceHash: processorEvidence.evidenceHash,
    processorReceiptId: receiptId,
    processorFinalReceiptHash: finalProcessorReceiptHash,
  });

  const transition = executeTransition({
    machine,
    proposal,
    targetCommit,
    causalBinding,
  });
  const transitionId = id("transition", transition.receipt.receiptHash);
  const stateId = id("state", {
    surface: transition.state.surface,
    commit: transition.state.commit,
    transitionId,
  });

  const lineage = createCausalLineage({
    [CAUSAL_STAGE.MESSAGE]: Object.freeze({
      messageId: message.messageId,
      schema: message.schema,
    }),
    [CAUSAL_STAGE.PROPOSAL]: Object.freeze({
      proposalId,
      proposalHash: proposal.proposalHash,
    }),
    [CAUSAL_STAGE.ADMISSION]: Object.freeze({
      admissionId,
      status: proposal.admission,
    }),
    [CAUSAL_STAGE.INSTANCE]: Object.freeze({
      instanceId: resolvedInstanceId,
    }),
    [CAUSAL_STAGE.TRANSITION]: Object.freeze({
      transitionId,
      receiptHash: transition.receipt.receiptHash,
      causalBindingHash: sha256(transition.receipt.causalBinding),
      preCommit: transition.receipt.preCommit,
      postCommit: transition.receipt.postCommit,
    }),
    [CAUSAL_STAGE.EXECUTION]: Object.freeze({
      executionId,
      processorVersion: processorEvidence.processorVersion,
      programHash: processorEvidence.programHash,
    }),
    [CAUSAL_STAGE.RECEIPT]: Object.freeze({
      receiptId,
      firstReceiptHash: executionReceipts[0]?.receiptHash ?? null,
      finalReceiptHash: executionReceipts.at(-1)?.receiptHash ?? null,
    }),
    [CAUSAL_STAGE.EVIDENCE]: Object.freeze({
      evidenceHash: processorEvidence.evidenceHash,
      processorReceiptId: receiptId,
      receiptHashes: processorEvidence.receiptHashes,
    }),
    [CAUSAL_STAGE.STATE]: Object.freeze({
      stateId,
      surface: transition.state.surface,
      commit: transition.state.commit,
      status: transition.state.status,
    }),
  });

  return Object.freeze({
    schema: CAUSAL_LINEAGE_RUNTIME_SCHEMA,
    status: "WITNESSED",
    message,
    proposal: Object.freeze({...proposal, proposalId}),
    admission: Object.freeze({admissionId, status: proposal.admission}),
    instanceId: resolvedInstanceId,
    executionId,
    processorEvidence,
    transition,
    lineage,
  });
}

export async function continueCausalLineageWithActuation({lineageResult, adapter, authorized=false, bounded=false}={}) {
  if (lineageResult?.status !== "WITNESSED") throw new Error("witnessed causal lineage is required");
  const transitionReceipt = lineageResult.transition?.receipt;
  if (!transitionReceipt) throw new Error("transition receipt is required");
  const {createActuationRequest} = await import("../../contracts/actuation.mjs");
  const {evaluateActuatorAdmission, executeActuation} = await import("./actuation.mjs");
  const request = createActuationRequest({
    transitionReceipt,
    targetSurface: transitionReceipt.to,
    expectedPreRef: lineageResult.transition.state.ref,
    expectedPreCommit: transitionReceipt.preCommit,
    requestedPostCommit: transitionReceipt.postCommit,
  });
  const admission = evaluateActuatorAdmission({
    request,
    machine: lineageResult._machine ?? null,
    transition: lineageResult.transition,
    authorized,
    bounded,
  });
  if (admission.status !== "ACTUATOR_ADMITTED") {
    return Object.freeze({status:"ACTUATOR_REJECTED",lineage:lineageResult,actuationRequest:request,actuatorAdmission:admission});
  }
  const actuation = await executeActuation({actuatorAdmission:admission,adapter});
  const continuation = actuation.status === "ACTUATOR_EXECUTED"
    ? Object.freeze({stateId:actuation.actualState.stateId, surface:actuation.actualState.surface, ref:actuation.actualState.ref, commit:actuation.actualState.commit})
    : null;
  return Object.freeze({status:actuation.status,lineage:lineageResult,actuationRequest:request,actuatorAdmission:admission,actuation,actualRepositoryState:continuation});
}
