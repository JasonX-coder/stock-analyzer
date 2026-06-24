import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { colors } from "../src/theme";
import { initPurchases } from "../src/lib/purchases";

export default function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme !== "light";

  useEffect(() => {
    initPurchases();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="analyze" options={{ headerShown: false, presentation: "modal" }} />
          <Stack.Screen name="paywall" options={{ presentation: "modal", headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
