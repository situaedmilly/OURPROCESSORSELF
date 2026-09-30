import {createEvent} from "./contracts/event.mjs";
import {createInstance} from "./contracts/instance.mjs";
import {evaluateAdmission} from "./policy/admission.mjs";
import {OurselfProcessor} from "./processor.mjs";

export class ProcessorControlPlane {
  constructor({processorVersion="OURSELF-ISA@0.1", policyVersion="policy@0.2", authority=false, actuatable=false}={}) {
    this.processorVersion = processorVersion;
    this.policyVersion = policyVersion;
    this.authority = authority;
    this.actuatable = actuatable;
  }

  admit({event, proposalId, instanceId, program, preStateHash="UNSEALED", capabilityCommitment="UNSEALED", maxCycles=16}={}) {
    const admission = evaluateAdmission({
      event,
      authority: this.authority,
      actuatable: this.actuatable,
      bounds: {maxCycles},
    });

    const instance = createInstance({
      instanceId,
      eventId: event.eventId,
      proposalId,
      policyVersion: this.policyVersion,
      processorVersion: this.processorVersion,
      programHash: hashBytes(program),
      preStateHash,
      capabilityCommitment,
      executionBounds: {maxCycles},
      status: admission.status,
    });

    if (admission.status !== "ADMITTED") return Object.freeze({admission, instance, processor: null});

    const processor = new OurselfProcessor({program});
    return Object.freeze({admission, instance, processor});
  }
}

function hashBytes(value) {
  const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value ?? []);
  let h = 2166136261;
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export {createEvent};
