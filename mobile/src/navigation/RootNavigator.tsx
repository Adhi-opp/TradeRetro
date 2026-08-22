import React from "react";
import {
  NavigationContainer,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import BottomTabs, { MainTabParamList } from "./BottomTabs";

import MarketDetailScreen from "../features/marketDetail/MarketDetailScreen";
import BacktestScreen from "../features/Backtest/BacktestScreen";
import BacktestResultsScreen from "../features/Backtest/BacktestResultsScreen";
import WatchlistScreen from "../features/watchlist/WatchlistScreen";

import { BacktestResponse } from "../types/Backtest";

export type RootStackParamList = {
  MainTabs: {
    screen?: keyof MainTabParamList;
  };

  MarketDetail: {
    symbol: string;
  };

  Watchlist: undefined;

  Backtest: {
    symbol?: string;
  };

  BacktestResults: {
    result: BacktestResponse;
  };

  AI: undefined;
};

const Stack =
  createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={BottomTabs}
        />

        <Stack.Screen
          name="MarketDetail"
          component={MarketDetailScreen}
        />

        <Stack.Screen
          name="Watchlist"
          component={WatchlistScreen}
        />

        <Stack.Screen
          name="Backtest"
          component={BacktestScreen}
        />

        <Stack.Screen
          name="BacktestResults"
          component={BacktestResultsScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}