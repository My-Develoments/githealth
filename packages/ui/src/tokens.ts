export const tokens = {
  colors: {
    background: {
      nightBase: "#050B17",
      panelBase: "#0B1220",
      panelElevated: "#101A2B",
      surfaceSubtle: "#111D2E",
      surfaceStronger: "#132235"
    },
    text: {
      primary: "#EAF3FF",
      muted: "#9AA8BB",
      secondaryMuted: "#7E8EA6",
      inverse: "#020812"
    },
    accent: {
      cyan: "#4DD7FF",
      blue: "#3A7BFF",
      violet: "#8B5CF6",
      magenta: "#C855F7",
      green: "#34D399",
      amber: "#FBBF24",
      red: "#F87171",
      white: "#EAF3FF"
    },
    semantic: {
      healthy: "#34D399",
      warning: "#FBBF24",
      critical: "#F87171",
      neutral: "#4DD7FF",
      unknown: "#7E8EA6"
    }
  },
  typography: {
    fontFamily: {
      sans: '"Sora", "IBM Plex Sans", "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace'
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    size: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.375rem",
      xxl: "1.875rem"
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.45,
      relaxed: 1.6
    },
    tracking: {
      label: "0.08em",
      normal: "0.01em"
    }
  },
  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px"
  },
  radii: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    xxl: "24px"
  },
  borders: {
    subtle: "1px solid rgba(234, 243, 255, 0.14)",
    medium: "1px solid rgba(234, 243, 255, 0.22)",
    strong: "1.5px solid rgba(77, 215, 255, 0.55)"
  },
  shadows: {
    panel: "0 12px 32px rgba(2, 8, 18, 0.38)",
    focusGlow: "0 0 0 2px rgba(77, 215, 255, 0.46)",
    activeGlow: "0 0 0 1px rgba(77, 215, 255, 0.45), 0 0 24px rgba(77, 215, 255, 0.2)",
    healthyGlow: "0 0 24px rgba(52, 211, 153, 0.25)",
    warningGlow: "0 0 24px rgba(251, 191, 36, 0.25)",
    criticalGlow: "0 0 24px rgba(248, 113, 113, 0.25)"
  }
} as const;

export type StatusTone = keyof typeof tokens.colors.semantic;
