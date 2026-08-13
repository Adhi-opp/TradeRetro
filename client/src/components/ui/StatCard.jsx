import { forwardRef } from 'react';
import { cx, surfaceBase } from './styles';
import { theme } from '../../styles/theme';

/**
 * Reusable statistic display card.
 *
 * @param {{ label?: React.ReactNode, value?: React.ReactNode, sub?: React.ReactNode, icon?: React.ReactNode, tone?: 'neutral' | 'positive' | 'negative' | 'warning', className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
const StatCard = forwardRef(function StatCard(
  { label, value, sub, icon, tone = 'neutral', className, children, ...props },
  ref,
) {
  const toneClass = theme.components.toneText[tone];

  return (
    <div ref={ref} className={cx(surfaceBase, 'p-4', className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {label && <div className={cx(theme.typographyClasses.statLabel, 'opacity-60')}>{label}</div>}
          {value && <div className={cx('mt-1', theme.typographyClasses.statValue, toneClass)}>{value}</div>}
          {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
        </div>
        {icon && <div className="shrink-0 opacity-70">{icon}</div>}
      </div>
      {children}
    </div>
  );
});

export default StatCard;
