import { forwardRef } from 'react';
import { cx } from './styles';
import { theme } from '../../styles/theme';

/**
 * Section heading with optional supporting text.
 *
 * @param {{ title?: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
const SectionTitle = forwardRef(function SectionTitle(
  { title, subtitle, actions, className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx('flex items-start justify-between gap-3', className)} {...props}>
      <div>
        {title && <h2 className={theme.typographyClasses.sectionTitle}>{title}</h2>}
        {subtitle && <p className={`mt-1 ${theme.typographyClasses.muted}`}>{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
});

export default SectionTitle;
