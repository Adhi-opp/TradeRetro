import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/RootNavigator";

import { getMarketUniverse } from "../../services/marketService";
import { runBacktest } from "../../services/backtestService";

import { MarketAsset } from "../../types/Market";
import { BacktestResponse } from "../../types/Backtest";

import { BACKTEST_STRATEGIES } from "../../constants/backtestStrategies";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "Backtest"
>;

type PerformanceMode = "gross" | "net";

export default function BacktestScreen({
  navigation,
  route,
}: Props) {
  // ==================================================
  // 1. STRATEGY
  // ==================================================

  const [strategy, setStrategy] = useState(
    "MOVING_AVERAGE_CROSSOVER",
  );

  // ==================================================
  // 2. PARAMETERS
  // ==================================================

  const [initialCapital, setInitialCapital] =
    useState("100000");

  const [shortPeriod, setShortPeriod] =
    useState("20");

  const [longPeriod, setLongPeriod] =
    useState("50");

  const [rsiPeriod, setRsiPeriod] =
    useState("14");

  const [rsiOversold, setRsiOversold] =
    useState("30");

  const [rsiOverbought, setRsiOverbought] =
    useState("70");

  const [bbPeriod, setBbPeriod] =
    useState("20");

  const [bbStdDev, setBbStdDev] =
    useState("2");

  const [dcPeriod, setDcPeriod] =
    useState("20");

  // ==================================================
  // 3. RISK MANAGEMENT
  // ==================================================

  const [riskEnabled, setRiskEnabled] =
    useState(true);

  /*
   * These are UI percentages.
   *
   * Example:
   *
   * Risk per trade = 2
   * Stop loss = 5
   *
   * Backend receives:
   *
   * riskPct = 0.02
   * stopLossPct = 0.05
   */

  const [riskPct, setRiskPct] =
    useState("2");

  const [stopLossPct, setStopLossPct] =
    useState("5");

  /*
   * These two settings remain part of the mobile
   * Risk Management UI.
   *
   * The current backend does not accept them in
   * /api/backtest, so they are deliberately NOT
   * included in the API request.
   */

  const [takeProfitPct, setTakeProfitPct] =
    useState("5");

  const [maxDrawdownPct, setMaxDrawdownPct] =
    useState("10");

  // ==================================================
  // 4. ASSET
  // ==================================================

  const [assets, setAssets] =
    useState<MarketAsset[]>([]);

  const [selectedSymbol, setSelectedSymbol] =
    useState("");

  const [loadingAssets, setLoadingAssets] =
    useState(true);

  // ==================================================
  // 5. PERIOD
  // ==================================================

  const [startDate, setStartDate] =
    useState("2025-01-01");

  const [endDate, setEndDate] =
    useState("2025-12-31");

  // ==================================================
  // 6. EXECUTION / PERFORMANCE MODE
  // ==================================================

  /*
   * This remains a frontend toggle.
   *
   * The current backend returns BOTH:
   *
   * result.metrics
   * result.grossMetrics
   *
   * Therefore performanceMode does not need to be
   * sent to /api/backtest.
   */

  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("gross");

  const [running, setRunning] =
    useState(false);

  // ==================================================
  // LOAD MARKETS
  // ==================================================

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    try {
      const universe =
        await getMarketUniverse();

      /*
       * These assets are not intended for the
       * stock strategy backtest engine.
       */

      const backtestAssets =
        universe.filter(
          (asset) =>
            ![
              "CRUDE",
              "USDINR",
              "INDIAVIX",
            ].includes(
              asset.symbol.toUpperCase(),
            ),
        );

      setAssets(backtestAssets);

      /*
       * Respect an optional symbol passed from
       * Dashboard.
       */

      const requestedSymbol =
        route.params?.symbol;

      const requestedAsset =
        requestedSymbol
          ? backtestAssets.find(
              (asset) =>
                asset.symbol ===
                requestedSymbol,
            )
          : undefined;

      if (requestedAsset) {
        setSelectedSymbol(
          requestedAsset.symbol,
        );
      } else if (
        backtestAssets.length > 0
      ) {
        setSelectedSymbol(
          backtestAssets[0].symbol,
        );
      }
    } catch (error) {
      console.error(
        "Failed to load markets:",
        error,
      );

      Alert.alert(
        "Error",
        "Unable to load markets.",
      );
    } finally {
      setLoadingAssets(false);
    }
  }

  // ==================================================
  // BUILD STRATEGY PARAMETERS
  // ==================================================

  function buildStrategyParams(): Record<
    string,
    number
  > {
    const params: Record<string, number> = {
      initialCapital:
        Number(initialCapital),
    };

    switch (strategy) {
      case "MOVING_AVERAGE_CROSSOVER":
        params.shortPeriod =
          Number(shortPeriod);

        params.longPeriod =
          Number(longPeriod);

        break;

      case "RSI":
        params.rsiPeriod =
          Number(rsiPeriod);

        /*
         * Backend expects:
         *
         * oversold
         * overbought
         */

        params.oversold =
          Number(rsiOversold);

        params.overbought =
          Number(rsiOverbought);

        break;

      case "MACD":
        /*
         * MACD currently uses its
         * backend defaults.
         */
        break;

      case "BOLLINGER_BREAKOUT":
        params.bbPeriod =
          Number(bbPeriod);

        params.bbStdDev =
          Number(bbStdDev);

        break;

      case "DONCHIAN_BREAKOUT":
        params.dcPeriod =
          Number(dcPeriod);

        break;

      default:
        break;
    }

    // ==================================================
    // RISK MANAGEMENT → BACKEND
    // ==================================================

    if (riskEnabled) {
      /*
       * IMPORTANT:
       *
       * UI:
       *   2%
       *
       * Backend:
       *   0.02
       */

      params.riskPct =
        Number(riskPct) / 100;

      params.stopLossPct =
        Number(stopLossPct) / 100;
    }

    /*
     * DO NOT send:
     *
     * positionSizePct
     * takeProfitPct
     * maxDrawdownPct
     *
     * because the current Python backtest endpoint
     * does not accept those parameters.
     */

    return params;
  }

  // ==================================================
  // VALIDATION
  // ==================================================

  function validateInputs(): boolean {
    // ----------------------------------------------
    // ASSET
    // ----------------------------------------------

    if (!selectedSymbol) {
      Alert.alert(
        "Missing Asset",
        "Please select a market.",
      );

      return false;
    }

    // ----------------------------------------------
    // INITIAL CAPITAL
    // ----------------------------------------------

    const capital =
      Number(initialCapital);

    if (
      !Number.isFinite(capital) ||
      capital <= 0
    ) {
      Alert.alert(
        "Invalid Capital",
        "Initial capital must be greater than zero.",
      );

      return false;
    }

    // ----------------------------------------------
    // DATES
    // ----------------------------------------------

    if (
      !startDate ||
      !endDate
    ) {
      Alert.alert(
        "Missing Period",
        "Please provide both start and end dates.",
      );

      return false;
    }

    const dateRegex =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !dateRegex.test(startDate) ||
      !dateRegex.test(endDate)
    ) {
      Alert.alert(
        "Invalid Date",
        "Dates must use the format YYYY-MM-DD.",
      );

      return false;
    }

    if (startDate >= endDate) {
      Alert.alert(
        "Invalid Date Range",
        "Start date must be before end date.",
      );

      return false;
    }

    // ----------------------------------------------
    // MOVING AVERAGE
    // ----------------------------------------------

    if (
      strategy ===
      "MOVING_AVERAGE_CROSSOVER"
    ) {
      const short =
        Number(shortPeriod);

      const long =
        Number(longPeriod);

      if (
        !Number.isFinite(short) ||
        !Number.isFinite(long) ||
        short <= 0 ||
        long <= 0
      ) {
        Alert.alert(
          "Invalid Moving Averages",
          "Moving average periods must be greater than zero.",
        );

        return false;
      }

      if (short >= long) {
        Alert.alert(
          "Invalid Moving Averages",
          "Short period must be smaller than long period.",
        );

        return false;
      }
    }

    // ----------------------------------------------
    // RSI
    // ----------------------------------------------

    if (strategy === "RSI") {
      const period =
        Number(rsiPeriod);

      const oversold =
        Number(rsiOversold);

      const overbought =
        Number(rsiOverbought);

      if (
        !Number.isFinite(period) ||
        period <= 0
      ) {
        Alert.alert(
          "Invalid RSI Period",
          "RSI period must be greater than zero.",
        );

        return false;
      }

      if (
        !Number.isFinite(oversold) ||
        oversold <= 0 ||
        oversold >= 100
      ) {
        Alert.alert(
          "Invalid Oversold Level",
          "Oversold must be between 1 and 99.",
        );

        return false;
      }

      if (
        !Number.isFinite(overbought) ||
        overbought <= 0 ||
        overbought >= 100
      ) {
        Alert.alert(
          "Invalid Overbought Level",
          "Overbought must be between 1 and 99.",
        );

        return false;
      }

      if (oversold >= overbought) {
        Alert.alert(
          "Invalid RSI Levels",
          "Oversold must be lower than overbought.",
        );

        return false;
      }
    }

    // ----------------------------------------------
    // BOLLINGER
    // ----------------------------------------------

    if (
      strategy ===
      "BOLLINGER_BREAKOUT"
    ) {
      const period =
        Number(bbPeriod);

      const deviation =
        Number(bbStdDev);

      if (
        !Number.isFinite(period) ||
        period <= 0
      ) {
        Alert.alert(
          "Invalid Bollinger Period",
          "Bollinger period must be greater than zero.",
        );

        return false;
      }

      if (
        !Number.isFinite(deviation) ||
        deviation <= 0
      ) {
        Alert.alert(
          "Invalid Standard Deviation",
          "Standard deviation must be greater than zero.",
        );

        return false;
      }
    }

    // ----------------------------------------------
    // DONCHIAN
    // ----------------------------------------------

    if (
      strategy ===
      "DONCHIAN_BREAKOUT"
    ) {
      const period =
        Number(dcPeriod);

      if (
        !Number.isFinite(period) ||
        period <= 0
      ) {
        Alert.alert(
          "Invalid Donchian Period",
          "Donchian period must be greater than zero.",
        );

        return false;
      }
    }

    // ----------------------------------------------
    // RISK MANAGEMENT
    // ----------------------------------------------

    if (riskEnabled) {
      const risk =
        Number(riskPct);

      const stop =
        Number(stopLossPct);

      const takeProfit =
        Number(takeProfitPct);

      const maxDrawdown =
        Number(maxDrawdownPct);

      if (
        !Number.isFinite(risk) ||
        risk <= 0 ||
        risk >= 100
      ) {
        Alert.alert(
          "Invalid Risk",
          "Risk per trade must be between 0 and 100%.",
        );

        return false;
      }

      if (
        !Number.isFinite(stop) ||
        stop <= 0 ||
        stop >= 100
      ) {
        Alert.alert(
          "Invalid Stop Loss",
          "Stop loss must be between 0 and 100%.",
        );

        return false;
      }

      if (
        !Number.isFinite(takeProfit) ||
        takeProfit <= 0 ||
        takeProfit >= 100
      ) {
        Alert.alert(
          "Invalid Take Profit",
          "Take profit must be between 0 and 100%.",
        );

        return false;
      }

      if (
        !Number.isFinite(maxDrawdown) ||
        maxDrawdown <= 0 ||
        maxDrawdown >= 100
      ) {
        Alert.alert(
          "Invalid Maximum Drawdown",
          "Maximum drawdown must be between 0 and 100%.",
        );

        return false;
      }
    }

    return true;
  }

  // ==================================================
  // RUN BACKTEST
  // ==================================================

  async function handleRunBacktest() {
    if (!validateInputs()) {
      return;
    }

    try {
      setRunning(true);

      /*
       * IMPORTANT:
       *
       * This is the EXACT API contract currently
       * accepted by the backend.
       *
       * Do not add:
       *
       * performanceMode
       * riskManagement
       *
       * at the top level.
       */

      const request = {
        symbol: selectedSymbol,

        strategyType: strategy,

        params:
          buildStrategyParams(),

        startDate,

        endDate,
      };

      console.log(
        "================================",
      );

      console.log(
        "BACKTEST REQUEST:",
        JSON.stringify(
          request,
          null,
          2,
        ),
      );

      console.log(
        "PERFORMANCE MODE:",
        performanceMode,
      );

      console.log(
        "================================",
      );

      const result: BacktestResponse =
        await runBacktest(request);

      console.log(
        "BACKTEST RESPONSE:",
        JSON.stringify(
          result,
          null,
          2,
        ),
      );

      navigation.navigate(
        "BacktestResults",
        {
          result,
        },
      );
    } catch (error) {
      console.error(
        "Backtest failed:",
        error,
      );

      Alert.alert(
        "Backtest Failed",
        "Unable to run the backtest. Please check your inputs and try again.",
      );
    } finally {
      setRunning(false);
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loadingAssets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading markets...
        </Text>
      </View>
    );
  }

  // ==================================================
  // MAIN UI
  // ==================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ==================================================
          HEADER
          ================================================== */}

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          BACKTEST ENGINE
        </Text>

        <Text style={styles.title}>
          Configure, validate, execute
        </Text>

        <Text style={styles.subtitle}>
          Configure a strategy, select an
          asset, define the historical
          period and run the backtest.
        </Text>

        <View style={styles.workflowBadge}>
          <Text style={styles.workflowBadgeText}>
            Manual workflow
          </Text>
        </View>
      </View>

      {/* ==================================================
          SIX STEP INDICATOR
          ================================================== */}

      <View style={styles.stepContainer}>
        <Step
          number="1"
          label="Strategy"
        />

        <Step
          number="2"
          label="Parameters"
        />

        <Step
          number="3"
          label="Risk"
        />

        <Step
          number="4"
          label="Asset"
        />

        <Step
          number="5"
          label="Period"
        />

        <Step
          number="6"
          label="Execute"
        />
      </View>

      {/* ==================================================
          1. STRATEGY
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="1"
          title="Strategy"
          description="Choose the trading strategy to evaluate."
        />

        <View style={styles.strategyGrid}>
          {BACKTEST_STRATEGIES.map(
            (item) => {
              const selected =
                strategy === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[
                    styles.strategyButton,
                    selected &&
                      styles.selectedButton,
                  ]}
                  onPress={() =>
                    setStrategy(
                      item.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.strategyText,
                      selected &&
                        styles.selectedText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      </View>

      {/* ==================================================
          2. PARAMETERS
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="2"
          title="Parameters"
          description="Configure strategy-specific parameters."
        />

        <Field
          label="Initial Capital"
          value={initialCapital}
          onChangeText={
            setInitialCapital
          }
          keyboardType="numeric"
          placeholder="100000"
        />

        {strategy ===
          "MOVING_AVERAGE_CROSSOVER" && (
          <>
            <Field
              label="Short Period"
              value={shortPeriod}
              onChangeText={
                setShortPeriod
              }
              keyboardType="numeric"
              placeholder="20"
            />

            <Field
              label="Long Period"
              value={longPeriod}
              onChangeText={
                setLongPeriod
              }
              keyboardType="numeric"
              placeholder="50"
            />
          </>
        )}

        {strategy === "RSI" && (
          <>
            <Field
              label="RSI Period"
              value={rsiPeriod}
              onChangeText={
                setRsiPeriod
              }
              keyboardType="numeric"
              placeholder="14"
            />

            <Field
              label="Oversold Level"
              value={rsiOversold}
              onChangeText={
                setRsiOversold
              }
              keyboardType="numeric"
              placeholder="30"
            />

            <Field
              label="Overbought Level"
              value={rsiOverbought}
              onChangeText={
                setRsiOverbought
              }
              keyboardType="numeric"
              placeholder="70"
            />
          </>
        )}

        {strategy === "MACD" && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              MACD uses the strategy's
              built-in parameters.
            </Text>
          </View>
        )}

        {strategy ===
          "BOLLINGER_BREAKOUT" && (
          <>
            <Field
              label="Bollinger Period"
              value={bbPeriod}
              onChangeText={
                setBbPeriod
              }
              keyboardType="numeric"
              placeholder="20"
            />

            <Field
              label="Standard Deviation"
              value={bbStdDev}
              onChangeText={
                setBbStdDev
              }
              keyboardType="decimal-pad"
              placeholder="2"
            />
          </>
        )}

        {strategy ===
          "DONCHIAN_BREAKOUT" && (
          <Field
            label="Donchian Period"
            value={dcPeriod}
            onChangeText={
              setDcPeriod
            }
            keyboardType="numeric"
            placeholder="20"
          />
        )}
      </View>

      {/* ==================================================
          3. RISK MANAGEMENT
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="3"
          title="Risk Management"
          description="Control position risk and protection rules."
        />

        {/* ENABLE / DISABLE */}

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>
              Enable Risk Management
            </Text>

            <Text style={styles.toggleDescription}>
              Apply risk-based position sizing
              and stop-loss protection.
            </Text>
          </View>

          <Pressable
            style={[
              styles.switch,
              riskEnabled &&
                styles.switchActive,
            ]}
            onPress={() =>
              setRiskEnabled(
                !riskEnabled,
              )
            }
          >
            <View
              style={[
                styles.switchThumb,
                riskEnabled &&
                  styles.switchThumbActive,
              ]}
            />
          </Pressable>
        </View>

        {riskEnabled && (
          <>
            <Field
              label="Risk Per Trade (%)"
              value={riskPct}
              onChangeText={setRiskPct}
              keyboardType="decimal-pad"
              placeholder="2"
            />

            <Field
              label="Stop Loss (%)"
              value={stopLossPct}
              onChangeText={
                setStopLossPct
              }
              keyboardType="decimal-pad"
              placeholder="5"
            />

            <Field
              label="Take Profit (%)"
              value={takeProfitPct}
              onChangeText={
                setTakeProfitPct
              }
              keyboardType="decimal-pad"
              placeholder="5"
            />

            <Field
              label="Maximum Drawdown (%)"
              value={maxDrawdownPct}
              onChangeText={
                setMaxDrawdownPct
              }
              keyboardType="decimal-pad"
              placeholder="10"
            />

            <View style={styles.riskNote}>
              <Text style={styles.riskNoteTitle}>
                Backend-compatible risk
              </Text>

              <Text style={styles.riskNoteText}>
                Risk per trade and stop loss
                are converted from percentages
                to decimal values before being
                sent to the backtest engine.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ==================================================
          4. ASSET
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="4"
          title="Asset"
          description="Select the market to backtest."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.horizontalList
          }
        >
          {assets.map((asset) => {
            const selected =
              selectedSymbol ===
              asset.symbol;

            return (
              <Pressable
                key={asset.symbol}
                style={[
                  styles.marketButton,
                  selected &&
                    styles.selectedButton,
                ]}
                onPress={() =>
                  setSelectedSymbol(
                    asset.symbol,
                  )
                }
              >
                <Text
                  style={[
                    styles.marketName,
                    selected &&
                      styles.selectedText,
                  ]}
                >
                  {asset.display_name}
                </Text>

                <Text
                  style={[
                    styles.marketSymbol,
                    selected &&
                      styles.selectedText,
                  ]}
                >
                  {asset.symbol}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {assets.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No backtestable assets are
              currently available.
            </Text>
          </View>
        )}
      </View>

      {/* ==================================================
          5. PERIOD
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="5"
          title="Period"
          description="Define the historical period to test."
        />

        <Field
          label="Start Date"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Field
          label="End Date"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.periodPreview}>
          <Text style={styles.periodPreviewLabel}>
            Backtest Period
          </Text>

          <Text style={styles.periodPreviewValue}>
            {startDate} → {endDate}
          </Text>
        </View>
      </View>

      {/* ==================================================
          6. EXECUTE
          ================================================== */}

      <View style={styles.section}>
        <SectionHeader
          number="6"
          title="Execute"
          description="Choose performance reporting and run the engine."
        />

        {/* GROSS / NET TOGGLE */}

        <Text style={styles.label}>
          Performance View
        </Text>

        <View style={styles.performanceToggle}>
          <Pressable
            style={[
              styles.performanceOption,
              performanceMode ===
                "net" &&
                styles.performanceOptionActive,
            ]}
            onPress={() =>
              setPerformanceMode("net")
            }
          >
            <Text
              style={[
                styles.performanceOptionText,
                performanceMode ===
                  "net" &&
                  styles.performanceOptionTextActive,
              ]}
            >
              Net of Costs
            </Text>

            <Text
              style={[
                styles.performanceHint,
                performanceMode ===
                  "net" &&
                  styles.performanceHintActive,
              ]}
            >
              After transaction costs
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.performanceOption,
              performanceMode ===
                "gross" &&
                styles.performanceOptionActive,
            ]}
            onPress={() =>
              setPerformanceMode("gross")
            }
          >
            <Text
              style={[
                styles.performanceOptionText,
                performanceMode ===
                  "gross" &&
                  styles.performanceOptionTextActive,
              ]}
            >
              Gross
            </Text>

            <Text
              style={[
                styles.performanceHint,
                performanceMode ===
                  "gross" &&
                  styles.performanceHintActive,
              ]}
            >
              Before transaction costs
            </Text>
          </Pressable>
        </View>

        {/* REQUEST PREVIEW */}

        <View style={styles.requestPreview}>
          <Text style={styles.requestPreviewTitle}>
            Execution Summary
          </Text>

          <SummaryRow
            label="Asset"
            value={
              selectedSymbol ||
              "Not selected"
            }
          />

          <SummaryRow
            label="Strategy"
            value={getStrategyName(
              strategy,
            )}
          />

          <SummaryRow
            label="Period"
            value={`${startDate} → ${endDate}`}
          />

          <SummaryRow
            label="Performance"
            value={
              performanceMode ===
              "gross"
                ? "Gross"
                : "Net of Costs"
            }
          />

          <SummaryRow
            label="Risk Management"
            value={
              riskEnabled
                ? "Enabled"
                : "Disabled"
            }
          />
        </View>

        {/* RUN */}

        <Pressable
          style={[
            styles.runButton,
            running &&
              styles.disabledButton,
          ]}
          disabled={running}
          onPress={
            handleRunBacktest
          }
        >
          {running ? (
            <>
              <ActivityIndicator
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.runningText
                }
              >
                Running Backtest...
              </Text>
            </>
          ) : (
            <Text
              style={
                styles.runButtonText
              }
            >
              Run Backtest
            </Text>
          )}
        </Pressable>

        <Text style={styles.executionNote}>
          The selected performance mode is
          retained for the mobile workflow.
          The current backend returns both
          gross and net metrics.
        </Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ======================================================
// STEP COMPONENT
// ======================================================

function Step({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNumber}>
          {number}
        </Text>
      </View>

      <Text style={styles.stepLabel}>
        {label}
      </Text>
    </View>
  );
}

// ======================================================
// SECTION HEADER
// ======================================================

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>
          {number}
        </Text>
      </View>

      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        <Text style={styles.sectionDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// INPUT FIELD
// ======================================================

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?:
    | "default"
    | "numeric"
    | "decimal-pad";
  placeholder?: string;
  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";
  autoCorrect?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize={
          autoCapitalize
        }
        autoCorrect={autoCorrect}
      />
    </View>
  );
}

// ======================================================
// SUMMARY ROW
// ======================================================

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

// ======================================================
// STRATEGY NAME
// ======================================================

function getStrategyName(
  strategyType: string,
) {
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

// ======================================================
// STYLES
// ======================================================

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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",

    padding: Spacing.xl,

    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: Spacing.md,

    color: Colors.textSecondary,

    fontSize: Typography.body,
  },

  // ==================================================
  // HEADER
  // ==================================================

  header: {
    position: "relative",

    marginBottom: Spacing.xl,

    paddingTop: Spacing.xs,
    paddingRight: 90,
  },

  eyebrow: {
    color: Colors.primary,

    fontSize: 10,
    fontWeight: "700",

    letterSpacing: 1.5,
  },

  title: {
    marginTop: Spacing.sm,

    fontSize: 28,
    lineHeight: 34,

    fontWeight: "700",

    color: Colors.textPrimary,

    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: Spacing.sm,

    fontSize: Typography.body,
    lineHeight: 21,

    color: Colors.textSecondary,
  },

  workflowBadge: {
    position: "absolute",

    right: 0,
    top: 0,

    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  workflowBadgeText: {
    fontSize: 9,
    fontWeight: "700",

    color: Colors.textMuted,

    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // ==================================================
  // SIX STEPS
  // ==================================================

  stepContainer: {
    marginBottom: Spacing.lg,

    padding: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    flexDirection: "row",
    flexWrap: "wrap",

    justifyContent: "space-between",
  },

  step: {
    width: "31%",

    marginBottom: Spacing.md,

    flexDirection: "row",
    alignItems: "center",
  },

  stepCircle: {
    width: 30,
    height: 30,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  stepNumber: {
    fontSize: 10,
    fontWeight: "700",

    color: Colors.primary,

    letterSpacing: 0.4,
  },

  stepLabel: {
    flex: 1,

    marginLeft: Spacing.sm,

    fontSize: Typography.caption,
    fontWeight: "600",

    color: Colors.textSecondary,
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

  sectionHeader: {
    marginBottom: Spacing.lg,

    flexDirection: "row",
    alignItems: "flex-start",
  },

  sectionNumber: {
    width: 32,
    height: 32,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  sectionNumberText: {
    fontSize: 10,
    fontWeight: "700",

    color: Colors.primary,

    letterSpacing: 0.4,
  },

  sectionHeaderText: {
    flex: 1,

    marginLeft: Spacing.md,
  },

  sectionTitle: {
    fontSize: Typography.sectionTitle,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  sectionDescription: {
    marginTop: 3,

    fontSize: Typography.caption,
    lineHeight: 18,

    color: Colors.textMuted,
  },

  // ==================================================
  // STRATEGY
  // ==================================================

  strategyGrid: {
    gap: Spacing.sm,
  },

  strategyButton: {
    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  strategyText: {
    fontSize: Typography.body,

    fontWeight: "600",

    color: Colors.textSecondary,
  },

  selectedButton: {
    backgroundColor: Colors.primary,

    borderColor: Colors.primary,
  },

  selectedText: {
    color: Colors.black,

    fontWeight: "700",
  },

  // ==================================================
  // INPUTS
  // ==================================================

  field: {
    marginBottom: Spacing.sm,
  },

  label: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,

    fontSize: Typography.label,

    fontWeight: "700",

    color: Colors.textSecondary,

    letterSpacing: 0.3,
  },

  input: {
    minHeight: 44,

    paddingHorizontal: Spacing.md,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    backgroundColor: Colors.backgroundSecondary,

    fontSize: Typography.body,

    color: Colors.textPrimary,
  },

  infoBox: {
    marginTop: Spacing.sm,

    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  infoText: {
    fontSize: Typography.caption,
    lineHeight: 18,

    color: Colors.textSecondary,
  },

  // ==================================================
  // RISK MANAGEMENT
  // ==================================================

  toggleRow: {
    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  toggleTextContainer: {
    flex: 1,

    paddingRight: Spacing.md,
  },

  toggleTitle: {
    fontSize: Typography.body,

    fontWeight: "700",

    color: Colors.textPrimary,
  },

  toggleDescription: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 17,

    color: Colors.textMuted,
  },

  switch: {
    width: 46,
    height: 26,

    padding: 3,

    borderRadius: Radius.round,

    justifyContent: "center",

    backgroundColor: Colors.borderLight,
  },

  switchActive: {
    backgroundColor: Colors.primary,
  },

  switchThumb: {
    width: 20,
    height: 20,

    borderRadius: Radius.round,

    backgroundColor: Colors.textSecondary,
  },

  switchThumbActive: {
    alignSelf: "flex-end",

    backgroundColor: Colors.black,
  },

  riskNote: {
    marginTop: Spacing.md,

    padding: Spacing.md,

    backgroundColor: "#17130A",

    borderWidth: 1,
    borderColor: "#4A3508",

    borderRadius: Radius.md,
  },

  riskNoteTitle: {
    fontSize: Typography.caption,

    fontWeight: "700",

    color: Colors.primary,
  },

  riskNoteText: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 17,

    color: Colors.textSecondary,
  },

  // ==================================================
  // ASSET
  // ==================================================

  horizontalList: {
    paddingRight: Spacing.sm,
  },

  marketButton: {
    minWidth: 140,

    marginRight: Spacing.sm,

    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  marketName: {
    fontSize: Typography.body,

    fontWeight: "700",

    color: Colors.textPrimary,
  },

  marketSymbol: {
    marginTop: 4,

    fontSize: 10,

    color: Colors.textMuted,

    letterSpacing: 0.3,
  },

  emptyBox: {
    marginTop: Spacing.sm,

    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  emptyText: {
    fontSize: Typography.caption,

    color: Colors.textMuted,

    textAlign: "center",
  },

  // ==================================================
  // PERIOD
  // ==================================================

  periodPreview: {
    marginTop: Spacing.md,

    padding: Spacing.md,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  periodPreviewLabel: {
    fontSize: 9,

    fontWeight: "700",

    color: Colors.textMuted,

    letterSpacing: 0.8,

    textTransform: "uppercase",
  },

  periodPreviewValue: {
    marginTop: 4,

    fontSize: Typography.body,

    fontWeight: "700",

    color: Colors.primary,

    letterSpacing: 0.2,
  },

  // ==================================================
  // PERFORMANCE TOGGLE
  // ==================================================

  performanceToggle: {
    marginTop: Spacing.xs,

    padding: 3,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    flexDirection: "row",
  },

  performanceOption: {
    flex: 1,

    padding: Spacing.md,

    borderRadius: Radius.sm,

    alignItems: "center",
  },

  performanceOptionActive: {
    backgroundColor: Colors.primary,
  },

  performanceOptionText: {
    fontSize: Typography.caption,

    fontWeight: "700",

    color: Colors.textMuted,
  },

  performanceOptionTextActive: {
    color: Colors.black,
  },

  performanceHint: {
    marginTop: 3,

    fontSize: 9,

    color: Colors.textMuted,

    textAlign: "center",
  },

  performanceHintActive: {
    color: "#3A2A08",
  },

  // ==================================================
  // EXECUTION SUMMARY
  // ==================================================

  requestPreview: {
    marginTop: Spacing.lg,

    padding: Spacing.md,

    backgroundColor: Colors.backgroundSecondary,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  requestPreviewTitle: {
    marginBottom: Spacing.sm,

    fontSize: Typography.body,

    fontWeight: "700",

    color: Colors.textPrimary,
  },

  summaryRow: {
    paddingVertical: Spacing.xs,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  summaryLabel: {
    fontSize: 11,

    color: Colors.textMuted,
  },

  summaryValue: {
    maxWidth: "62%",

    fontSize: 11,

    fontWeight: "700",

    color: Colors.textPrimary,

    textAlign: "right",
  },

  // ==================================================
  // RUN BUTTON
  // ==================================================

  runButton: {
    minHeight: 52,

    marginTop: Spacing.lg,

    borderRadius: Radius.md,

    justifyContent: "center",
    alignItems: "center",

    flexDirection: "row",

    backgroundColor: Colors.primary,
  },

  disabledButton: {
    opacity: 0.55,
  },

  runButtonText: {
    fontSize: Typography.body,

    fontWeight: "800",

    color: Colors.black,

    letterSpacing: 0.2,
  },

  runningText: {
    marginLeft: Spacing.sm,

    fontSize: Typography.body,

    fontWeight: "700",

    color: Colors.black,
  },

  executionNote: {
    marginTop: Spacing.sm,

    fontSize: 10,
    lineHeight: 16,

    textAlign: "center",

    color: Colors.textMuted,
  },

  bottomSpacer: {
    height: Spacing.xl,
  },
});