import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getToken } from '../src/utils/secureStorage';
import { useAuthStore } from '../src/store/authStore';

/**
 * Root layout.
 *
 * Wraps the app in SafeAreaProvider for reliable edge-to-edge rendering
 * across iOS Dynamic Island / notch and Android navigation bars.
 * Manages authentication hydration and route guards.
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, token, setAuth, clearAuth } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // Bootstrap: hydrate auth state from SecureStore on first render.
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getToken();
        if (storedToken) {
          setAuth(storedToken, {
            id: '',
            email: '',
            nombre: '',
            role: 'user',
          });
        }
      } catch {
        clearAuth();
      } finally {
        setIsReady(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: redirect based on authentication state whenever it changes.
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isReady, segments, router]);

  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Slot />
    </SafeAreaProvider>
  );
}
