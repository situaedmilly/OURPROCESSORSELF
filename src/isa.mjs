export const ISA=Object.freeze({name:"OURSELF-ISA",version:"0.1",wordBytes:4,registers:8,memoryBytes:256});
export const OPCODE=Object.freeze({HALT:0x00,CONST:0x01,ADD:0x02,SUB:0x03,LOAD:0x04,STORE:0x05,JMP:0x06,JZ:0x07,TRAP:0xff});
export function encode(opcode,a=0,b=0,c=0){
  for(const value of [opcode,a,b,c]) if(!Number.isInteger(value)||value<0||value>255) throw new RangeError("instruction byte out of range");
  return Uint8Array.from([opcode,a,b,c]);
}
