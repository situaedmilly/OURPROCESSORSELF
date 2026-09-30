import {SURFACE_ROLE, TRANSITION} from "../../contracts/repository-machine.mjs";

const PURGE_TARGETS = Object.freeze([
  "input", "cache", "cpu", "ram", "storage", "output",
]);

export function evaluateTransition({from, to, operation, authorized=false, bounded=true}={}) {
  const validSurface = Object.hasOwn(SURFACE_ROLE, from) && Object.hasOwn(SURFACE_ROLE, to);
  const validOperation = Object.values(TRANSITION).includes(operation);
  const valid = validSurface && validOperation;
  const checks = Object.freeze({valid, authorized:Boolean(authorized), bounded:Boolean(bounded)});
  return Object.freeze({
    status: checks.valid && checks.authorized && checks.bounded ? "ADMITTED" : "REJECTED",
    checks,
  });
}

export function evaluatePurge({authorized=false, bounded=true}={}) {
  const admission = evaluateTransition({
    from: "main",
    to: "main",
    operation: TRANSITION.PURGE,
    authorized,
    bounded,
  });
  return Object.freeze({
    ...admission,
    targets: PURGE_TARGETS,
    invariant: "PURGE_IS_STATE_TRANSITION_NOT_DELETE",
  });
}
