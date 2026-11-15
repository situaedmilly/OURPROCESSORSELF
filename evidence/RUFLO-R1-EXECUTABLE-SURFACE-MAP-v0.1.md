# RUFLO R1 — Executable Surface Map and Effect Boundary
**Pinned upstream:** `ruvnet/ruflo@dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1`  
**Tree SHA:** `dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1`  
**Inventory schema:** `OURSELF.RUFLO.EXECUTABLE_SURFACE_INVENTORY.v0.1`  
**Generated against:** GitHub recursive Git tree at the pinned commit  
**OURSELF work branch:** `ruflo-alchemy/r3-mock-lifecycle-v0.1`

## R1 outcome

**R1-A — path and entrypoint inventory: COMPLETE.**  
**R1-B — handler-by-handler semantic and transitive-effect review: OPEN.**

The machine-readable inventory at [RUFLO-R1-EXECUTABLE-SURFACE-INVENTORY-v0.1.json](./RUFLO-R1-EXECUTABLE-SURFACE-INVENTORY-v0.1.json) records every path and Git blob SHA in these categories:

| Surface | Enumerated |
|---|---:|
| CLI command source modules | 91 |
| CLI MCP tool source modules | 72 |
| CLI service modules | 71 |
| Plugin tree entries | 3,001 |
| Plugin code files | 1,452 |
| Claude/Codex plugin manifests | 54 |
| Plugin hook registration files | 46 |
| Plugin MCP config files | 5 |
| Plugin package manifests | 5 |
| Plugin server entrypoints | 3 |

The CLI command registry exposes 60 command-loader names. Eleven core commands are synchronously imported; advanced commands are loaded through the registry. The MCP tool index exports 31 grouped tool collections. A module inventory is not the same as a completed per-handler effect audit: many modules contain multiple tool definitions, helpers, and transitive imports.

## 1. Executable registration and package boundaries

- Root package: `claude-flow@3.76.0`.
- CLI package: `@claude-flow/cli@3.76.0`.
- CLI binaries: `bin/cli.js` and `bin/mcp-server.js`.
- CLI package scripts include `postinstall`, `build`, `test`, `prepublishOnly`, `release`, and `publish:all`. Installation and release are executable mutation surfaces.
- CLI command registry: `v3/@claude-flow/cli/src/commands/index.ts`.
- MCP tool group registry: `v3/@claude-flow/cli/src/mcp-tools/index.ts`.
- Plugin README describes Claude Code plugin loading via `--plugin-dir`; plugin manifests and hook registration files are enumerated individually in the inventory.
- Five plugin package manifests expose package scripts; three plugin packages have `src/server.*` entrypoints. Plugin loading is not merely static metadata.

## 2. High-risk source traces completed

### 2.1 Init executor — filesystem and configuration mutation

Source: [`init/executor.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/init/executor.ts)

The inspected execution path creates directories, writes settings/configuration and helper files, copies helper implementations, and changes executable permissions. Upgrade paths may merge permissions and settings. Treat init/upgrade as a project-filesystem mutation workflow, not a read-only bootstrap. OURSELF adapter must not call it without an explicit file-scope grant, preimage capture, bounded diff, and independent post-write observation.

### 2.2 MCP server — process and transport lifecycle

Source: [`mcp-server.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/mcp-server.ts)

- stdio mode starts a server process; HTTP/WebSocket modes start an in-process server.
- Stop logic can send SIGTERM and then SIGKILL to the owned child process, close network servers, stop backend servers, and retract PID records.
- HTTP token resolution supports explicit token, token file, or environment variable. A default token file is created with restrictive permissions when needed.
- Non-loopback HTTP startup is refused without authentication unless an explicit unauthenticated opt-out is configured. Loopback hosts are treated as same-machine scope and are not refused by that gate.
- PID records include stronger instance metadata than a bare PID, but process liveness remains distinct from identity attestation and OURSELF authority.

OURSELF disposition: transport authentication is necessary but insufficient. Every tool invocation still needs mandatory SELFMOAT admission, exact tool/capability binding, scope, expiry, nonce, and replay protection.

### 2.3 Swarm tool — coordination record, not process creation

Source: [`swarm-tools.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/mcp-tools/swarm-tools.ts)

The inspected swarm initialization handler creates a random swarm ID, sets the coordination record's status to `running`, and persists it. By default, the record has no PID; the source comment explicitly notes that a normal CLI invocation exits after creating the coordination record. PID ownership is only optionally recorded when `trackHostProcess === true`.

OURSELF disposition: map this to a swarm/coordination proposal or record. It is not a `PROCESS_INSTANCE`, host liveness observation, or OURSELF agent activation.

### 2.4 Daemon command — detached process creation and stop path

Source: [`commands/daemon.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/commands/daemon.ts)

The background path uses Node `child_process.fork()` to create a detached foreground daemon child. It coordinates startup with lock files and PID state, checks/reaps stale daemons, and carries workspace/environment context into the child. This is an actual process lifecycle surface, unlike the swarm record.

OURSELF disposition: never let a Ruflo daemon command bypass OURSELFD. OS supervision belongs to launchd/systemd; OURSELFD owns constitutional lifecycle admission and observation.

### 2.5 Worker daemon — worker scheduling, child cleanup, state persistence

Source: [`services/worker-daemon.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/services/worker-daemon.ts)

The inspected start path checks singleton PID state, reaps orphaned children, detects mid-flight failures, marks the daemon running, writes a PID file, and enters repository-supervisor election. Stop clears worker and queue timers, stops lifecycle monitors, cancels headless child process groups, and releases supervisor state. Signal and crash handlers perform shutdown and state cleanup.

OURSELF disposition: worker scheduling and cancellation are bounded realization behavior, not constitutional authority. Process and child observations must be supplied by the host adapter and independently witnessed.

### 2.6 Repository supervisor — PID/heartbeat coordination lease

Source: [`services/repo-supervisor.ts`](https://github.com/ruvnet/ruflo/blob/dc25dd9b522bf1f3761f0d061a0bd0deb1900ba1/v3/@claude-flow/cli/src/services/repo-supervisor.ts)

The registry writes a per-repository record containing worktree root, PID, election time, and heartbeat; uses lock files; checks liveness with `process.kill(pid, 0)`; takes over stale records; and releases its own record on graceful shutdown. Coordination fails closed when the registry cannot safely elect.

OURSELF disposition: this is a local scheduling lease. It is not a trust root, signed membership grant, host attestation, or OURSELF admission.

## 3. Effect classification

| Entry surface | Effect class | OURSELF disposition |
|---|---|---|
| CLI command modules | Mixed; read, config, network, process, filesystem, provider and release effects | Per-command allowlist; no blanket CLI authority |
| MCP tool modules | Mixed; individual handlers may mutate state or invoke external tools | Per-tool admission and transitive effect mapping |
| MCP server | Process start/stop, network bind, tool dispatch | Quarantine behind mandatory transport and tool authorization |
| Init executor | Filesystem/config writes, helper installation, chmod | Deny by default; bounded file transaction only |
| Swarm initialization | Persistent coordination-state write | Candidate coordination record only |
| Daemon/worker services | Process creation/termination, timers, child process groups, files | OURSELFD-governed; OS owns supervision |
| Repository supervisor | Lock/PID/heartbeat filesystem coordination | Coordination only, never authority |
| Plugin manifests | Discoverability/configuration metadata | Metadata is not trust admission |
| Plugin hooks | Callback registration and execution | Trigger only; every side effect separately admitted |
| Plugin MCP configs/servers | External process/service/tool exposure | Deny by default until source, version, capability and data-flow audit |
| Package lifecycle scripts | Install/build/publish side effects | Never execute as part of read-only inspection |

## 4. Required R1 continuation before semantic closure

1. Extract every actual MCP tool name from all 72 module files and map each handler to its imported helpers and effect class.
2. Trace every one of the 60 CLI command loaders through its action handler and imported side-effect functions.
3. Inspect all 54 plugin manifests, 46 hook registration files, 5 MCP configs, 5 package manifests, and 3 server entrypoints for permissions, tool exposure, environment inheritance, and side effects.
4. Trace shell/process, filesystem, browser, Git, HTTP, provider-secret, federation, and memory calls through transitive helpers.
5. Reconcile package-lock resolution, lifecycle scripts, published files, and actual package entrypoints before any installation.

R1-A is closed as a reproducible path inventory. R1-B remains open until handler-level effect mapping and transitive review are complete. No unreviewed entrypoint is implicitly admitted.

## 5. R1 source invariants

- A command name is not an authority grant.
- A tool schema is not authorization.
- A plugin manifest is not trust.
- A hook callback is not authority.
- A swarm record marked `running` is not a running process.
- A PID/heartbeat lease is not identity attestation.
- A successful daemon start is not OURSELF activation.
- A receipt emitted by the executor is not independent effect observation.
