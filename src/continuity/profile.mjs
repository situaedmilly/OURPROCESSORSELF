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
const RESTORE_READY_STATES = new Set(["INTEGRITY_VERIFIED", "ADMITTED"]);
const REQUIRED_RESTORE_ROLES = [
  "VM_CONFIGURATION", "GUEST_DISK", "QEMU_RUNTIME", "PRESERVATION_COPY",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deterministically validates a REVERSELF profile and evaluates its restore gate.
 * This function performs no I/O and does not verify external envelope references,
 * payload bytes, signatures, custody, authority, or witness independence.
 */
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
  if (typeof profile.continuity_id !== "string" || profile.continuity_id.length < 8) {
    errors.push("INVALID_CONTINUITY_ID");
  }

  const subject = profile.subject;
  if (!isRecord(subject)) {
    errors.push("SUBJECT_NOT_OBJECT");
  } else {
    if (typeof subject.vm_name !== "string" || !subject.vm_name.trim()) errors.push("INVALID_VM_NAME");
    if (typeof subject.vm_uuid !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject.vm_uuid)) {
      errors.push("INVALID_VM_UUID");
    }
    if (subject.backend !== "QEMU") errors.push("UNSUPPORTED_BACKEND");
    if (!["aarch64", "x86_64", "other"].includes(subject.guest_architecture)) {
      errors.push("INVALID_GUEST_ARCHITECTURE");
    }
    if (typeof subject.application_context !== "string" || !subject.application_context.trim()) {
      errors.push("INVALID_APPLICATION_CONTEXT");
    }
  }

  const components = profile.components;
  const componentIds = new Set();
  const componentByRole = new Map();
  if (!Array.isArray(components) || components.length === 0) {
    errors.push("COMPONENTS_REQUIRED");
  } else {
    for (const component of components) {
      if (!isRecord(component)) {
        errors.push("COMPONENT_NOT_OBJECT");
        continue;
      }
      if (typeof component.component_id !== "string" || component.component_id.length < 8) {
        errors.push("INVALID_COMPONENT_ID");
      } else if (componentIds.has(component.component_id)) {
        errors.push("DUPLICATE_COMPONENT_ID");
      } else {
        componentIds.add(component.component_id);
      }
      if (!ROLES.has(component.role)) errors.push("INVALID_COMPONENT_ROLE");
      else componentByRole.set(component.role, component);
      if (typeof component.envelope_ref !== "string" || !component.envelope_ref.trim()) {
        errors.push("INVALID_ENVELOPE_REF");
      }
      if (!PAYLOAD_STATES.has(component.payload_state)) errors.push("INVALID_PAYLOAD_STATE");
      if (component.payload_state === "QUARANTINED" || component.payload_state === "MISSING") {
        blockers.push(`COMPONENT_${component.payload_state}:${component.component_id ?? "UNKNOWN"}`);
      }
      if (component.depends_on !== undefined) {
        if (!Array.isArray(component.depends_on) || new Set(component.depends_on).size !== component.depends_on.length) {
          errors.push("INVALID_COMPONENT_DEPENDENCIES");
        } else {
          for (const dependency of component.depends_on) {
            if (typeof dependency !== "string" || !dependency.trim()) errors.push("INVALID_DEPENDENCY_ID");
            else if (!components.some((candidate) => candidate?.component_id === dependency)) {
              errors.push("UNRESOLVED_COMPONENT_DEPENDENCY");
            }
          }
        }
      }
    }
  }

  const recovery = profile.recovery;
  if (!isRecord(recovery)) {
    errors.push("RECOVERY_NOT_OBJECT");
  } else {
    if (typeof recovery.target_reality !== "string" || !recovery.target_reality.trim()) {
      errors.push("INVALID_TARGET_REALITY");
    }
    if (recovery.source_immutable !== true) errors.push("SOURCE_MUST_REMAIN_IMMUTABLE");
    if (!RESTORE_AUTHORITIES.has(recovery.restore_authority)) errors.push("INVALID_RESTORE_AUTHORITY");
    if (recovery.restore_authority !== "ADMITTED") blockers.push("RESTORE_AUTHORITY_NOT_ADMITTED");
  }

  if (!Array.isArray(profile.limitations) ||
      profile.limitations.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push("LIMITATIONS_MUST_BE_STRING_ARRAY");
  }

  for (const role of REQUIRED_RESTORE_ROLES) {
    const component = componentByRole.get(role);
    if (!component) {
      blockers.push(`REQUIRED_COMPONENT_ABSENT:${role}`);
    } else if (!RESTORE_READY_STATES.has(component.payload_state)) {
      blockers.push(`REQUIRED_COMPONENT_NOT_VERIFIED:${role}`);
    }
  }

  const uniqueErrors = [...new Set(errors)];
  const uniqueBlockers = [...new Set(blockers)];
  return Object.freeze({
    valid: uniqueErrors.length === 0,
    errors: Object.freeze(uniqueErrors),
    restore_gate: Object.freeze({
      ready: uniqueErrors.length === 0 && uniqueBlockers.length === 0,
      blockers: Object.freeze(uniqueBlockers),
    }),
  });
}
