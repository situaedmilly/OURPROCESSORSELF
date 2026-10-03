# OURSELFMCP bridge v0.1

Two controlled primitives:

1. MESSAGE → PROPOSAL → ADMISSION — the bridge creates proposal/instance identifiers and delegates the decision to an injected ProcessorControlPlane.
2. ADMISSION → LIFECYCLE NOTIFICATION — ADMISSION_PENDING is emitted before admission, followed by ADMITTED or MESSAGE_REJECTED.

GBTSELF → MCP MESSAGE → OURSELFMCP → PROPOSAL → ProcessorControlPlane.admit()
ADMITTED? → INSTANCE → PROCESSOR
REJECTED → STOP

MCP transport does not grant authority. Notification does not become effect.
