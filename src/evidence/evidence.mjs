import {sha256} from "./hash.mjs";

export const EVIDENCE_SCHEMA = "OURSELF.PROCESSOR.EXECUTION_EVIDENCE.v0.3";

export function linkEvidence({instance, receipt, observation, parentEvidenceHash=null}={}) {
  if (!instance || !receipt) throw new TypeError("instance and receipt required");
  if (receipt.instanceId !== instance.instanceId) throw new TypeError("receipt/instance mismatch");
  const preimageHash = sha256({
    instanceId: instance.instanceId,
    eventId: instance.eventId,
    programHash: instance.programHash,
    preStateHash: instance.preStateHash,
    capabilityCommitment: instance.capabilityCommitment,
    executionBounds: instance.executionBounds,
  });
  const observationHash = sha256(observation ?? null);
  const receiptHash = sha256(receipt);
  const evidenceHash = sha256({
    schema: EVIDENCE_SCHEMA,
    instanceId: instance.instanceId,
    parentEvidenceHash,
    preimageHash,
    observationHash,
    receiptHash,
  });
  return Object.freeze({
    schema: EVIDENCE_SCHEMA,
    instanceId: instance.instanceId,
    parentEvidenceHash,
    preimageHash,
    observationHash,
    receiptHash,
    evidenceHash,
  });
}
