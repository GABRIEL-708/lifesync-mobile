import { Stack } from 'expo-router';

/**
 * Stack navigator for authenticated screens.
 * Access to this group is guarded by the root layout redirect logic.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
