// ==========================================================================
// NexTerm — Centralized Design Token System
// One Dark-inspired developer workspace tokens per Modern UI/UX Redesign Plan
// ==========================================================================

export const tokens = {
  colors: {
    // Surfaces
    bgApp: "#161920",
    bgSurface: "#1e222b",
    bgPanel: "#21252b",
    bgElevated: "#282c34",
    bgInput: "#1a1d24",
    bgHover: "rgba(255, 255, 255, 0.05)",
    bgActive: "rgba(255, 255, 255, 0.09)",

    // Borders
    borderMuted: "#232731",
    borderSubtle: "#2d323d",
    borderActive: "#434956",
    borderFocus: "#61afef",

    // Typography
    textPrimary: "#abb2bf",
    textSecondary: "#828997",
    textMuted: "#5c6370",
    textBright: "#ffffff",

    // Semantic Syntax Accents
    accentCyan: "#56b6c2",
    accentBlue: "#61afef",
    accentPurple: "#c678dd",
    accentGreen: "#98c379",
    accentRed: "#e06c75",
    accentAmber: "#d19a66",

    // Environment Colors (Folder-driven)
    envProd: "#ef4444",
    envUat: "#f59e0b",
    envTest: "#10b981",
    envLocal: "#3b82f6",
    envClient: "#a855f7",
    envUser: "#64748b",

    // State Colors
    stateConnected: "#22c55e",
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
    xs: "2px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    pill: "9999px"
  },

  typography: {
    fontSans: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
    fontMono: "'Fira Code', Consolas, Monaco, monospace",
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
    md: "0 4px 12px rgba(0, 0, 0, 0.4)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.55)",
    popover: "0 12px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)",
    modal: "0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)"
  },

  transitions: {
    fast: "100ms ease",
    normal: "150ms ease",
    slow: "180ms ease"
  }
};
