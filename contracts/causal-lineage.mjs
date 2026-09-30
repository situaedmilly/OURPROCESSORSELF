export const CAUSAL_LINEAGE_SCHEMA = "OURSELF.CAUSAL.LINEAGE.v0.1";

export const CAUSAL_STATUS = Object.freeze({
  REJECTED: "REJECTED",
  ADMITTED: "ADMITTED",
  EXECUTED: "EXECUTED",
  WITNESSED: "WITNESSED",
});

export const CAUSAL_STAGE = Object.freeze({
  MESSAGE: "MCP_MESSAGE",
  PROPOSAL: "PROPOSAL",
  ADMISSION: "ADMISSION",
  INSTANCE: "INSTANCE",
  TRANSITION: "REPOSITORY_TRANSITION",
  EXECUTION: "LEVEL_0_EXECUTION",
  RECEIPT: "PROCESSOR_RECEIPT",
  EVIDENCE: "SEALED_EVIDENCE",
  STATE: "REPOSITORY_STATE",
});

export function createCausalLineage(stages) {
  for (const stage of Object.values(CAUSAL_STAGE)) {
    if (!stages?.[stage]) throw new TypeError(`missing causal stage: ${stage}`);
  }
  return Object.freeze({
    schema: CAUSAL_LINEAGE_SCHEMA,
    status: CAUSAL_STATUS.WITNESSED,
    stages: Object.freeze({...stages}),
  });
}
