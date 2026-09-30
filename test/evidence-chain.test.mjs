import assert from "node:assert/strict";
import {encode,OPCODE} from "../src/isa.mjs";
import {ProcessorControlPlane} from "../src/control-plane.mjs";
import {createEvent} from "../src/contracts/event.mjs";
import {sealReceipt} from "../src/receipts/receipt.mjs";
import {linkEvidence} from "../src/evidence/evidence.mjs";
import {admitEvidence} from "../src/policy/evidence-admission.mjs";

const program=Uint8Array.from([
  ...encode(OPCODE.CONST,0,0,7),
  ...encode(OPCODE.CONST,1,0,5),
  ...encode(OPCODE.ADD,2,0,1),
  ...encode(OPCODE.HALT),
]);
const event=createEvent({eventId:"evt_evidence_001",type:"PROCESSOR_EXECUTION",input:{operation:"add"},source:"evidence-test"});
const admission=new ProcessorControlPlane({authority:true,actuatable:true}).admit({
  event,proposalId:"proposal_evidence_001",instanceId:"inst_evidence_001",program,maxCycles:16
});
assert.equal(admission.admission.status,"ADMITTED");

admission.processor.run({maxCycles:16});
const observation={
  halted:admission.processor.state.halted,
  register2:admission.processor.state.registers[2],
  cycles:admission.processor.state.cycles
};
const receipt=sealReceipt({
  instance:admission.instance,
  executionStatus:"EXECUTED",
  observations:[observation],
  effect:{register2:observation.register2}
});
const evidence=linkEvidence({instance:admission.instance,receipt,observation});
const accepted=admitEvidence({instance:admission.instance,receipt,evidence});
assert.equal(accepted.status,"ADMITTED");
assert.equal(accepted.evidenceId,evidence.evidenceHash);
assert.equal(evidence.receiptHash.length,64);
assert.equal(evidence.evidenceHash.length,64);

const tampered={...evidence,receiptHash:evidence.receiptHash.replace(/^./,"0")};
const rejected=admitEvidence({instance:admission.instance,receipt,evidence:tampered});
assert.equal(rejected.status,"REJECTED");
assert.ok(rejected.reasons.includes("RECEIPT_HASH_MISMATCH"));
assert.ok(rejected.reasons.includes("EVIDENCE_HASH_MISMATCH"));

console.log("OURPROCESSORSELF evidence-chain tests: PASS");
