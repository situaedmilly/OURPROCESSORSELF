export const RECEIPT_SCHEMA = "OURSELF.PROCESSOR.RECEIPT.v0.2";

export function sealReceipt({instance, executionStatus, observations=[], effect=null}={}) {
  if (!instance) throw new TypeError("instance required");
  return Object.freeze({
    schema: RECEIPT_SCHEMA,
    instanceId: instance.instanceId,
    executionStatus,
    observations: Object.freeze([...observations]),
    effect,
    evidence: Object.freeze({
      admission: instance.status === "ADMITTED",
      receiptIsEvidence: true,
      receiptIsNotEffect: true,
    }),
  });
}
