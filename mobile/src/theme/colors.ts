export const colors = {
  // ─────────────────────────────────────────
  // TradeRetro Backgrounds
  // ─────────────────────────────────────────

  background: "#090909",
  backgroundSecondary: "#0D0D0D",

  surface: "#111111",
  surfaceElevated: "#171717",
  surfaceHover: "#1C1C1C",

  // ─────────────────────────────────────────
  // Borders
  // ─────────────────────────────────────────

  border: "#232323",
  borderLight: "#2A2A2A",

  // ─────────────────────────────────────────
  // Text
  // ─────────────────────────────────────────

  textPrimary: "#F5F5F5",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",

  // ─────────────────────────────────────────
  // TradeRetro Accent
  // ─────────────────────────────────────────

  primary: "#F59E0B",
  primaryLight: "#FBBF24",
  primaryDark: "#D97706",

  // ─────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────

  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#4A9EDA",

  // ─────────────────────────────────────────
  // Trading
  // ─────────────────────────────────────────

  bullish: "#10B981",
  bearish: "#EF4444",

  // ─────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",

  // _________________________________________
  // Graph Lines
  // _________________________________________

  positive: "#16A34A",
  negative: "#DC2626",

  textOnPrimary: "#FFFFFF",
} as const;

export type ColorKey = keyof typeof colors;