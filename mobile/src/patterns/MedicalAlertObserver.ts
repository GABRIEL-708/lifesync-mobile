/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PATRÓN DE DISEÑO OBSERVER: Módulo de Alertas Médicas Locales
 * Permite suscribir observadores (UI, sonido, notificaciones locales) que
 * reaccionan automáticamente ante anomalías de salud o recordatorios de
 * medicamentos críticos sin acoplar la lógica de negocio.
 * ══════════════════════════════════════════════════════════════════════════════
 */

export interface MedicalAlert {
  id: string;
  tipo: 'CRITICAL_MEDICATION' | 'ANOMALY_DETECTED' | 'EMERGENCY_DISPATCH';
  titulo: string;
  mensaje: string;
  medicamento?: string;
  dosis?: string;
  timestamp: string;
  nivelPrioridad: 'ALTA' | 'CRITICA';
}

export type AlertObserverCallback = (alert: MedicalAlert) => void;

export interface IMedicalAlertSubject {
  subscribe(observer: AlertObserverCallback): () => void;
  unsubscribe(observer: AlertObserverCallback): void;
  notify(alert: MedicalAlert): void;
}

class MedicalAlertSubject implements IMedicalAlertSubject {
  private observers: Set<AlertObserverCallback> = new Set();
  private alertHistory: MedicalAlert[] = [];

  /**
   * Suscribe un observador a las alertas médicas.
   * Retorna una función para cancelar la suscripción automáticamente (clean-up).
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
   * Notifica a todos los observadores registrados
   */
  notify(alert: MedicalAlert): void {
    this.alertHistory.unshift(alert);
    // Limitar historial a las últimas 10 alertas
    if (this.alertHistory.length > 10) this.alertHistory.pop();

    this.observers.forEach((callback) => {
      try {
        callback(alert);
      } catch (err) {
        console.error('[Observer Error]', err);
      }
    });
  }

  /**
   * Dispara una alerta de medicamento controlado crítico
   */
  triggerCriticalMedicationAlert(medicamento: string, dosis: string, instrucciones: string): MedicalAlert {
    const alert: MedicalAlert = {
      id: `alert_${Date.now()}`,
      tipo: 'CRITICAL_MEDICATION',
      titulo: `⚠️ Hora de medicamento crítico: ${medicamento}`,
      mensaje: `Dosis prescrita: ${dosis}. Instrucciones: ${instrucciones || 'Tomar con agua'}.`,
      medicamento,
      dosis,
      timestamp: new Date().toLocaleTimeString(),
      nivelPrioridad: 'CRITICA',
    };
    this.notify(alert);
    return alert;
  }

  /**
   * Dispara una alerta de anomalía o emergencia
   */
  triggerAnomalyAlert(titulo: string, detalle: string): MedicalAlert {
    const alert: MedicalAlert = {
      id: `anomaly_${Date.now()}`,
      tipo: 'ANOMALY_DETECTED',
      titulo: `🚨 ANOMALÍA MÉDICA: ${titulo}`,
      mensaje: detalle,
      timestamp: new Date().toLocaleTimeString(),
      nivelPrioridad: 'ALTA',
    };
    this.notify(alert);
    return alert;
  }

  getHistory(): MedicalAlert[] {
    return [...this.alertHistory];
  }
}

// Instancia única (Singleton) del Subject de Alertas
export const medicalAlertDispatcher = new MedicalAlertSubject();
