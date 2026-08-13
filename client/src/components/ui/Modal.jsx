import { forwardRef, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cx } from './styles';
import { theme } from '../../styles/theme';

const PANEL_SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

/**
 * Reusable modal shell.
 *
 * Handles dialog semantics, Escape/overlay close, body scroll locking while
 * open, panel focus on open, and a sticky header/footer with a scrollable
 * body region. Styling goes through the TradeRetro design tokens so it
 * adapts to both dark and light themes.
 *
 * @param {{ open?: boolean, title?: React.ReactNode, subtitle?: React.ReactNode, footer?: React.ReactNode, size?: 'md' | 'lg' | 'xl', onClose?: () => void, className?: string, overlayClassName?: string, bodyClassName?: string, children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>} props
 */
const Modal = forwardRef(function Modal(
  {
    open,
    title,
    subtitle,
    footer,
    size = 'md',
    onClose,
    className,
    overlayClassName,
    bodyClassName,
    children,
    ...props
  },
  ref,
) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cx('tr-modal-overlay', overlayClassName)}
      onClick={onClose}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        ref={(node) => {
          panelRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          theme.classes.modalPanel,
          'tr-modal-panel flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden',
          PANEL_SIZES[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <div className="tr-modal-header">
          <div className="min-w-0">
            {title && <div className="tr-modal-title">{title}</div>}
            {subtitle && <div className="tr-modal-subtitle">{subtitle}</div>}
          </div>
          {onClose && (
            <button
              type="button"
              className="tr-modal-close"
              onClick={onClose}
              aria-label="Close dialog"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={cx('tr-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="tr-modal-footer flex shrink-0 items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
});

export default Modal;