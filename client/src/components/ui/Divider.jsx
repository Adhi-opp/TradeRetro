import { forwardRef } from 'react';
import { cx } from './styles';

/**
 * Visual separator.
 *
 * @param {{ orientation?: 'horizontal' | 'vertical', className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
const Divider = forwardRef(function Divider({ orientation = 'horizontal', className, ...props }, ref) {
  const isVertical = orientation === 'vertical';
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cx(isVertical ? 'h-full w-px' : 'h-px w-full', 'bg-current opacity-15', className)}
      {...props}
    />
  );
});

export default Divider;
