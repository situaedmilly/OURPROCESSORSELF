# R3 — Deterministic Mock Lifecycle Adapter v0.1
**Implementation repository:** `situaedmilly/OURPROCESSORSELF`  
**Branch:** `ruflo-alchemy/r3-mock-lifecycle-v0.1`  
**Pinned Ruflo realization:** `ruvnet/ruflo@dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1`  
**Runtime target:** none — deterministic in-memory mock only.

## Purpose

R3 proves the OURSELF lifecycle contract can evaluate bounded START, OBSERVE, and STOP requests without touching a real host. This is a test adapter for the OURSELF lifecycle boundary; it is not a Ruflo patch, a daemon, a host supervisor, or a production SELFMOAT implementation.

## Files

- `contracts/lifecycle.mjs` — immutable request factory, operation/capability binding, payload digest.
- `src/lifecycle/mock-adapter.mjs` — deterministic, memory-only lifecycle simulator.
- `test/ruflo-lifecycle-mock.test.mjs` — Node built-in test coverage.
- `package.json` — includes the test in `npm test`.

## Request contract

`OURSELF.LIFECYCLE.REQUEST.v0.1` binds:
- request ID and operation;
- agent ID and realization ID;
- explicit `mock-host:` host identity;
- requester identity;
- operation-derived capability (`process.start`, `process.stop`, `process.observe`);
- exact host/agent/realization scope;
- issued and expiry timestamps;
- nonce, authorization reference, policy version;
- SHA-256 payload digest.

A STOP or OBSERVE request must bind a process-instance ID. The request factory does not issue authority.

## Admission boundary

The adapter requires an injected `verifyAdmission` function. If none is supplied, every request fails closed. Before calling the verifier, the adapter checks:
- request schema and payload digest;
- request host identity equals the adapter's explicit mock host;
- scope fields bind to the request's host, agent, and realization;
- capability matches operation;
- request is currently valid at the caller-supplied `nowMs`;
- admission status, requester, agent, realization, host, capability, nonce, authorization reference, policy version, and exact scope all match;
- admission time window covers the request time window.

The verifier is the future SELFMOAT integration seam. The test verifier is explicitly a test fixture and does not provide cryptographic or constitutional authority.

## Simulation semantics

- START creates a deterministic `mockproc_*` record with status `SIMULATED_ACTIVE`.
- OBSERVE returns the mock record without asserting a real process exists.
- STOP changes the mock record to `SIMULATED_STOPPED`.
- Process PID is always `null`.
- `isRealProcess` is always `false`.
- `hostAttestationRef` is always `null`.
- Every receipt sets `realHostActuation=false` and `effectObserved=false`.
- Request IDs are single-use; replay is denied.
- Receipts are sequence-numbered and hash-chained.
- Time is injected; no wall clock, randomness, timers, filesystem, network, shell, child process, launchd, systemd, or device API is used.

The adapter's state is ephemeral process memory. It is not durable memory, a real process table, an admitted SELFGRAPH record, or a witness of physical effect.

## Verification

A local Node.js 22-compatible isolated harness ran:

```
node --test test/ruflo-lifecycle-mock.test.mjs
5 tests passed
0 failures
```

Covered:
1. START → OBSERVE → STOP simulation.
2. Missing, invalid, expired, mismatched-scope, and replayed admission denial.
3. Default verifier fail-closed behavior.
4. Payload-tampering detection.
5. Deterministic receipt hash-chain continuity.

The isolated harness reproduced the adapter and contract in a temporary local directory because the execution environment could not resolve `github.com` for a repository clone. This is a local test of the authored module logic, not a run of the full OURPROCESSORSELF repository test suite. The GitHub branch's package script includes the new test; the full `npm test` has not been run here.

## Gate result

**R3-A — deterministic mock lifecycle adapter: IMPLEMENTED.**  
**R3-B — isolated test suite: 5/5 PASS.**  
**R3-C — full repository suite: NOT RUN.**  
**R3-D — integration with live SELFMOAT/OURSELFD: NOT STARTED.**

No actual process was created or terminated. No local Mac/Pi state was changed. No Ruflo code was installed or executed.

## Non-promotion rule

`SIMULATED_ACTIVE 
eq RUNNING`  
`MOCK_OBSERVATION_ONLY 
eq EFFECT_OBSERVED`  
`TEST_FIXTURE_ADMISSION 
eq SELFMOAT_AUTHORITY`  
`MOCK_RECEIPT 
eq ADMITTED_SELFGRAPH_EVIDENCE`

Next engineering gate: define the host-neutral supervisor port and a read-only process-observation adapter, then prove macOS launchd and Raspberry Pi systemd adapters against the same contract without granting either supervisor constitutional authority.
