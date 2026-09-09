// ==========================================================================
// NexTerm — Theme Manager
// Injects and coordinates design tokens into CSS variables per UI/UX Plan
// ==========================================================================

import { tokens } from './tokens.js';

export function applyDesignTokens() {
  const root = document.documentElement;
  if (!root || !root.style) return;

  const setProp = (prop, val) => {
    if (typeof root.style.setProperty === "function") {
      root.style.setProperty(prop, val);
    } else {
      root.style[prop] = val;
    }
  };

  // Colors
  Object.entries(tokens.colors).forEach(([k, v]) => {
    setProp(`--nex-${camelToKebab(k)}`, v);
  });

  // Spacing
  Object.entries(tokens.spacing).forEach(([k, v]) => {
    setProp(`--nex-space-${k}`, v);
  });

  // Radius
  Object.entries(tokens.radius).forEach(([k, v]) => {
    setProp(`--nex-radius-${k}`, v);
  });

  // Typography
  Object.entries(tokens.typography).forEach(([k, v]) => {
    setProp(`--nex-typo-${camelToKebab(k)}`, v);
  });

  // Shadows
  Object.entries(tokens.shadows).forEach(([k, v]) => {
    setProp(`--nex-shadow-${k}`, v);
  });

  // Transitions
  Object.entries(tokens.transitions).forEach(([k, v]) => {
    setProp(`--nex-trans-${k}`, v);
  });
}

function camelToKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
