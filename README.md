# OURPROCESSORSELF

Bounded, receipt-producing processor substrate for the OURSELF execution architecture.

## v0.2 control-plane mutation

WORLD → EVENT/INPUT → FETCH → NORMALIZE → CLASSIFY → SEMANTIC OBJECT → POLICY → ADMISSION → PROGRAM → ISA → PROCESSOR → STATE/EFFECT → OBSERVATION → RECEIPT → EVIDENCE

Constitutional separations:

- EVENT != AUTHORITY
- GIT != RUNTIME
- AGENT != ACTUATOR
- RECEIPT != EFFECT
- OBSERVATION != ADMISSION

### Hot loop

EVENT → FETCH → NORMALIZE → CLASSIFY → POLICY → ADMISSION → PROCESSOR → STATE/EFFECT → OBSERVE → RECEIPT

### Cold loop

RECEIPT → EVIDENCE → INSTANCE → ANALYSIS → PROPOSAL → PRESSURE TEST → POLICY → ADMISSION → SOURCE MUTATION → ARTIFACT → NEW PROCESSOR REALITY

### Admission doctrine

Admission means a transition is permitted to enter execution. It does not guarantee an effect. Execution may result in EXECUTED, TRAPPED, FAILED, BOUNDED, or ROLLED_BACK.

### Instance doctrine

Every processor transition receives an addressable execution instance containing its event, proposal, policy version, processor version, program hash, pre-state commitment, capability commitment, execution bounds, status and receipt linkage.

### Repository boundary

Git is durable source/control/evidence memory. It is not the processor runtime. The runtime remains independently executable.

## Runtime

- Node.js 22+
- zero external dependencies
- deterministic 4-byte instruction words
- bounded register and memory model
- explicit traps
- deterministic execution receipts
- no GitHub Actions dependency
- no host/device authority

Run `npm test` and `npm run boot`.

The processor is an explicit OURSELF execution machine above the physical host CPU.
