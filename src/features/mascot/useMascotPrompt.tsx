import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAccount, useNames } from '@/features/account/account';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/ui/Toast';

import { Mascot } from './Mascot';

const ASKED = 'usync.mascot.asked';

/** Once paired, ask once (per phone) to make the mascot your partner gets nudged by. */
export function useMascotPrompt() {
  const { me, partner } = useAccount();
  const names = useNames();
  const t = useTheme();
  const toast = useToast();
  const due = !!partner && !!me && !me.mascot;
  const bg = t.tones[names.colors.me].glow[0];
  const them = partner?.name;

  useEffect(() => {
    if (!due) return;
    let live = true;
    const id = setTimeout(async () => {
      const asked = await AsyncStorage.getItem(ASKED).catch(() => '1');
      if (!live || asked) return;
      await AsyncStorage.setItem(ASKED, '1').catch(() => undefined);
      toast({
        kind: 'info',
        lead: <Mascot recipe={null} mood="cheeky" size={40} bg={bg} />,
        title: 'Make your mascot',
        body: `When a task sits too long, ${them} gets a nudge from it. In your voice, Hinglish style.`,
        action: { label: 'Make it', onPress: () => router.push('/mascot') },
        ms: 9000,
      });
    }, 2500);
    return () => { live = false; clearTimeout(id); };
  }, [due, bg, them, toast]);
}
