# OURPROCESSORSELF BOOT
Status: v0.2 processor/control-plane expansion.

WORLD → EVENT → FETCH → NORMALIZE → CLASSIFY → SEMANTIC OBJECT → POLICY → ADMISSION → SUPERBIN/IR → ISA → MACHINE WORDS → PROCESSOR → STATE/EFFECT → OBSERVATION → RECEIPT → EVIDENCE

## Constitutional boundaries

- EVENT != AUTHORITY
- GIT != RUNTIME
- AGENT != ACTUATOR
- RECEIPT != EFFECT
- OBSERVATION != ADMISSION

## Processor

- ISA: OURSELF-ISA/0.1
- Word: 4 bytes
- Registers: 8 × 32-bit
- Memory: 256 bytes
- Execution: deterministic and bounded
- Dependencies: none
- GitHub Actions: intentionally absent
- Host/device authority: none

## Instance

Every admitted transition receives an addressable execution instance with event, proposal, policy version, processor version, program hash, pre-state commitment, capability commitment and execution bounds.

## Admission

Admission permits entry into execution. It does not guarantee effect.

Execution may terminate as EXECUTED, TRAPPED, FAILED, BOUNDED or ROLLED_BACK.

Boot vector: R0=7, R1=5, R2=R0+R1, MEM[0x10]=R2, HALT.
Expected: R2=12 and MEM[0x10]=12.

Machine validity != OURSELF authority.
