import assert from "node:assert/strict";
import {encode,OPCODE} from "../src/isa.mjs";
import {ProcessorControlPlane} from "../src/control-plane.mjs";
import {createEvent} from "../src/contracts/event.mjs";
import {sealReceipt} from "../src/receipts/receipt.mjs";

const program=Uint8Array.from([
  ...encode(OPCODE.CONST,0,0,7),
  ...encode(OPCODE.CONST,1,0,5),
  ...encode(OPCODE.ADD,2,0,1),
  ...encode(OPCODE.HALT),
]);

const event=createEvent({eventId:"evt_test_001",type:"PROCESSOR_EXECUTION",input:{operation:"add"},source:"test"});
const rejected=new ProcessorControlPlane({authority:false,actuatable:true}).admit({
  event,proposalId:"proposal_rejected",instanceId:"inst_rejected",program,maxCycles:16
});
assert.equal(rejected.admission.status,"REJECTED");
assert.equal(rejected.processor,null);

const admitted=new ProcessorControlPlane({authority:true,actuatable:true}).admit({
  event,proposalId:"proposal_001",instanceId:"inst_001",program,maxCycles:16
});
assert.equal(admitted.admission.status,"ADMITTED");
assert.equal(admitted.instance.status,"ADMITTED");
assert.equal(admitted.instance.eventId,event.eventId);
assert.equal(admitted.instance.executionBounds.maxCycles,16);

const executions=admitted.processor.run({maxCycles:16});
const receipt=sealReceipt({
  instance:admitted.instance,
  executionStatus:"EXECUTED",
  observations:[{halted:admitted.processor.state.halted,register2:admitted.processor.state.registers[2]}],
  effect:{register2:admitted.processor.state.registers[2]}
});
assert.equal(executions.length,4);
assert.equal(receipt.executionStatus,"EXECUTED");
assert.equal(receipt.instanceId,"inst_001");
assert.equal(receipt.effect.register2,12);
assert.equal(receipt.evidence.receiptIsNotEffect,true);

console.log("OURPROCESSORSELF control-plane tests: PASS");
