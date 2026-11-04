import { CaretRight } from 'phosphor-react-native';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui/Text';

export type WeekBar = { label: string; count: number; note: 'added' | 'missed' | null };

/** One month in the album: how many jobs got done, week by week, and whether a note went out. */
export function MonthCard({ month, total, weeks }: { month: string; total: number; weeks: WeekBar[] }) {
  const t = useTheme();
  const s = useStyles();
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const busiest = weeks.findIndex((w) => w.count === max && max > 0);
  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.flex}>
          <Text variant="label/md" color={t.color.text.secondary}>{month}</Text>
          <Text variant="display/lg" style={s.total}>{`${total} ${total === 1 ? 'Task' : 'Tasks'}`}</Text>
        </View>
        <CaretRight size={20} color={t.color.text.muted} />
      </View>
      <View style={s.bars}>
        {weeks.map((w, i) => (
          <View key={w.label} style={s.col}>
            <Text variant={i === busiest ? 'title/md' : 'caption'} color={i === busiest ? t.color.text.primary : t.color.text.secondary}>
              {i === busiest ? 'Busiest' : w.count ? String(w.count) : ''}
            </Text>
            <View style={[s.bar, { height: 12 + (w.count / max) * 76, backgroundColor: i === busiest ? t.color.action.primary : t.color.action.neutral }]} />
            <View style={[s.dot, { backgroundColor: w.note === 'added' ? '#2E8F80' : w.note === 'missed' ? t.color.action.negative : 'transparent' }]} />
            <Text variant="caption" color={t.color.text.secondary}>{w.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Legend() {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={s.legend}>
      <View style={s.key}><View style={[s.dot, { backgroundColor: '#2E8F80' }]} /><Text variant="caption" color={t.color.text.secondary}>Note added</Text></View>
      <View style={s.key}><View style={[s.dot, { backgroundColor: t.color.action.negative }]} /><Text variant="caption" color={t.color.text.secondary}>Note missed</Text></View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { backgroundColor: t.color.bg.sync, borderRadius: t.radius.lg, padding: 16, gap: 16, boxShadow: t.shadow.row },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  total: { textTransform: 'none', fontSize: 22, lineHeight: 28 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: 130 },
  col: { alignItems: 'center', gap: 6, flex: 1 },
  bar: { width: 36, borderRadius: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legend: { flexDirection: 'row', gap: 16 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
