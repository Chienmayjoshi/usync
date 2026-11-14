import { useRef } from 'react';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { PopButton } from '@/ui/PopButton';
import { Sheet, type SheetHandle } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import type { Card } from './model';

type Props = {
  card: Card;
  onClose: () => void;
  /** Back to the Table (cards on my deck only). */
  onTable?: () => void;
  onUpdate?: () => void;
  onDelete: () => void;
};

/**
 * What you can do with one task, as a drawer: move it back to the table, add an update, or
 * delete it (red, as "Not this one"). The drawer slides away first, then the choice happens,
 * so an update sheet never opens on top of it.
 */
export function TaskActions({ card, onClose, onTable, onUpdate, onDelete }: Props) {
  const t = useTheme();
  const s = useStyles();
  const sheet = useRef<SheetHandle>(null);
  const then = useRef<(() => void) | null>(null);
  const pick = (run?: () => void) => {
    then.current = run ?? null;
    sheet.current?.close();
  };
  return (
    <Sheet ref={sheet} onClose={() => { onClose(); then.current?.(); }}>
      <Text variant="label/md" color={t.color.text.secondary}>Task</Text>
      <Text variant="display/md" numberOfLines={2}>{card.title}</Text>
      <View style={s.buttons}>
        {onTable && <PopButton label="Move back to table" tone="ghost" onPress={() => pick(onTable)} />}
        {onUpdate && <PopButton label="Add an update" tone="primary" onPress={() => pick(onUpdate)} />}
        <PopButton label="Delete task" tone="negative" onPress={() => pick(onDelete)} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  buttons: { gap: 12, marginTop: 8 },
}));
