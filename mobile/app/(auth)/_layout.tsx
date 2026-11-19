import { Stack } from 'expo-router';

/**
 * Stack navigator for unauthenticated screens: Login and Register.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
