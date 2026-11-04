import { View } from 'react-native';

import { makeStyles } from '@/theme/ThemeProvider';

import { Text } from './Text';

/** Small dashed tag for a card's guesses: bucket, effort, when. */
export function Chip({ label, color }: { label: string; color?: string }) {
  const s = useStyles();
  return (
    <View style={[s.chip, color ? { borderColor: color } : null]}>
      <Text variant="body/sm" color={color}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: t.color.border.dashed, borderRadius: t.radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
}));
