import type { Icon } from 'phosphor-react-native';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/theme/haptics';
import { motion } from '@/theme/motion';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { Tone } from '@/theme/tokens';

import { Text } from './Text';

/**
 * Pill buttons from the redesign.
 * - primary: solid ink pill (black in light, cream in dark), the one main action
 * - positive / negative: green "Take it" and red "Not this one / Delete"
 * - ghost: a quiet surface pill for secondary actions
 * - a person tone or 'gold': the pill wears that person's color
 * Older call sites pass 'cream' for the main action; it maps to primary.
 */
export type ButtonTone = 'primary' | 'positive' | 'negative' | 'ghost' | Tone;

type Props = {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  icon?: Icon;
  fill?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

export function PopButton({ label, onPress, tone = 'primary', icon: IconCmp, fill, disabled, small, style }: Props) {
  const t = useTheme();
  const s = useStyles();
  const p = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.04 }] }));

  const role = tone === 'cream' ? 'primary' : tone;
  const colors: { bg: string; ink: string; border?: string } = (() => {
    if (disabled) return { bg: t.color.bg.surface, ink: t.color.text.placeholder };
    switch (role) {
      case 'primary': return { bg: t.color.action.primary, ink: t.color.action.onPrimary };
      case 'positive': return { bg: t.color.action.positive, ink: t.color.text.onColor };
      case 'negative': return { bg: t.color.action.negative, ink: t.color.text.onColor };
      case 'ghost': return { bg: t.color.bg.raised, ink: t.color.text.primary, border: t.color.border.strong };
      case 'neutral': return { bg: t.color.action.neutral, ink: t.color.text.onColor };
      default: return { bg: t.tones[role].face, ink: '#1A1A1A' };
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => { p.set(withTiming(1, motion.press)); haptics.press(); }}
      onPressOut={() => { p.set(withTiming(0, motion.release)); }}
      onPress={onPress}
      style={[fill && s.fill, style]}
    >
      <Animated.View style={[s.face, small && s.small, { backgroundColor: colors.bg }, colors.border ? { borderWidth: 1, borderColor: colors.border } : null, face]}>
        {IconCmp && <IconCmp size={small ? 14 : 18} color={colors.ink} weight="bold" />}
        <Text variant={small ? 'button/sm' : 'button'} color={colors.ink} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flexGrow: 1, flexBasis: 0 },
  face: {
    minHeight: 48, paddingHorizontal: 22, borderRadius: t.radius.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  small: { minHeight: 32, paddingHorizontal: 14 },
}));
