# Causal Binding v0.4 Tightened

Gate: ADMITTED

Local witness: 2 passed, 0 failed.

The repository transition receipt now commits to messageId, proposalId, admissionId, instanceId, executionId, processorReceiptId, processorFinalReceiptHash, and evidenceHash. Changing the binding changes the transition receipt hash.

Scope: semantic repository-machine transition only. No live Git ref mutation is claimed. No GitHub Actions dependency. No merge performed.
