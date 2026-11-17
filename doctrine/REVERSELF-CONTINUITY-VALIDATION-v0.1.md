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

## Implemented structural boundary

The v0.1 pure profile validator now checks the declared envelope binding fields, exact envelope-reference identity, digest/content-key consistency, byte-count shape, transition-reference shape, component identity uniqueness, dependency references, and required baseline roles.

It deliberately returns `restore_gate.ready = false` for every input. It has no admitted envelope resolver, payload byte reader, transition-journal verifier, authority verifier, custody verifier, or independent witness. A declaration that a component is `ADMITTED` is not accepted as `INTEGRITY_VERIFIED`.

The validator emits explicit blockers for unresolved envelope and transition references, unverified bytes, and unverified authority/custody. It is a structural guard, not a restoration authorization or recovery proof.

## Remaining implementation gates

- Resolve envelope IDs against canonical DATASELF objects and compare all bound identity fields.
- Read exact payload bytes through an admitted, read-only storage adapter and recompute SHA-256 and byte count.
- Verify the complete anchored transition journal against the v1 event contract.
- Resolve authority/admission evidence for the exact restoration proposal and preimage.
- Inventory every disk backing file, firmware/variable-store dependency, runtime binary, and dependency lock.
- Verify independent custody and later recontact/witness evidence.

Until those adapters and independent evidence exist, no processor result may claim restoration readiness or recovery.

## Read-only resolution and transition verification

The continuity branch now includes two additional pure verification modules:

- `src/continuity/resolver.mjs` accepts an injected read-only DATASELF adapter. It resolves canonical envelope IDs, compares envelope/object/reality/instance identities and payload declarations, reads exact payload bytes, recomputes SHA-256 and byte count, requires DATASELF lifecycle `INTEGRITY_VERIFIED` with verification integrity `MATCH`, and resolves each referenced transition event against the same object and envelope.
- `src/continuity/transition-journal.mjs` verifies a complete supplied journal beginning at sequence zero, deterministic event digests, predecessor hash continuity, unique event IDs, nonce non-replay across transitions, immutable transition target/preimage bindings, lifecycle phase order, result sequence, content-address binding, and required observation/recontact evidence.

These functions do not create an admitted storage adapter. A fake or test adapter proves only verifier behavior. The journal verifier cannot prove that an external journal is complete or immutable unless its source is independently trusted. Authority/admission references, independent custody, compatibility and independent witnessing remain separate gates.

The processor package test command now includes profile, resolver, and transition-journal regression files. GitHub Actions workflows were added to the processor and DATASELF source branches to run the complete `npm test` command and compile the DATASELF envelope, transition and continuity schemas against Draft 2020-12. Their run results remain unconfirmed until GitHub reports actual completed runs.

## Boot-launch configuration boundary

`src/continuity/boot-launch-gate.mjs` configures a software-side, fail-closed authorization gate. It requires injected verifiers for payload resolution, byte integrity, journal lineage, source immutability, preservation copy, independent custody, operation-specific authority, runtime compatibility, and exact launch scope. Each verifier must return a positive result with a non-empty evidence reference.

The gate does not start QEMU, open a VM bundle, write a disk, or perform a boot. It reports `BOOT_LAUNCH_AUTHORIZED` only when every independent verifier is supplied and succeeds; even then `effect_performed` remains false. A separate, explicitly admitted runtime actuator and observed boot receipt would be required for actual launch.
