import { colorClasses, colors, rawColors } from '../constants/colors';
import { motion, radius, shadows, spacing, spacingClasses } from '../constants/spacing';
import { fonts, fontSizes, typographyClasses } from '../constants/typography';

/**
 * Centralized TradeRetro design system.
 *
 * This file intentionally references the existing CSS custom properties from
 * `index.css` to keep the current UI visually identical while giving React
 * components a single source for design decisions.
 */

export const theme = {
  colors,
  rawColors,
  spacing,
  radius,
  shadows,
  motion,
  fonts,
  fontSizes,
  classes: {
    focusRing: 'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]',
    controlBase: 'inline-flex items-center justify-center gap-2 transition-colors disabled:pointer-events-none disabled:opacity-60',
    fieldBase: [
      'w-full rounded-md border bg-transparent transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-60',
      colorClasses.border,
      colorClasses.textPrimary,
    ].join(' '),
    surfaceBase: ['rounded-lg border bg-transparent', colorClasses.border].join(' '),
    modalPanel: [
      'w-full max-w-lg rounded-lg border p-4 shadow-xl',
      colorClasses.surface,
      colorClasses.border,
    ].join(' '),
    tooltipContent: [
      'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden',
      '-translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-xs shadow-lg group-hover:block',
      colorClasses.surface,
      colorClasses.border,
    ].join(' '),
  },
  components: {
    button: {
      variants: {
        default: ['border border-transparent', colorClasses.primary, colorClasses.primaryHover].join(' '),
        secondary: ['border bg-transparent', colorClasses.border, colorClasses.textPrimary, colorClasses.hover].join(' '),
        ghost: ['border border-transparent bg-transparent', colorClasses.hover].join(' '),
        danger: 'border border-transparent bg-[var(--red)] text-[var(--bg-root)] hover:opacity-90',
      },
      sizes: {
        sm: [spacingClasses.controlSm, typographyClasses.control].join(' '),
        md: [spacingClasses.controlMd, typographyClasses.control].join(' '),
        lg: [spacingClasses.controlLg, 'text-base'].join(' '),
        icon: spacingClasses.controlIcon,
      },
    },
    badge: {
      variants: {
        default: ['border-transparent', colorClasses.primary].join(' '),
        neutral: ['bg-transparent', colorClasses.border, colorClasses.textSecondary].join(' '),
        success: 'border-[var(--green)] bg-[var(--green-bg)] text-[var(--green)]',
        warning: 'border-[var(--amber)] bg-[var(--amber-bg)] text-[var(--amber)]',
        danger: 'border-[var(--red)] bg-[var(--red-bg)] text-[var(--red)]',
      },
    },
    toneText: {
      neutral: '',
      positive: colorClasses.positive,
      negative: colorClasses.negative,
      warning: colorClasses.warning,
    },
    containerSizes: {
      sm: 'max-w-screen-sm',
      md: 'max-w-screen-md',
      lg: 'max-w-screen-lg',
      xl: 'max-w-screen-xl',
      full: 'max-w-none',
    },
  },
  typographyClasses,
  spacingClasses,
};

export default theme;
