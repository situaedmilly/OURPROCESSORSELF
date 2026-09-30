import { ISA, OPCODE } from "./isa.mjs";
import { sha256 } from "./evidence/hash.mjs";
import { sealExecutionEvidence } from "./evidence/seal.mjs";

export class ProcessorTrap extends Error {
 constructor(code,message){super(message);this.name="ProcessorTrap";this.code=code;}
}

export class OurselfProcessor {
 constructor({program=new Uint8Array(),memoryBytes=ISA.memoryBytes}={}){
  this.state={pc:0,registers:new Uint32Array(ISA.registers),flags:{zero:false},memory:new Uint8Array(memoryBytes),halted:false,trapped:false,cycles:0};
  this.program=program instanceof Uint8Array?program:Uint8Array.from(program);
  this.receiptChain=[];
 }
 fetch(){const p=this.state.pc;if(p+ISA.wordBytes>this.program.length)throw new ProcessorTrap("FETCH_BOUNDS","program fetch out of bounds");return this.program.slice(p,p+ISA.wordBytes);}
 step(){
  if(this.state.halted||this.state.trapped)return this.receipt("NOOP");
  const before=this.snapshot(),[op,a,b,c]=this.fetch();
  switch(op){
   case OPCODE.HALT:this.state.halted=true;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.CONST:this.assertRegister(a);this.state.registers[a]=((b<<8)|c)>>>0;this.state.flags.zero=this.state.registers[a]===0;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.ADD:this.assertRegisters(a,b,c);this.state.registers[a]=(this.state.registers[b]+this.state.registers[c])>>>0;this.state.flags.zero=this.state.registers[a]===0;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.SUB:this.assertRegisters(a,b,c);this.state.registers[a]=(this.state.registers[b]-this.state.registers[c])>>>0;this.state.flags.zero=this.state.registers[a]===0;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.LOAD:this.assertRegister(a);this.assertMemory(c);this.state.registers[a]=this.state.memory[c];this.state.flags.zero=this.state.registers[a]===0;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.STORE:this.assertRegister(a);this.assertMemory(c);this.state.memory[c]=this.state.registers[a]&0xff;this.state.pc+=ISA.wordBytes;break;
   case OPCODE.JMP:this.assertProgram(c);this.state.pc=c;break;
   case OPCODE.JZ:this.assertProgram(c);this.state.pc=this.state.flags.zero?c:this.state.pc+ISA.wordBytes;break;
   case OPCODE.TRAP:this.state.trapped=true;throw new ProcessorTrap("TRAP_"+a,"explicit processor trap");
   default:this.state.trapped=true;throw new ProcessorTrap("INVALID_OPCODE","invalid opcode");
  }
  this.state.cycles++;
  return this.receipt("EXECUTED",before,this.snapshot(),[op,a,b,c]);
 }
 run({maxCycles=1000}={}){const receipts=[];while(!this.state.halted&&!this.state.trapped){if(this.state.cycles>=maxCycles)throw new ProcessorTrap("EXECUTION_BOUND","cycle bound exceeded");receipts.push(this.step());}return receipts;}
 snapshot(){return {pc:this.state.pc,registers:[...this.state.registers],zero:this.state.flags.zero,memory:[...this.state.memory],halted:this.state.halted,trapped:this.state.trapped,cycles:this.state.cycles};}
 receipt(status,before=null,after=this.snapshot(),instruction=null){
  const sequence=this.receiptChain.length;
  const preStateHash=sha256(before);
  const postStateHash=sha256(after);
  const previousReceiptHash=this.receiptChain.at(-1)?.receiptHash??null;
  const body={schema:"OURSELF.PROCESSOR.EXECUTION_RECEIPT.v0.2",sequence,status,instruction,preStateHash,postStateHash,previousReceiptHash};
  const receipt=Object.freeze({...body,receiptHash:sha256(body)});
  this.receiptChain.push(receipt);
  return receipt;
 }
 sealEvidence({previousEvidenceHash=null}={}){
  return sealExecutionEvidence({isa:ISA,program:this.program,preStateHash:this.receiptChain[0]?.preStateHash??sha256(this.snapshot()),receipts:this.receiptChain,postStateHash:this.receiptChain.at(-1)?.postStateHash??sha256(this.snapshot()),previousEvidenceHash});
 }
 assertRegister(i){if(!Number.isInteger(i)||i<0||i>=ISA.registers)throw new ProcessorTrap("REGISTER_BOUNDS","register out of bounds");}
 assertRegisters(...i){i.forEach(x=>this.assertRegister(x));}
 assertMemory(a){if(!Number.isInteger(a)||a<0||a>=this.state.memory.length)throw new ProcessorTrap("MEMORY_BOUNDS","memory out of bounds");}
 assertProgram(a){if(!Number.isInteger(a)||a<0||a%ISA.wordBytes!==0||a>=this.program.length)throw new ProcessorTrap("PROGRAM_BOUNDS","program address out of bounds");}
}
