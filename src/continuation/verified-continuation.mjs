import {createSelfGraph, differentiateSelfGraph, updateSelfGraph} from "./differentiate.mjs";
import {generateNextProposal} from "./proposal.mjs";

export const VERIFIED_CONTINUATION_SCHEMA = "OURSELF.CONTINUATION.VERIFIED.v0.1";

export async function runVerifiedContinuation({
  observedState,
  desiredState,
  authorityContext,
  capabilityContext,
  mutation,
  invariants = [],
  stopConditions = [],
  escalationConditions = [],
  causalParent = null,
  executeProposal,
  maxCycles = 8,
} = {}) {
  if (typeof executeProposal !== "function") throw new TypeError("executeProposal is required");
  if (!Number.isInteger(maxCycles) || maxCycles < 1) throw new RangeError("maxCycles must be >= 1");

  let graph = createSelfGraph({
    observedState,
    desiredState,
    authorityContext,
    capabilityContext,
    causalParent,
  });
  const cycles = [];

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    const differentiated = differentiateSelfGraph(graph, {
      invariants,
      stopConditions,
      escalationConditions,
      causalParent,
    });
    const proposal = generateNextProposal(differentiated.delta, {mutation});

    if (proposal.status === "REALIZED") {
      return Object.freeze({
        schema: VERIFIED_CONTINUATION_SCHEMA,
        status: "DESIRED_STATE_REALIZED",
        cycles: Object.freeze(cycles),
        graph,
        delta: differentiated.delta,
        proposal,
      });
    }

    if (proposal.status !== "PROPOSED") {
      return Object.freeze({
        schema: VERIFIED_CONTINUATION_SCHEMA,
        status: "BOUNDARY_UPRISE",
        reason: proposal.reason,
        cycles: Object.freeze(cycles),
        graph,
        delta: differentiated.delta,
        proposal,
      });
    }

    const execution = await executeProposal(Object.freeze({
      proposal,
      delta: differentiated.delta,
      graph,
      cycle,
    }));

    if (execution?.status !== "ACTUATION_EXECUTED") {
      return Object.freeze({
        schema: VERIFIED_CONTINUATION_SCHEMA,
        status: "BOUNDARY_UPRISE",
        reason: execution?.reason ?? "ACTUATION_FAILED",
        cycles: Object.freeze([...cycles, Object.freeze({cycle, proposal, execution})]),
        graph,
        delta: differentiated.delta,
        proposal,
      });
    }

    if (!execution.actualState) {
      throw new Error("ACTUATION_EXECUTED requires verified actualState");
    }

    graph = updateSelfGraph(graph, {
      actualState: execution.actualState,
      causalParent: proposal.proposalId,
      status: "ACTUAL_VERIFIED",
    });

    cycles.push(Object.freeze({
      cycle,
      proposal,
      execution: Object.freeze({
        status: execution.status,
        actualState: execution.actualState,
        receipt: execution.receipt ?? null,
      }),
    }));
  }

  return Object.freeze({
    schema: VERIFIED_CONTINUATION_SCHEMA,
    status: "BOUNDARY_UPRISE",
    reason: "MAX_CYCLES_REACHED",
    cycles: Object.freeze(cycles),
    graph,
  });
}
