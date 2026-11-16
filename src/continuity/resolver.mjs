import { createHash } from "node:crypto";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Resolve declared continuity references against an admitted, read-only DATASELF adapter.
 * Adapter contract:
 *   resolveEnvelope(envelopeId) -> canonical envelope object | null
 *   readPayload(envelope) -> Uint8Array | Buffer | null
 *   resolveTransitionEvent(eventId) -> canonical transition event | null
 *
 * This function performs exact envelope/payload binding checks and reference resolution.
 * It does not establish custody independence, authority, journal completeness, or witness independence.
 */
export async function resolveContinuityEvidence(profile, adapter) {
  const errors = [];
  const resolved = [];
  if (!adapter || typeof adapter.resolveEnvelope !== "function" ||
      typeof adapter.readPayload !== "function" ||
      typeof adapter.resolveTransitionEvent !== "function") {
    return Object.freeze({ resolved: false, errors: Object.freeze(["READ_ONLY_DATASELF_ADAPTER_REQUIRED"]), components: Object.freeze([]) });
  }

  for (const component of profile?.components ?? []) {
    const binding = component?.envelope_binding;
    if (!binding) {
      errors.push(`ENVELOPE_BINDING_ABSENT:${component?.component_id ?? "UNKNOWN"}`);
      continue;
    }
    let envelope;
    try { envelope = await adapter.resolveEnvelope(binding.envelope_id); }
    catch { errors.push(`ENVELOPE_LOOKUP_FAILED:${component.component_id}`); continue; }
    if (!envelope) {
      errors.push(`ENVELOPE_NOT_FOUND:${component.component_id}`);
      continue;
    }
    if (envelope.schema !== "ourdata.envelope.v1") errors.push(`ENVELOPE_SCHEMA_MISMATCH:${component.component_id}`);
    for (const field of ["envelope_id", "object_id", "reality_id", "instance_id"]) {
      if (envelope[field] !== binding[field]) errors.push(`ENVELOPE_${field.toUpperCase()}_MISMATCH:${component.component_id}`);
    }
    const payload = envelope.payload;
    if (!payload || payload.sha256 !== binding.payload_sha256 ||
        payload.byte_count !== binding.byte_count ||
        payload.content_key !== binding.content_key) {
      errors.push(`ENVELOPE_PAYLOAD_DECLARATION_MISMATCH:${component.component_id}`);
    }
    if (envelope.lifecycle !== binding.lifecycle) errors.push(`ENVELOPE_LIFECYCLE_MISMATCH:${component.component_id}`);
    if (envelope.lifecycle !== "INTEGRITY_VERIFIED" || envelope.verification?.integrity !== "MATCH") {
      errors.push(`ENVELOPE_NOT_INTEGRITY_VERIFIED:${component.component_id}`);
    }

    let bytes;
    try { bytes = await adapter.readPayload(envelope); }
    catch { errors.push(`PAYLOAD_READ_FAILED:${component.component_id}`); continue; }
    if (!(bytes instanceof Uint8Array)) {
      errors.push(`PAYLOAD_BYTES_UNAVAILABLE:${component.component_id}`);
      continue;
    }
    const digest = sha256(bytes);
    if (bytes.byteLength !== binding.byte_count || digest !== binding.payload_sha256) {
      errors.push(`PAYLOAD_INTEGRITY_MISMATCH:${component.component_id}`);
    }

    for (const eventId of binding.transition_event_refs) {
      let event;
      try { event = await adapter.resolveTransitionEvent(eventId); }
      catch { errors.push(`TRANSITION_LOOKUP_FAILED:${eventId}`); continue; }
      if (!event) {
        errors.push(`TRANSITION_EVENT_NOT_FOUND:${eventId}`);
        continue;
      }
      if (event.schema !== "ourdata.transition-event.v1" || event.event_id !== eventId ||
          event.object_id !== binding.object_id || event.reality_id !== binding.reality_id ||
          event.instance_id !== binding.instance_id || event.target?.envelope_id !== binding.envelope_id) {
        errors.push(`TRANSITION_EVENT_BINDING_MISMATCH:${eventId}`);
      }
    }
    resolved.push(component.component_id);
  }

  return Object.freeze({
    resolved: errors.length === 0 && resolved.length === (profile?.components?.length ?? -1),
    errors: Object.freeze([...new Set(errors)]),
    components: Object.freeze(resolved),
    limitations: Object.freeze([
      "TRANSITION_JOURNAL_COMPLETENESS_AND_HASH_CHAIN_NOT_VERIFIED",
      "AUTHORITY_AND_ADMISSION_REFERENCES_NOT_RESOLVED",
      "INDEPENDENT_CUSTODY_NOT_VERIFIED",
      "WITNESS_INDEPENDENCE_NOT_VERIFIED",
    ]),
  });
}
