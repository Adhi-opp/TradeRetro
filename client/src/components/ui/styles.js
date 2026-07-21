/**
 * Internal UI helpers shared by reusable components.
 */

import { theme } from '../../styles/theme';

export const focusRing = theme.classes.focusRing;
export const controlBase = theme.classes.controlBase;
export const fieldBase = theme.classes.fieldBase;
export const surfaceBase = theme.classes.surfaceBase;

/**
 * Joins class names while ignoring empty values.
 *
 * @param {...(string | false | null | undefined)} classes
 * @returns {string}
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
