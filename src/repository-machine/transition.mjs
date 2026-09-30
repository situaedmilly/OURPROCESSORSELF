import {createHash} from "node:crypto";
import {SURFACE_ROLE} from "../../contracts/repository-machine.mjs";
import {evaluateTransition} from "./admission.mjs";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function proposeTransition({machine, from, to, operation, authorized=false, bounded=true, metadata={}}={}) {
  if (!machine?.surfaces?.[from] || !machine?.surfaces?.[to]) throw new TypeError("transition references unknown machine surface");
  if (!Object.hasOwn(SURFACE_ROLE, from) || !Object.hasOwn(SURFACE_ROLE, to)) throw new TypeError("unknown machine surface");
  const admission = evaluateTransition({from, to, operation, authorized, bounded});
  const proposal = {
    schema: "OURSELF.GITHUBCOMPUTERMORPH.TRANSITION_PROPOSAL.v0.1",
    from,
    to,
    operation,
    fromCommit: machine.surfaces[from].commit,
    toCommit: machine.surfaces[to].commit,
    admission: admission.status,
    metadata,
  };
  return Object.freeze({...proposal, proposalHash: hash(proposal)});
}

export function executeTransition({machine, proposal, targetCommit}={}) {
  if (proposal?.admission !== "ADMITTED") throw new Error("transition is not admitted");
  if (!targetCommit) throw new TypeError("targetCommit is required");
  const previous = machine.surfaces[proposal.from];
  const next = Object.freeze({
    ...previous,
    surface: proposal.to,
    commit: targetCommit,
    status: "TRANSITIONED",
  });
  const receiptBody = {
    schema: "OURSELF.GITHUBCOMPUTERMORPH.TRANSITION_RECEIPT.v0.1",
    proposalHash: proposal.proposalHash,
    from: proposal.from,
    to: proposal.to,
    operation: proposal.operation,
    preCommit: previous.commit,
    postCommit: targetCommit,
  };
  return Object.freeze({
    state: next,
    receipt: Object.freeze({...receiptBody, receiptHash: hash(receiptBody)}),
  });
}
