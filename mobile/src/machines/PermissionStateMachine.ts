/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MÁQUINA DE ESTADOS FINITOS (FSM): Gestión Asíncrona de Permisos de Hardware
 * Gestiona de forma determinista la solicitud de permisos (GPS / Cámara)
 * e implementa DEGRADACIÓN GRADUAL (Graceful Degradation):
 * Si el usuario deniega el GPS, la app no crashea; deshabilita el rastreo en nube
 * y permite el funcionamiento offline del historial clínico.
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type PermissionState =
  | 'IDLE'                  // Estado inicial, permiso no solicitado aún
  | 'REQUESTING'            // En proceso de solicitud al sistema operativo
  | 'GRANTED'               // Permiso concedido, funcionalidad completa activada
  | 'DENIED_SOFT'           // Denegado temporalmente (degradación gradual activa)
  | 'PERMANENTLY_BLOCKED';  // Denegado con "no volver a preguntar", requiere Ajustes

export type SensorType = 'GPS_LOCATION' | 'CAMERA_PRESCRIPTION';

export interface SensorStatus {
  sensor: SensorType;
  state: PermissionState;
  cloudSyncEnabled: boolean;
  offlineAccessEnabled: boolean;
  lastLocation?: { lat: number; lng: number } | null;
  statusMessage: string;
}

export class PermissionStateMachine {
  private currentState: PermissionState = 'IDLE';
  private sensor: SensorType;
  private onStateChangeListeners: Array<(status: SensorStatus) => void> = [];

  constructor(sensor: SensorType) {
    this.sensor = sensor;
  }

  getState(): PermissionState {
    return this.currentState;
  }

  getStatus(): SensorStatus {
    const isGranted = this.currentState === 'GRANTED';

    let statusMessage = 'Permiso no solicitado.';
    if (this.currentState === 'REQUESTING') statusMessage = 'Solicitando acceso al sensor al sistema operativo...';
    if (this.currentState === 'GRANTED') statusMessage = 'Sensor activo. Geolocalización en la nube habilitada.';
    if (this.currentState === 'DENIED_SOFT') {
      statusMessage = 'Permiso denegado por el usuario. [DEGRADACIÓN GRADUAL ACTIVA]: Rastreo en la nube deshabilitado; el historial clínico continúa funcionando 100% offline sin fallos.';
    }
    if (this.currentState === 'PERMANENTLY_BLOCKED') {
      statusMessage = 'Permiso bloqueado permanentemente. Actívalo en Ajustes si requieres GPS.';
    }

    return {
      sensor: this.sensor,
      state: this.currentState,
      cloudSyncEnabled: isGranted,
      // DEGRADACIÓN GRADUAL: El acceso offline NUNCA se desactiva
      offlineAccessEnabled: true,
      lastLocation: isGranted ? { lat: 20.9674, lng: -89.5926 } : null, // Mérida, Yucatán coords demo
      statusMessage,
    };
  }

  subscribe(listener: (status: SensorStatus) => void): () => void {
    this.onStateChangeListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.onStateChangeListeners.forEach((l) => l(status));
  }

  /**
   * Transición de estado: Iniciar solicitud
   */
  startRequest(): void {
    if (this.currentState === 'REQUESTING') return;
    this.currentState = 'REQUESTING';
    this.notify();
  }

  /**
   * Transición de estado: Concedido
   */
  grant(): void {
    this.currentState = 'GRANTED';
    this.notify();
  }

  /**
   * Transición de estado: Denegado (Aplica Graceful Degradation)
   */
  deny(permanent = false): void {
    this.currentState = permanent ? 'PERMANENTLY_BLOCKED' : 'DENIED_SOFT';
    this.notify();
  }

  /**
   * Reinicia la máquina a IDLE
   */
  reset(): void {
    this.currentState = 'IDLE';
    this.notify();
  }
}

// Instancias exportadas para sensores de la app
export const gpsStateMachine = new PermissionStateMachine('GPS_LOCATION');
export const cameraStateMachine = new PermissionStateMachine('CAMERA_PRESCRIPTION');
