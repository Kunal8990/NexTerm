# NexTerm — SSH Gateway / Bastion Jump Host

> Repo: `kunal-gin/NexTerm`
> Note on the name: this feature is referred to elsewhere as **"Bordast"** — that's a
> typo. The actual code, UI labels, and README all call it **Bastion** / **Jump Host**.
> This document uses "Bastion" throughout.

## 1. What it does

A bastion (or "jump") host is an intermediate SSH server that sits between your
machine and a private target host — typically a server inside a VPC or subnet
that has no direct route from the internet. Instead of connecting straight to
the target, NexTerm:

1. Opens and authenticates a normal SSH connection to the **gateway** (the bastion).
2. Asks that gateway connection to open a TCP channel to the **target** host/port
   (an SSH-level port-forward, not a second network hop from your machine).
3. Runs the real SSH handshake and authentication for the target **through**
   that channel.

Your machine never talks to the target directly — every byte to and from it is
tunneled inside the encrypted connection to the gateway. This is the same
concept as `ssh -J bastion target` or a `ProxyJump` entry in `~/.ssh/config`.

```
┌──────────┐        SSH #1 (auth'd)        ┌──────────┐    SSH #2 (auth'd,     ┌──────────┐
│  NexTerm │ ─────────────────────────────▶│  Bastion │    tunneled inside     │  Target  │
│  client  │                                │  Gateway │───────SSH #1──────────▶│  Host    │
└──────────┘                                └──────────┘                       └──────────┘
```

## 2. Where the code lives

| Layer | File | Responsibility |
|---|---|---|
| Data model | `internal/model/session.go` | `SessionProfile` fields: `UseJumpHost`, `JumpHost`, `JumpPort`, `JumpUsername`, `JumpAuthType`, `JumpVaultKey`, `JumpPrivateKeyPath` |
| Tunnel logic | `internal/sshsession/ssh_session.go` | `Connect()` — dials the gateway, authenticates, then `bastionClient.Dial("tcp", target)` to open the tunneled channel |
| Auth building | `internal/sshsession/auth.go` | Builds `[]ssh.AuthMethod` for both the gateway and target legs (password / key / agent / keyboard-interactive) |
| Wiring | `internal/service/connection_manager.go` | `buildSSHConnectOptions()` — copies bastion fields from the saved profile into `sshsession.ConnectOptions`, resolves the gateway secret |
| Desktop bridge | `app.go` | `OpenSession`, `OpenSessionWithTabID`, `OpenSessionWithTabIDAndJumpSecret` — exposed to the frontend via Wails |
| Session dialog UI | `frontend/src/sessions/sessionDialog.js` | "Connect via SSH Jump Host" box: host/port/username/auth-method/key-path fields |
| Connect-time UI | `frontend/src/terminal/terminalManager.js` | `connectToSession()` — resolves the gateway secret before calling into the backend |
| Prompt dialog | `frontend/src/ui/modal.js` | `promptBastionSecretDialog()` — asks for a gateway password/passphrase when nothing is saved |

## 3. Backend connection flow (`internal/sshsession/ssh_session.go`)

`Connect(opts ConnectOptions)` branches on `opts.UseJumpHost`:

```go
if opts.UseJumpHost && opts.JumpHost != "" {
    // 1. Build auth methods for the GATEWAY (its own username/password/key)
    jumpAuth, _ := buildAuthMethods(jumpOpts)

    // 2. Dial + SSH-handshake the gateway directly
    bastionDirectConn, _ := net.DialTimeout("tcp", jumpAddr, timeout)
    bastionSSHConn, bastionChans, bastionReqs, _ :=
        ssh.NewClientConn(bastionDirectConn, jumpAddr, jumpConfig)
    bastionClient := ssh.NewClient(bastionSSHConn, bastionChans, bastionReqs)

    // 3. Ask the gateway to open a channel to the TARGET — this is the tunnel
    proxiedConn, _ := bastionClient.Dial("tcp", addr)
    conn = proxiedConn
} else {
    conn, _ = net.DialTimeout("tcp", addr, timeout)
}

// 4. Run the normal SSH handshake for the TARGET over `conn`
//    (works identically whether `conn` is a direct TCP socket or a
//    tunneled channel through the bastion — the target's own
//    authentication, host-key check, and PTY setup are unaffected)
sshConn, chans, reqs, _ := ssh.NewClientConn(conn, addr, config)
```

Two full SSH auth handshakes happen: one to the gateway, one to the target,
each with its own credentials. Host-key verification (via `internal/hostkey`)
runs against the **target's** known_hosts entry regardless of whether a
bastion is in play.

## 4. What was broken, and what "rebuilding" the feature meant

The tunnel logic above was already correct. The gap was entirely in how the
gateway's *credential* got from "the user typed it in" to "the backend used
it to authenticate" — that plumbing was incomplete:

- The session dialog captured a gateway password into a local JS variable,
  but never generated `profile.jumpVaultKey`. The vault-save call was
  gated on that key, so it silently never ran — nothing was ever persisted.
- On connect, `buildSSHConnectOptions` looked up `profile.JumpVaultKey` to
  fetch a saved password — and found nothing, for the same reason.
- The UI only had a plain password field for the gateway. There was no way
  to pick key-based auth for the bastion hop or point at a private key file,
  even though the backend (`JumpAuthType`, `JumpPrivateKeyPath`,
  `JumpKeyPassphrase`) already fully supported it.
- Editing a saved session with a bastion configured didn't reload the
  bastion fields into the dialog.
- There was no runtime path for an *unsaved* gateway password at all —
  `OpenSession`/`OpenSessionWithTabID` only ever took the target host's
  password as a parameter.

Net effect: bastion connections worked only when the gateway accepted
passwordless/agent auth. Any gateway requiring a password or an
encrypted-key passphrase failed on every connection attempt, with no clear
error pointing at why.

### The fix

**Backend**
- `connection_manager.go`: `OpenSession()` and `buildSSHConnectOptions()`
  now take a `jumpSecret` parameter. It's applied as `opts.JumpPassword` or
  `opts.JumpKeyPassphrase` depending on `JumpAuthType`, with the saved vault
  entry (`JumpVaultKey` / `JumpVaultKey + "_passphrase"`) used as a fallback
  when nothing is passed explicitly.
- `app.go`: added `OpenSessionWithTabIDAndJumpSecret(tabID, profile, password, jumpSecret)`.
  `OpenSessionWithTabID` and `OpenSession` are kept as thin backward-compatible
  wrappers (`jumpSecret = ""`), so nothing else in the codebase needed to change.

**Frontend**
- `sessionDialog.js`:
  - Added a Gateway Auth Method dropdown (Password / Private Key), a key-file
    picker with **Browse...**, and a key-passphrase field, matching the
    pattern already used for the target host's own auth section.
  - `jumpVaultKey` is now generated deterministically as `<vaultKey>_jump`
    when a session is saved, and reused (not regenerated) on every edit —
    same convention the app already uses for `passphraseVaultKey`
    (`vaultKey + "_passphrase"`).
  - The gateway password (or key passphrase) is now actually written to the
    vault via `SaveSessionPassword`, using that key.
  - Editing a session now correctly repopulates all bastion fields, instead
    of resetting them to defaults every time the dialog opens.
- `terminalManager.js` (`connectToSession`): before calling into the backend,
  if `profile.useJumpHost` is set, it now resolves the gateway secret the
  same way it already resolves the target password — check the vault first,
  and if nothing is saved, prompt for it — then passes it through to
  `OpenSessionWithTabIDAndJumpSecret`.
- `modal.js`: added `promptBastionSecretDialog()`, a minimal password/passphrase
  prompt scoped to the gateway. It intentionally does **not** reuse
  `promptPasswordDialog`/`promptPassphraseDialog` — those two mutate and
  persist the profile object they're given (`UpdateSession`/`AddSession`
  side effects), and pointing them at a bastion's host/username would have
  overwritten the *target* session's saved profile with gateway details.

## 5. How to use it (UI)

1. In the session dialog (SSH/SFTP protocol only), scroll to **"Connect via
   SSH Jump Host (Bastion Gateway Proxy)"** and check the box.
2. Fill in the gateway's host/IP and port (defaults to `22`).
3. Set the gateway username (defaults to `bastion`).
4. Choose the gateway's auth method:
   - **Password** — type it in; it's saved to the encrypted platform vault
     (Windows DPAPI / macOS Keychain / Linux Secret Service) unless left blank,
     in which case you'll be prompted for it on each connect.
   - **Private Key** — browse to the key file and, if it's encrypted, supply
     the passphrase (also vault-backed).
5. Save (and optionally connect). On connect, if no credential was saved,
   you'll see a dedicated **"SSH Gateway Password Authentication"** /
   **"Bastion Private Key Passphrase Required"** prompt before the target
   host's own auth prompt (if any).

## 6. Data flow at connect time

```
sessionDialog.js (save)
  └─ generates profile.jumpVaultKey = "<vaultKey>_jump"
  └─ SaveSessionPassword(jumpVaultKey [+ "_passphrase"], secret)
       └─ credentialService → OS-native encrypted vault

terminalManager.js: connectToSession(profile)
  ├─ resolve TARGET password/key/agent            (existing flow, unchanged)
  ├─ resolve GATEWAY secret (jumpAuthType-aware):
  │    1. HasSavedPassword / GetSessionPassphrase(jumpVaultKey[...])
  │    2. else → promptBastionSecretDialog()
  └─ App.OpenSessionWithTabIDAndJumpSecret(tabID, profile, password, jumpSecret)
        └─ app.go → connectionManager.OpenSession(ctx, tabID, profile, password, jumpSecret)
              └─ buildSSHConnectOptions(...)
                    ├─ opts.UseJumpHost / JumpHost / JumpPort / JumpUsername / JumpAuthType
                    ├─ opts.JumpPassword ⇐ jumpSecret   (if JumpAuthType == "password")
                    ├─ opts.JumpKeyPassphrase ⇐ jumpSecret (if JumpAuthType == "key")
                    └─ sshsession.Connect(opts)
                          ├─ auth + connect to GATEWAY
                          ├─ tunnel to TARGET through the gateway channel
                          └─ auth + connect to TARGET (existing target auth flow)
```

## 7. Known limitations / follow-ups not covered by this fix

- Only a single hop is supported (client → bastion → target). Multi-hop
  chains (bastion → bastion → target) would need `ConnectOptions` to accept
  a list of hops rather than one `Jump*` set.
- The gateway's host key is currently verified using the same
  `HostKeyCallback` as the target, backed by one shared `known_hosts` store —
  it works, but gateway and target entries aren't visually distinguished in
  the host-key-mismatch dialog.
- SFTP and port-forwarding (`internal/tunnel`) sessions don't yet reuse an
  already-open bastion-tunneled SSH client; each protocol session currently
  re-dials through the gateway independently.
