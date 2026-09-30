# GITHUBCOMPUTERMORPH v0.5 — PHYSICAL ACTUATOR MEMBRANE

Status: IMPLEMENTED ON BRANCH `mutation/github-computermorph-v0.5-actuator`.

Scope:
- One physical operation: UPDATE_REF.
- Admission is separate from actuation.
- Pre-state is read from the actual Git ref before mutation.
- Mutation uses compare-and-swap semantics: `git update-ref <ref> <new> <expected-old>`.
- Post-state is independently read back.
- ACTUATOR_EXECUTED requires actualPostCommit === requestedPostCommit.
- Any mismatch or mutation error yields ACTUATOR_FAILED and preserves the observed pre-state.
- Raw Git mutation is not represented as an admitted machine transition unless it passes the actuator membrane.

Causal bindings committed into the actuator receipt:
- transitionReceiptHash
- messageId
- proposalId
- admissionId
- instanceId
- executionId
- processorReceiptId
- processorFinalReceiptHash
- evidenceHash

Boundary:
PROCESSOR RECEIPT != ACTUATOR RECEIPT
REQUESTED STATE != ACTUAL STATE until read-back verifies equality.

No GitHub Actions dependency was introduced.
No existing pull request was merged.
