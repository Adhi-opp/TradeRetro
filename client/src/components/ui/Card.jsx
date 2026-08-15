import { forwardRef } from 'react';
import { cx, surfaceBase } from './styles';

/**
 * Generic surface container for grouped UI.
 *
 * @param {{ className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cx(surfaceBase, className)} {...props} />;
});

/**
 * Header region for Card composition.
 *
 * @param {{ className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cx('flex items-start justify-between gap-3 p-4', className)} {...props} />;
});

/**
 * Body region for Card composition.
 *
 * @param {{ className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export const CardBody = forwardRef(function CardBody({ className, ...props }, ref) {
  return <div ref={ref} className={cx('p-4', className)} {...props} />;
});

/**
 * Footer region for Card composition.
 *
 * @param {{ className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cx('flex items-center justify-end gap-2 p-4', className)} {...props} />;
});
