import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '@/theme/ThemeProvider';

import { Backdrop } from './Backdrop';
import { useLightStatusBar } from './navChrome';
import { BODY_TOP, ScreenHeader } from './ScreenHeader';

export { HEADER_TOP } from './ScreenHeader';

type Props = { title: string; count?: number; children: ReactNode; scroll?: boolean; right?: ReactNode };

/**
 * A tab screen (Figma 355:30851): the dark-to-light backdrop, the header on its dark top, and the
 * content in the light body container below it, which runs to the bottom of the screen.
 */
export function Screen({ title, count, children, scroll = true, right }: Props) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  useLightStatusBar();
  const top = insets.top + BODY_TOP;
  return (
    <View style={s.fill}>
      <Backdrop />
      <ScreenHeader title={title} count={count} right={right} />
      <View style={[s.panel, { top }]}>
        {scroll ? (
          // Inputs on scrolling screens stay above the keyboard on both platforms.
          <KeyboardAvoidingView behavior="padding" style={s.flex}>
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={[s.flex, s.body]}>{children}</View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1 },
  flex: { flex: 1 },
  // Figma 355:30867: 8 in from each side, #FDFDFD, a 4 white top edge, 24 top corners.
  panel: {
    position: 'absolute', left: 8, right: 8, bottom: 0, overflow: 'hidden',
    backgroundColor: t.color.body.fill, borderTopWidth: 4, borderColor: t.color.body.edge,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  // 24 above the content, 12 more at the sides (20 from the screen edge); room under it for the nav.
  body: { paddingHorizontal: 12, paddingTop: 24, paddingBottom: 128, gap: 16, flexGrow: 1 },
}));
