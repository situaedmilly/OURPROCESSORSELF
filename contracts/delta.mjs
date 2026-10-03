export const DELTA_SCHEMA = "OURSELF.CONTINUATION.DELTA.v0.1";

function freezeArray(value) {
  return Object.freeze(Array.isArray(value) ? [...value] : []);
}

export function createDelta({
  graphPreimage,
  observedState,
  desiredState,
  differences,
  candidateMutations,
  authorityContext,
  capabilityContext,
  invariants,
  stopConditions,
  escalationConditions,
  causalParent = null,
  proposalId = null,
} = {}) {
  if (!graphPreimage || !observedState || !desiredState) {
    throw new TypeError("graphPreimage, observedState, and desiredState are required");
  }
  return Object.freeze({
    schema: DELTA_SCHEMA,
    graphPreimage,
    observedState,
    desiredState,
    differences: freezeArray(differences),
    candidateMutations: freezeArray(candidateMutations),
    authorityContext: authorityContext ?? Object.freeze({}),
    capabilityContext: capabilityContext ?? Object.freeze({}),
    invariants: freezeArray(invariants),
    stopConditions: freezeArray(stopConditions),
    escalationConditions: freezeArray(escalationConditions),
    causalParent,
    proposalId,
  });
}
