import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Svg, {
  Polyline,
  Line,
  Circle,
} from "react-native-svg";

import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/RootNavigator";

import {
  BacktestResponse,
  BacktestTrade,
} from "../../types/Backtest";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "BacktestResults"
>;

/* =====================================================
   EQUITY CURVE CHART
===================================================== */

function EquityCurveChart({
  data,
}: {
  data: {
    date: string;
    equity: number;
  }[];
}) {
  if (data.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartInfo}>
          No equity curve data available.
        </Text>
      </View>
    );
  }

  const width = 340;
  const height = 220;
  const padding = 25;

  const equities = data.map(
    (point) => point.equity,
  );

  const minEquity = Math.min(...equities);
  const maxEquity = Math.max(...equities);

  const equityRange =
    maxEquity - minEquity || 1;

  const chartPoints = data.map(
    (point, index) => {
      const x =
        padding +
        (index /
          Math.max(data.length - 1, 1)) *
          (width - padding * 2);

      const y =
        height -
        padding -
        ((point.equity - minEquity) /
          equityRange) *
          (height - padding * 2);

      return `${x},${y}`;
    },
  );

  const lastIndex =
    data.length - 1;

  const lastX =
    padding +
    (lastIndex /
      Math.max(data.length - 1, 1)) *
      (width - padding * 2);

  const lastY =
    height -
    padding -
    ((data[lastIndex].equity -
      minEquity) /
      equityRange) *
      (height - padding * 2);

  return (
    <View style={styles.equityChartContainer}>
      <Svg
        width={width}
        height={height}
      >
        {/* Bottom axis */}

        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#D1D5DB"
          strokeWidth="1"
        />

        {/* Left axis */}

        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#D1D5DB"
          strokeWidth="1"
        />

        {/* Middle guide line */}

        <Line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#E5E7EB"
          strokeWidth="1"
        />

        {/* Equity curve */}

        <Polyline
          points={chartPoints.join(" ")}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="3"
        />

        {/* Latest equity point */}

        <Circle
          cx={lastX}
          cy={lastY}
          r="5"
          fill={Colors.primary}
        />
      </Svg>

      {/* Chart labels */}

      <View style={styles.equityChartLabels}>
        <Text style={styles.chartLabel}>
          ₹
          {minEquity.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 0,
            },
          )}
        </Text>

        <Text style={styles.chartLabel}>
          ₹
          {maxEquity.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 0,
            },
          )}
        </Text>
      </View>

      {/* Start / End */}

      <View style={styles.equitySummary}>
        <View>
          <Text style={styles.equitySummaryLabel}>
            Start
          </Text>

          <Text style={styles.equitySummaryValue}>
            ₹
            {data[0].equity.toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}
          </Text>
        </View>

        <View style={styles.equitySummaryRight}>
          <Text style={styles.equitySummaryLabel}>
            End
          </Text>

          <Text style={styles.equitySummaryValue}>
            ₹
            {data[
              data.length - 1
            ].equity.toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* =====================================================
   DRAWDOWN CHART
===================================================== */

function DrawdownChart({
  equityCurve,
}: {
  equityCurve: {
    date: string;
    equity: number;
  }[];
}) {
  if (equityCurve.length === 0) {
    return (
      <Text style={styles.emptyText}>
        No drawdown data available.
      </Text>
    );
  }

  const width = 340;
  const height = 220;
  const padding = 20;

  /*
   * Calculate running peak and drawdown percentage.
   */
  let peak = equityCurve[0].equity;

  const drawdowns = equityCurve.map(
    (point) => {
      peak = Math.max(
        peak,
        point.equity,
      );

      return {
        date: point.date,
        drawdown:
          peak > 0
            ? ((point.equity - peak) /
                peak) *
              100
            : 0,
      };
    },
  );

  const values = drawdowns.map(
    (point) => point.drawdown,
  );

  const minDrawdown = Math.min(
    ...values,
    0,
  );

  const maxDrawdown = Math.max(
    ...values,
    0,
  );

  const range =
    maxDrawdown - minDrawdown || 1;

  const chartPoints =
    drawdowns.map(
      (point, index) => {
        const x =
          padding +
          (index /
            Math.max(
              drawdowns.length - 1,
              1,
            )) *
            (width -
              padding * 2);

        const y =
          padding +
          ((maxDrawdown -
            point.drawdown) /
            range) *
            (height -
              padding * 2);

        return `${x},${y}`;
      },
    );

  /*
   * Position of the zero-drawdown line.
   */
  const zeroY =
    padding +
    ((maxDrawdown - 0) /
      range) *
      (height -
        padding * 2);

  return (
    <View style={styles.chartContainer}>
      <Svg
        width={width}
        height={height}
      >
        {/* Zero drawdown axis */}

        <Line
          x1={padding}
          y1={zeroY}
          x2={width - padding}
          y2={zeroY}
          stroke={Colors.borderLight}
          strokeWidth="1"
        />

        {/* Drawdown line */}

        <Polyline
          points={chartPoints.join(" ")}
          fill="none"
          stroke={Colors.negative}
          strokeWidth="3"
        />
      </Svg>

      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>
          0.00%
        </Text>

        <Text style={styles.chartLabel}>
          {minDrawdown.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

export default function BacktestResultsScreen({
  navigation,
  route,
}: Props) {
  const { result } = route.params;

  const { metrics, grossMetrics, costBreakdown, trades, strategy } =
    result;

  const returnIsPositive = metrics.totalReturn >= 0;
  const alphaIsPositive = metrics.alpha >= 0;

  function getPerformanceSummary() {
  const returnText =
    metrics.totalReturn >= 0
      ? `The strategy generated a positive return of ${formatPercent(
          metrics.totalReturn,
        )}.`
      : `The strategy generated a negative return of ${formatPercent(
          metrics.totalReturn,
        )}.`;

  const benchmarkText =
    metrics.alpha >= 0
      ? `It outperformed the benchmark by ${formatPercent(
          metrics.alpha,
        )}.`
      : `It underperformed the benchmark by ${formatPercent(
          Math.abs(metrics.alpha),
        )}.`;

  const riskText =
    metrics.sharpeRatio >= 1
      ? `The Sharpe Ratio of ${metrics.sharpeRatio.toFixed(
          2,
        )} indicates relatively strong risk-adjusted performance.`
      : `The Sharpe Ratio of ${metrics.sharpeRatio.toFixed(
          2,
        )} indicates more modest risk-adjusted performance.`;

  const drawdownText =
    `The maximum drawdown was ${formatPercent(
      metrics.maxDrawdown,
    )}.`;

  const tradingText =
    `The strategy completed ${metrics.totalTrades} trades with a ${formatPercent(
      metrics.winRate,
    )} win rate.`;

  return {
    returnText,
    benchmarkText,
    riskText,
    drawdownText,
    tradingText,
  };
}

  function formatCurrency(value: number) {
    return `₹${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatPercent(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStrategyName(strategyType: string) {
    switch (strategyType) {
      case "MOVING_AVERAGE_CROSSOVER":
        return "Moving Average Crossover";

      case "RSI":
        return "RSI";

      case "MACD":
        return "MACD";

      case "BOLLINGER_BREAKOUT":
        return "Bollinger Breakout";

      case "DONCHIAN_BREAKOUT":
        return "Donchian Breakout";

      default:
        return strategyType;
    }
  }

  const summary =
  getPerformanceSummary();

  const winningTrades =
  trades.filter(
    (trade) => trade.isWin,
  );

const losingTrades =
  trades.filter(
    (trade) => !trade.isWin,
  );

const averageWin =
  winningTrades.length > 0
    ? winningTrades.reduce(
        (total, trade) =>
          total + trade.profitLoss,
        0,
      ) / winningTrades.length
    : 0;

const averageLoss =
  losingTrades.length > 0
    ? losingTrades.reduce(
        (total, trade) =>
          total + trade.profitLoss,
        0,
      ) / losingTrades.length
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <Text style={styles.title}>
          Backtest Results
        </Text>

        <Text style={styles.subtitle}>
          {getStrategyName(strategy.strategyType)}
        </Text>
      </View>

      {/* PERFORMANCE SUMMARY */}

<View style={styles.summaryCard}>
  <Text style={styles.summaryTitle}>
    Performance Summary
  </Text>

  <Text
    style={[
      styles.summaryStatus,
      returnIsPositive
        ? styles.positive
        : styles.negative,
    ]}
  >
    {returnIsPositive
      ? "Strategy generated a positive return"
      : "Strategy generated a negative return"}
  </Text>

  <Text style={styles.summaryText}>
    {summary.returnText}
  </Text>

  <Text style={styles.summaryText}>
    {summary.benchmarkText}
  </Text>

  <Text style={styles.summaryText}>
    {summary.riskText}
  </Text>

  <Text style={styles.summaryText}>
    {summary.drawdownText}
  </Text>

  <Text style={styles.summaryText}>
    {summary.tradingText}
  </Text>
</View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Performance
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            Final Portfolio Value
          </Text>

          <Text style={styles.heroValue}>
            {formatCurrency(metrics.finalValue)}
          </Text>

          <Text
            style={[
              styles.heroReturn,
              returnIsPositive
                ? styles.positive
                : styles.negative,
            ]}
          >
            {formatPercent(metrics.totalReturn)}
          </Text>

          <Text style={styles.heroCaption}>
            Net return
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Initial Capital"
            value={formatCurrency(
              metrics.initialCapital,
            )}
          />

          <MetricCard
            label="Total Profit/Loss"
            value={formatCurrency(
              metrics.totalReturnRupee,
            )}
            valueStyle={
              metrics.totalReturnRupee >= 0
                ? styles.positive
                : styles.negative
            }
          />

          <MetricCard
            label="Buy & Hold"
            value={formatPercent(
              metrics.buyHoldReturn,
            )}
          />

          <MetricCard
            label="Alpha"
            value={formatPercent(
              metrics.alpha,
            )}
            valueStyle={
              alphaIsPositive
                ? styles.positive
                : styles.negative
            }
          />
        </View>
      </View>

      {/* GROSS VS NET PERFORMANCE */}

<View style={styles.section}>
  <Text style={styles.sectionTitle}>
    Gross vs Net Performance
  </Text>

  <MetricRow
    label="Gross Final Value"
    value={formatCurrency(
      grossMetrics.finalValue,
    )}
  />

  <MetricRow
    label="Net Final Value"
    value={formatCurrency(
      metrics.finalValue,
    )}
  />

  <MetricRow
    label="Gross Return"
    value={formatPercent(
      grossMetrics.totalReturn,
    )}
  />

  <MetricRow
    label="Net Return"
    value={formatPercent(
      metrics.totalReturn,
    )}
  />

  <MetricRow
    label="Total Transaction Costs"
    value={formatCurrency(
      costBreakdown.totalCosts,
    )}
  />

  <MetricRow
    label="Cost as % of Capital"
    value={`${costBreakdown.costPctOfCapital.toFixed(
      2,
    )}%`}
  />
</View>

      {/* RISK METRICS */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Risk & Performance
        </Text>

        <MetricRow
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
        />

        <MetricRow
          label="Maximum Drawdown"
          value={formatPercent(
            metrics.maxDrawdown,
          )}
        />

        <MetricRow
          label="CAGR"
          value={formatPercent(metrics.cagr)}
        />

        <MetricRow
          label="Benchmark CAGR"
          value={formatPercent(
            metrics.benchmarkCagr,
          )}
        />

        <MetricRow
          label="Information Ratio"
          value={metrics.informationRatio.toFixed(
            2,
          )}
        />

        <MetricRow
          label="Exposure"
          value={formatPercent(
            metrics.exposurePct,
          )}
        />
      </View>

      {/* TRADING STATISTICS */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Trading Statistics
        </Text>

        <MetricRow
          label="Total Trades"
          value={metrics.totalTrades.toString()}
        />

        <MetricRow
          label="Winning Trades"
          value={metrics.winningTrades.toString()}
        />

        <MetricRow
          label="Losing Trades"
          value={metrics.losingTrades.toString()}
        />

        <MetricRow
          label="Win Rate"
          value={formatPercent(metrics.winRate)}
        />

        <MetricRow
          label="Average P/L"
          value={formatCurrency(
            metrics.avgProfitLoss,
          )}
        />

        <MetricRow
          label="Average Holding Period"
          value={`${metrics.avgHoldingPeriod} days`}
        />
      </View>

      {/* TRADE STATISTICS VISUALIZATION */}

<View style={styles.section}>
  <Text style={styles.sectionTitle}>
    Trade Analysis
  </Text>

  {/* WIN / LOSS */}

  <View style={styles.tradeDistribution}>
    <View style={styles.distributionItem}>
      <Text style={styles.distributionValue}>
        {winningTrades.length}
      </Text>

      <Text style={styles.distributionLabel}>
        Winning Trades
      </Text>
    </View>

    <View style={styles.distributionDivider} />

    <View style={styles.distributionItem}>
      <Text style={styles.distributionValue}>
        {losingTrades.length}
      </Text>

      <Text style={styles.distributionLabel}>
        Losing Trades
      </Text>
    </View>
  </View>

  {/* WIN / LOSS BAR */}

  <View style={styles.tradeBar}>
    {trades.length > 0 && (
      <>
        <View
          style={[
            styles.winBar,
            {
              width: `${
                (winningTrades.length /
                  trades.length) *
                100
              }%`,
            },
          ]}
        />

        <View
          style={[
            styles.lossBar,
            {
              width: `${
                (losingTrades.length /
                  trades.length) *
                100
              }%`,
            },
          ]}
        />
      </>
    )}
  </View>

  {/* AVERAGE RESULTS */}

  <View style={styles.averageResults}>
    <View style={styles.averageCard}>
      <Text style={styles.averageLabel}>
        Average Win
      </Text>

      <Text
        style={[
          styles.averageValue,
          styles.positive,
        ]}
      >
        {formatCurrency(averageWin)}
      </Text>
    </View>

    <View style={styles.averageCard}>
      <Text style={styles.averageLabel}>
        Average Loss
      </Text>

      <Text
        style={[
          styles.averageValue,
          styles.negative,
        ]}
      >
        {formatCurrency(averageLoss)}
      </Text>
    </View>
  </View>
</View>

      {/* EQUITY CURVE */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Equity Curve
        </Text>

        <EquityCurveChart
          data={result.equityCurve}
        />
      </View>

      {/* DRAWDOWN */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Drawdown
        </Text>

        <Text style={styles.chartInfo}>
          Percentage decline from the previous
          portfolio peak.
        </Text>

        <DrawdownChart
          equityCurve={result.equityCurve}
        />

        <View style={styles.drawdownSummary}>
          <Text style={styles.drawdownLabel}>
            Maximum Drawdown
          </Text>

          <Text style={styles.drawdownValue}>
            {formatPercent(
              metrics.maxDrawdown,
            )}
          </Text>
        </View>
      </View>

      {/* COST BREAKDOWN */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Transaction Costs
        </Text>

        <MetricRow
          label="STT"
          value={formatCurrency(
            costBreakdown.stt,
          )}
        />

        <MetricRow
          label="Brokerage"
          value={formatCurrency(
            costBreakdown.brokerage,
          )}
        />

        <MetricRow
          label="Slippage"
          value={formatCurrency(
            costBreakdown.slippage,
          )}
        />

        <MetricRow
          label="Exchange Fees"
          value={formatCurrency(
            costBreakdown.exchangeFees,
          )}
        />

        <MetricRow
          label="GST"
          value={formatCurrency(
            costBreakdown.gst,
          )}
        />

        <MetricRow
          label="Stamp Duty"
          value={formatCurrency(
            costBreakdown.stampDuty,
          )}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total Costs
          </Text>

          <Text style={styles.totalValue}>
            {formatCurrency(
              costBreakdown.totalCosts,
            )}
          </Text>
        </View>

        <Text style={styles.costPercentage}>
          {costBreakdown.costPctOfCapital.toFixed(
            2,
          )}
          % of initial capital
        </Text>
      </View>

      {/* TRADES */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Trades
        </Text>

        {trades.length === 0 ? (
          <Text style={styles.emptyText}>
            No trades were generated.
          </Text>
        ) : (
          trades.map(
  (
    trade: BacktestTrade,
    index,
  ) => (
    <View
      key={`${trade.entryDate}-${index}`}
      style={styles.tradeCard}
    >
      {/* TRADE HEADER */}

      <View style={styles.tradeHeader}>
        <View>
          <Text style={styles.tradeNumber}>
            Trade {index + 1}
          </Text>

          <Text style={styles.tradeType}>
            {trade.type}
          </Text>
        </View>

        <View
          style={[
            styles.tradeBadge,
            trade.isWin
              ? styles.tradeBadgeWin
              : styles.tradeBadgeLoss,
          ]}
        >
          <Text
            style={[
              styles.tradeBadgeText,
              trade.isWin
                ? styles.tradeBadgeTextWin
                : styles.tradeBadgeTextLoss,
            ]}
          >
            {trade.isWin
              ? "WIN"
              : "LOSS"}
          </Text>
        </View>
      </View>

      {/* ENTRY / EXIT */}

      <View style={styles.tradeTimeline}>
        <View style={styles.tradeTimelineRow}>
          <View
            style={styles.tradeTimelineDot}
          />

          <View
            style={styles.tradeTimelineContent}
          >
            <Text
              style={styles.tradeTimelineLabel}
            >
              Entry
            </Text>

            <Text
              style={styles.tradeTimelineDate}
            >
              {formatDate(
                trade.entryDate,
              )}
            </Text>

            <Text
              style={styles.tradeTimelinePrice}
            >
              {formatCurrency(
                trade.entryPrice,
              )}
            </Text>
          </View>
        </View>

        <View
          style={styles.tradeTimelineLine}
        />

        <View style={styles.tradeTimelineRow}>
          <View
            style={styles.tradeTimelineDot}
          />

          <View
            style={styles.tradeTimelineContent}
          >
            <Text
              style={styles.tradeTimelineLabel}
            >
              Exit
            </Text>

            <Text
              style={styles.tradeTimelineDate}
            >
              {formatDate(
                trade.exitDate,
              )}
            </Text>

            <Text
              style={styles.tradeTimelinePrice}
            >
              {formatCurrency(
                trade.exitPrice,
              )}
            </Text>
          </View>
        </View>
      </View>

      {/* TRADE RESULT */}

      <View style={styles.tradeResultBox}>
        <View>
          <Text
            style={styles.tradeResultLabel}
          >
            Profit / Loss
          </Text>

          <Text
            style={[
              styles.tradeResultValue,
              trade.profitLoss >= 0
                ? styles.positive
                : styles.negative,
            ]}
          >
            {formatCurrency(
              trade.profitLoss,
            )}
          </Text>
        </View>

        <View style={styles.tradeResultRight}>
          <Text
            style={styles.tradeResultLabel}
          >
            Return
          </Text>

          <Text
            style={[
              styles.tradeResultValue,
              trade.pnlPct >= 0
                ? styles.positive
                : styles.negative,
            ]}
          >
            {formatPercent(
              trade.pnlPct,
            )}
          </Text>
        </View>
      </View>

      {/* TRADE DETAILS */}

      <MetricRow
        label="Shares"
        value={trade.shares.toString()}
      />

      <MetricRow
        label="Holding Period"
        value={`${trade.holdingPeriod} days`}
      />

      <MetricRow
        label="Exit Reason"
        value={trade.exitReason}
      />

      <MetricRow
        label="Fees"
        value={formatCurrency(
          trade.fee,
        )}
      />

      {trade.forceClose && (
        <Text style={styles.forceCloseText}>
          Position force-closed at end of
          backtest
        </Text>
      )}
    </View>
  ),
)
        )}
      </View>

      {/* STRATEGY */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Strategy Configuration
        </Text>

        <MetricRow
          label="Strategy"
          value={getStrategyName(
            strategy.strategyType,
          )}
        />

        {Object.entries(strategy.params).map(
          ([key, value]) => (
            <MetricRow
              key={key}
              label={key}
              value={String(value)}
            />
          ),
        )}
      </View>

      {/* BACK BUTTON */}

      <Pressable
        style={styles.backButton}
        onPress={() =>
          navigation.goBack()
        }
      >
        <Text style={styles.backButtonText}>
          Back to Backtest
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricCardLabel}>
        {label}
      </Text>

      <Text
        style={[
          styles.metricCardValue,
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ==================================================
  // SCREEN
  // ==================================================

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: Spacing.lg,
    paddingBottom: 140,
  },

  // ==================================================
  // HEADER
  // ==================================================

  header: {
    marginBottom: Spacing.xl,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },

  // ==================================================
  // PERFORMANCE SUMMARY
  // ==================================================

  summaryCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,
  },

  summaryTitle: {
    fontSize: Typography.sectionTitle,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  summaryStatus: {
    marginTop: Spacing.sm,

    fontSize: Typography.body,
    fontWeight: "700",
  },

  summaryText: {
    marginTop: Spacing.sm,

    fontSize: Typography.caption,
    lineHeight: 18,

    color: Colors.textSecondary,
  },

  // ==================================================
  // POSITIVE / NEGATIVE
  // ==================================================

  positive: {
    color: Colors.positive,
  },

  negative: {
    color: Colors.negative,
  },

  // ==================================================
  // SECTION
  // ==================================================

  section: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,
  },

  sectionTitle: {
    marginBottom: Spacing.lg,

    fontSize: Typography.sectionTitle,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  // ==================================================
  // HERO PERFORMANCE
  // ==================================================

  heroCard: {
    padding: Spacing.xl,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    alignItems: "center",
  },

  heroLabel: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },

  heroValue: {
    marginTop: Spacing.sm,

    fontSize: 32,
    fontWeight: "700",

    color: Colors.textPrimary,

    letterSpacing: -0.5,
  },

  heroReturn: {
    marginTop: Spacing.xs,

    fontSize: 20,
    fontWeight: "700",
  },

  heroCaption: {
    marginTop: 3,

    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ==================================================
  // METRIC CARDS
  // ==================================================

  metricsGrid: {
    marginTop: Spacing.md,

    flexDirection: "row",
    flexWrap: "wrap",

    justifyContent: "space-between",
  },

  metricCard: {
    width: "48%",

    marginBottom: Spacing.sm,
    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  metricCardLabel: {
    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  metricCardValue: {
    marginTop: Spacing.xs,

    fontSize: 16,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  // ==================================================
  // METRIC ROWS
  // ==================================================

  metricRow: {
    minHeight: 40,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    paddingVertical: Spacing.sm,

    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  metricLabel: {
    flex: 1,

    fontSize: Typography.caption,

    color: Colors.textMuted,
  },

  metricValue: {
    maxWidth: "60%",

    fontSize: Typography.caption,
    fontWeight: "700",

    color: Colors.textPrimary,

    textAlign: "right",
  },

  // ==================================================
  // CHARTS
  // ==================================================

  equityChartContainer: {
    marginTop: Spacing.xs,

    alignItems: "center",
  },

  chartContainer: {
    marginTop: Spacing.sm,

    alignItems: "center",
  },

  chartLabels: {
    width: "100%",

    flexDirection: "row",
    justifyContent: "space-between",

    paddingHorizontal: Spacing.sm,
  },

  equityChartLabels: {
    width: "100%",

    flexDirection: "row",
    justifyContent: "space-between",

    paddingHorizontal: Spacing.sm,
  },

  chartLabel: {
    fontSize: 10,

    color: Colors.textMuted,
  },

  chartInfo: {
    marginTop: Spacing.xs,

    fontSize: Typography.caption,
    lineHeight: 18,

    color: Colors.textMuted,
  },

  chartPlaceholder: {
    minHeight: 180,

    padding: Spacing.lg,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    justifyContent: "center",
    alignItems: "center",
  },

  // ==================================================
  // EQUITY SUMMARY
  // ==================================================

  equitySummary: {
    width: "100%",

    marginTop: Spacing.md,
    paddingTop: Spacing.md,

    borderTopWidth: 1,
    borderTopColor: Colors.border,

    flexDirection: "row",
    justifyContent: "space-between",
  },

  equitySummaryRight: {
    alignItems: "flex-end",
  },

  equitySummaryLabel: {
    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  equitySummaryValue: {
    marginTop: 3,

    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  // ==================================================
  // DRAWDOWN
  // ==================================================

  drawdownSummary: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,

    borderTopWidth: 1,
    borderTopColor: Colors.border,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  drawdownLabel: {
    fontSize: Typography.caption,
    fontWeight: "600",

    color: Colors.textSecondary,
  },

  drawdownValue: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.negative,
  },

  // ==================================================
  // TOTAL COSTS
  // ==================================================

  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,

    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,

    flexDirection: "row",
    justifyContent: "space-between",
  },

  totalLabel: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  totalValue: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  costPercentage: {
    marginTop: Spacing.xs,

    fontSize: 10,

    color: Colors.textMuted,

    textAlign: "right",
  },

  // ==================================================
  // TRADE ANALYSIS
  // ==================================================

  tradeDistribution: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",

    paddingVertical: Spacing.sm,
  },

  distributionItem: {
    flex: 1,

    alignItems: "center",
  },

  distributionValue: {
    fontSize: 26,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  distributionLabel: {
    marginTop: 4,

    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  distributionDivider: {
    width: 1,
    height: 45,

    backgroundColor: Colors.border,
  },

  tradeBar: {
    height: 10,

    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,

    borderRadius: Radius.round,

    overflow: "hidden",

    flexDirection: "row",

    backgroundColor: Colors.border,
  },

  winBar: {
    height: "100%",
    backgroundColor: Colors.positive,
  },

  lossBar: {
    height: "100%",
    backgroundColor: Colors.negative,
  },

  averageResults: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  averageCard: {
    width: "48%",

    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  averageLabel: {
    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
  },

  averageValue: {
    marginTop: Spacing.xs,

    fontSize: 16,
    fontWeight: "700",
  },

  // ==================================================
  // TRADES
  // ==================================================

  tradeCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  tradeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    marginBottom: Spacing.md,
  },

  tradeNumber: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  tradeType: {
    marginTop: 3,

    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
  },

  tradeBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,

    borderRadius: Radius.sm,

    borderWidth: 1,
  },

  tradeBadgeWin: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.positive,
  },

  tradeBadgeLoss: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.negative,
  },

  tradeBadgeText: {
    fontSize: 9,
    fontWeight: "800",

    letterSpacing: 0.7,
  },

  tradeBadgeTextWin: {
    color: Colors.positive,
  },

  tradeBadgeTextLoss: {
    color: Colors.negative,
  },

  // ==================================================
  // TRADE TIMELINE
  // ==================================================

  tradeTimeline: {
    marginBottom: Spacing.md,
  },

  tradeTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  tradeTimelineDot: {
    width: 10,
    height: 10,

    marginTop: 5,

    borderRadius: Radius.round,

    backgroundColor: Colors.primary,
  },

  tradeTimelineContent: {
    marginLeft: Spacing.md,
  },

  tradeTimelineLabel: {
    fontSize: 10,
    fontWeight: "700",

    color: Colors.textMuted,

    textTransform: "uppercase",
  },

  tradeTimelineDate: {
    marginTop: 2,

    fontSize: Typography.caption,

    color: Colors.textSecondary,
  },

  tradeTimelinePrice: {
    marginTop: 2,

    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  tradeTimelineLine: {
    width: 1,
    height: 18,

    marginLeft: 4,

    backgroundColor: Colors.border,
  },

  // ==================================================
  // TRADE RESULT
  // ==================================================

  tradeResultBox: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,

    backgroundColor: Colors.backgroundSecondary,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    flexDirection: "row",
    justifyContent: "space-between",
  },

  tradeResultRight: {
    alignItems: "flex-end",
  },

  tradeResultLabel: {
    fontSize: 10,

    color: Colors.textMuted,

    textTransform: "uppercase",
  },

  tradeResultValue: {
    marginTop: 3,

    fontSize: 16,
    fontWeight: "700",
  },

  forceCloseText: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,

    backgroundColor: "#17130A",

    borderWidth: 1,
    borderColor: "#4A3508",

    borderRadius: Radius.sm,

    fontSize: 10,

    color: Colors.primary,
  },

  // ==================================================
  // EMPTY STATE
  // ==================================================

  emptyText: {
    paddingVertical: Spacing.md,

    fontSize: Typography.caption,

    color: Colors.textMuted,

    textAlign: "center",
  },

  // ==================================================
  // BACK BUTTON
  // ==================================================

  backButton: {
    minHeight: 52,

    marginTop: Spacing.xs,

    borderRadius: Radius.md,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: Colors.primary,
  },

  backButtonText: {
    fontSize: Typography.body,
    fontWeight: "800",

    color: Colors.black,

    letterSpacing: 0.2,
  },
});