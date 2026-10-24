import { Tabs } from 'expo-router/js-tabs';

import { DropProvider } from '@/features/drop/DropSheet';
import { theme } from '@/theme/tokens';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <DropProvider>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.color.bg.canvas } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="us" />
        <Tabs.Screen name="sync" />
      </Tabs>
    </DropProvider>
  );
}
