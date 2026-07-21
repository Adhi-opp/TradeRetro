import { forwardRef } from 'react';
import { cx } from './styles';
import { theme } from '../../styles/theme';

/**
 * Width-constrained layout container.
 *
 * @param {{ size?: 'sm' | 'md' | 'lg' | 'xl' | 'full', className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
const Container = forwardRef(function Container({ size = 'xl', className, ...props }, ref) {
  const sizes = theme.components.containerSizes;

  return <div ref={ref} className={cx('mx-auto w-full px-4', sizes[size], className)} {...props} />;
});

export default Container;
