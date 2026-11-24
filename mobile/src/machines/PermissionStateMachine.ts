/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MÁQUINA DE ESTADOS FINITOS (FSM): Gestión Asíncrona de Permisos de Hardware
 * Gestiona de forma determinista la solicitud REAL de permisos de GPS al sistema
 * operativo (expo-location) e implementa DEGRADACIÓN GRADUAL (Graceful Degradation):
 * Si el usuario deniega el GPS, la app no crashea; deshabilita el rastreo y el
 * historial clínico continúa funcionando offline.
 *
 *   IDLE ──startRequest──▶ REQUESTING ──grant──▶ GRANTED (lectura GPS en vivo)
 *                               │
 *                               └──deny──▶ DENIED_SOFT / PERMANENTLY_BLOCKED
 * ══════════════════════════════════════════════════════════════════════════════
 */
import * as Location from 'expo-location';

export type PermissionState =
  | 'IDLE'                  // Estado inicial, permiso no solicitado aún
  | 'REQUESTING'            // En proceso de solicitud al sistema operativo
  | 'GRANTED'               // Permiso concedido, funcionalidad completa activada
  | 'DENIED_SOFT'           // Denegado temporalmente (degradación gradual activa)
  | 'PERMANENTLY_BLOCKED';  // Denegado con "no volver a preguntar", requiere Ajustes

export type SensorType = 'GPS_LOCATION' | 'CAMERA_PRESCRIPTION';

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number | null;   // metros
  altitude: number | null;   // metros
  speed: number | null;      // m/s
  timestamp: number;         // epoch ms
}

export interface SensorStatus {
  sensor: SensorType;
  state: PermissionState;
  cloudSyncEnabled: boolean;
  offlineAccessEnabled: boolean;
  lastLocation: GeoFix | null;
  statusMessage: string;
  error?: string | null;
}

/** Transiciones válidas de la FSM (cualquier otra se ignora) */
const TRANSITIONS: Record<PermissionState, PermissionState[]> = {
  IDLE: ['REQUESTING'],
  REQUESTING: ['GRANTED', 'DENIED_SOFT', 'PERMANENTLY_BLOCKED', 'IDLE'],
  GRANTED: ['IDLE', 'REQUESTING', 'DENIED_SOFT'],
  DENIED_SOFT: ['REQUESTING', 'IDLE'],
  PERMANENTLY_BLOCKED: ['REQUESTING', 'IDLE'],
};

export class PermissionStateMachine {
  private currentState: PermissionState = 'IDLE';
  private sensor: SensorType;
  private listeners: Array<(status: SensorStatus) => void> = [];
  private lastLocation: GeoFix | null = null;
  private error: string | null = null;
  private watcher: Location.LocationSubscription | null = null;

  constructor(sensor: SensorType) {
    this.sensor = sensor;
  }

  getState(): PermissionState {
    return this.currentState;
  }

  getStatus(): SensorStatus {
    const isGranted = this.currentState === 'GRANTED';

    let statusMessage = 'Permiso no solicitado. Presiona "Activar GPS real".';
    if (this.currentState === 'REQUESTING') statusMessage = 'Solicitando permiso de ubicación al sistema operativo...';
    if (isGranted) {
      statusMessage = this.lastLocation
        ? 'GPS activo: recibiendo coordenadas reales del dispositivo en tiempo real.'
        : 'Permiso concedido. Obteniendo primera lectura del GPS...';
    }
    if (this.currentState === 'DENIED_SOFT') {
      statusMessage =
        'Permiso denegado. [DEGRADACIÓN GRADUAL ACTIVA]: rastreo deshabilitado; el historial clínico sigue funcionando 100% offline.';
    }
    if (this.currentState === 'PERMANENTLY_BLOCKED') {
      statusMessage = 'Permiso bloqueado en el sistema. Actívalo en Ajustes → Expo Go → Ubicación.';
    }

    return {
      sensor: this.sensor,
      state: this.currentState,
      cloudSyncEnabled: isGranted,
      offlineAccessEnabled: true, // DEGRADACIÓN GRADUAL: el acceso offline NUNCA se desactiva
      lastLocation: isGranted ? this.lastLocation : null,
      statusMessage,
      error: this.error,
    };
  }

  subscribe(listener: (status: SensorStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  private transition(next: PermissionState): boolean {
    if (next === this.currentState) return true;
    if (!TRANSITIONS[this.currentState].includes(next)) {
      console.warn(`[FSM] Transición inválida ${this.currentState} → ${next}`);
      return false;
    }
    this.currentState = next;
    this.notify();
    return true;
  }

  // ── Transiciones públicas (también usadas por pruebas / simulación) ───────
  startRequest(): void {
    this.transition('REQUESTING');
  }

  grant(): void {
    this.transition('GRANTED');
  }

  deny(permanent = false): void {
    this.stopWatching();
    this.lastLocation = null;
    this.transition(permanent ? 'PERMANENTLY_BLOCKED' : 'DENIED_SOFT');
  }

  reset(): void {
    this.stopWatching();
    this.lastLocation = null;
    this.error = null;
    this.transition('IDLE');
  }

  // ── Flujo REAL con el hardware GPS ────────────────────────────────────────
  /**
   * Solicita el permiso real al SO y, si se concede, empieza a leer el GPS.
   */
  async requestRealPermission(): Promise<void> {
    if (this.currentState === 'REQUESTING') return;
    this.error = null;
    this.transition('REQUESTING');

    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        this.error = 'Los servicios de ubicación del teléfono están apagados.';
        this.transition('DENIED_SOFT');
        return;
      }

      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.transition(canAskAgain ? 'DENIED_SOFT' : 'PERMANENTLY_BLOCKED');
        return;
      }

      this.transition('GRANTED');
      await this.startWatching();
    } catch (err: any) {
      this.error = err?.message || 'Error al acceder al GPS.';
      this.transition('DENIED_SOFT');
    }
  }

  private toFix(loc: Location.LocationObject): GeoFix {
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      altitude: loc.coords.altitude ?? null,
      speed: loc.coords.speed ?? null,
      timestamp: loc.timestamp,
    };
  }

  private async startWatching(): Promise<void> {
    this.stopWatching();

    // Lectura rápida inicial (última conocida) y luego una precisa
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last) {
      this.lastLocation = this.toFix(last);
      this.notify();
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    this.lastLocation = this.toFix(current);
    this.notify();

    // Seguimiento continuo mientras el permiso esté concedido
    this.watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 2 },
      (loc) => {
        if (this.currentState !== 'GRANTED') return;
        this.lastLocation = this.toFix(loc);
        this.notify();
      }
    );
  }

  /** Refresca manualmente la posición actual */
  async refreshLocation(): Promise<void> {
    if (this.currentState !== 'GRANTED') return;
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      this.lastLocation = this.toFix(current);
      this.error = null;
    } catch (err: any) {
      this.error = err?.message || 'No se pudo actualizar la ubicación.';
    }
    this.notify();
  }

  stopWatching(): void {
    this.watcher?.remove();
    this.watcher = null;
  }
}

// Instancias exportadas para sensores de la app
export const gpsStateMachine = new PermissionStateMachine('GPS_LOCATION');
export const cameraStateMachine = new PermissionStateMachine('CAMERA_PRESCRIPTION');
