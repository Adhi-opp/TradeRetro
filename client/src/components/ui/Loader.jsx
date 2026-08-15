import { forwardRef } from 'react';
import { cx } from './styles';

/**
 * Inline spinner primitive.
 *
 * @param {{ className?: string } & React.HTMLAttributes<HTMLSpanElement>} props
 */
export const Spinner = forwardRef(function Spinner({ className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      aria-hidden="true"
      {...props}
    />
  );
});

/**
 * Loader row with optional label.
 *
 * @param {{ label?: React.ReactNode, className?: string, spinnerClassName?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export const Loader = forwardRef(function Loader(
  { label = 'Loading', className, spinnerClassName, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx('inline-flex items-center gap-2 text-sm', className)} role="status" {...props}>
      <Spinner className={spinnerClassName} />
      {label && <span>{label}</span>}
    </div>
  );
});
