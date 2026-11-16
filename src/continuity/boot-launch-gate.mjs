const REQUIRED_CHECKS = Object.freeze([
  "payload_resolution",
  "payload_integrity",
  "journal_lineage",
  "source_immutability",
  "preservation_copy",
  "independent_custody",
  "operation_authority",
  "runtime_compatibility",
  "launch_scope",
]);

/**
 * Software-side boot launch gate only. It never starts QEMU or mutates a VM.
 * Each injected verifier must return { verified: true, evidence_ref: non-empty string }.
 */
export async function evaluateBootLaunchGate(verifiers = {}) {
  const blockers = [];
  const evidence = {};
  for (const name of REQUIRED_CHECKS) {
    const verify = verifiers[name];
    if (typeof verify !== "function") {
      blockers.push(`VERIFIER_NOT_CONFIGURED:${name}`);
      continue;
    }
    let result;
    try { result = await verify(); }
    catch { blockers.push(`VERIFIER_FAILED:${name}`); continue; }
    if (result?.verified !== true || typeof result.evidence_ref !== "string" || !result.evidence_ref.trim()) {
      blockers.push(`EVIDENCE_NOT_VERIFIED:${name}`);
      continue;
    }
    evidence[name] = result.evidence_ref;
  }
  const ready = blockers.length === 0;
  return Object.freeze({
    ready,
    state: ready ? "BOOT_LAUNCH_AUTHORIZED" : "BOOT_LAUNCH_BLOCKED",
    effect_performed: false,
    blockers: Object.freeze(blockers),
    evidence: Object.freeze(evidence),
  });
}
