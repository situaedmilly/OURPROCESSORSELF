# OURSELFMCP v0.1 Boot

OURSELFMCP is the messaging and control surface above OURPROCESSORSELF.

## Boundary

GBTSELF / client
→ MCP message
→ OURSELFMCP messaging layer
→ policy/admission boundary
→ OURPROCESSORSELF
→ execution
→ observation
→ receipt
→ notification

The layers remain distinct:

- Message = inbound command, request, or event envelope.
- Notification = outbound observation of control-plane state.
- Receipt = sealed execution evidence.
- Effect = processor state change.
- Authority = policy-controlled permission to actuate.

A message is not authority. A notification is not proof of effect. A receipt is evidence about an execution attempt and remains distinct from the effect itself.

## Initial MCP surface

- ourself_message
- ourself_notify

Transport: stdio JSON-RPC.

This first boot is dependency-free so the protocol boundary can be pressure-tested before adding an SDK or remote transport.

## Lifecycle

MESSAGE
→ ACCEPT
→ NOTIFY
→ ADMISSION
→ EXECUTION
→ OBSERVATION
→ RECEIPT
→ NOTIFY

## Next mutation boundary

Wire ourself_message into ProcessorControlPlane.admit() so MCP messages become proposals rather than direct processor commands. No direct host or device authority is granted by this layer.
