export const REPOSITORY_ACTUATOR_SCHEMA = "OURSELF.GITHUBCOMPUTERMORPH.REPOSITORY_ACTUATOR.v0.1";
export const ACTUATOR_OPERATION = Object.freeze({UPDATE_REF: "UPDATE_REF"});
export const ACTUATOR_STATUS = Object.freeze({
  ADMITTED: "ACTUATOR_ADMITTED",
  EXECUTED: "ACTUATOR_EXECUTED",
  FAILED: "ACTUATOR_FAILED",
});

export function assertUpdateRefPlan(plan={}) {
  if (plan.operation !== ACTUATOR_OPERATION.UPDATE_REF) throw new TypeError("only UPDATE_REF is permitted");
  if (!plan.targetSurface || !plan.preRef || !plan.preCommit || !plan.requestedPostCommit) {
    throw new TypeError("UPDATE_REF requires targetSurface, preRef, preCommit, and requestedPostCommit");
  }
  if (!/^[0-9a-f]{40}$/i.test(plan.preCommit)) throw new TypeError("preCommit must be a 40-hex Git object id");
  if (!/^[0-9a-f]{40}$/i.test(plan.requestedPostCommit)) throw new TypeError("requestedPostCommit must be a 40-hex Git object id");
  return true;
}
