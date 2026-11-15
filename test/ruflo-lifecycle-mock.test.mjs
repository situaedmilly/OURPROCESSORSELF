import test from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "../src/evidence/hash.mjs";
import {
  createLifecycleRequest,
  LIFECYCLE_OPERATION,
  LIFECYCLE_CAPABILITY,
} from "../contracts/lifecycle.mjs";
import {
  DeterministicMockLifecycleAdapter,
  MOCK_ADAPTER_SCHEMA,
} from "../src/lifecycle/mock-adapter.mjs";

const NOW = Date.parse("2026-11-15T20:00:00.000Z");
const HOST = "mock-host:ourself-test-host-01";
const common = {
  agentId: "RUFLO_AGENT_001",
  realizationId: "RUFLO_REALIZATION_001",
  hostIdentityId: HOST,
  requesterIdentity: "test-founder-identity",
  issuedAt: "2026-11-15T19:59:00.000Z",
  expiresAt: "2026-11-15T20:05:00.000Z",
  authorizationRef: "TEST_ONLY:AUTH-001",
  policyVersion: "SELFMOAT-MOCK-POLICY-v0.1",
};

function request(operation, requestId, extra = {}) {
  return createLifecycleRequest({
    ...common,
    operation,
    requestId,
    nonce: `nonce-${requestId}`,
    ...extra,
  });
}

function admissionFor(req, overrides = {}) {
  return {
    status: "ADMITTED",
    requestId: req.requestId,
    requesterIdentity: req.requesterIdentity,
    agentId: req.agentId,
    realizationId: req.realizationId,
    hostIdentityId: req.hostIdentityId,
    capability: req.capability,
    scope: { ...req.scope },
    issuedAt: req.issuedAt,
    expiresAt: req.expiresAt,
    nonce: req.nonce,
    authorizationRef: req.authorizationRef,
    policyVersion: req.policyVersion,
    fixtureSignature: "TEST_ONLY_VALID_FIXTURE",
    ...overrides,
  };
}

function adapter() {
  return new DeterministicMockLifecycleAdapter({
    hostIdentityId: HOST,
    verifyAdmission: ({ admission }) => admission.fixtureSignature === "TEST_ONLY_VALID_FIXTURE",
  });
}

test("START, OBSERVE, STOP are deterministic simulation only", () => {
  const a = adapter();
  const start = request(LIFECYCLE_OPERATION.START, "REQ-START-001");
  const started = a.execute({ request: start, admission: admissionFor(start), nowMs: NOW });

  assert.equal(started.status, "SIMULATED");
  assert.equal(started.effect, "SIMULATED_START");
  assert.equal(started.instance.status, "SIMULATED_ACTIVE");
  assert.equal(started.instance.isRealProcess, false);
  assert.equal(started.instance.pid, null);
  assert.equal(started.instance.hostAttestationRef, null);
  assert.equal(started.state.adapterSchema, MOCK_ADAPTER_SCHEMA);
  assert.equal(started.state.realHostActuation, false);
  assert.equal(started.receipt.effectObserved, false);

  const observe = request(LIFECYCLE_OPERATION.OBSERVE, "REQ-OBSERVE-001", {
    processInstanceId: started.instance.processInstanceId,
  });
  const observed = a.execute({ request: observe, admission: admissionFor(observe), nowMs: NOW });
  assert.equal(observed.effect, "MOCK_OBSERVATION_ONLY");
  assert.equal(observed.instance.status, "SIMULATED_ACTIVE");

  const stop = request(LIFECYCLE_OPERATION.STOP, "REQ-STOP-001", {
    processInstanceId: started.instance.processInstanceId,
  });
  const stopped = a.execute({ request: stop, admission: admissionFor(stop), nowMs: NOW });
  assert.equal(stopped.effect, "SIMULATED_STOP");
  assert.equal(stopped.instance.status, "SIMULATED_STOPPED");
  assert.equal(stopped.state.realHostActuation, false);
});

test("missing, invalid, expired, mismatched and replayed admission fail closed", () => {
  const a = adapter();
  const missing = request(LIFECYCLE_OPERATION.START, "REQ-MISSING");
  assert.equal(a.execute({ request: missing, nowMs: NOW }).reason, "ADMISSION_MISSING");

  const invalid = request(LIFECYCLE_OPERATION.START, "REQ-INVALID");
  assert.equal(
    a.execute({ request: invalid, admission: admissionFor(invalid, { fixtureSignature: "BAD" }), nowMs: NOW }).reason,
    "ADMISSION_VERIFICATION_FAILED",
  );

  const expired = request(LIFECYCLE_OPERATION.START, "REQ-EXPIRED", {
    expiresAt: "2026-11-15T19:59:59.000Z",
  });
  assert.equal(a.execute({ request: expired, admission: admissionFor(expired), nowMs: NOW }).reason, "REQUEST_EXPIRED");

  const scope = request(LIFECYCLE_OPERATION.START, "REQ-SCOPE");
  assert.equal(
    a.execute({ request: scope, admission: admissionFor(scope, { scope: { ...scope.scope, hostIdentityId: "mock-host:other" } }), nowMs: NOW }).reason,
    "ADMISSION_SCOPE_MISMATCH",
  );

  const replay = request(LIFECYCLE_OPERATION.START, "REQ-REPLAY");
  assert.equal(a.execute({ request: replay, admission: admissionFor(replay), nowMs: NOW }).status, "SIMULATED");
  assert.equal(a.execute({ request: replay, admission: admissionFor(replay), nowMs: NOW }).reason, "REQUEST_REPLAY");
});

test("default verifier denies all admission claims", () => {
  const a = new DeterministicMockLifecycleAdapter({ hostIdentityId: HOST });
  const req = request(LIFECYCLE_OPERATION.START, "REQ-DEFAULT-DENY");
  const result = a.execute({ request: req, admission: admissionFor(req), nowMs: NOW });
  assert.equal(result.status, "DENIED");
  assert.equal(result.reason, "ADMISSION_VERIFICATION_FAILED");
  assert.equal(result.state.instances.length, 0);
});

test("request payload tampering is detected before simulated state change", () => {
  const a = adapter();
  const req = request(LIFECYCLE_OPERATION.START, "REQ-TAMPER");
  const tampered = Object.freeze({ ...req, requesterIdentity: "attacker" });
  const result = a.execute({ request: tampered, admission: admissionFor(req), nowMs: NOW });
  assert.equal(result.status, "DENIED");
  assert.equal(result.reason, "REQUEST_DIGEST_MISMATCH");
  assert.equal(result.state.instances.length, 0);
});

test("receipts form a deterministic hash chain", () => {
  const a = adapter();
  const req1 = request(LIFECYCLE_OPERATION.START, "REQ-CHAIN-1");
  const one = a.execute({ request: req1, admission: admissionFor(req1), nowMs: NOW });
  const req2 = request(LIFECYCLE_OPERATION.OBSERVE, "REQ-CHAIN-2", {
    processInstanceId: one.instance.processInstanceId,
  });
  const two = a.execute({ request: req2, admission: admissionFor(req2), nowMs: NOW });
  assert.equal(two.receipt.sequence, 1);
  assert.equal(two.receipt.previousReceiptHash, one.receipt.receiptHash);
  assert.match(two.receipt.receiptHash, /^[0-9a-f]{64}$/);
  assert.equal(sha256({ ...two.receipt, receiptHash: undefined }).length, 64);
});
