// ==========================================================================
// NexTerm — Centralized Design Token System
// One Dark-inspired developer workspace tokens per Modern UI/UX Redesign Plan
// ==========================================================================

export const tokens = {
  colors: {
    // Surfaces (macOS Dark Slate / Graphite)
    bgApp: "#0d0f17",
    bgSurface: "#131722",
    bgPanel: "#161b26",
    bgElevated: "#1c2230",
    bgGlass: "rgba(22, 27, 38, 0.75)",
    bgInput: "#0f121a",
    bgPill: "rgba(255, 255, 255, 0.05)",
    bgPillHover: "rgba(255, 255, 255, 0.09)",
    bgPillActive: "rgba(255, 255, 255, 0.14)",
    bgHover: "rgba(255, 255, 255, 0.05)",
    bgActive: "rgba(255, 255, 255, 0.09)",

    // Borders
    borderMuted: "rgba(255, 255, 255, 0.05)",
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    borderActive: "rgba(255, 255, 255, 0.15)",
    borderFocus: "#38bdf8",

    // Typography
    textPrimary: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textBright: "#ffffff",

    // Semantic Syntax Accents
    accentCyan: "#38bdf8",
    accentBlue: "#60a5fa",
    accentPurple: "#c084fc",
    accentGreen: "#34d399",
    accentRed: "#f87171",
    accentAmber: "#fbbf24",

    // Environment Colors (Soft Pastel Translucent)
    envProd: "#ef4444",
    envUat: "#f59e0b",
    envTest: "#10b981",
    envLocal: "#3b82f6",
    envClient: "#a855f7",
    envUser: "#64748b",

    // State Colors
    stateConnected: "#10b981",
    stateConnecting: "#f59e0b",
    stateFailed: "#ef4444",
    stateDisconnected: "#64748b",
    stateAttention: "#f59e0b"
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px"
  },

  radius: {
    xs: "4px",
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "18px",
    pill: "9999px"
  },

  typography: {
    fontSans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontMono: "'SF Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
    sizeXs: "10px",
    sizeSm: "11px",
    sizeBase: "12px",
    sizeMd: "13px",
    sizeLg: "14px",
    sizeXl: "16px",
    weightNormal: "400",
    weightMedium: "500",
    weightSemiBold: "600",
    weightBold: "700"
  },

  shadows: {
    sm: "0 1px 3px rgba(0, 0, 0, 0.3)",
    md: "0 4px 14px rgba(0, 0, 0, 0.35)",
    lg: "0 10px 28px rgba(0, 0, 0, 0.5)",
    macosSm: "0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)",
    macosMd: "0 6px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.07)",
    macosLg: "0 14px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.09)",
    popover: "0 12px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)",
    modal: "0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)"
  },

  transitions: {
    fast: "120ms cubic-bezier(0.16, 1, 0.3, 1)",
    normal: "200ms cubic-bezier(0.16, 1, 0.3, 1)",
    slow: "280ms cubic-bezier(0.16, 1, 0.3, 1)"
  }
};
