# OURPROCESSORSELF SELFTHOUGHT — REVERSELF Continuity Validation v0.1

**State:** Design contract; implementation and admission pending.

## Processor role

OURPROCESSORSELF is the deterministic transition-evaluation layer for REVERSELF continuity. It is not QEMU, UTM, a storage adapter, an authority root, or an independent witness.

It evaluates supplied evidence and proposed state transitions. It must not infer external facts from declarations or create authority from its own output.

## Inputs

A future continuity validator consumes:
- a schema-valid OURDATASELFBASE envelope;
- a REVERSELF continuity profile;
- the exact observed payload digest and byte count;
- disk-format and backing-chain inventory;
- configuration and firmware inventory;
- runtime/dependency compatibility observations;
- predecessor transition journal and exact preimage;
- authority and admission references for any mutation.

## Deterministic checks

The validator should fail closed on:
- invalid or unknown schema versions;
- missing or duplicate component identities;
- unresolved envelope references;
- mismatched digest or byte count;
- missing disk backing files;
- unresolved firmware or variable-store dependencies;
- incompatible guest/host architecture declarations;
- missing preservation copy or inadequate capacity evidence;
- discontinuous journal sequence or predecessor digest;
- changed preimage, target, operation, or nonce;
- absent authority/admission for an actuation transition;
- claims of independent custody or witnessing without resolvable external evidence.

A validator can establish structural consistency of supplied inputs. It cannot prove a referenced external object exists unless it reads that object through an admitted adapter. It cannot prove independent custody or witness identity from a reference string.

## Transition discipline

The existing verified-continuation pattern remains authoritative for proposal/admission/execution separation:

1. Observe actual state.
2. Differentiate observed and desired state.
3. Generate a proposal.
4. Obtain independent admission for the exact proposal and preimage.
5. Execute only after admission.
6. Require verified actual state after actuation.
7. Seal evidence and preserve causal lineage.
8. Recontact through a later or independent path.
9. Stop on boundary uprising, mismatch, or missing evidence.

## Prohibited shortcuts

- Do not treat a successful schema check as payload integrity.
- Do not treat a hash as provenance.
- Do not treat a processor receipt as independent witnessing.
- Do not create or replace a Windows VM to satisfy a missing original.
- Do not execute QEMU or alter the source disk during discovery.
- Do not authorize MT5 broker orders or trading through a continuity transition.

## Next implementation gate

Implement a pure, side-effect-free REVERSELF profile validator and deterministic tests against valid, missing-component, digest-mismatch, dependency-gap, and unauthorized-transition fixtures. Storage reads, QEMU operations, and restoration remain separate adapters and separately admitted effects.
