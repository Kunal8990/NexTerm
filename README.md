# NexTerm — Professional Desktop SSH & Systems Workspace

<div align="center">

[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://golang.org)
[![Wails v2](https://img.shields.io/badge/Wails-v2.9+-df1a5a?style=for-the-badge&logo=wails&logoColor=white)](https://wails.io)
[![xterm.js](https://img.shields.io/badge/xterm.js-v5.3+-000000?style=for-the-badge&logo=gnometerminal&logoColor=white)](https://xtermjs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://microsoft.com/windows)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.badge?style=for-the-badge)](#license)

**NexTerm** is an all-in-one desktop SSH client, terminal emulator, SFTP browser, and remote infrastructure workstation built with **Go**, **Wails v2**, and **xterm.js**. It features zero artificial limits, enterprise-grade security controls, visual SSH tunnel management, bastion jump hosts, multi-execution command broadcasting, macro automation, and multi-protocol remote desktop connectivity.

</div>

---

## 🌟 Key Features

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Terminal  Sessions  View  Tools  Tunneling  Split  Macros  Settings  Help              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Session] [Servers] [Tools] [Split ⮟] [MultiExec] [Tunneling] [Macros] [Settings] [Exit]│
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Quick connect...     │ [🏠] [Tab 1: prod-app-01] [Tab 2: db-cluster] [+]           [⚙] │
├────┬─────────────────┼────────────────────────────────┬────────────────────────────────┤
│ 📁 │ SFTP BROWSER    │ $ cd /opt/brm                  │ $ systemctl status oracle      │
│ ★  │ /opt/brm        │ $ ./pin_ctl status             │ ● oracle-rdbms.service         │
│ ⚡ │ ├─ bin          │ [ OK ] CM daemon active        │   Active: active (running)     │
│ ⇄  │ ├─ sys          ├────────────────────────────────┼────────────────────────────────┤
│ 📜 │ ├─ conf         │ $ df -h                        │ $ tail -f /var/log/syslog      │
│ 🛠  │ └─ pin.conf     │ /dev/sda1   500G  120G   380G   │ Mar 08 14:30:00 kernel: OK     │
├────┴─────────────────┴────────────────────────────────┴────────────────────────────────┤
│ 🟢 CONNECTED (4) • MultiExec Broadcast [Active] • Nexterm Tunnel: 2 Active • DPAPI Vault│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 📁 1. Graphical SFTP Browser & Embedded Editor (Nexterm Editor)
- **Shared Authentication**: Reuses the active SSH connection seamlessly without asking for passwords again.
- **Remote File Management**: Browse remote directory trees, create folders (`mkdir`), delete, rename, and download with native file save dialogs.
- **Drag-and-Drop Remote Upload**: Drop local files or directories directly onto the SFTP grid to upload in background.
- **Embedded Text Editor**: 1-click **Edit** opens remote configuration files, scripts, and logs in an in-app syntax editor with instant remote saving.

### ⇄ 2. Nexterm Tunnel Graphical Port Forwarding Manager
- **Local Port Forwarding**: Expose remote database ports (e.g., Oracle `1521`, MySQL `3306`, Postgres `5432`) locally on `127.0.0.1`.
- **Remote Port Forwarding**: Expose local test servers and services to remote SSH destinations.
- **Dynamic SOCKS5 Proxy**: Turn any remote SSH server into a secure local SOCKS5 proxy (e.g., `127.0.0.1:1080`).
- **Visual Status Management**: Real-time 🟢 Active / ⚪ Inactive status indicators, persistent configuration in `tunnels.json`, and 1-click start/stop.

### 🛡️ 3. SSH Gateway / Bastion Jump Host
- **Transparent Bastion Tunnels**: Connect to private hosts within isolated VPCs through intermediate Jump / Bastion hosts.
- **Two-Stage Multi-Stage Authentication**: Independent credential configuration for Bastion and Target hosts (Passwords, Vault Keys, or Private Key files).

### 🪟 4. Split Terminals (2-Way & 4-Way 2x2 Grid)
- **Flexible Layouts**:
  - `Single` full terminal view
  - `2-Way Vertical` (`Ctrl+Shift+\`)
  - `2-Way Horizontal` (`Ctrl+Shift+-`)
  - `4-Way 2x2 Grid`
- **Dynamic PTY Fit**: Automated column/row recalculation with `xterm-addon-fit` ensuring zero visual corruption or clipping.

### ⚡ 5. MultiExec Command Broadcasting
- Broadcast shell commands simultaneously across multiple remote servers in real time.
- **Scoped Targets**:
  - `All Connected Sessions`
  - `Selected Folder Hierarchy`
  - `Active Tab Only`

### 📜 6. Terminal Macro Automation Engine
- Record terminal keystrokes, save with custom names, and replay with 1-click on any single session or session group.
- **Pre-Seeded Playbooks**:
  - `System Diagnostics`: `uname -a; df -h; free -m; uptime; top -b -n 1 | head -n 20`
  - `Oracle BRM Status`: `cd $PIN_HOME; ./pin_ctl status; ps -ef | grep pin`
  - `BRM Restart`: `cd $PIN_HOME; ./pin_ctl stop; sleep 3; ./pin_ctl start`
  - `Network Ports Diagnostics`: `ss -tulpn; ip addr; netstat -rn`

### 🖥️ 7. Multi-Protocol Session Wizard
- **SSH**: Interactive PTY with Keep-Alive, Bastion Jump Host, and DPAPI password vault.
- **SFTP**: Standalone remote file explorer session.
- **RDP (Remote Desktop)**: Native Windows hardware-accelerated `mstsc.exe` integration with automated credential passing and multi-monitor settings.
- **Serial (COM)**: Automated COM port discovery (`COM1`–`COM8`) with configurable Baud Rates (9600 to 115200), Parity, Data Bits, and Stop Bits.
- **Local Shells**: Native PowerShell, Command Prompt (CMD), and WSL (Ubuntu/Debian) via ConPTY.

### 🛠️ 8. Integrated Network Toolbox
- **ICMP Ping**: Real-time ping latency test with packet loss statistics.
- **DNS Resolver**: Queries A, AAAA, and CNAME records for any domain or IP.
- **Concurrent Multi-Port Scanner**: Multi-threaded TCP port scanner testing common ports (21, 22, 80, 443, 1521, 3306, 5432, 8080) or custom port ranges.
- **Checksum & Hash Generator**: Computes SHA256, SHA1, and MD5 hashes.
- **SSH KeyGen**: Generates 2048/4096-bit RSA SSH key pairs in PEM and OpenSSH formats.

### 🔒 9. Enterprise Security Policies & NexTerm Customizer
- **Security Policy Enforcement**: Administrator toggles to allow or forbid specific protocols (SSH, SFTP, Telnet, FTP, RDP, VNC, Serial), enforce password complexity, or disable dangerous commands.
- **NexTerm Customizer**: Corporate white-label branding (Application Name, Logo Text, custom Startup/Splash messaging, and default company session catalogs).

### 🔑 10. Windows DPAPI Hardware-Bound Credential Vault
- Zero plain-text credentials on disk. All passwords and passphrases are encrypted using Windows DPAPI (`CryptProtectData`) tied to the local Windows user profile.

### 📈 11. Live Server Monitoring Dashboard
- **Real-Time Visual Sparklines**: Live canvas-rendered graphs for CPU utilization, RAM usage, and network RX/TX bandwidth (refreshed every 2.5s).
- **Out-of-Band SSH Probing**: Background diagnostic probes run on a dedicated SSH channel without interrupting or printing to your active interactive shell.
- **Process & Port Management**: Inspect listening ports, associated daemons, and PIDs. Terminate runaway processes with a single click.
- **Interactive User Management**: View active TTY logins and disconnect idle or unauthorized user sessions directly from the dashboard.
- **Storage Metrics**: Visual disk usage bars across all mounted remote filesystems.

### 🖥️ 12. X11 Forwarding & Local X Server Manager
- **Remote GUI App Display**: Seamless SSH X11 tunneling (`x11-req`) forwarding remote Linux graphical applications (e.g. `xclock`, `gedit`, `firefox`, database installers) directly to your Windows desktop.
- **Local X Server Detection & Launch**: Automatically detects and launches local Windows X servers (VcXsrv, Xming, GWSL) on display `:0` (port `6000`).

### 💾 13. Portable Session Tree Backup, Export & Import
- **Native File Dialogs**: Export your entire hierarchical session tree (folders, host configurations, environments, and jump host bindings) into a portable JSON backup file.
- **1-Click Import & Merge**: Restore or transfer session catalogs from another machine seamlessly with native file picker integration.

### 🎛️ 14. Adaptive Multi-Pane Workspace & Resizable Sidebar
- **Resizable Sidebar**: Drag the custom splitter bar to adjust the navigation and session panel width, with persistent state saved across sessions.
- **Intelligent Header Layering**: Eliminates redundant global tab bars when multiple split panes are open, providing a clean, single-layer header per pane.
- **Collapsible SFTP Dual Manager**: Easily toggle or drag the SFTP panel to expand terminal real estate when focusing on command execution.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend (HTML5 / Vanilla CSS / xterm.js)"]
        UI[Workspace & Tabbar]
        SFTPUI[SFTP Browser & Nexterm Editor]
        TunnelUI[Nexterm Tunnel Manager]
        MacroUI[Macro Recorder & Runner]
        ToolsUI[Network Toolbox Modal]
        SplitMgr[Split Layout Controller]
    end

    subgraph Wails ["Wails v2 Desktop Bridge"]
        Bridge[app.go Bridge APIs]
    end

    subgraph Backend ["Go Backend (internal/)"]
        SSH[sshsession: SSH & Bastion Engine]
        SFTPMgr[sftp: SFTP Manager]
        TunnelMgr[tunnel: SSH Tunnel Engine]
        MacroMgr[macro: Macro Manager]
        NetTools[nettools: Ping, DNS, PortScan, Hash]
        SecMgr[security: Policy & Customizer]
        Vault[vault: Windows DPAPI Vault]
        Store[store: Session Tree Store]
    end

    UI --> Bridge
    SFTPUI --> Bridge
    TunnelUI --> Bridge
    MacroUI --> Bridge
    ToolsUI --> Bridge
    SplitMgr --> Bridge

    Bridge --> SSH
    Bridge --> SFTPMgr
    Bridge --> TunnelMgr
    Bridge --> MacroMgr
    Bridge --> NetTools
    Bridge --> SecMgr
    Bridge --> Vault
    Bridge --> Store

    SSH -->|Jump Host Proxy| Bastion[SSH Bastion Gateway]
    Bastion --> Target[Remote Linux/Unix Hosts]
    SFTPMgr -->|Shares SSH Client| Target
    TunnelMgr -->|Local / Remote / SOCKS5| Target
```

---

## 🚀 Getting Started

### Prerequisites
- **Go 1.22+** ([golang.org](https://golang.org/dl/))
- **Wails CLI v2.9+** ([wails.io](https://wails.io/docs/gettingstarted/installation))
  ```powershell
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- **Node.js 18+** (Optional, for frontend asset modification)
- **Windows 10 / 11**

### Quick Launch
Simply double-click `run.bat` or execute in PowerShell:
```cmd
run.bat
```

### Build from Source
To compile a clean release executable:
```powershell
wails build
```
The compiled release executable will be available at:
```text
build\bin\nexterm.exe
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` | Open Universal Command Palette |
| `Ctrl + N` | New SSH Session Dialog |
| `Ctrl + T` | Open Local PowerShell Tab |
| `Ctrl + W` | Close Active Tab |
| `Ctrl + Shift + F` | Terminal In-Buffer Text Search |
| `Ctrl + Shift + \` | 2-Way Vertical Split |
| `Ctrl + Shift + -` | 2-Way Horizontal Split |
| `Alt + M` | Toggle MultiExec Command Broadcast |
| `Ctrl + Tab` | Next Tab |
| `Ctrl + Shift + Tab` | Previous Tab |
| `Ctrl + Shift + C` | Copy Selected Terminal Text |
| `Ctrl + Shift + V` / `Right Click` | Paste into Terminal |

---

## 📄 License

This project is licensed under the Apache License, Version 2.0 — see the [LICENSE](LICENSE) file for details.
