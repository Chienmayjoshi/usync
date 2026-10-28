import { requireOptionalNativeModule } from 'expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Voice drop runs on the phone's own speech recognizer: free, and the audio never leaves the
// phone. It needs a development build (the module is not in Expo Go); in Expo Go the mic button
// says so and the keyboard's mic still works. On web it uses the browser's recognizer.

type Speech = typeof import('expo-speech-recognition');
let speech: Speech | null | undefined;

function load(): Speech | null {
  if (speech !== undefined) return speech;
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) return (speech = null);
  try {
    // Required lazily: importing it where the native module is missing throws at load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    speech = require('expo-speech-recognition') as Speech;
    if (!speech.ExpoSpeechRecognitionModule.isRecognitionAvailable()) speech = null;
  } catch {
    speech = null;
  }
  return speech;
}

/** Live transcript while listening. `text` is what was typed before plus what is being said. */
export function useVoice(typed: string, onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useRef('');
  const sink = useRef(onText);
  useEffect(() => { sink.current = onText; }, [onText]);
  const available = load() !== null;

  useEffect(() => {
    const sr = load();
    if (!sr) return;
    const m = sr.ExpoSpeechRecognitionModule;
    const subs = [
      m.addListener('result', (e) => {
        const said = e.results[0]?.transcript ?? '';
        sink.current([base.current, said].filter(Boolean).join(base.current.endsWith(',') ? ' ' : ', '));
      }),
      m.addListener('end', () => setListening(false)),
      m.addListener('error', (e) => {
        setListening(false);
        if (e.error !== 'aborted' && e.error !== 'no-speech') setError('Didn’t catch that. Try again, or type it.');
      }),
    ];
    return () => { subs.forEach((s) => s.remove()); m.abort(); };
  }, []);

  const start = useCallback(async () => {
    const sr = load();
    if (!sr) return;
    setError(null);
    const perm = await sr.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { setError('Microphone access is off for usync. Turn it on in Settings to drop by voice.'); return; }
    base.current = typed.trim();
    // en-IN follows Indian English and most Hinglish ("kal electrician ko bulana hai").
    sr.ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: false });
    setListening(true);
  }, [typed]);

  const stop = useCallback(() => { load()?.ExpoSpeechRecognitionModule.stop(); }, []);

  return { available, listening, error, start, stop };
}
