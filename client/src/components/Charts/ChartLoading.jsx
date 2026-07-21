import { SkeletonChart } from '../feedback';

/**
 * Standard chart loading state.
 */
export default function ChartLoading({ className = '', style, ...props }) {
  return <SkeletonChart className={className} style={style} {...props} />;
}
