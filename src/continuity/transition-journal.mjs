import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateJsonSchema, validateSchema } from "./json-schema.mjs";

const TRANSITION_SCHEMA = JSON.parse(readFileSync(new URL("../../contracts/dataself/ourdata-transition.v1.schema.json", import.meta.url), "utf8"));
const TRANSITION_SCHEMA_ERRORS = validateSchema(TRANSITION_SCHEMA);


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
  const errors = TRANSITION_SCHEMA_ERRORS.map((error) => "UNSUPPORTED_CANONICAL_SCHEMA:" + error);
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
    const schemaErrors = validateJsonSchema(event, TRANSITION_SCHEMA);
    if (schemaErrors.length) {
      errors.push(...schemaErrors.map((error) => `EVENT_CANONICAL_SCHEMA_INVALID:${index}:${error}`));
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
    const eventTypes = list.map((event) => event.event_type);
    const terminalTypes = ["REJECTED", "QUARANTINED", "RETIRED"];
    const terminalIndexes = eventTypes.map((type, index) => terminalTypes.includes(type) ? index : -1).filter((index) => index >= 0);
    if (first.event_type !== "PROPOSED") errors.push(`TRANSITION_MUST_BEGIN_PROPOSED:${transitionId}`);
    if (terminalIndexes.length > 1) errors.push(`CONFLICTING_TERMINAL_EVENTS:${transitionId}`);
    if (terminalIndexes.length === 1 && terminalIndexes[0] !== list.length - 1) errors.push(`TERMINAL_EVENT_NOT_FINAL:${transitionId}`);
    const positiveTypes = eventTypes.filter((type) => phases.includes(type));
    if (positiveTypes.length !== eventTypes.length - terminalIndexes.length) errors.push(`INVALID_TERMINAL_EVENT_SEQUENCE:${transitionId}`);
    const phaseIndexes = positiveTypes.map((phase) => phases.indexOf(phase));
    for (let i = 0; i < phaseIndexes.length; i++) {
      if (phaseIndexes[i] !== i) errors.push(`TRANSITION_PHASE_GAP_OR_REORDER:${transitionId}`);
    }
    if (terminalTypes.includes(eventTypes.at(-1))) {
      if (eventTypes.at(-1) === "RETIRED" && (first.operation !== "RETIRE" || positiveTypes.at(-1) !== "RECONTACTED")) {
        errors.push(`RETIREMENT_REQUIRES_RECONTACTED_RETIRE_OPERATION:${transitionId}`);
      }
      if (eventTypes.at(-1) === "REJECTED" && positiveTypes.some((type) => ["ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"].includes(type))) {
        errors.push(`REJECTION_AFTER_ADMISSION_OR_EFFECT:${transitionId}`);
      }
    }
    if (["CREATE"].includes(first.operation)) {
      if (first.preimage?.expected_sha256 !== null || first.preimage?.expected_object_sequence !== 0) errors.push(`CREATE_PREIMAGE_INVALID:${transitionId}`);
    } else if (!first.preimage?.expected_sha256 || !Number.isInteger(first.preimage?.expected_object_sequence)) {
      errors.push(`NON_CREATE_PREIMAGE_REQUIRED:${transitionId}`);
    }
    let authorizedRef = null;
    let admissionRef = null;
    let capability = first.authority?.capability;
    let committedResult = null;
    for (const event of list) {
      const authority = event.authority ?? {};
      if (event.event_type === "AUTHORIZED" || ["ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"].includes(event.event_type)) {
        if (typeof authority.authority_ref !== "string" || !authority.authority_ref.trim()) errors.push(`AUTHORITY_REFERENCE_REQUIRED:${event.event_id}`);
        if (authorizedRef === null) authorizedRef = authority.authority_ref;
        else if (authority.authority_ref !== authorizedRef) errors.push(`AUTHORITY_BINDING_CHANGED:${event.event_id}`);
      }
      if (["ADMITTED", "ACTUATED", "OBSERVED", "RECONTACTED"].includes(event.event_type)) {
        if (typeof authority.admission_ref !== "string" || !authority.admission_ref.trim()) errors.push(`ADMISSION_REFERENCE_REQUIRED:${event.event_id}`);
        if (admissionRef === null) admissionRef = authority.admission_ref;
        else if (authority.admission_ref !== admissionRef) errors.push(`ADMISSION_BINDING_CHANGED:${event.event_id}`);
      } else if (admissionRef !== null && authority.admission_ref !== admissionRef) {
        errors.push(`ADMISSION_BINDING_CHANGED:${event.event_id}`);
      }
      if (authority.capability !== capability) errors.push(`AUTHORITY_CAPABILITY_CHANGED:${event.event_id}`);

      if (["ACTUATED", "OBSERVED", "RECONTACTED"].includes(event.event_type)) {
        const result = event.result;
        if (!result?.payload_sha256 || !result?.envelope_sha256 || !Number.isInteger(result?.object_sequence)) errors.push(`RESULT_BINDING_REQUIRED:${event.event_id}`);
        if (result?.object_sequence !== first.preimage?.expected_object_sequence + 1) errors.push(`RESULT_SEQUENCE_MISMATCH:${event.event_id}`);
        if (event.target?.object_key !== `sha256:${result?.payload_sha256}`) errors.push(`TARGET_CONTENT_KEY_MISMATCH:${event.event_id}`);
        if (committedResult === null) committedResult = result;
        else if (JSON.stringify(canonical(result)) !== JSON.stringify(canonical(committedResult))) errors.push(`RESULT_BINDING_CHANGED:${event.event_id}`);
      } else if (event.result?.payload_sha256 !== null || event.result?.envelope_sha256 !== null || event.result?.object_sequence !== null) {
        errors.push(`RESULT_PRESENT_BEFORE_ACTUATION:${event.event_id}`);
      }
      if (event.event_type === "OBSERVED" && !(event.evidence?.observation_refs?.length)) errors.push(`OBSERVATION_EVIDENCE_REQUIRED:${event.event_id}`);
      if (event.event_type === "RECONTACTED" && !(event.evidence?.receipt_refs?.length)) errors.push(`RECONTACT_RECEIPT_REQUIRED:${event.event_id}`);
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

  const objectHistory = new Map();
  const orderedTransitions = [...byTransition.entries()].sort((a, b) => a[1][0].journal_sequence - b[1][0].journal_sequence);
  for (const [transitionId, list] of orderedTransitions) {
    const first = list[0];
    const prior = objectHistory.get(first.object_id);
    if (first.operation === "CREATE") {
      if (prior) errors.push(`CREATE_AFTER_EXISTING_OBJECT_STATE:${transitionId}`);
      if (first.preimage?.expected_sha256 !== null || first.preimage?.expected_object_sequence !== 0) errors.push(`CREATE_PREIMAGE_INVALID:${transitionId}`);
    } else {
      if (!prior) errors.push(`OBJECT_PREIMAGE_WITHOUT_PRIOR_RECONTACT:${transitionId}`);
      else {
        if (first.preimage?.expected_sha256 !== prior.payload_sha256) errors.push(`OBJECT_PREIMAGE_DIGEST_MISMATCH:${transitionId}`);
        if (first.preimage?.expected_object_sequence !== prior.object_sequence) errors.push(`OBJECT_PREIMAGE_SEQUENCE_MISMATCH:${transitionId}`);
      }
    }
    const finalEvent = list.at(-1);
    if (finalEvent?.event_type === "RECONTACTED") {
      objectHistory.set(first.object_id, {
        payload_sha256: finalEvent.result?.payload_sha256,
        object_sequence: finalEvent.result?.object_sequence,
        envelope_id: finalEvent.target?.envelope_id
      });
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
