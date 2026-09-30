import {encode,OPCODE} from "./isa.mjs";
import {OurselfProcessor} from "./processor.mjs";
const program=Uint8Array.from([...encode(OPCODE.CONST,0,0,7),...encode(OPCODE.CONST,1,0,5),...encode(OPCODE.ADD,2,0,1),...encode(OPCODE.STORE,2,0,0x10),...encode(OPCODE.HALT)]);
const processor=new OurselfProcessor({program});
const receipts=processor.run({maxCycles:16});
const s=processor.snapshot();
if(!s.halted||s.registers[2]!==12||s.memory[0x10]!==12)throw new Error("boot invariant failed");
console.log(JSON.stringify({schema:"OURSELF.PROCESSOR.BOOT_RECEIPT.v0.1",result:"BOOTED",isa:"OURSELF-ISA@0.1",cycles:s.cycles,halted:s.halted,register_2:s.registers[2],memory_0x10:s.memory[0x10],receipts:receipts.length},null,2));
