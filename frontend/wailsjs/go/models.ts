export namespace hostkey {
	
	export class HostKeyEntry {
	    host: string;
	    keyType: string;
	    fingerprint: string;
	    sourceFile: string;
	    lineNumber: number;
	
	    static createFrom(source: any = {}) {
	        return new HostKeyEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.keyType = source["keyType"];
	        this.fingerprint = source["fingerprint"];
	        this.sourceFile = source["sourceFile"];
	        this.lineNumber = source["lineNumber"];
	    }
	}

}

export namespace macro {
	
	export class Macro {
	    id: string;
	    name: string;
	    description: string;
	    commands: string[];
	    delayMs: number;
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new Macro(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.commands = source["commands"];
	        this.delayMs = source["delayMs"];
	        this.category = source["category"];
	    }
	}

}

export namespace main {
	
	export class SFTPListResult {
	    path: string;
	    items: sftpmanager.SFTPItem[];
	
	    static createFrom(source: any = {}) {
	        return new SFTPListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.items = this.convertValues(source["items"], sftpmanager.SFTPItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SavedCredential {
	    sessionId: string;
	    sessionName: string;
	    host: string;
	    port: number;
	    username: string;
	    vaultKey: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedCredential(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.sessionName = source["sessionName"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.vaultKey = source["vaultKey"];
	        this.password = source["password"];
	    }
	}

}

export namespace model {
	
	export class SessionProfile {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    username: string;
	    authType?: string;
	    vaultKey?: string;
	    passphraseVaultKey?: string;
	    privateKeyPath?: string;
	    certificatePath?: string;
	    keyPassphrase?: string;
	    keyType?: string;
	    keyFingerprint?: string;
	    startupCommand?: string;
	    terminalType?: string;
	    theme?: string;
	    fontSize?: number;
	    keepAliveInterval?: number;
	    protocol?: string;
	    fontFamily?: string;
	    rows?: number;
	    cols?: number;
	    cursorStyle?: string;
	    cursorBlink?: boolean;
	    encoding?: string;
	    scrollback?: number;
	    workingDirectory?: string;
	    connectionTimeout?: number;
	    compression?: boolean;
	    useAgent?: boolean;
	    autoReconnect?: boolean;
	    reconnectAttempts?: number;
	    reconnectDelay?: number;
	    proxyType?: string;
	    proxyHost?: string;
	    proxyPort?: number;
	    proxyUsername?: string;
	    proxyPassword?: string;
	    foreground?: string;
	    background?: string;
	    cursorColor?: string;
	    selectionColor?: string;
	    ansiColors?: {[key: string]: string};
	    useJumpHost?: boolean;
	    jumpHost?: string;
	    jumpPort?: number;
	    jumpUsername?: string;
	    jumpAuthType?: string;
	    jumpVaultKey?: string;
	    jumpPrivateKeyPath?: string;
	    serialPort?: string;
	    baudRate?: number;
	    dataBits?: number;
	    stopBits?: number;
	    parity?: string;
	    rdpDomain?: string;
	    rdpWidth?: number;
	    rdpHeight?: number;
	    rdpFullScreen?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SessionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.authType = source["authType"];
	        this.vaultKey = source["vaultKey"];
	        this.passphraseVaultKey = source["passphraseVaultKey"];
	        this.privateKeyPath = source["privateKeyPath"];
	        this.certificatePath = source["certificatePath"];
	        this.keyPassphrase = source["keyPassphrase"];
	        this.keyType = source["keyType"];
	        this.keyFingerprint = source["keyFingerprint"];
	        this.startupCommand = source["startupCommand"];
	        this.terminalType = source["terminalType"];
	        this.theme = source["theme"];
	        this.fontSize = source["fontSize"];
	        this.keepAliveInterval = source["keepAliveInterval"];
	        this.protocol = source["protocol"];
	        this.fontFamily = source["fontFamily"];
	        this.rows = source["rows"];
	        this.cols = source["cols"];
	        this.cursorStyle = source["cursorStyle"];
	        this.cursorBlink = source["cursorBlink"];
	        this.encoding = source["encoding"];
	        this.scrollback = source["scrollback"];
	        this.workingDirectory = source["workingDirectory"];
	        this.connectionTimeout = source["connectionTimeout"];
	        this.compression = source["compression"];
	        this.useAgent = source["useAgent"];
	        this.autoReconnect = source["autoReconnect"];
	        this.reconnectAttempts = source["reconnectAttempts"];
	        this.reconnectDelay = source["reconnectDelay"];
	        this.proxyType = source["proxyType"];
	        this.proxyHost = source["proxyHost"];
	        this.proxyPort = source["proxyPort"];
	        this.proxyUsername = source["proxyUsername"];
	        this.proxyPassword = source["proxyPassword"];
	        this.foreground = source["foreground"];
	        this.background = source["background"];
	        this.cursorColor = source["cursorColor"];
	        this.selectionColor = source["selectionColor"];
	        this.ansiColors = source["ansiColors"];
	        this.useJumpHost = source["useJumpHost"];
	        this.jumpHost = source["jumpHost"];
	        this.jumpPort = source["jumpPort"];
	        this.jumpUsername = source["jumpUsername"];
	        this.jumpAuthType = source["jumpAuthType"];
	        this.jumpVaultKey = source["jumpVaultKey"];
	        this.jumpPrivateKeyPath = source["jumpPrivateKeyPath"];
	        this.serialPort = source["serialPort"];
	        this.baudRate = source["baudRate"];
	        this.dataBits = source["dataBits"];
	        this.stopBits = source["stopBits"];
	        this.parity = source["parity"];
	        this.rdpDomain = source["rdpDomain"];
	        this.rdpWidth = source["rdpWidth"];
	        this.rdpHeight = source["rdpHeight"];
	        this.rdpFullScreen = source["rdpFullScreen"];
	    }
	}
	export class TabSession {
	    id: string;
	    title: string;
	    profile: SessionProfile;
	    isConnected: boolean;
	    isLocal: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new TabSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.profile = this.convertValues(source["profile"], SessionProfile);
	        this.isConnected = source["isConnected"];
	        this.isLocal = source["isLocal"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Pane {
	    id: string;
	    title?: string;
	    activeTabId: string;
	    tabs: TabSession[];
	    row: number;
	    col: number;
	    rowSpan: number;
	    colSpan: number;
	    maximized?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Pane(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.activeTabId = source["activeTabId"];
	        this.tabs = this.convertValues(source["tabs"], TabSession);
	        this.row = source["row"];
	        this.col = source["col"];
	        this.rowSpan = source["rowSpan"];
	        this.colSpan = source["colSpan"];
	        this.maximized = source["maximized"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TreeNode {
	    id: string;
	    name: string;
	    session?: SessionProfile;
	    children?: TreeNode[];
	    expanded?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.session = this.convertValues(source["session"], SessionProfile);
	        this.children = this.convertValues(source["children"], TreeNode);
	        this.expanded = source["expanded"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Workspace {
	    id: string;
	    name: string;
	    layout: string;
	    activePaneId: string;
	    panes: Pane[];
	
	    static createFrom(source: any = {}) {
	        return new Workspace(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.layout = source["layout"];
	        this.activePaneId = source["activePaneId"];
	        this.panes = this.convertValues(source["panes"], Pane);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace nettools {
	
	export class PortScanResult {
	    port: number;
	    open: boolean;
	    service: string;
	    latency: string;
	
	    static createFrom(source: any = {}) {
	        return new PortScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.open = source["open"];
	        this.service = source["service"];
	        this.latency = source["latency"];
	    }
	}

}

export namespace security {
	
	export class SecurityPolicy {
	    allowSSH: boolean;
	    allowSFTP: boolean;
	    allowRDP: boolean;
	    allowVNC: boolean;
	    allowTelnet: boolean;
	    allowSerial: boolean;
	    allowPasswordSaving: boolean;
	    allowClipboardSharing: boolean;
	    allowFileTransfers: boolean;
	    requireAuditLog: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SecurityPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allowSSH = source["allowSSH"];
	        this.allowSFTP = source["allowSFTP"];
	        this.allowRDP = source["allowRDP"];
	        this.allowVNC = source["allowVNC"];
	        this.allowTelnet = source["allowTelnet"];
	        this.allowSerial = source["allowSerial"];
	        this.allowPasswordSaving = source["allowPasswordSaving"];
	        this.allowClipboardSharing = source["allowClipboardSharing"];
	        this.allowFileTransfers = source["allowFileTransfers"];
	        this.requireAuditLog = source["requireAuditLog"];
	    }
	}
	export class CustomizerConfig {
	    appName: string;
	    companyName: string;
	    companyLogoText: string;
	    splashMessage: string;
	    defaultSSHPort: number;
	    defaultTheme: string;
	    defaultFontSize: number;
	    security: SecurityPolicy;
	
	    static createFrom(source: any = {}) {
	        return new CustomizerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.companyName = source["companyName"];
	        this.companyLogoText = source["companyLogoText"];
	        this.splashMessage = source["splashMessage"];
	        this.defaultSSHPort = source["defaultSSHPort"];
	        this.defaultTheme = source["defaultTheme"];
	        this.defaultFontSize = source["defaultFontSize"];
	        this.security = this.convertValues(source["security"], SecurityPolicy);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace sftpmanager {
	
	export class SFTPItem {
	    name: string;
	    path: string;
	    size: number;
	    formattedSize: string;
	    isDir: boolean;
	    modTime: string;
	    permissions: string;
	    octalPerm: string;
	    extension: string;
	
	    static createFrom(source: any = {}) {
	        return new SFTPItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.formattedSize = source["formattedSize"];
	        this.isDir = source["isDir"];
	        this.modTime = source["modTime"];
	        this.permissions = source["permissions"];
	        this.octalPerm = source["octalPerm"];
	        this.extension = source["extension"];
	    }
	}

}

export namespace sshsession {
	
	export class ClassifiedError {
	    category: string;
	    message: string;
	    description: string;
	    rawError: string;
	
	    static createFrom(source: any = {}) {
	        return new ClassifiedError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.category = source["category"];
	        this.message = source["message"];
	        this.description = source["description"];
	        this.rawError = source["rawError"];
	    }
	}
	export class KeyInfo {
	    valid: boolean;
	    path?: string;
	    keyType: string;
	    fingerprint: string;
	    encrypted: boolean;
	    comment?: string;
	    hasCertificate?: boolean;
	    certificateType?: string;
	    certificateKeyId?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new KeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.path = source["path"];
	        this.keyType = source["keyType"];
	        this.fingerprint = source["fingerprint"];
	        this.encrypted = source["encrypted"];
	        this.comment = source["comment"];
	        this.hasCertificate = source["hasCertificate"];
	        this.certificateType = source["certificateType"];
	        this.certificateKeyId = source["certificateKeyId"];
	        this.error = source["error"];
	    }
	}

}

export namespace tunnel {
	
	export class TunnelConfig {
	    id: string;
	    name: string;
	    type: string;
	    sshHost: string;
	    sshPort: number;
	    sshUsername: string;
	    sshVaultKey?: string;
	    sshPrivateKeyPath?: string;
	    localPort: number;
	    remoteHost?: string;
	    remotePort?: number;
	    autoStart: boolean;
	    status: string;
	    errorMsg?: string;
	
	    static createFrom(source: any = {}) {
	        return new TunnelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.sshHost = source["sshHost"];
	        this.sshPort = source["sshPort"];
	        this.sshUsername = source["sshUsername"];
	        this.sshVaultKey = source["sshVaultKey"];
	        this.sshPrivateKeyPath = source["sshPrivateKeyPath"];
	        this.localPort = source["localPort"];
	        this.remoteHost = source["remoteHost"];
	        this.remotePort = source["remotePort"];
	        this.autoStart = source["autoStart"];
	        this.status = source["status"];
	        this.errorMsg = source["errorMsg"];
	    }
	}

}

