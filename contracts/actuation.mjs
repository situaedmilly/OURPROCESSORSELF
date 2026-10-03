export const ACTUATION_SCHEMA = "OURSELF.CAUSAL.ACTUATION.v0.1";
export const ACTUATION_STAGE = Object.freeze({REQUEST:"ACTUATION_REQUEST",ADMISSION:"ACTUATOR_ADMISSION",RECEIPT:"ACTUATOR_RECEIPT",STATE:"ACTUAL_REPOSITORY_STATE"});
export function createActuationRequest({transitionReceipt,targetSurface,expectedPreRef,expectedPreCommit,requestedPostCommit}={}) {
  if (!transitionReceipt?.receiptHash) throw new TypeError("transitionReceipt is required");
  if (!targetSurface || !expectedPreRef || !expectedPreCommit || !requestedPostCommit) throw new TypeError("complete actuation request is required");
  return Object.freeze({schema:ACTUATION_SCHEMA,operation:"UPDATE_REF",transitionReceiptHash:transitionReceipt.receiptHash,targetSurface,expectedPreRef,expectedPreCommit,requestedPostCommit});
}
