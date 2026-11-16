import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function eventDigest(event) {
  const { event_sha256: _omitted, ...preimage } = event;
  return hash(JSON.stringify(canonical(preimage)));
}
const phases = ["PROPOSED", "AUTHORIZED", "ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"];

/** Verifies a complete journal segment beginning at sequence zero. */
export function verifyTransitionJournal(events) {
  const errors = [];
  if (!Array.isArray(events) || events.length === 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(["JOURNAL_EVENTS_REQUIRED"]) });
  }
  const ids = new Set();
  const nonceOwners = new Map();
  const byTransition = new Map();
  let previousDigest = null;

  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      errors.push(`EVENT_NOT_OBJECT:${index}`);
      continue;
    }
    if (event.schema !== "ourdata.transition-event.v1") errors.push(`EVENT_SCHEMA_INVALID:${index}`);
    if (ids.has(event.event_id)) errors.push(`DUPLICATE_EVENT_ID:${event.event_id}`);
    ids.add(event.event_id);
    if (event.journal_sequence !== index) errors.push(`JOURNAL_SEQUENCE_GAP:${event.event_id}`);
    if (event.previous_event_sha256 !== previousDigest) errors.push(`PREVIOUS_EVENT_DIGEST_MISMATCH:${event.event_id}`);
    if (!/^[a-f0-9]{64}$/.test(event.nonce ?? "")) errors.push(`INVALID_NONCE:${event.event_id}`);
    const owner = nonceOwners.get(event.nonce);
    if (owner && owner !== event.transition_id) errors.push(`NONCE_REPLAY:${event.event_id}`);
    nonceOwners.set(event.nonce, event.transition_id);

    let calculated;
    try { calculated = eventDigest(event); }
    catch { errors.push(`EVENT_CANONICALIZATION_FAILED:${event.event_id}`); }
    if (calculated && calculated !== event.event_sha256) errors.push(`EVENT_DIGEST_MISMATCH:${event.event_id}`);
    previousDigest = event.event_sha256;

    const list = byTransition.get(event.transition_id) ?? [];
    list.push(event);
    byTransition.set(event.transition_id, list);
  }

  for (const [transitionId, list] of byTransition) {
    const first = list[0];
    const invariant = ["reality_id", "instance_id", "object_id", "operation", "nonce"];
    for (const event of list) {
      for (const key of invariant) if (event[key] !== first[key]) errors.push(`TRANSITION_BINDING_CHANGED:${transitionId}:${key}`);
      if (JSON.stringify(canonical(event.target)) !== JSON.stringify(canonical(first.target))) errors.push(`TRANSITION_TARGET_CHANGED:${transitionId}`);
      if (JSON.stringify(canonical(event.preimage)) !== JSON.stringify(canonical(first.preimage))) errors.push(`TRANSITION_PREIMAGE_CHANGED:${transitionId}`);
    }
    const positive = list.map((event) => event.event_type);
    const phaseIndexes = positive.map((phase) => phases.indexOf(phase));
    if (phaseIndexes.some((phase) => phase < 0)) {
      if (!positive.every((phase) => ["REJECTED", "QUARANTINED", "RETIRED"].includes(phase))) errors.push(`INVALID_TERMINAL_EVENT_SEQUENCE:${transitionId}`);
    } else {
      for (let i = 1; i < phaseIndexes.length; i++) {
        if (phaseIndexes[i] !== phaseIndexes[i - 1] + 1) errors.push(`TRANSITION_PHASE_GAP_OR_REORDER:${transitionId}`);
      }
    }
    if (["CREATE"].includes(first.operation)) {
      if (first.preimage?.expected_sha256 !== null || first.preimage?.expected_object_sequence !== 0) errors.push(`CREATE_PREIMAGE_INVALID:${transitionId}`);
    } else if (!first.preimage?.expected_sha256 || !Number.isInteger(first.preimage?.expected_object_sequence)) {
      errors.push(`NON_CREATE_PREIMAGE_REQUIRED:${transitionId}`);
    }
    for (const event of list) {
      if (["ACTUATED", "OBSERVED", "RECONTACTED"].includes(event.event_type)) {
        const result = event.result;
        if (!result?.payload_sha256 || !result?.envelope_sha256 || !Number.isInteger(result?.object_sequence)) errors.push(`RESULT_BINDING_REQUIRED:${event.event_id}`);
        if (result?.object_sequence !== first.preimage?.expected_object_sequence + 1) errors.push(`RESULT_SEQUENCE_MISMATCH:${event.event_id}`);
        if (event.target?.object_key !== `sha256:${result?.payload_sha256}`) errors.push(`TARGET_CONTENT_KEY_MISMATCH:${event.event_id}`);
      }
      if (["ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"].includes(event.event_type) &&
          (!event.authority?.authority_ref || !event.authority?.admission_ref)) errors.push(`AUTHORITY_ADMISSION_REQUIRED:${event.event_id}`);
      if (event.event_type === "OBSERVED" && !(event.evidence?.observation_refs?.length)) errors.push(`OBSERVATION_EVIDENCE_REQUIRED:${event.event_id}`);
      if (event.event_type === "RECONTACTED" && !(event.evidence?.receipt_refs?.length)) errors.push(`RECONTACT_RECEIPT_REQUIRED:${event.event_id}`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    limitations: Object.freeze([
      "COMPLETE_PERSISTENT_JOURNAL_CUSTODY_NOT_ESTABLISHED",
      "AUTHORITY_REFERENCES_NOT_RESOLVED",
      "INDEPENDENT_CUSTODY_NOT_VERIFIED",
      "INDEPENDENT_WITNESS_NOT_VERIFIED",
    ]),
  });
}
