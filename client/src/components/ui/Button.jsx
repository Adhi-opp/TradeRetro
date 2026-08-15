import { forwardRef } from 'react';
import { controlBase, cx, focusRing } from './styles';
import { theme } from '../../styles/theme';

const { variants, sizes } = theme.components.button;

/**
 * Reusable button primitive.
 *
 * @param {{ variant?: 'default' | 'secondary' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' | 'icon', className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
const Button = forwardRef(function Button(
  { className, variant = 'default', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(controlBase, focusRing, 'rounded-md font-medium', variants[variant], sizes[size], className)}
      {...props}
    />
  );
});

export default Button;
