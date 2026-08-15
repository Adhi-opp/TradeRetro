import { forwardRef } from 'react';
import { cx } from './styles';

/**
 * Empty, idle, or no-results state.
 *
 * @param {{ icon?: React.ReactNode, title?: React.ReactNode, description?: React.ReactNode, actions?: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
const EmptyState = forwardRef(function EmptyState(
  { icon, title, description, actions, className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx('flex flex-col items-center justify-center gap-3 text-center', className)} {...props}>
      {icon}
      {title && <div className="text-base font-semibold">{title}</div>}
      {description && <p className="max-w-md text-sm opacity-70">{description}</p>}
      {children}
      {actions && <div className="flex items-center justify-center gap-2">{actions}</div>}
    </div>
  );
});

export default EmptyState;
