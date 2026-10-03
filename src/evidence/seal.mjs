import { sha256 } from "./hash.mjs";

export const EVIDENCE_SCHEMA = "OURSELF.PROCESSOR.EXECUTION_EVIDENCE.v0.1";

export function sealExecutionEvidence({
  processorVersion = "OURPROCESSORSELF@0.1",
  isa,
  program,
  preState = null,
  preStateHash = null,
  receipts = [],
  postState = null,
  postStateHash = null,
  previousEvidenceHash = null,
} = {}) {
  const programHash = sha256(Array.from(program ?? []));
  const resolvedPreStateHash = preStateHash ?? sha256(preState);
  const resolvedPostStateHash = postStateHash ?? sha256(postState);
  const receiptHashes = receipts.map((receipt) => receipt.receiptHash ?? sha256(receipt));

  const body = {
    schema: EVIDENCE_SCHEMA,
    processorVersion,
    isa,
    programHash,
    preStateHash: resolvedPreStateHash,
    receiptHashes,
    postStateHash: resolvedPostStateHash,
    previousEvidenceHash,
  };

  return Object.freeze({...body,evidenceHash:sha256(body)});
}
