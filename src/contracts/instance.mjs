export const INSTANCE_SCHEMA = "OURSELF.PROCESSOR.EXECUTION_INSTANCE.v0.2";

export function createInstance({
  instanceId,
  parentInstance=null,
  eventId,
  proposalId,
  policyVersion,
  processorVersion,
  programHash,
  preStateHash,
  capabilityCommitment,
  executionBounds={maxCycles:16},
  status="PROPOSED",
}={}) {
  if (!instanceId || !eventId || !proposalId) throw new TypeError("instanceId, eventId and proposalId are required");
  if (!Number.isInteger(executionBounds.maxCycles) || executionBounds.maxCycles < 1) {
    throw new RangeError("executionBounds.maxCycles must be a positive integer");
  }
  return Object.freeze({
    schema: INSTANCE_SCHEMA,
    instanceId,
    parentInstance,
    eventId,
    proposalId,
    policyVersion,
    processorVersion,
    programHash,
    preStateHash,
    capabilityCommitment,
    executionBounds: Object.freeze({...executionBounds}),
    status,
    receiptId: null,
  });
}
