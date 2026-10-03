import {createDelta} from "../../contracts/delta.mjs";

export const SELFGRAPH_SCHEMA = "OURSELF.CONTINUATION.SELFGRAPH.v0.1";

function freeze(value) {
  return Object.freeze(value && typeof value === "object" ? {...value} : {});
}

function difference(observedState, desiredState) {
  const keys = new Set([...Object.keys(observedState), ...Object.keys(desiredState)]);
  return [...keys].sort().flatMap((key) => {
    if (observedState[key] === desiredState[key]) return [];
    return [{
      field: key,
      observed: observedState[key] ?? null,
      desired: desiredState[key] ?? null,
    }];
  });
}

export function createSelfGraph({
  observedState,
  desiredState,
  authorityContext,
  capabilityContext,
  causalParent = null,
} = {}) {
  if (!observedState || !desiredState) {
    throw new TypeError("observedState and desiredState are required");
  }
  return Object.freeze({
    schema: SELFGRAPH_SCHEMA,
    state: Object.freeze({
      observed: freeze(observedState),
      desired: freeze(desiredState),
      actual: null,
    }),
    authority: freeze(authorityContext),
    capability: freeze(capabilityContext),
    causality: Object.freeze({parent: causalParent, causes: Object.freeze([]), supersedes: null}),
  });
}

export function differentiateSelfGraph(graph, {
  candidateMutations = [],
  invariants = [],
  stopConditions = [],
  escalationConditions = [],
  causalParent = null,
  proposalId = null,
} = {}) {
  if (!graph?.state?.observed || !graph?.state?.desired) {
    throw new TypeError("SELFGRAPH requires observed and desired state");
  }
  const observedState = graph.state.actual ?? graph.state.observed;
  const desiredState = graph.state.desired;
  const differences = difference(observedState, desiredState);
  const delta = createDelta({
    graphPreimage: graph,
    observedState,
    desiredState,
    differences,
    candidateMutations,
    authorityContext: graph.authority,
    capabilityContext: graph.capability,
    invariants,
    stopConditions,
    escalationConditions,
    causalParent: causalParent ?? graph.causality.parent,
    proposalId,
  });
  return Object.freeze({
    graph,
    delta,
    realized: differences.length === 0,
  });
}

export function updateSelfGraph(graph, {
  actualState,
  causalParent = null,
  status = "OBSERVED",
} = {}) {
  if (!actualState) throw new TypeError("actualState is required");
  return Object.freeze({
    ...graph,
    state: Object.freeze({
      ...graph.state,
      actual: freeze(actualState),
      observed: freeze(actualState),
    }),
    causality: Object.freeze({
      ...graph.causality,
      parent: causalParent ?? graph.causality.parent,
    }),
    status,
  });
}
