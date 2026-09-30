import {encode,OPCODE} from '../src/isa.mjs';
import {ProcessorControlPlane} from '../src/control-plane.mjs';
import {createEvent} from '../src/contracts/event.mjs';
import {sealReceipt} from '../src/receipts/receipt.mjs';
import {linkEvidence} from '../src/evidence/evidence.mjs';
import {admitEvidence} from '../src/policy/evidence-admission.mjs';
import {sha256} from '../src/evidence/hash.mjs';

const program=Uint8Array.from([
  ...encode(OPCODE.CONST,0,0,7),
  ...encode(OPCODE.CONST,1,0,5),
  ...encode(OPCODE.ADD,2,0,1),
  ...encode(OPCODE.HALT),
]);
const event=createEvent({
  eventId:'evt_v03_runtime_001',
  type:'PROCESSOR_EXECUTION',
  input:{operation:'add',expected:12},
  source:'v0.3-runtime-witness',
});
const control=new ProcessorControlPlane({authority:true,actuatable:true});
const admitted=control.admit({
  event,
  proposalId:'proposal_v03_runtime_001',
  instanceId:'inst_v03_runtime_001',
  program,
  maxCycles:16,
  preStateHash:'EMPTY_STATE',
  capabilityCommitment:'TEST_CAPABILITY',
});
if(admitted.admission.status!=='ADMITTED') throw new Error('admission failed');

const executionReceipts=admitted.processor.run({maxCycles:16});
const observation={
  halted:admitted.processor.state.halted,
  register2:admitted.processor.state.registers[2],
  cycles:admitted.processor.state.cycles,
};
if(!observation.halted||observation.register2!==12) throw new Error('runtime invariant failed');

const receipt=sealReceipt({
  instance:admitted.instance,
  executionStatus:'EXECUTED',
  observations:[observation],
  effect:{register2:observation.register2},
});
const evidence=linkEvidence({
  instance:admitted.instance,
  receipt,
  observation,
});
const evidenceAdmission=admitEvidence({
  instance:admitted.instance,
  receipt,
  evidence,
});
if(evidenceAdmission.status!=='ADMITTED') throw new Error('evidence admission failed');

const tampered={
  ...evidence,
  receiptHash:evidence.receiptHash.replace(/^./,'0'),
};
const tamperAdmission=admitEvidence({
  instance:admitted.instance,
  receipt,
  evidence:tampered,
});
if(tamperAdmission.status!=='REJECTED') throw new Error('tamper rejection failed');

const witness={
  schema:'OURSELF.PROCESSOR.V0.3.RUNTIME_WITNESS.v1',
  runtime:{node:process.version,platform:process.platform},
  instance:admitted.instance,
  execution:{
    status:receipt.executionStatus,
    steps:executionReceipts.length,
    observation,
  },
  receipt,
  evidence,
  evidenceAdmission,
  tamperAdmission,
  witnessHash:null,
};
witness.witnessHash=sha256({...witness,witnessHash:null});
console.log(JSON.stringify(witness,null,2));
