# NexTerm — MobaXterm Capability Gap Analysis & Implementation Plan

**Reference repositories**

- Reference implementation: `zarfadev/MobaXterm-Keygen`
- Target application: `Kunal8990/NexTerm`

## 1. Important scope correction

`zarfadev/MobaXterm-Keygen` is **not MobaXterm itself**. It is a browser-side license/customization-file generator for MobaXterm.

Its core flow is:

```text
Edition + Username + Version + User Count
              |
              v
     License string construction
              |
              v
   Custom byte transformation
              |
              v
       Variant Base64 encoding
              |
              v
          Pro.key
              |
              v
       ZIP container creation
              |
              v
       Custom.mxtpro
```

The repository also has a second utility that combines an existing `Custom.mxtpro` and a MobaXterm `.custom` settings archive into one ZIP containing `Pro.key` plus the customization files.

**Do not treat the license-generator code as the architecture of a terminal emulator.** It only exposes how one external product packages/encodes its licensing and customization artifacts.

For NexTerm, the useful comparison is therefore the **product principles and workflow patterns associated with a professional terminal/network workspace**, not reproduction of MobaXterm's proprietary licensing mechanism.

---

# 2. What the reference repository actually does

## 2.1 License model

The generator defines three license type values:

```text
Professional = 1
Educational  = 3
Personal     = 4
```

It constructs a deterministic license string from:

```text
type
username
major version
minor version
user count
```

The source format is conceptually:

```text
TYPE#USERNAME|VERSION#COUNT#VERSION3MINOR6MINOR#0#0#0#
```

The string is converted to bytes, transformed with a stateful XOR-based routine starting from `0x787`, then encoded with a custom little-endian Base64-like encoder.

This is an application-specific reversible obfuscation/encoding scheme, **not a modern cryptographic licensing architecture**.

## 2.2 License packaging

The generated text becomes:

```text
Pro.key
```

and JSZip packages it as:

```text
Custom.mxtpro
```

The merger then:

1. Reads the license ZIP.
2. Extracts `Pro.key`.
3. Reads the `.custom` ZIP.
4. Copies the customization files into a new ZIP.
5. Writes `Pro.key` into the resulting archive.
6. Saves the merged archive as `Custom.mxtpro`.

---

# 3. NexTerm current architecture

NexTerm is materially more sophisticated architecturally than the reference keygen project.

Current stack:

```text
Frontend
  HTML / CSS / JavaScript
  xterm.js
        |
        v
Wails v2 bridge
        |
        v
Go application layer
        |
        +-- SSH session engine
        +-- SFTP manager
        +-- Tunnel manager
        +-- Macro manager
        +-- Security manager
        +-- DPAPI vault
        +-- Session store
        +-- Network tools
        +-- Windows ConPTY
```

The repository already contains dedicated packages for SSH, SFTP, tunnels, macros, network utilities, security, vault storage, session storage, and Windows ConPTY.

---

# 4. What NexTerm already has

These areas are already reasonably represented and should **not** be treated as missing fundamentals.

## Terminal / session foundation

- SSH interactive PTY sessions
- xterm.js terminal rendering
- terminal input/write path
- terminal resize
- keep-alive
- local Windows ConPTY
- PowerShell/CMD local terminal
- tab IDs and live-session tracking
- session tree
- folders
- move/duplicate/delete session operations
- Quick Connect
- session import/export
- saved session persistence

## SSH

- password authentication
- private-key authentication
- encrypted key/passphrase support
- startup command
- configurable terminal type
- keep-alive interval
- bastion/jump host support
- separate bastion credentials

## SFTP

Current manager already supports:

- directory listing
- metadata
- upload
- download
- delete
- rename
- mkdir
- empty-file creation
- text-file read
- text-file write
- remote stat

## Tunneling

Current tunnel manager already models:

```text
Local forwarding
Remote forwarding
Dynamic/SOCKS5 mode
```

and persists tunnel configuration.

## Automation

The macro manager already supports:

- named macros
- descriptions
- command sequences
- delays
- categories
- persistence
- seeded operational playbooks

## Security foundation

NexTerm already has a strong starting point:

- Windows DPAPI for stored passwords
- encrypted vault files
- vault-key references instead of plaintext passwords in session JSON
- security policy object
- protocol enable/disable controls
- password-saving control
- clipboard/file-transfer controls
- audit-log policy flag

## Network tooling

Already present:

- ping
- DNS
- concurrent TCP port scanning
- common-service identification
- MD5/SHA1/SHA256/SHA512 hashing

## Windows integration

Already present:

- ConPTY
- native file dialogs
- Task Manager launch
- Device Manager launch
- Resource Monitor launch
- elevated CMD/PowerShell launch

---

# 5. High-priority gaps

These are the areas I would implement next.

---

## GAP-01 — Host-key verification is not production-grade

### Current problem

The SSH client currently uses:

```go
HostKeyCallback: ssh.InsecureIgnoreHostKey()
```

for both the target host and the bastion.

That means NexTerm is not performing normal SSH host identity verification.

### Why this matters

A professional SSH client needs protection against:

- MITM attacks
- unexpected host replacement
- DNS redirection
- compromised network paths

### Required implementation

Build a real host-key subsystem:

```text
known_hosts database
        |
        +-- first connection -> prompt user
        |
        +-- known fingerprint -> accept
        |
        +-- changed fingerprint -> hard warning/block
        |
        +-- user-approved fingerprint -> persist
```

Recommended model:

```go
HostKeyRecord {
    Host
    Port
    Algorithm
    FingerprintSHA256
    FirstSeen
    LastSeen
}
```

Add UI states:

```text
Unknown Host
Known Host
Host Key Changed
Host Key Rejected
```

Add:

- fingerprint display
- SHA256 fingerprint
- remove/forget host key
- trust-once
- trust-and-save
- changed-key override only after explicit user action

**Priority: P0**

---

# 6. GAP-02 — SSH authentication architecture needs to become extensible

Current `buildAuthMethods()` effectively chooses:

```text
private key OR password
```

The session model already hints at:

```text
password
key
agent
```

but the actual authentication abstraction should be expanded.

### Required design

Create:

```text
AuthProvider interface
    |
    +-- PasswordAuth
    +-- PrivateKeyAuth
    +-- SSHAgentAuth
    +-- KeyboardInteractiveAuth
    +-- CertificateAuth
```

Support:

- ssh-agent
- keyboard-interactive
- multiple identity files
- encrypted private keys
- OpenSSH certificate authentication
- authentication-method fallback
- agent forwarding policy

**Priority: P0**

---

# 7. GAP-03 — Session tree needs richer semantics

NexTerm has a tree, but a professional terminal client needs more metadata and operations around sessions.

### Add

```text
Session
    |
    +-- Tags
    +-- Color
    +-- Description
    +-- Group
    +-- Favorites
    +-- Recent
    +-- Last connected
    +-- Last status
    +-- Connection profile
```

### Add actions

```text
Open
Open in New Tab
Open in New Window
Duplicate
Rename
Move
Favorite
Copy
Export
Delete
Reconnect
Open SFTP
Open Tunnel
Open RDP
Open Terminal
```

### Search

Implement global session search:

```text
Ctrl+K
```

Search by:

```text
name
host
username
folder
tags
protocol
```

**Priority: P1**

---

# 8. GAP-04 — Session templates / connection profiles

MobaXterm-like workflows benefit from creating sessions quickly.

Add reusable templates:

```text
Linux SSH
Oracle BRM Server
Database Server
Bastion
Windows RDP
Serial Device
SFTP Server
Local Shell
```

A template should define defaults while allowing per-session overrides.

Example:

```text
Template: Oracle BRM
Default Port: 22
Terminal: xterm-256color
Startup:
    cd $PIN_HOME
Keepalive: 15
Theme: enterprise-dark
```

**Priority: P1**

---

# 9. GAP-05 — SFTP implementation is functional but not professional-grade

Current SFTP coverage is good for an MVP, but production file management needs more.

### Missing depth

- recursive folder deletion
- recursive upload
- recursive download
- background transfer queue
- transfer progress
- transfer speed
- ETA
- pause/cancel
- retry
- overwrite prompts
- conflict handling
- resume/partial transfer
- permissions editing
- chmod
- chown where supported
- timestamp preservation
- symlink handling
- hidden-file toggle
- sorting/filtering
- multi-select
- drag/drop directory transfers

### Required architecture

```text
TransferManager
    |
    +-- Queue
    +-- Worker Pool
    +-- Progress Events
    +-- Cancellation
    +-- Retry
    +-- Resume
```

Do not block the UI thread for large transfers.

**Priority: P0/P1**

---

# 10. GAP-06 — Embedded editor needs real editing capabilities

The repository currently reads/writes remote text, with a stated 2 MB read limit.

For a professional workflow, make this a real remote editor.

### Required

- syntax highlighting
- language detection
- search
- replace
- line numbers
- dirty state
- save
- save-as
- undo/redo
- encoding detection
- large-file protection
- reload
- remote file change detection
- conflict warning before overwrite

### Stronger save workflow

```text
Read remote file
      |
      v
Local temporary buffer
      |
      v
User edits
      |
      v
Save
      |
      v
Upload temporary file
      |
      v
Atomic remote replace
```

Avoid blindly overwriting the remote file.

**Priority: P1**

---

# 11. GAP-07 — Terminal productivity features

xterm.js provides the rendering layer, but NexTerm should add a richer terminal experience.

Implement:

- scrollback search
- Ctrl+F terminal search
- copy mode
- selection improvements
- bracketed paste handling
- hyperlinks
- clickable paths/URLs
- clear screen
- clear scrollback
- terminal zoom
- bell notification policy
- copy-on-select
- pane title from remote hostname/process
- terminal logging
- session transcript
- timestamped terminal output
- command history UI
- command recall/search
- reconnect preserving tab metadata

### Important

Terminal search should search the xterm buffer rather than the raw DOM.

**Priority: P1**

---

# 12. GAP-08 — Split panes need a reusable layout model

NexTerm already has:

```text
single
vertical 2-way
horizontal 2-way
2x2
```

The next step is making the layout model compositional.

Use a tree:

```text
SplitNode
    |
    +-- Pane
    |
    +-- Split
         |
         +-- Pane
         +-- Split
```

Then users can create:

```text
3 panes
1x3
3+1
nested splits
resizable panes
```

This avoids hardcoding only four-pane layouts.

**Priority: P1**

---

# 13. GAP-09 — MultiExec needs safety controls

Broadcast execution is powerful and therefore dangerous.

Current behavior broadcasts data to active SSH and local tabs.

Add:

```text
Target selection
Preview
Confirmation
Protocol filtering
Folder filtering
Tagged selection
Dry run
Per-target status
Stop remaining
Failure isolation
Output aggregation
```

Example UI:

```text
Target count: 17

Command:
systemctl restart pin

[Preview targets]
[x] Production
[ ] UAT
[ ] Testing

[ Execute on 5 targets ]
```

For destructive commands, require an explicit confirmation policy.

**Priority: P0**

---

# 14. GAP-10 — Macro engine needs a real execution model

Current macros are sequences of command strings plus delay.

Make them structured:

```text
Macro
  |
  +-- Step
       +-- command
       +-- delay
       +-- waitForText
       +-- timeout
       +-- continueOnError
       +-- conditional
```

Example:

```text
1. send "cd $PIN_HOME"
2. wait for "$"
3. send "./pin_ctl status"
4. wait for "running"
5. continue
```

Support variables:

```text
${HOST}
${USER}
${SESSION_NAME}
${DATE}
${ENV:PIN_HOME}
```

Also add execution logs.

**Priority: P1**

---

# 15. GAP-11 — Audit logging is declared but not implemented deeply enough

There is a `RequireAuditLog` policy flag, but a policy object alone is not an audit system.

Implement an append-only audit event model:

```text
timestamp
user
session
protocol
host
action
result
duration
source
```

Examples:

```text
SSH_CONNECTED
SSH_AUTH_FAILED
SSH_DISCONNECTED
FILE_UPLOADED
FILE_DOWNLOADED
FILE_DELETED
TUNNEL_STARTED
TUNNEL_STOPPED
MACRO_EXECUTED
MULTIEXEC_EXECUTED
PASSWORD_SAVED
PASSWORD_DELETED
SETTINGS_CHANGED
```

Store sensitive values out of logs.

Add export:

```text
audit-2026-09.csv
audit-2026-09.json
```

**Priority: P0**

---

# 16. GAP-12 — Security policy must actually enforce behavior

The current security manager stores flags such as:

```text
AllowSSH
AllowSFTP
AllowRDP
AllowVNC
AllowTelnet
AllowSerial
AllowPasswordSaving
AllowClipboardSharing
AllowFileTransfers
RequireAuditLog
```

The important next step is enforcing these policies at the application boundary.

For example:

```text
App.OpenSession()
    |
    v
Policy.CheckProtocol(SSH)
    |
    +-- denied -> error + audit event
    |
    +-- allowed -> connect
```

Do the same for:

- SFTP
- RDP
- VNC
- serial
- file transfers
- clipboard
- password saving
- macro execution
- command broadcasting

Never rely only on hiding UI controls.

**Priority: P0**

---

# 17. GAP-13 — Credentials should be separated further

The vault approach is a good foundation, but the session profile still contains:

```text
KeyPassphrase
```

as a normal model field.

Do not persist private-key passphrases in the regular session JSON.

Use:

```text
VaultKey
JumpVaultKey
PrivateKeyReference
```

and put secrets exclusively in the vault.

Also consider:

- Secure memory handling
- minimizing plaintext secret lifetime
- zeroing sensitive buffers where practical
- vault integrity checking
- vault migration/versioning

**Priority: P0**

---

# 18. GAP-14 — File permissions on configuration files

Some NexTerm configuration files are written with:

```text
0644
```

while the vault is tighter.

Make security-sensitive configuration files restrictive.

Recommended Windows-oriented principle:

```text
sessions
security policy
tunnel configuration
macro configuration
audit state
```

should not be broadly writable/readable when equivalent Windows ACL controls are available.

Create a centralized secure-storage helper rather than setting permissions ad hoc.

**Priority: P1**

---

# 19. GAP-15 — Import/export needs validation

Current session import directly unmarshals JSON and replaces the root tree.

Strengthen it.

### Validate

- schema version
- required IDs
- duplicate IDs
- invalid protocol
- invalid ports
- invalid path fields
- unsupported authentication mode
- dangerous command configuration
- malformed folder structure

Use:

```text
SchemaVersion
Migration()
Validate()
Normalize()
```

before replacing active state.

**Priority: P1**

---

# 20. GAP-16 — Transactional persistence

The current session store rewrites the JSON file directly.

Improve persistence:

```text
Serialize
   |
   v
temporary file
   |
   v
fsync
   |
   v
atomic rename
```

For critical configuration, maintain a backup:

```text
sessions.json
sessions.json.bak
```

and recover automatically after corruption.

The same model should be used for:

```text
sessions
macros
tunnels
security
customizer
```

**Priority: P1**

---

# 21. GAP-17 — Connection lifecycle management needs to be centralized

The application currently keeps live SSH sessions and local terminals in separate maps.

Create a protocol-neutral connection abstraction.

Example:

```go
type Connection interface {
    Write([]byte) error
    Resize(cols, rows int) error
    Close() error
    State() ConnectionState
}
```

Then adapters:

```text
SSHConnection
LocalPTYConnection
TelnetConnection
SerialConnection
RDPConnection
VNCConnection
```

This matches the direction already documented in the SSH session code and makes multi-protocol support much easier.

**Priority: P0**

---

# 22. GAP-18 — Explicit connection state machine

Implement:

```text
Disconnected
   |
Connecting
   |
Authenticating
   |
VerifyingHost
   |
Connected
   |
Degraded
   |
Reconnecting
   |
Disconnected
```

Do not infer connection health only from whether a pointer exists in `a.tabs`.

Expose:

```text
ConnectionState
LastError
ConnectedAt
DisconnectedAt
ReconnectAttempt
Latency
```

**Priority: P0**

---

# 23. GAP-19 — Automatic reconnect

Keepalive exists, but keepalive is not reconnection.

Implement configurable policies:

```text
Disabled
Immediate
Exponential Backoff
```

Example:

```text
1s
2s
4s
8s
16s
30s max
```

Stop reconnecting after an authentication failure or explicit user disconnect.

Preserve:

- tab
- terminal dimensions
- session metadata
- SFTP state where possible

**Priority: P0**

---

# 24. GAP-20 — Bookmarks and portable connection metadata

A major professional-client pattern is separating:

```text
saved session
quick bookmark
recent session
favorite session
```

Add:

```text
Favorites
Recent
Pinned
Tags
```

Provide one-click access from the sidebar.

**Priority: P1**

---

# 25. GAP-21 — Plugin/extension architecture

This is one of the largest strategic gaps.

The reference MobaXterm ecosystem is strong partly because many utilities can be integrated into one workstation.

NexTerm should create a controlled extension model rather than hardcoding everything into `app.go`.

Possible architecture:

```text
PluginManager
   |
   +-- Built-in plugins
   +-- External plugins
   +-- Version checking
   +-- Capability permissions
```

Plugin capabilities:

```text
terminal
session
sftp
network
commands
ui
context-menu
protocol
```

Each plugin should have explicit permissions.

Do **not** allow arbitrary plugins unrestricted access to credentials.

**Priority: P1 / long-term**

---

# 26. GAP-22 — Integrated tools should become first-class workspace tabs

The network toolbox already exists. Expand the concept.

Workspace tabs:

```text
Terminal
SFTP
Port Scanner
Ping
DNS
Hash
SSH Key Generator
Tunnel Manager
Macro Runner
Session Manager
Log Viewer
Audit Viewer
```

This creates one coherent workspace rather than a collection of modal dialogs.

**Priority: P1**

---

# 27. GAP-23 — SSH key management

The network toolbox has SSH key generation, but a professional application should also manage identities.

Add:

```text
SSH Keys
   |
   +-- Generate
   +-- Import
   +-- Export public key
   +-- Rename
   +-- Fingerprint
   +-- View algorithm
   +-- Add to ssh-agent
   +-- Remove from ssh-agent
```

Support common key families appropriate for the application.

**Priority: P1**

---

# 28. GAP-24 — RDP/VNC/Serial/Telnet need common adapter contracts

The session model already reserves protocol values:

```text
ssh
sftp
rdp
vnc
telnet
serial
local
```

but the architecture should make these concrete protocol adapters rather than just profile fields.

Use:

```text
ProtocolFactory
    |
    +-- SSH
    +-- SFTP
    +-- RDP
    +-- VNC
    +-- Telnet
    +-- Serial
    +-- Local
```

Every protocol should expose:

```text
Connect
Disconnect
State
Metadata
Capabilities
```

**Priority: P1**

---

# 29. GAP-25 — Clipboard policy needs actual enforcement

The security policy has:

```text
AllowClipboardSharing
```

but terminal clipboard behavior needs a centralized policy layer.

Define:

```text
ClipboardPolicy
    |
    +-- Copy local
    +-- Paste remote
    +-- Copy remote
    +-- Paste local
```

Support per-session restrictions in addition to global policy.

**Priority: P1**

---

# 30. GAP-26 — Dangerous-command controls

A professional administrative tool benefits from command-risk controls.

Add configurable command rules:

```text
deny:
    rm -rf /
    mkfs
    shutdown
    reboot
```

But avoid pretending that a simple blacklist is security. It is only a UX safety feature.

A stronger model is:

```text
CommandPolicy
    |
    +-- Warn
    +-- Confirm
    +-- Block
```

with command classification.

Never advertise this as a sandbox.

**Priority: P1**

---

# 31. GAP-27 — Session logging and replay

Add optional terminal logging:

```text
Session
  |
  +-- Live terminal
  +-- Transcript
  +-- Metadata
  +-- Audit events
```

Store:

```text
timestamp
direction
data
```

Support:

- save session log
- search
- redact sensitive input
- export

Do not record passwords typed into terminals by default.

**Priority: P1**

---

# 32. GAP-28 — Performance architecture for many sessions

The product should be designed for:

```text
1 session
10 sessions
50 sessions
100+ sessions
```

Avoid assumptions that every terminal is always active.

Introduce:

```text
ConnectionManager
SessionRegistry
EventRouter
ResourceLimiter
```

Track:

```text
active SSH connections
idle connections
PTY workers
SFTP workers
transfer workers
tunnel workers
```

Add configurable resource limits.

**Priority: P1**

---

# 33. GAP-29 — Better event architecture

The application currently emits events such as:

```text
terminal:data:<tabID>
terminal:closed:<tabID>
```

As the system grows, use typed event families.

Example:

```text
connection.status
connection.data
connection.error
connection.closed

transfer.started
transfer.progress
transfer.completed
transfer.failed

tunnel.status

audit.event

macro.started
macro.step
macro.completed
```

Payloads should be structured objects rather than overloaded strings.

**Priority: P1**

---

# 34. GAP-30 — UI customization / white-label system

NexTerm already has a customizer configuration.

Extend it to support:

```text
Application name
Logo
Company name
Startup message
Theme
Default font
Default SSH port
Default session templates
Security policy
Disabled features
```

The important principle is:

```text
Customizer -> configuration
               |
               v
             runtime
```

Avoid building separate custom binaries for every corporate configuration unless distribution requirements demand it.

**Priority: P1**

---

# 35. Recommended implementation order

## Phase 1 — Security + reliability

Implement first:

```text
1. Host-key verification
2. Connection state machine
3. Automatic reconnect
4. Policy enforcement
5. Remove key-passphrase persistence
6. Audit logging
7. Transactional config storage
8. Import validation
9. MultiExec safety controls
```

This phase turns the current MVP into a safer professional tool.

---

## Phase 2 — Core productivity

```text
10. Global session search
11. Favorites / recents / tags
12. Session templates
13. Terminal search
14. Terminal logging
15. Structured macro engine
16. Better split-layout tree
17. Better clipboard handling
```

---

## Phase 3 — File-management depth

```text
18. Transfer queue
19. Progress/cancel/retry
20. Recursive transfers
21. Resume
22. Permissions
23. Better remote editor
24. Conflict-safe save
```

---

## Phase 4 — Multi-protocol workstation

```text
25. Protocol adapter interface
26. SSH-agent
27. Keyboard-interactive auth
28. RDP adapter
29. VNC adapter
30. Serial adapter
31. Telnet adapter
```

---

## Phase 5 — Extensibility

```text
32. Plugin manager
33. Plugin capability permissions
34. Tool/plugin workspace tabs
35. Extension API
36. Versioned configuration/schema migrations
```

---

# 36. Proposed target architecture

After the above work, the architecture should evolve toward:

```text
                         ┌─────────────────────────┐
                         │       NexTerm UI        │
                         │                         │
                         │ Tabs / Tree / Panes     │
                         │ SFTP / Tools / Macros   │
                         └────────────┬────────────┘
                                      │
                              Typed Event Bus
                                      │
                         ┌────────────▼────────────┐
                         │       App Facade        │
                         │                         │
                         │ policy / audit / state │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
             ConnectionManager   TransferManager   PluginManager
                    │
          ┌─────────┼──────────┐
          │         │          │
          ▼         ▼          ▼
         SSH      Local      Protocol adapters
                              │
                   ┌──────────┼───────────┐
                   │          │           │
                  RDP        VNC       Serial/Telnet

                    ┌───────────────────────┐
                    │ Security subsystem    │
                    │                       │
                    │ Host keys             │
                    │ DPAPI vault           │
                    │ Policy enforcement    │
                    │ Audit log             │
                    └───────────────────────┘

                    ┌───────────────────────┐
                    │ Persistent state      │
                    │                       │
                    │ sessions              │
                    │ macros                │
                    │ tunnels               │
                    │ customizer            │
                    │ schema migrations     │
                    └───────────────────────┘
```

---

# 37. Specific code issues worth fixing immediately

## SSH host key

Current:

```go
HostKeyCallback: ssh.InsecureIgnoreHostKey()
```

Replace with a real callback backed by persistent known-host data.

This is the single most important security issue found in the current SSH implementation.

## Secret persistence

Avoid keeping:

```go
KeyPassphrase string
```

in the normal session profile.

Move secret material to the vault.

## Configuration writes

Replace direct:

```go
os.WriteFile(...)
```

for important state with atomic save operations.

## Session import

Do not immediately replace the active root tree after JSON unmarshalling.

Use:

```text
parse
validate
normalize
migrate
commit
```

## MultiExec

Do not treat:

```go
BroadcastCommand(data)
```

as sufficient for a professional broadcast system.

Introduce target resolution and explicit execution policy.

---

# 38. What NOT to copy from the MobaXterm keygen repository

Do not copy these aspects into NexTerm:

```text
MobaXterm-specific license string format
MobaXterm Pro.key format
MobaXterm custom license encoding
MobaXterm activation behavior
MobaXterm proprietary customization archive semantics
```

Those are implementation details of another product.

Use the reference project only as reverse-engineering evidence about its own file format and as an example of a compact client-side utility.

---

# 39. Final gap ranking

| Area | Current NexTerm | Priority |
|---|---|---:|
| SSH terminal | Strong MVP | — |
| SFTP | Functional MVP | P1 |
| SSH host-key verification | Missing / unsafe | **P0** |
| Connection state | Basic | **P0** |
| Reconnect | Incomplete | **P0** |
| DPAPI vault | Good foundation | P0 |
| Secret separation | Needs hardening | **P0** |
| Security policy enforcement | Needs enforcement layer | **P0** |
| Audit logging | Flag exists, depth missing | **P0** |
| MultiExec safety | Needs controls | **P0** |
| Session tree | Good foundation | P1 |
| Session search/tags/favorites | Limited | P1 |
| Session templates | Missing | P1 |
| Terminal search/productivity | Limited | P1 |
| Macro engine | Basic | P1 |
| SFTP transfer engine | Basic | P0/P1 |
| Remote editor | Basic | P1 |
| Tunnels | Good foundation | P1 |
| Network toolbox | Good foundation | P1 |
| SSH agent | Missing | P0/P1 |
| RDP | Profile/integration direction | P1 |
| VNC | Needs real adapter | P1 |
| Serial | Needs full adapter | P1 |
| Telnet | Needs adapter | P1 |
| Plugin system | Missing | P1/Long-term |
| White-label customizer | Foundation exists | P1 |
| Transactional storage | Missing | P1 |
| Schema migration | Missing | P1 |
| Typed event bus | Missing | P1 |
| Large-scale session/resource management | Limited | P1 |

---

# 40. The strategic conclusion

NexTerm is **not missing “MobaXterm features” in the simple sense**. Its current repository already contains a substantial terminal-client foundation.

The most important work now is to move it from:

```text
feature-rich prototype
```

to:

```text
reliable professional terminal workstation
```

The highest-value sequence is:

```text
Security
    ↓
Connection lifecycle
    ↓
Transfer engine
    ↓
Terminal productivity
    ↓
Session management
    ↓
Multi-protocol adapters
    ↓
Plugin architecture
```

The reference keygen repository does **not** justify adding any licensing/activation subsystem to NexTerm. For NexTerm itself, the relevant equivalent is a proper application entitlement/version/configuration architecture if you eventually decide to commercialize it, implemented independently rather than reproducing another application's license system.
