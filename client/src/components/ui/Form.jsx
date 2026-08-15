import { forwardRef } from 'react';
import { cx, fieldBase, focusRing } from './styles';
import { theme } from '../../styles/theme';

/**
 * Accessible form label primitive.
 *
 * @param {{ className?: string } & React.LabelHTMLAttributes<HTMLLabelElement>} props
 */
export const Label = forwardRef(function Label({ className, ...props }, ref) {
  return <label ref={ref} className={cx('block', theme.typographyClasses.label, className)} {...props} />;
});

/**
 * Text input primitive.
 *
 * @param {{ className?: string } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(fieldBase, focusRing, 'h-10 px-3', theme.typographyClasses.control, className)}
      {...props}
    />
  );
});

/**
 * Number input primitive.
 *
 * @param {{ className?: string } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export const NumberInput = forwardRef(function NumberInput({ className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="number"
      inputMode="decimal"
      className={className}
      {...props}
    />
  );
});

/**
 * Select input primitive.
 *
 * @param {{ className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>} props
 */
export const Select = forwardRef(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx(fieldBase, focusRing, 'h-10 px-3', theme.typographyClasses.control, className)}
      {...props}
    />
  );
});
