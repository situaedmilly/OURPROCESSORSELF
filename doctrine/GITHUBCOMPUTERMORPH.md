# GITHUBCOMPUTERMORPH v0.1

## Definition

GITHUBCOMPUTERMORPH treats a Git repository as a programmable state/object/reference graph.

Git's native objects and refs remain Git semantics. OURSELF supplies the computational interpretation:

OBJECT → STATE → REFERENCE → JURISDICTION → TRANSITION → ADMISSION → ACTUATION → OBSERVATION → RECEIPT → EVIDENCE

A branch name does not itself grant authority, execution, or effect.

## Seven machine surfaces

| Surface | Semantic role |
|---|---|
| main | canonical lineage |
| input | incoming matter |
| cache | hot/precomputed candidate |
| cpu | current computational state |
| ram | speculative state |
| storage | durable state |
| output | projected state |

These are repository machine surfaces, not claims about physical hardware.

## Repository transition

A repository transition is only a machine transition when its proposal is valid, authorized, and bounded.

REF STATE(n)
→ MACHINE OPERATION
→ VALIDATE
→ ADMIT
→ OBJECT/REF TRANSITION
→ OBSERVE
→ RECEIPT
→ SEALED EVIDENCE
→ REF STATE(n+1)

A successful Git operation alone is not proof of computation.

## Cache

CACHE may reduce recomputation.

CACHE MUST NOT:
- manufacture authority
- bypass admission
- constitute execution
- constitute evidence
- constitute a receipt
- become the source of truth solely by being selected

CACHE HIT ≠ AUTHORITY
CACHE HIT ≠ EXECUTION

## Purge

PURGE is a bounded state-normalization transition.

PURGE ≠ DELETE

The implementation produces a purge plan. Actual external ref mutation remains a separate actuation step and must not be inferred from plan creation.

## Constitutional boundaries

MESSAGE ≠ AUTHORITY
PROPOSAL ≠ ADMISSION
ADMISSION ≠ ACTUATION
GIT TRANSITION ≠ EFFECT
RECEIPT ≠ EFFECT
EVIDENCE ≠ AUTHORITY

The repository machine therefore remains compatible with the Level-0 OURPROCESSORSELF processor:

ISA → PROCESSOR → STATE → RECEIPT → EVIDENCE

and creates Level 1:

REPOSITORY STATE → REF → TRANSITION → NEXT REF → RECEIPT → EVIDENCE
