/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PATRÓN DE DISEÑO OBSERVER: Módulo de Alertas Médicas Locales
 * Permite suscribir observadores (UI, sonido, notificaciones locales de sistema)
 * que reaccionan automáticamente ante anomalías de salud o recordatorios de
 * medicamentos críticos sin acoplar la lógica de negocio.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { showLocalNotification } from '../services/notificationService';

export interface MedicalAlert {
  id: string;
  tipo: 'CRITICAL_MEDICATION' | 'ANOMALY_DETECTED' | 'EMERGENCY_DISPATCH';
  titulo: string;
  mensaje: string;
  medicamento?: string;
  dosis?: string;
  timestamp: string;
  nivelPrioridad: 'ALTA' | 'CRITICA';
  leida?: boolean;
}

export type AlertObserverCallback = (alert: MedicalAlert) => void;

class MedicalAlertSubject {
  private observers: Set<AlertObserverCallback> = new Set();
  private alertHistory: MedicalAlert[] = [];

  // El permiso de notificaciones se solicita desde la UI (initLocalNotifications)
  constructor() {}

  /**
   * Suscribe un observador a las alertas médicas.
   */
  subscribe(observer: AlertObserverCallback): () => void {
    this.observers.add(observer);
    return () => this.unsubscribe(observer);
  }

  /**
   * Da de baja un observador
   */
  unsubscribe(observer: AlertObserverCallback): void {
    this.observers.delete(observer);
  }

  /**
   * Notifica a todos los observadores registrados y dispara notificación de sistema
   */
  notify(alert: MedicalAlert): void {
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > 15) this.alertHistory.pop();

    // 1. Notificar a los componentes UI observadores
    this.observers.forEach((callback) => {
      try {
        callback(alert);
      } catch (err) {
        console.error('[Observer Error]', err);
      }
    });

    // 2. Disparar notificación nativa del sistema (iOS / Android / Web)
    showLocalNotification(alert.titulo, alert.mensaje, alert.nivelPrioridad === 'CRITICA');
  }

  /**
   * Dispara una alerta de medicamento controlado crítico
   */
  triggerCriticalMedicationAlert(medicamento: string, dosis: string, instrucciones: string): MedicalAlert {
    const alert: MedicalAlert = {
      id: `alert_${Date.now()}`,
      tipo: 'CRITICAL_MEDICATION',
      titulo: `⏰ RECORDATORIO: ${medicamento.toUpperCase()}`,
      mensaje: `Es hora de administrar ${dosis}. Indicación: ${instrucciones || 'Tomar según prescripción médica'}.`,
      medicamento,
      dosis,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      nivelPrioridad: 'CRITICA',
      leida: false,
    };
    this.notify(alert);
    return alert;
  }

  /**
   * Dispara una alerta de anomalía médica
   */
  triggerAnomalyAlert(titulo: string, detalle: string): MedicalAlert {
    const alert: MedicalAlert = {
      id: `anomaly_${Date.now()}`,
      tipo: 'ANOMALY_DETECTED',
      titulo: `🚨 ANOMALÍA MÉDICA DETECTADA: ${titulo}`,
      mensaje: detalle,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      nivelPrioridad: 'ALTA',
      leida: false,
    };
    this.notify(alert);
    return alert;
  }

  getHistory(): MedicalAlert[] {
    return [...this.alertHistory];
  }

  clearHistory(): void {
    this.alertHistory = [];
  }
}

export const medicalAlertDispatcher = new MedicalAlertSubject();
