import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import DashboardScreen from "../features/dashboard/DashboardScreen";
import MarketScreen from "../features/market/MarketScreen";
import WatchlistScreen from "../features/watchlist/WatchlistScreen";

import { Colors, Typography } from "../theme";

export type MainTabParamList = {
  Dashboard: undefined;
  Market: undefined;
  Watchlist: undefined;
};

const Tab =
  createBottomTabNavigator<MainTabParamList>();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor:
          Colors.primary,

        tabBarInactiveTintColor:
          Colors.textMuted,

        tabBarStyle: {
          backgroundColor:
            Colors.surface,

          borderTopColor:
            Colors.border,

          borderTopWidth: 1,

          height: 64,

          paddingTop: 7,
          paddingBottom: 7,
        },

        tabBarLabelStyle: {
          fontSize:
            Typography.caption,

          fontWeight: "600",
        },

        tabBarIcon: ({
          color,
          size,
          focused,
        }) => {
          let icon: keyof typeof Ionicons.glyphMap =
            "home-outline";

          switch (route.name) {
            case "Dashboard":
              icon = focused
                ? "home"
                : "home-outline";
              break;

            case "Market":
              icon = focused
                ? "trending-up"
                : "trending-up-outline";
              break;

            case "Watchlist":
              icon = focused
                ? "star"
                : "star-outline";
              break;
          }

          return (
            <Ionicons
              name={icon}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
      />

      <Tab.Screen
        name="Market"
        component={MarketScreen}
      />

      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
      />
    </Tab.Navigator>
  );
}