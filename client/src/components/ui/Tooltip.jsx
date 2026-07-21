import { forwardRef } from 'react';
import { cx } from './styles';
import { theme } from '../../styles/theme';

/**
 * CSS-only tooltip wrapper.
 *
 * @param {{ content: React.ReactNode, className?: string, contentClassName?: string, children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>} props
 */
const Tooltip = forwardRef(function Tooltip(
  { content, className, contentClassName, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx('group relative inline-flex', className)} {...props}>
      {children}
      <span
        role="tooltip"
        className={cx(
          theme.classes.tooltipContent,
          contentClassName,
        )}
      >
        {content}
      </span>
    </span>
  );
});

export default Tooltip;
