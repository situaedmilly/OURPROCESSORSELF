import {sha256} from "../evidence/hash.mjs";

export const NEXT_PROPOSAL_SCHEMA = "OURSELF.CONTINUATION.NEXT_PROPOSAL.v0.1";

export function generateNextProposal(delta, {
  mutation,
  authorityRequired = null,
  capabilityRequired = null,
} = {}) {
  if (!delta?.schema?.includes("DELTA")) throw new TypeError("valid DELTA is required");
  if (delta.differences.length === 0) {
    return Object.freeze({schema: NEXT_PROPOSAL_SCHEMA, status: "REALIZED", reason: "DESIRED_STATE_REALIZED"});
  }
  if (!mutation) {
    return Object.freeze({schema: NEXT_PROPOSAL_SCHEMA, status: "BOUNDARY_UPRISE", reason: "NO_VALID_MUTATION"});
  }
  const authority = authorityRequired ?? mutation.authority ?? null;
  const capability = capabilityRequired ?? mutation.capability ?? mutation.operation ?? null;
  const allowedCapabilities = delta.capabilityContext?.capabilities ?? [];
  const authorityCapabilities = delta.authorityContext?.capabilities ?? [];
  const authorized = authority !== null
    && authorityCapabilities.includes(capability)
    && allowedCapabilities.includes(capability);
  if (!authorized) {
    return Object.freeze({
      schema: NEXT_PROPOSAL_SCHEMA,
      status: "BOUNDARY_UPRISE",
      reason: "INSUFFICIENT_AUTHORITY",
      capability,
      authority,
    });
  }
  const body = Object.freeze({
    schema: NEXT_PROPOSAL_SCHEMA,
    status: "PROPOSED",
    mutation: Object.freeze({...mutation}),
    authority,
    capability,
    deltaHash: sha256(delta),
  });
  return Object.freeze({...body, proposalId: "proposal_" + sha256(body).slice(0, 24)});
}
