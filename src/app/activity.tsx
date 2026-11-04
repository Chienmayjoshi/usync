import { router } from 'expo-router';
import { Bell, CheckCircle, Hand, Heart, Plus, Users, X } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ActivityItem, useActivity } from '@/features/notify/activity';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

const ICON = { thanks: Heart, request: Hand, drop: Plus, done: CheckCircle, sync: Users } as const;

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Behind the bell: requests, hearts, new cards and finished jobs, newest first. */
export default function ActivityScreen() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { items, markSeen, seen } = useActivity();
  // Opening the list reads it; the dot clears once you leave.
  useEffect(() => () => markSeen(), [markSeen]);

  return (
    <View style={[s.fill, { paddingTop: insets.top + 12 }]}>
      <View style={s.header}>
        <Text variant="display/lg">Activity</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={s.close}>
          <X size={22} color={t.color.text.primary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}>
        {items.length === 0 && (
          <View style={s.empty}>
            <Bell size={40} color={t.color.text.placeholder} />
            <Text variant="body/md" color={t.color.text.secondary}>Nothing yet. Requests, hearts and new cards show up here.</Text>
          </View>
        )}
        {items.map((i) => <Row key={i.id} item={i} fresh={!seen || i.created_at > seen} />)}
      </ScrollView>
    </View>
  );
}

function Row({ item, fresh }: { item: ActivityItem; fresh: boolean }) {
  const t = useTheme();
  const s = useStyles();
  const Icon = ICON[item.kind as keyof typeof ICON] ?? Bell;
  const color = item.kind === 'thanks' ? t.color.accent.heart : item.kind === 'request' ? t.color.accent.tag : t.color.text.secondary;
  return (
    <View style={s.row}>
      <View style={s.icon}><Icon size={20} color={color} weight="fill" /></View>
      <View style={s.copy}>
        <Text variant="title/md">{item.title}</Text>
        <Text variant="body/sm" color={t.color.text.secondary} numberOfLines={2}>{item.body}</Text>
      </View>
      <View style={s.meta}>
        <Text variant="caption" color={t.color.text.muted}>{ago(item.created_at)}</Text>
        {fresh && <View style={s.dot} />}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, minHeight: 56 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: t.color.bg.surface },
  list: { paddingHorizontal: 20, gap: 10, paddingTop: 8 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.bg.surface, borderRadius: t.radius.md, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.color.bg.raised, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  meta: { alignItems: 'flex-end', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.accent.heart },
}));
