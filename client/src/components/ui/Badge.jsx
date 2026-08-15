import { forwardRef } from 'react';
import { cx } from './styles';
import { theme } from '../../styles/theme';

const { variants } = theme.components.badge;

/**
 * Small status or category badge.
 *
 * @param {{ variant?: 'default' | 'neutral' | 'success' | 'warning' | 'danger', className?: string } & React.HTMLAttributes<HTMLSpanElement>} props
 */
const Badge = forwardRef(function Badge({ className, variant = 'default', ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
});

export default Badge;
