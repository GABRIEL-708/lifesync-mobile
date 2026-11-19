import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getToken } from '../src/utils/secureStorage';
import { useAuthStore } from '../src/store/authStore';

/**
 * Root layout.
 *
 * On mount it reads the JWT from SecureStore. If a token exists it marks the
 * store as authenticated so the protected (app) group is reachable. The router
 * then redirects to the correct segment based on authentication state.
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
          // We only have the token; a full user object would require a /me
          // endpoint (Sprint 2). For now, populate a minimal placeholder so
          // the store is marked as authenticated.
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
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}
