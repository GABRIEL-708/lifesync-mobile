import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SERVICIO DE NOTIFICACIONES LOCALES NATIVAS (iOS / Android / Web)
 * Observador concreto del patrón Observer: traduce cada MedicalAlert en una
 * notificación de sistema real (banner del SO + sonido + vibración).
 * Funciona sin internet (Modo Avión) porque son notificaciones LOCALES.
 * ══════════════════════════════════════════════════════════════════════════════
 */

let initialized = false;
let permissionGranted = false;

// Mostrar el banner del sistema incluso cuando la app está en primer plano
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Entornos sin soporte (web antiguo)
}

export async function initLocalNotifications(): Promise<boolean> {
  if (initialized) return permissionGranted;
  initialized = true;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const res =
          Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        permissionGranted = res === 'granted';
      }
      return permissionGranted;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medical-alerts', {
        name: 'Alertas Médicas',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      status = req.status;
    }
    permissionGranted = status === 'granted';
  } catch (err) {
    console.warn('[Notifications] No se pudo inicializar:', err);
    permissionGranted = false;
  }
  return permissionGranted;
}

export async function showLocalNotification(
  title: string,
  body: string,
  critical = false
): Promise<void> {
  // Retroalimentación háptica inmediata (siempre disponible)
  Vibration.vibrate(critical ? [0, 400, 200, 400] : 400);

  try {
    if (!initialized) await initLocalNotifications();
    if (!permissionGranted) return;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        new Notification(title, { body });
      }
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: critical
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: Platform.OS === 'android' ? { channelId: 'medical-alerts' } as any : null,
    });
  } catch (err) {
    console.warn('[Notifications] Error mostrando notificación:', err);
  }
}

export function isNotificationPermissionGranted(): boolean {
  return permissionGranted;
}
