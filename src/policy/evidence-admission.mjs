import {sha256} from "../evidence/hash.mjs";

export const EVIDENCE_ADMISSION_SCHEMA = "OURSELF.PROCESSOR.EVIDENCE_ADMISSION.v0.3";

export function admitEvidence({instance, receipt, evidence}={}) {
  const reasons=[];
  if (!instance || !receipt || !evidence) reasons.push("MISSING_EVIDENCE_INPUT");
  else {
    if (receipt.instanceId !== instance.instanceId) reasons.push("RECEIPT_INSTANCE_MISMATCH");
    if (evidence.instanceId !== instance.instanceId) reasons.push("EVIDENCE_INSTANCE_MISMATCH");
    const expectedReceiptHash=sha256(receipt);
    if (evidence.receiptHash !== expectedReceiptHash) reasons.push("RECEIPT_HASH_MISMATCH");
    const expectedEvidenceHash=sha256({
      schema:evidence.schema,
      instanceId:evidence.instanceId,
      parentEvidenceHash:evidence.parentEvidenceHash,
      preimageHash:evidence.preimageHash,
      observationHash:evidence.observationHash,
      receiptHash:evidence.receiptHash,
    });
    if (evidence.evidenceHash !== expectedEvidenceHash) reasons.push("EVIDENCE_HASH_MISMATCH");
  }
  return Object.freeze({
    schema:EVIDENCE_ADMISSION_SCHEMA,
    status:reasons.length ? "REJECTED" : "ADMITTED",
    reasons:Object.freeze(reasons),
    evidenceId:evidence?.evidenceHash ?? null,
  });
}
