import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { AvatarPair } from '@/ui/AvatarPair';

import { useNames } from './account';

/** The avatar pair in every tab header. Tapping it opens profile and settings. */
export function HeaderAvatars({ wrapPartner }: { wrapPartner?: (node: ReactNode) => ReactNode }) {
  const n = useNames();
  return (
    <AvatarPair
      me={{ initial: n.initials.a, avatar: n.avatars.a, color: n.colors.me }}
      partner={n.partner ? { initial: n.initials.b, avatar: n.avatars.b, color: n.colors.partner } : null}
      wrapPartner={wrapPartner}
      onPress={() => router.push('/settings')}
    />
  );
}
