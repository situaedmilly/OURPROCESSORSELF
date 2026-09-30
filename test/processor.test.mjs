import assert from "node:assert/strict";
import {encode,OPCODE} from "../src/isa.mjs";
import {OurselfProcessor,ProcessorTrap} from "../src/processor.mjs";
const program=Uint8Array.from([...encode(OPCODE.CONST,0,0,9),...encode(OPCODE.CONST,1,0,3),...encode(OPCODE.SUB,2,0,1),...encode(OPCODE.STORE,2,0,0x20),...encode(OPCODE.HALT)]);
const cpu=new OurselfProcessor({program});
const receipts=cpu.run({maxCycles:16});
assert.equal(cpu.state.halted,true);assert.equal(cpu.state.registers[2],6);assert.equal(cpu.state.memory[0x20],6);assert.equal(receipts.length,5);assert.equal(receipts.at(-1).status,"EXECUTED");
assert.throws(()=>new OurselfProcessor({program:Uint8Array.from([0xff,0,0,0])}).step(),e=>e instanceof ProcessorTrap&&e.code==="TRAP_0");
console.log("OURPROCESSORSELF tests: PASS");
