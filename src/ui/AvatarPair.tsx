import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { PersonColor } from '@/theme/tokens';

import { Text } from './Text';

type Person = { initial: string | null; avatar: string | null; color: PersonColor };

/** One person: their emoji if they picked one, else their initial, on their color. */
export function Avatar({ initial, avatar, color, size = 44 }: Person & { size?: number }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={[s.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.tones[color].face }]}>
      {avatar
        ? <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{avatar}</Text>
        : <Text variant="title/md" color="#1A1A1A" style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>{initial ?? '?'}</Text>}
    </View>
  );
}

type Props = {
  me: Person;
  partner: Person | null;
  /** Lets a feature wrap the partner avatar, e.g. to make it a drop target. */
  wrapPartner?: (node: ReactNode) => ReactNode;
  onPress?: () => void;
};

export function AvatarPair({ me, partner, wrapPartner = (n) => n, onPress }: Props) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Pressable
      style={s.row}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Profile and settings' : partner ? 'You and your partner' : 'You, partner not joined yet'}
    >
      <Avatar {...me} />
      <View style={s.second}>
        {partner ? wrapPartner(<Avatar {...partner} />) : (
          <View style={[s.av, s.empty]}><Text variant="title/md" color={t.color.text.secondary}>+</Text></View>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row' },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.color.bg.canvas, overflow: 'hidden' },
  second: { marginLeft: -8 },
  empty: { borderStyle: 'dashed', borderColor: t.color.border.dashed, backgroundColor: t.color.bg.surface },
}));
