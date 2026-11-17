const PROFILE_SCHEMA = "ourself.reverself.continuity-profile.v1";
const PAYLOAD_STATES = new Set([
  "UNKNOWN", "DECLARED", "LOCATED", "OBSERVED",
  "INTEGRITY_VERIFIED", "ADMITTED", "QUARANTINED", "MISSING",
]);
const ROLES = new Set([
  "VM_CONFIGURATION", "GUEST_DISK", "DISK_BACKING_FILE",
  "FIRMWARE_CODE", "FIRMWARE_VARIABLES", "QEMU_RUNTIME",
  "DEPENDENCY_LOCK", "PRESERVATION_COPY", "WORKING_COPY",
  "OBSERVATION_EVIDENCE", "CUSTODY_EVIDENCE", "WITNESS_EVIDENCE",
]);
const RESTORE_AUTHORITIES = new Set(["NOT_REQUESTED", "PENDING", "ADMITTED", "REJECTED"]);
const RECOVERY_STATUSES = new Set(["DISCOVERY", "ACQUISITION", "PRESERVATION", "ADMISSION", "RESTORE_READY", "RESTORING", "OBSERVING", "RECONTACT", "WITNESSING", "RECOVERY_BLOCKED", "RECOVERED", "QUARANTINED"]);
const REQUIRED_RESTORE_ROLES = [
  "VM_CONFIGURATION", "GUEST_DISK",
  "QEMU_RUNTIME", "FIRMWARE_CODE", "FIRMWARE_VARIABLES",
  "DEPENDENCY_LOCK", "PRESERVATION_COPY",
];
const SHA256 = /^[a-f0-9]{64}$/;

/** Structural-only validator. It never resolves envelopes or reads payload bytes. */
export function validateContinuityProfile(profile) {
  const errors = [];
  const blockers = [];
  if (!isRecord(profile)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["PROFILE_NOT_OBJECT"]),
      restore_gate: Object.freeze({ ready: false, blockers: Object.freeze(["PROFILE_NOT_OBJECT"]) }),
    });
  }
  if (profile.schema !== PROFILE_SCHEMA) errors.push("UNSUPPORTED_SCHEMA");
  if (typeof profile.continuity_id !== "string" || profile.continuity_id.length < 8) errors.push("INVALID_CONTINUITY_ID");

  const subject = profile.subject;
  if (!isRecord(subject)) errors.push("SUBJECT_NOT_OBJECT");
  else {
    if (typeof subject.vm_name !== "string" || !subject.vm_name.trim()) errors.push("INVALID_VM_NAME");
    if (typeof subject.vm_uuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject.vm_uuid)) errors.push("INVALID_VM_UUID");
    if (subject.backend !== "QEMU") errors.push("UNSUPPORTED_BACKEND");
    if (!["aarch64", "x86_64", "other"].includes(subject.guest_architecture)) errors.push("INVALID_GUEST_ARCHITECTURE");
    if (typeof subject.application_context !== "string" || !subject.application_context.trim()) errors.push("INVALID_APPLICATION_CONTEXT");
  }

  const components = profile.components;
  const componentIds = new Set();
  const componentsByRole = new Map();
  if (!Array.isArray(components) || components.length === 0) errors.push("COMPONENTS_REQUIRED");
  else {
    for (const component of components) {
      if (!isRecord(component)) { errors.push("COMPONENT_NOT_OBJECT"); continue; }
      const id = component.component_id;
      if (typeof id !== "string" || id.length < 8) errors.push("INVALID_COMPONENT_ID");
      else if (componentIds.has(id)) errors.push("DUPLICATE_COMPONENT_ID");
      else componentIds.add(id);

      if (!ROLES.has(component.role)) errors.push("INVALID_COMPONENT_ROLE");
      else {
        const list = componentsByRole.get(component.role) ?? [];
        list.push(component);
        componentsByRole.set(component.role, list);
      }
      if (typeof component.envelope_ref !== "string" || !component.envelope_ref.trim()) errors.push("INVALID_ENVELOPE_REF");
      if (!PAYLOAD_STATES.has(component.payload_state)) errors.push("INVALID_PAYLOAD_STATE");
      if (component.payload_state === "QUARANTINED" || component.payload_state === "MISSING") {
        blockers.push(`COMPONENT_${component.payload_state}:${id ?? "UNKNOWN"}`);
      }
      if (component.payload_state === "ADMITTED") blockers.push(`ADMISSION_IS_NOT_INTEGRITY:${id ?? "UNKNOWN"}`);
      if (component.payload_state !== "INTEGRITY_VERIFIED") blockers.push(`COMPONENT_BYTES_NOT_VERIFIED:${id ?? "UNKNOWN"}`);

      const binding = component.envelope_binding;
      if (!isRecord(binding)) {
        errors.push("ENVELOPE_BINDING_REQUIRED");
        blockers.push(`ENVELOPE_BINDING_ABSENT:${id ?? "UNKNOWN"}`);
      } else {
        if (typeof binding.envelope_id !== "string" || !binding.envelope_id.trim()) errors.push("INVALID_BOUND_ENVELOPE_ID");
        if (component.envelope_ref !== binding.envelope_id) errors.push("ENVELOPE_REFERENCE_MISMATCH");
        if (typeof binding.object_id !== "string" || !binding.object_id.trim()) errors.push("INVALID_BOUND_OBJECT_ID");
        if (typeof binding.reality_id !== "string" || !binding.reality_id.trim()) errors.push("INVALID_BOUND_REALITY_ID");
        if (typeof binding.instance_id !== "string" || !binding.instance_id.trim()) errors.push("INVALID_BOUND_INSTANCE_ID");
        if (typeof binding.payload_sha256 !== "string" || !SHA256.test(binding.payload_sha256)) errors.push("INVALID_BOUND_PAYLOAD_SHA256");
        if (!Number.isSafeInteger(binding.byte_count) || binding.byte_count < 0) errors.push("INVALID_BOUND_BYTE_COUNT");
        if (binding.content_key !== `sha256:${binding.payload_sha256}`) errors.push("CONTENT_KEY_DIGEST_MISMATCH");
        if (binding.lifecycle !== "INTEGRITY_VERIFIED") blockers.push(`ENVELOPE_NOT_INTEGRITY_VERIFIED:${id ?? "UNKNOWN"}`);
        if (!Array.isArray(binding.transition_event_refs) || binding.transition_event_refs.length === 0 ||
            binding.transition_event_refs.some((ref) => typeof ref !== "string" || !ref.trim()) ||
            new Set(binding.transition_event_refs).size !== binding.transition_event_refs.length) {
          errors.push("INVALID_TRANSITION_EVENT_REFS");
        } else {
          blockers.push(`TRANSITION_EVENTS_NOT_RESOLVED:${id ?? "UNKNOWN"}`);
        }
      }

      if (component.depends_on !== undefined) {
        if (!Array.isArray(component.depends_on) || new Set(component.depends_on).size !== component.depends_on.length) errors.push("INVALID_COMPONENT_DEPENDENCIES");
        else for (const dependency of component.depends_on) {
          if (typeof dependency !== "string" || !dependency.trim()) errors.push("INVALID_DEPENDENCY_ID");
          else if (!Array.isArray(components) || !components.some((candidate) => candidate?.component_id === dependency)) errors.push("UNRESOLVED_COMPONENT_DEPENDENCY");
        }
      }
    }
  }

  for (const role of REQUIRED_RESTORE_ROLES) {
    const matches = componentsByRole.get(role) ?? [];
    if (matches.length === 0) blockers.push(`REQUIRED_COMPONENT_ABSENT:${role}`);
    for (const component of matches) {
      if (component.payload_state !== "INTEGRITY_VERIFIED") blockers.push(`REQUIRED_COMPONENT_NOT_INTEGRITY_VERIFIED:${role}:${component.component_id ?? "UNKNOWN"}`);
    }
  }

  const recovery = profile.recovery;
  if (!isRecord(recovery)) errors.push("RECOVERY_NOT_OBJECT");
  else {
    if (typeof recovery.target_reality !== "string" || !recovery.target_reality.trim()) errors.push("INVALID_TARGET_REALITY");
    if (recovery.source_immutable !== true) errors.push("SOURCE_MUST_REMAIN_IMMUTABLE");
    if (!RESTORE_AUTHORITIES.has(recovery.restore_authority)) errors.push("INVALID_RESTORE_AUTHORITY");
    if (recovery.restore_authority !== "ADMITTED") blockers.push("RESTORE_AUTHORITY_NOT_ADMITTED");
    if (!RECOVERY_STATUSES.has(recovery.status)) errors.push("INVALID_RECOVERY_STATUS");
    if (["RESTORE_READY", "RESTORING", "OBSERVING", "RECONTACT", "WITNESSING", "RECOVERED"].includes(recovery.status)) {
      blockers.push("UNVERIFIED_RECOVERY_STATUS_CLAIM");
    }
  }
  if (!Array.isArray(profile.limitations) || profile.limitations.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push("LIMITATIONS_MUST_BE_STRING_ARRAY");
  }

  // This pure validator has no admitted resolver, byte reader, journal verifier,
  // authority verifier, custody verifier, or independent witness. It must never
  // return RESTORE_READY, even when supplied declarations appear internally consistent.
  blockers.push("EXTERNAL_ENVELOPE_RESOLUTION_NOT_PERFORMED");
  blockers.push("PAYLOAD_BYTE_VERIFICATION_NOT_PERFORMED");
  blockers.push("TRANSITION_LINEAGE_VERIFICATION_NOT_PERFORMED");
  blockers.push("AUTHORITY_AND_CUSTODY_NOT_INDEPENDENTLY_VERIFIED");

  const uniqueErrors = [...new Set(errors)];
  const uniqueBlockers = [...new Set(blockers)];
  return Object.freeze({
    valid: uniqueErrors.length === 0,
    errors: Object.freeze(uniqueErrors),
    restore_gate: Object.freeze({ ready: false, blockers: Object.freeze(uniqueBlockers) }),
  });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
