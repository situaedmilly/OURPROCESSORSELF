# OURPROCESSORSELF v0.7 — VERIFIED CONTINUATION

## Constitutional transition

v0.7 does not add a new actuator. It closes the processor cycle around the existing bounded actuator.

```
OBSERVED STATE
  ↓
SELFGRAPH
  ↓
DIFFERENTIATE
  ↓
DELTA
  ↓
NEXT PROPOSAL
  ↓
ADMISSION / AUTHORITY
  ↓
PROCESSOR
  ↓
ACTUATOR
  ↓
READ-BACK
  ↓
VERIFIED ACTUAL STATE
  ↓
SELFGRAPH UPDATE
  └──────────────→ DIFFERENTIATE
```

## Invariants

- OBSERVATION ≠ DESIRE
- DESIRE ≠ AUTHORITY
- AUTHORITY ≠ PROPOSAL
- PROPOSAL ≠ ADMISSION
- ADMISSION ≠ EXECUTION
- EXECUTION ≠ ACTUALITY
- ACTUALITY ≠ SUCCESS

Actual state may only be asserted from verified external read-back supplied by the execution boundary.

## Autonomy layers

1. Execution autonomy: execute an already authorized instruction.
2. Continuation autonomy: within bounded authority, observe actual state, calculate the next permitted transition, and continue.
3. Jurisdictional autonomy: define or expand authority itself.

v0.7 implements layer 2 only. It does not create or expand authority.

## Termination

The continuation terminates when:

- desired state is realized;
- actuation fails;
- authority/capability is insufficient;
- a configured stop/escalation boundary is reached;
- max cycle bound is reached.

## Minimal graph

STATE:
- observed
- desired
- actual

TRANSITION:
- proposal
- admission
- execution
- receipt

AUTHORITY:
- jurisdiction
- capabilities
- constraints
- termination

CAUSALITY:
- parent
- causes
- supersedes

Edges:
OBSERVES, DESIRES, DIFFERS_FROM, PROPOSES, ADMITTED_BY, AUTHORIZED_BY, EXECUTES, CAUSES, REALIZES, BLOCKED_BY, SUPERSEDES.
