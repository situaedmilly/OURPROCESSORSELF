# OURPROCESSORSELF BOOT
Status: repository substrate bootstrapped.

ECOSYSTEM FETCH → NORMALIZE → ADMIT → SUPERBIN/IR → ISA → MACHINE WORDS → PROCESSOR → STATE → RECEIPT

- ISA: OURSELF-ISA/0.1
- Word: 4 bytes
- Registers: 8 × 32-bit
- Memory: 256 bytes
- Execution: deterministic and bounded
- Dependencies: none
- GitHub Actions: intentionally absent
- Host/device authority: none

Boot vector: R0=7, R1=5, R2=R0+R1, MEM[0x10]=R2, HALT.
Expected: R2=12 and MEM[0x10]=12.

Machine validity ≠ OURSELF authority.
