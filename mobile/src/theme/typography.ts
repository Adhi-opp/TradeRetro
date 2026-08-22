export const Typography = {
  // Existing component compatibility
  title: 24,
  heading: 18,
  subheading: 14,

  // Existing/common sizes
  body: 14,
  caption: 12,

  // Additional TradeRetro sizes
  label: 11,
  sectionTitle: 16,
  bodyMedium: 14,
  value: 22,
  largeValue: 28,
} as const;

// Lowercase alias for newer components
export const typography = Typography;

export type TypographyKey = keyof typeof Typography;