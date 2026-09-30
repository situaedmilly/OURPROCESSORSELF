# Causal Binding v0.4

## Gate

MCP MESSAGE → PROPOSAL → ADMISSION → INSTANCE → GITHUBCOMPUTERMORPH TRANSITION → LEVEL-0 EXECUTION → PROCESSOR RECEIPT → SEALED EVIDENCE → REPOSITORY STATE

## Runtime witness

Local Node.js reconstruction of the exact committed causal-binding source:

- rejected admission: processor execution not entered
- admitted causal path: full lineage witnessed
- tests: 2 passed, 0 failed

## Identifier lineage

`messageId → proposalId → admissionId → instanceId → transitionId → executionId → receiptId → evidenceHash → stateId`

## Constitutional boundaries

- MESSAGE ≠ AUTHORITY
- PROPOSAL ≠ ADMISSION
- ADMISSION ≠ EXECUTION
- RECEIPT ≠ EFFECT
- EVIDENCE ≠ AUTHORITY
- RAW GIT REF MOVEMENT ≠ COMPUTATIONAL TRANSITION

## Important scope

v0.4 binds the semantic repository-machine transition to Level-0 processor evidence. The existing v0.1 `executeTransition()` remains a semantic state-transition function; it does not itself mutate a live Git ref. No physical external repository mutation is claimed by this runtime witness.

## Gate result

CAUSAL_BINDING_PRESSURE_GATE = ADMITTED

PREREQUISITE: GITHUBCOMPUTERMORPH v0.1 pressure gate = 10/10 PASS
