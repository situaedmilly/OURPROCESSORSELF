import { sha256 } from "./hash.mjs";

export const EVIDENCE_SCHEMA = "OURSELF.PROCESSOR.EXECUTION_EVIDENCE.v0.1";

export function sealExecutionEvidence({
  processorVersion = "OURPROCESSORSELF@0.1",
  isa,
  program,
  preState,
  receipts,
  postState,
  previousEvidenceHash = null,
} = {}) {
  const programHash = sha256(Array.from(program ?? []));
  const preStateHash = sha256(preState);
  const postStateHash = sha256(postState);
  const receiptHashes = (receipts ?? []).map((receipt) => sha256(receipt));

  const evidence = {
    schema: EVIDENCE_SCHEMA,
    processorVersion,
    isa,
    programHash,
    preStateHash,
    receiptHashes,
    postStateHash,
    previousEvidenceHash,
  };

  return Object.freeze({
    ...evidence,
    evidenceHash: sha256(evidence),
  });
}
