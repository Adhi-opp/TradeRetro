import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import BaseChart from './BaseChart';

const defaultMargin = { top: 8, right: 16, bottom: 4, left: 8 };

/**
 * Reusable equity curve chart.
 */
export default function EquityCurveChart({
  data,
  tooltip,
  showCosts = true,
  formatXAxis,
  formatYAxis,
  margin = defaultMargin,
}) {
  return (
    <BaseChart>
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#475569"
          tickFormatter={formatXAxis}
          minTickGap={40}
          tickMargin={10}
          fontSize={11}
        />
        <YAxis
          stroke="#475569"
          domain={['auto', 'auto']}
          width={80}
          tickFormatter={formatYAxis}
          tickMargin={6}
          fontSize={11}
        />
        <Tooltip content={tooltip} />
        <Legend
          verticalAlign="top"
          height={30}
          iconType="line"
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          name="Buy & Hold"
          type="monotone"
          dataKey="buyHold"
          stroke="#6366f1"
          strokeWidth={1.75}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1', stroke: '#080c12', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          name={showCosts ? 'Strategy (Net)' : 'Strategy (Gross)'}
          type="monotone"
          dataKey="displayEquity"
          stroke="#22c55e"
          strokeWidth={2.25}
          dot={false}
          activeDot={{ r: 5, fill: '#22c55e', stroke: '#080c12', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </BaseChart>
  );
}
