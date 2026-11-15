import { sha256 } from "../evidence/hash.mjs";
import {
  LIFECYCLE_OPERATION,
  lifecycleRequestDigestPayload,
  requiredCapability,
} from "../../contracts/lifecycle.mjs";

export const MOCK_ADAPTER_SCHEMA = "OURSELF.LIFECYCLE.DETERMINISTIC_MOCK_ADAPTER.v0.1";
export const MOCK_RECEIPT_SCHEMA = "OURSELF.LIFECYCLE.MOCK_RECEIPT.v0.1";

/**
 * Deterministic lifecycle simulation.
 *
 * It does not import or call process, child_process, fs, launchd, systemd,
 * a shell, a network client, or a device API. Its state is memory-only.
 * A supplied verifier is mandatory; absent verification fails closed.
 */
export class DeterministicMockLifecycleAdapter {
  constructor({ hostIdentityId, verifyAdmission } = {}) {
    if (typeof hostIdentityId !== "string" || !hostIdentityId.startsWith("mock-host:")) {
      throw new TypeError("hostIdentityId must use the explicit mock-host: namespace");
    }
    this.hostIdentityId = hostIdentityId;
    this.verifyAdmission = typeof verifyAdmission === "function" ? verifyAdmission : () => false;
    this.instances = new Map();
    this.consumedRequestIds = new Set();
    this.receipts = [];
  }

  snapshot() {
    return Object.freeze({
      adapterSchema: MOCK_ADAPTER_SCHEMA,
      hostIdentityId: this.hostIdentityId,
      realHostActuation: false,
      instances: Object.freeze(
        [...this.instances.values()]
          .sort((a, b) => a.processInstanceId.localeCompare(b.processInstanceId))
          .map((instance) => Object.freeze({ ...instance })),
      ),
    });
  }

  execute({ request, admission, nowMs } = {}) {
    if (!request || typeof request !== "object" || !request.requestId || !request.payloadDigest) {
      throw new TypeError("a digest-bound lifecycle request is required");
    }
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be supplied for deterministic evaluation");

    const before = this.snapshot();
    let denial = this.validateRequest(request, admission, nowMs);

    if (!denial && this.consumedRequestIds.has(request.requestId)) {
      denial = "REQUEST_REPLAY";
    }
    if (!denial) this.consumedRequestIds.add(request.requestId);

    if (denial) {
      return this.record({
        request,
        decision: "DENIED",
        reason: denial,
        effect: "NONE",
        before,
        instance: null,
      });
    }

    let instance = this.instances.get(request.processInstanceId) ?? null;

    if (request.operation === LIFECYCLE_OPERATION.START) {
      const active = [...this.instances.values()].find(
        (candidate) =>
          candidate.agentId === request.agentId &&
          candidate.realizationId === request.realizationId &&
          candidate.status === "SIMULATED_ACTIVE",
      );
      if (active) {
        return this.record({
          request,
          decision: "DENIED",
          reason: "INSTANCE_ALREADY_ACTIVE",
          effect: "NONE",
          before,
          instance: active,
        });
      }

      const processInstanceId = "mockproc_" + sha256({
        hostIdentityId: this.hostIdentityId,
        agentId: request.agentId,
        realizationId: request.realizationId,
        requestId: request.requestId,
      }).slice(0, 24);

      instance = Object.freeze({
        schema: "OURSELF.PROCESS_INSTANCE.MOCK.v0.1",
        processInstanceId,
        agentId: request.agentId,
        realizationId: request.realizationId,
        hostIdentityId: this.hostIdentityId,
        status: "SIMULATED_ACTIVE",
        observationKind: "DETERMINISTIC_MOCK",
        isRealProcess: false,
        pid: null,
        processStartTime: request.issuedAt,
        hostAttestationRef: null,
      });
      this.instances.set(processInstanceId, instance);
      return this.record({
        request,
        decision: "SIMULATED",
        reason: null,
        effect: "SIMULATED_START",
        before,
        instance,
      });
    }

    if (!instance) {
      return this.record({
        request,
        decision: "DENIED",
        reason: "PROCESS_INSTANCE_NOT_FOUND",
        effect: "NONE",
        before,
        instance: null,
      });
    }

    if (
      instance.agentId !== request.agentId ||
      instance.realizationId !== request.realizationId ||
      instance.hostIdentityId !== request.hostIdentityId
    ) {
      return this.record({
        request,
        decision: "DENIED",
        reason: "PROCESS_INSTANCE_BINDING_MISMATCH",
        effect: "NONE",
        before,
        instance,
      });
    }

    if (request.operation === LIFECYCLE_OPERATION.OBSERVE) {
      return this.record({
        request,
        decision: "SIMULATED",
        reason: null,
        effect: "MOCK_OBSERVATION_ONLY",
        before,
        instance,
      });
    }

    if (request.operation === LIFECYCLE_OPERATION.STOP) {
      if (instance.status !== "SIMULATED_ACTIVE") {
        return this.record({
          request,
          decision: "DENIED",
          reason: "INSTANCE_NOT_ACTIVE",
          effect: "NONE",
          before,
          instance,
        });
      }
      instance = Object.freeze({ ...instance, status: "SIMULATED_STOPPED" });
      this.instances.set(instance.processInstanceId, instance);
      return this.record({
        request,
        decision: "SIMULATED",
        reason: null,
        effect: "SIMULATED_STOP",
        before,
        instance,
      });
    }

    return this.record({
      request,
      decision: "DENIED",
      reason: "UNSUPPORTED_OPERATION",
      effect: "NONE",
      before,
      instance: null,
    });
  }

  validateRequest(request, admission, nowMs) {
    if (request.schema !== "OURSELF.LIFECYCLE.REQUEST.v0.1") return "REQUEST_SCHEMA_INVALID";
    if (request.payloadDigest !== sha256(lifecycleRequestDigestPayload(request))) return "REQUEST_DIGEST_MISMATCH";
    if (request.hostIdentityId !== this.hostIdentityId) return "HOST_SCOPE_MISMATCH";
    if (request.scope?.hostIdentityId !== request.hostIdentityId || request.scope?.agentId !== request.agentId || request.scope?.realizationId !== request.realizationId) return "REQUEST_SCOPE_BINDING_MISMATCH";
    if (request.capability !== requiredCapability(request.operation)) return "CAPABILITY_OPERATION_MISMATCH";

    const issuedAt = Date.parse(request.issuedAt);
    const expiresAt = Date.parse(request.expiresAt);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return "REQUEST_TIME_INVALID";
    if (issuedAt > nowMs) return "REQUEST_NOT_YET_VALID";
    if (expiresAt <= nowMs) return "REQUEST_EXPIRED";

    if (!admission || admission.status !== "ADMITTED") return "ADMISSION_MISSING";
    if (
      admission.requestId !== request.requestId ||
      admission.requesterIdentity !== request.requesterIdentity ||
      admission.agentId !== request.agentId ||
      admission.realizationId !== request.realizationId ||
      admission.hostIdentityId !== request.hostIdentityId ||
      admission.capability !== request.capability ||
      admission.nonce !== request.nonce ||
      admission.authorizationRef !== request.authorizationRef ||
      admission.policyVersion !== request.policyVersion
    ) return "ADMISSION_BINDING_MISMATCH";

    if (
      admission.scope?.hostIdentityId !== request.scope.hostIdentityId ||
      admission.scope?.agentId !== request.scope.agentId ||
      admission.scope?.realizationId !== request.scope.realizationId
    ) return "ADMISSION_SCOPE_MISMATCH";

    const admissionExpiry = Date.parse(admission.expiresAt);
    const admissionIssued = Date.parse(admission.issuedAt);
    if (!Number.isFinite(admissionExpiry) || !Number.isFinite(admissionIssued)) return "ADMISSION_TIME_INVALID";
    if (admissionIssued > nowMs || admissionExpiry <= nowMs || admissionIssued > issuedAt || admissionExpiry < expiresAt) return "ADMISSION_EXPIRED";

    let verified = false;
    try {
      verified = this.verifyAdmission({ request, admission, nowMs }) === true;
    } catch {
      verified = false;
    }
    if (!verified) return "ADMISSION_VERIFICATION_FAILED";
    return null;
  }

  record({ request, decision, reason, effect, before, instance }) {
    const after = this.snapshot();
    const sequence = this.receipts.length;
    const body = {
      schema: MOCK_RECEIPT_SCHEMA,
      adapter: "DETERMINISTIC_MOCK",
      requestId: request.requestId,
      operation: request.operation,
      decision,
      reason,
      effect,
      processInstanceId: instance?.processInstanceId ?? request.processInstanceId ?? null,
      beforeStateHash: sha256(before),
      afterStateHash: sha256(after),
      previousReceiptHash: this.receipts.at(-1)?.receiptHash ?? null,
      sequence,
      realHostActuation: false,
      effectObserved: false,
    };
    const receipt = Object.freeze({ ...body, receiptHash: sha256(body) });
    this.receipts.push(receipt);
    return Object.freeze({
      status: decision,
      reason,
      effect,
      instance,
      receipt,
      state: after,
    });
  }
}
