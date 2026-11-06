import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Manrope_300Light } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider, useAccount } from '@/features/account/account';
import { DeckProvider } from '@/features/deck/store';
import { ActivityProvider } from '@/features/notify/activity';
import { NotificationsBridge } from '@/features/notify/NotificationsBridge';
import { Hearts } from '@/features/thanks/Hearts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ToastHost } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded] = useFonts({
    ArchivoBlack_400Regular,
    Manrope_300Light,
    'Satoshi-Regular': require('@/../assets/fonts/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('@/../assets/fonts/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('@/../assets/fonts/Satoshi-Bold.otf'),
    'Satoshi-Black': require('@/../assets/fonts/Satoshi-Black.otf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const t = useTheme();
  // The window behind every screen (seen during transitions and keyboard moves) follows the mode.
  useEffect(() => { SystemUI.setBackgroundColorAsync(t.color.bg.canvas).catch(() => undefined); }, [t]);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.color.bg.canvas }}>
      <SafeAreaProvider>
        <ToastHost>
          <AccountProvider>
            <DeckProvider>
              <ActivityProvider>
                <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
                <Routes />
                <NotificationsBridge />
                <Hearts />
              </ActivityProvider>
            </DeckProvider>
          </AccountProvider>
        </ToastHost>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Sign in, then a name, then a space; the deck only once all three exist. */
function Routes() {
  const { session, me, loading } = useAccount();
  const t = useTheme();
  if (loading) return null;
  const signedIn = !!session;
  const named = signedIn && !!me;
  const paired = named && !!me?.couple_id;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.color.bg.canvas } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !named}>
        <Stack.Screen name="name" />
      </Stack.Protected>
      <Stack.Protected guard={named && !paired}>
        <Stack.Screen name="pair" />
      </Stack.Protected>
      <Stack.Protected guard={paired}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="activity" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}
