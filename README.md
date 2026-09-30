# OURPROCESSORSELF

Bounded processor substrate for the OURSELF execution architecture.

ECOSYSTEM → FETCH → NORMALIZE → ADMIT → ISA → MACHINE WORDS → PROCESSOR → STATE → RECEIPT

## v0.1
- Node.js 22+
- zero external dependencies
- deterministic 4-byte instruction words
- bounded register and memory model
- explicit traps
- deterministic execution receipts
- no GitHub Actions dependency
- no host/device authority

Run `npm test` and `npm run boot`.

The processor is an explicit OURSELF execution machine above the physical host CPU.
