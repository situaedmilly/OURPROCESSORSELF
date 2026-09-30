export const ADMISSION_SCHEMA = "OURSELF.PROCESSOR.ADMISSION.v0.2";

export const AdmissionStatus = Object.freeze({
  VALID: "VALID",
  AUTHORIZED: "AUTHORIZED",
  ACTUATABLE: "ACTUATABLE",
  BOUNDED: "BOUNDED",
  ADMITTED: "ADMITTED",
  REJECTED: "REJECTED",
});

export function evaluateAdmission({event, authority=false, actuatable=false, bounds, validator=()=>true}={}) {
  const valid = Boolean(event && validator(event));
  const bounded = Boolean(bounds && Number.isInteger(bounds.maxCycles) && bounds.maxCycles > 0);
  const authorized = Boolean(authority);
  const canActuate = Boolean(actuatable);
  const admitted = valid && authorized && canActuate && bounded;
  return Object.freeze({
    schema: ADMISSION_SCHEMA,
    status: admitted ? AdmissionStatus.ADMITTED : AdmissionStatus.REJECTED,
    predicates: Object.freeze({valid, authorized, actuatable: canActuate, bounded}),
  });
}
