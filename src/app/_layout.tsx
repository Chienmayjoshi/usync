import { Fraunces_400Regular_Italic, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider, useAccount } from '@/features/account/account';
import { DeckProvider } from '@/features/deck/store';
import { theme } from '@/theme/tokens';
import { ToastHost } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded] = useFonts({ Fraunces_600SemiBold, Fraunces_400Regular_Italic, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastHost>
          <AccountProvider>
            <DeckProvider>
              <StatusBar style="light" />
              <Routes />
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
  if (loading) return null;
  const signedIn = !!session;
  const named = signedIn && !!me;
  const paired = named && !!me?.couple_id;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg.canvas } }}>
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
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.color.bg.canvas } });
