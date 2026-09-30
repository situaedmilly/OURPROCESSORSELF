# v0.3 Evidence Chain

The v0.3 mutation adds two executable primitives:

1. **Cryptographically linked execution evidence**
   - SHA-256 preimage commitment
   - SHA-256 observation commitment
   - SHA-256 receipt commitment
   - deterministic evidence hash
   - optional parent evidence hash for lineage

2. **Evidence admission**
   - recomputes receipt and evidence hashes
   - verifies instance/receipt/evidence identity binding
   - returns ADMITTED or REJECTED
   - tampered evidence cannot enter the admitted evidence state

The boundary remains explicit:

EVENT != AUTHORITY
RECEIPT != EFFECT
EVIDENCE != AUTHORITY

Evidence admission verifies integrity and linkage. It does not grant execution authority retroactively.
