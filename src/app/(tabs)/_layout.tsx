import { Tabs } from 'expo-router/js-tabs';

import { DropProvider } from '@/features/drop/DropSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { NavChromeProvider } from '@/ui/navChrome';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <NavChromeProvider>
    <DropProvider>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.color.bg.canvas } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="us" />
        <Tabs.Screen name="sync" />
      </Tabs>
    </DropProvider>
    </NavChromeProvider>
  );
}
