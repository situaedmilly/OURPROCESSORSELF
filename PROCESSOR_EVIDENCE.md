# Processor Evidence Chain v0.3

Two processor primitives are introduced.

## Primitive 1 — cryptographically linked execution receipts

Each execution receipt commits:

- sequence
- instruction
- pre-state hash
- post-state hash
- previous receipt hash
- receipt hash

Therefore receipt N references receipt N-1 without treating a receipt as the effect itself.

## Primitive 2 — sealed execution evidence

After execution, the processor can seal:

- ISA identity
- program hash
- initial-state commitment
- ordered receipt hashes
- final-state commitment
- optional previous evidence hash
- evidence hash

Flow:

WORLD / ADMITTED PROGRAM
  ↓
PROCESSOR
  ↓
RECEIPT₀ → RECEIPT₁ → ... → RECEIPTₙ
  ↓
SEALED EXECUTION EVIDENCE

The evidence object is a witness of the processor transition. It is not authority and it is not itself the external effect.

Runtime witness performed against the reconstructed v0.3 source:

- Node.js test runner
- 2 tests passed
- receipt-chain assertions passed
- SHA-256 commitment assertions passed
- trap-boundary assertion passed
