import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DropFab } from '@/features/drop/DropFab';
import { DropProvider } from '@/features/drop/DropSheet';
import { theme } from '@/theme/tokens';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  // The Drop button floats over the screens, just above the tab bar, so it needs the bar's height.
  const [barH, setBarH] = useState(80);
  return (
    <DropProvider>
      <View style={styles.fill}>
        <Tabs tabBar={(props) => <TabBar {...props} onHeight={setBarH} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.color.bg.canvas } }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="us" />
          <Tabs.Screen name="sync" />
        </Tabs>
        <DropFab bottom={barH + 14} />
      </View>
    </DropProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: theme.color.bg.canvas } });
