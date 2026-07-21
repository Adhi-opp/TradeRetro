import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import BaseChart from './BaseChart';

const defaultMargin = { top: 8, right: 16, bottom: 4, left: 8 };

/**
 * Reusable drawdown area chart.
 */
export default function DrawdownChart({
  data,
  tooltip,
  formatXAxis,
  margin = defaultMargin,
  height = 180,
}) {
  return (
    <BaseChart height={height}>
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
        <XAxis dataKey="date" stroke="#475569" tickFormatter={formatXAxis} minTickGap={40} tickMargin={8} fontSize={11} />
        <YAxis stroke="#475569" tickFormatter={(v) => `${v.toFixed(0)}%`} width={55} fontSize={11} />
        <Tooltip content={tooltip} />
        <ReferenceLine y={0} stroke="#475569" />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#ddFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </BaseChart>
  );
}
