import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider, useAppState } from './src/AppState';
import FeedScreen from './src/screens/FeedScreen';
import SavedScreen from './src/screens/SavedScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors, fonts } from './src/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, border: colors.line },
};

const TAB_ICON: Record<string, string> = { feed: '📖', saved: '♥', settings: '⚙' };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 16, color }}>{TAB_ICON[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="feed" component={FeedScreen} options={{ tabBarLabel: 'פיד' }} />
      <Tab.Screen name="saved" component={SavedScreen} options={{ tabBarLabel: 'שמורים' }} />
      <Tab.Screen name="settings" component={SettingsScreen} options={{ tabBarLabel: 'הגדרות' }} />
    </Tab.Navigator>
  );
}

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready, error } = useAppState();

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>משהו השתבש בטעינת השירים</Text>
        <Text style={styles.errBody}>{error}</Text>
      </View>
    );
  }
  if (!fontsReady || !ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingTxt}>טוען שירה…</Text>
      </View>
    );
  }
  return <Tabs />;
}

export default function App() {
  const [fontsReady] = useFonts({
    [fonts.serif]: require('./assets/fonts/FrankRuhlLibre-Regular.ttf'),
    'FrankRuhlLibre-Medium': require('./assets/fonts/FrankRuhlLibre-Medium.ttf'),
    'FrankRuhlLibre-Bold': require('./assets/fonts/FrankRuhlLibre-Bold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <NavigationContainer theme={navTheme}>
          <Gate fontsReady={fontsReady} />
        </NavigationContainer>
        <StatusBar style="dark" />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  loadingTxt: { color: colors.inkSoft, fontSize: 16, writingDirection: 'rtl' },
  errTitle: { color: colors.ink, fontSize: 18, writingDirection: 'rtl', textAlign: 'center' },
  errBody: { color: colors.inkFaint, fontSize: 13, textAlign: 'center' },
});
