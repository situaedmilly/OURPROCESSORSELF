import {evaluatePurge} from "./admission.mjs";

export function planPurge({machine, canonicalCommit, authorized=false, bounded=true}={}) {
  if (!machine?.surfaces?.main) throw new TypeError("machine main surface is required");
  if (!canonicalCommit) throw new TypeError("canonicalCommit is required");
  const admission = evaluatePurge({authorized, bounded});
  const targets = Object.fromEntries(
    admission.targets.map((surface) => [surface, {
      fromCommit: machine.surfaces[surface].commit,
      toCommit: canonicalCommit,
    }])
  );
  return Object.freeze({
    schema: "OURSELF.GITHUBCOMPUTERMORPH.PURGE_PLAN.v0.1",
    canonicalSurface: "main",
    canonicalCommit,
    admission,
    targets,
  });
}
