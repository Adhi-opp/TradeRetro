import { forwardRef } from 'react';
import { cx } from './styles';
import Button from './Button';
import { theme } from '../../styles/theme';

/**
 * Basic reusable modal shell.
 *
 * @param {{ open?: boolean, title?: React.ReactNode, footer?: React.ReactNode, onClose?: () => void, className?: string, overlayClassName?: string, children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>} props
 */
const Modal = forwardRef(function Modal(
  { open, title, footer, onClose, className, overlayClassName, children, ...props },
  ref,
) {
  if (!open) return null;

  return (
    <div className={cx('fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4', overlayClassName)}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cx(theme.classes.modalPanel, className)}
        {...props}
      >
        {(title || onClose) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            {title && <div className="text-base font-semibold">{title}</div>}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
                Close
              </Button>
            )}
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
});

export default Modal;
