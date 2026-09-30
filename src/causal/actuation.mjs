import {sha256} from "../evidence/hash.mjs";
import {admitUpdateRef,executeUpdateRef} from "../repository-actuator/update-ref.mjs";
export function evaluateActuatorAdmission({request,machine,transition,authorized=false,bounded=false}={}) {
  if (!request || request.transitionReceiptHash !== transition?.receipt?.receiptHash) return Object.freeze({status:"REJECTED",reason:"TRANSITION_RECEIPT_MISMATCH"});
  if (request.targetSurface !== transition.receipt.to) return Object.freeze({status:"REJECTED",reason:"TARGET_SURFACE_MISMATCH"});
  if (request.expectedPreCommit !== transition.receipt.preCommit) return Object.freeze({status:"REJECTED",reason:"REQUESTED_PRESTATE_MISMATCH"});
  const admission=admitUpdateRef({machine,transition,authorized,bounded});
  if (admission.status!=="ACTUATOR_ADMITTED") return admission;
  if (admission.plan.preRef!==request.expectedPreRef) return Object.freeze({status:"REJECTED",reason:"REF_MISMATCH"});
  if (admission.plan.requestedPostCommit!==request.requestedPostCommit) return Object.freeze({status:"REJECTED",reason:"POSTSTATE_MISMATCH"});
  return Object.freeze({status:admission.status,plan:admission.plan,requestHash:sha256(request)});
}
export async function executeActuation({actuatorAdmission,adapter}={}) {
  if (actuatorAdmission?.status!=="ACTUATOR_ADMITTED") throw new Error("actuator admission is required");
  const receipt=await executeUpdateRef({admission:actuatorAdmission,adapter});
  const actualState=receipt.status==="ACTUATOR_EXECUTED" ? Object.freeze({stateId:"state_"+sha256({ref:receipt.preRef,commit:receipt.actualPostCommit,actuatorReceiptHash:receipt.receiptHash}).slice(0,24),surface:receipt.targetSurface,ref:receipt.preRef,commit:receipt.actualPostCommit}) : null;
  return Object.freeze({status:receipt.status,requestHash:actuatorAdmission.requestHash,receipt,actualState});
}
