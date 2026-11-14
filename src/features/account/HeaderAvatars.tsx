import { router } from 'expo-router';
import { Pressable, Share, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useActivity } from '@/features/notify/activity';
import { haptics } from '@/theme/haptics';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Avatar } from '@/ui/AvatarPair';

import { useAccount, useNames } from './account';

/** Shares the invite code through the system share sheet. */
export const shareInvite = (code: string) =>
  Share.share({ message: `Join me on usync so we can share the life admin. Open the app and enter this code: ${code}` }).catch(() => undefined);

/**
 * Right side of every tab header (Figma 214:21545): the activity bell in a soft circle, then your
 * avatar, which opens your profile and settings. Until your partner joins, a "+" sits next to it
 * and shares your invite code.
 */
export function HeaderAvatars() {
  const t = useTheme();
  const s = useStyles();
  const n = useNames();
  const { partner, inviteCode } = useAccount();
  const { unread } = useActivity();
  // Figma 355:30856: on the dark header the bell is white in a #383838 circle.
  const ink = t.color.header.ink;
  return (
    <View style={s.row}>
      <Pressable
        onPress={() => router.push('/activity')}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={unread ? 'Activity, new' : 'Activity'}
        style={[s.circle, s.bell]}
      >
        <Svg width={16.2} height={18} viewBox="0 0 18 20" fill="none">
          <Path fill={ink} d="M12.748 18.75C12.748 18.9489 12.669 19.1397 12.5283 19.2803C12.3877 19.421 12.1969 19.5 11.998 19.5H5.99798C5.79906 19.5 5.6083 19.421 5.46765 19.2803C5.32699 19.1397 5.24798 18.9489 5.24798 18.75C5.24798 18.5511 5.32699 18.3603 5.46765 18.2197C5.6083 18.079 5.79906 18 5.99798 18H11.998C12.1969 18 12.3877 18.079 12.5283 18.2197C12.669 18.3603 12.748 18.5511 12.748 18.75ZM17.7964 15.75C17.6663 15.9792 17.4774 16.1696 17.2491 16.3014C17.0209 16.4333 16.7616 16.5018 16.498 16.5H1.49798C1.23429 16.4996 0.97536 16.4298 0.747279 16.2975C0.519198 16.1651 0.330028 15.975 0.198835 15.7463C0.0676423 15.5176 -0.000936882 15.2583 9.66719e-06 14.9946C0.000956216 14.7309 0.0713951 14.4722 0.204227 14.2444C0.724539 13.3481 1.49798 10.8131 1.49798 7.5C1.49798 5.51088 2.28815 3.60322 3.69468 2.1967C5.1012 0.790176 7.00885 0 8.99798 0C10.9871 0 12.8948 0.790176 14.3013 2.1967C15.7078 3.60322 16.498 5.51088 16.498 7.5C16.498 10.8122 17.2724 13.3481 17.7927 14.2444C17.9268 14.4725 17.9978 14.7322 17.9983 14.9968C17.9988 15.2614 17.9288 15.5214 17.7955 15.75H17.7964ZM16.498 15C15.7733 13.7559 14.998 10.8797 14.998 7.5C14.998 5.9087 14.3658 4.38258 13.2406 3.25736C12.1154 2.13214 10.5893 1.5 8.99798 1.5C7.40668 1.5 5.88055 2.13214 4.75534 3.25736C3.63012 4.38258 2.99798 5.9087 2.99798 7.5C2.99798 10.8806 2.22173 13.7569 1.49798 15H16.498Z" />
        </Svg>
        {unread && <View style={s.dot} />}
      </Pressable>
      <View style={s.people}>
        <Pressable onPress={() => router.push('/settings')} hitSlop={4} accessibilityRole="button" accessibilityLabel="Profile and settings">
          <Avatar initial={n.initials.a} avatar={n.avatars.a} color={n.colors.me} size={40} ring={{ width: 0, color: 'transparent' }} />
        </Pressable>
        {!partner && inviteCode && (
          <Pressable
            onPress={() => { haptics.tick(); shareInvite(inviteCode); }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Invite your person"
            style={[s.circle, s.plus]}
          >
            <Svg width={13} height={13} viewBox="0 0 15 15" fill="none">
              <Path fill={ink} d="M15 7.5C15 7.66576 14.9342 7.82473 14.8169 7.94194C14.6997 8.05915 14.5408 8.125 14.375 8.125H8.125V14.375C8.125 14.5408 8.05915 14.6997 7.94194 14.8169C7.82473 14.9342 7.66576 15 7.5 15C7.33424 15 7.17527 14.9342 7.05806 14.8169C6.94085 14.6997 6.875 14.5408 6.875 14.375V8.125H0.625C0.45924 8.125 0.300269 8.05915 0.183058 7.94194C0.0658481 7.82473 0 7.66576 0 7.5C0 7.33424 0.0658481 7.17527 0.183058 7.05806C0.300269 6.94085 0.45924 6.875 0.625 6.875H6.875V0.625C6.875 0.45924 6.94085 0.300269 7.05806 0.183058C7.17527 0.0658481 7.33424 0 7.5 0C7.66576 0 7.82473 0.0658481 7.94194 0.183058C8.05915 0.300269 8.125 0.45924 8.125 0.625V6.875H14.375C14.5408 6.875 14.6997 6.94085 14.8169 7.05806C14.9342 7.17527 15 7.33424 15 7.5Z" />
            </Svg>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Figma 355:30856: the bell, 12, then my avatar; both 40.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  people: { flexDirection: 'row', alignItems: 'center' },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.header.button },
  bell: {},
  plus: { marginLeft: 6 },
  dot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: t.color.header.button, backgroundColor: t.color.accent.heart },
}));
