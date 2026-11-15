import { sha256 } from "../src/evidence/hash.mjs";

export const LIFECYCLE_REQUEST_SCHEMA = "OURSELF.LIFECYCLE.REQUEST.v0.1";
export const LIFECYCLE_OPERATION = Object.freeze({
  START: "START",
  STOP: "STOP",
  OBSERVE: "OBSERVE",
});

export const LIFECYCLE_CAPABILITY = Object.freeze({
  START: "process.start",
  STOP: "process.stop",
  OBSERVE: "process.observe",
});

const CAPABILITY_BY_OPERATION = Object.freeze({
  [LIFECYCLE_OPERATION.START]: LIFECYCLE_CAPABILITY.START,
  [LIFECYCLE_OPERATION.STOP]: LIFECYCLE_CAPABILITY.STOP,
  [LIFECYCLE_OPERATION.OBSERVE]: LIFECYCLE_CAPABILITY.OBSERVE,
});

function requiredText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function validTime(value, name) {
  requiredText(value, name);
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${name} must be a parseable timestamp`);
  }
  return value;
}

export function lifecycleRequestDigestPayload(request) {
  return {
    schema: request.schema,
    requestId: request.requestId,
    operation: request.operation,
    agentId: request.agentId,
    realizationId: request.realizationId,
    hostIdentityId: request.hostIdentityId,
    requesterIdentity: request.requesterIdentity,
    capability: request.capability,
    processInstanceId: request.processInstanceId ?? null,
    scope: request.scope,
    issuedAt: request.issuedAt,
    expiresAt: request.expiresAt,
    nonce: request.nonce,
    authorizationRef: request.authorizationRef,
    policyVersion: request.policyVersion,
  };
}

/**
 * Create an immutable, digest-bound lifecycle request.
 * This creates a request, not an admission or an actuation.
 */
export function createLifecycleRequest(input = {}) {
  const operation = requiredText(input.operation, "operation");
  const capability = CAPABILITY_BY_OPERATION[operation];
  if (!capability) throw new TypeError("unsupported lifecycle operation");
  if (input.capability !== undefined && input.capability !== capability) {
    throw new TypeError("capability does not match lifecycle operation");
  }

  const request = {
    schema: LIFECYCLE_REQUEST_SCHEMA,
    requestId: requiredText(input.requestId, "requestId"),
    operation,
    agentId: requiredText(input.agentId, "agentId"),
    realizationId: requiredText(input.realizationId, "realizationId"),
    hostIdentityId: requiredText(input.hostIdentityId, "hostIdentityId"),
    requesterIdentity: requiredText(input.requesterIdentity, "requesterIdentity"),
    capability,
    processInstanceId: input.processInstanceId ?? null,
    scope: Object.freeze({
      hostIdentityId: requiredText(input.hostIdentityId, "hostIdentityId"),
      agentId: requiredText(input.agentId, "agentId"),
      realizationId: requiredText(input.realizationId, "realizationId"),
    }),
    issuedAt: validTime(input.issuedAt, "issuedAt"),
    expiresAt: validTime(input.expiresAt, "expiresAt"),
    nonce: requiredText(input.nonce, "nonce"),
    authorizationRef: requiredText(input.authorizationRef, "authorizationRef"),
    policyVersion: requiredText(input.policyVersion, "policyVersion"),
  };

  if (Date.parse(request.expiresAt) <= Date.parse(request.issuedAt)) {
    throw new TypeError("expiresAt must be later than issuedAt");
  }
  if (request.operation !== LIFECYCLE_OPERATION.START && !request.processInstanceId) {
    throw new TypeError("processInstanceId is required for STOP and OBSERVE");
  }

  return Object.freeze({
    ...request,
    payloadDigest: sha256(lifecycleRequestDigestPayload(request)),
  });
}

export function requiredCapability(operation) {
  return CAPABILITY_BY_OPERATION[operation] ?? null;
}
