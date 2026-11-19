'use strict';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PATRÓN DE DISEÑO STRATEGY: Exportación de Historial Clínico de Emergencia
 * Permite intercambiar dinámicamente la estrategia de serialización y formato
 * según el destinatario (JSON para sistemas médicos / HL7 o CSV para aseguradoras)
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Interfaz / Clase Base
class ExportStrategy {
  /**
   * @param {Object} record - Documento del historial clínico
   * @param {Object} user - Datos del usuario titular
   * @returns {{ contentType: string, filename: string, data: string }}
   */
  export(_record, _user) {
    throw new Error('Método export() debe ser implementado por la estrategia.');
  }
}

/**
 * Estrategia 1: Exportación en JSON estándar para sistemas hospitalarios / médicos
 */
class MedicalSystemJsonStrategy extends ExportStrategy {
  export(record, user) {
    const payload = {
      standard: 'LifeSync-HealthRecord-v1.0',
      exportedAt: new Date().toISOString(),
      patient: {
        id: user.id || user._id,
        nombre: user.nombre,
        email: user.email,
        tipoSangre: record.tipoSangre,
      },
      clinicalData: {
        alergias: record.alergias || [],
        condicionesCronicas: record.condicionesCronicas || [],
        medicamentosControlados: record.medicamentosControlados || [],
        notasMedicas: record.notasMedicas || '',
      },
      emergencyContacts: record.contactosEmergencia || [],
      incidentLocation: record.ultimaUbicacionIncidente || null,
    };

    return {
      contentType: 'application/json',
      filename: `historial_medico_${user.id || 'paciente'}.json`,
      data: JSON.stringify(payload, null, 2),
    };
  }
}

/**
 * Estrategia 2: Exportación en formato tabular CSV para compañías de seguros médicos
 */
class InsuranceCsvStrategy extends ExportStrategy {
  export(record, user) {
    const headers = [
      'ID_PACIENTE',
      'NOMBRE',
      'EMAIL',
      'TIPO_SANGRE',
      'ALERGIAS',
      'CONDICIONES_CRONICAS',
      'MEDICAMENTOS_CONTROLADOS_CANTIDAD',
      'CONTACTOS_EMERGENCIA_CANTIDAD',
      'FECHA_EXPORTACION',
    ].join(',');

    const sanitizeCsvField = (val) => {
      const stringVal = String(val ?? '').replace(/"/g, '""');
      return `"${stringVal}"`;
    };

    const row = [
      sanitizeCsvField(user.id || user._id),
      sanitizeCsvField(user.nombre),
      sanitizeCsvField(user.email),
      sanitizeCsvField(record.tipoSangre),
      sanitizeCsvField((record.alergias || []).join('; ')),
      sanitizeCsvField((record.condicionesCronicas || []).join('; ')),
      sanitizeCsvField((record.medicamentosControlados || []).length),
      sanitizeCsvField((record.contactosEmergencia || []).length),
      sanitizeCsvField(new Date().toISOString()),
    ].join(',');

    // Detalles adicionales de medicamentos y contactos
    let detailsSection = '\n\nDETALLE_MEDICAMENTOS_CONTROLADOS\nNombre,Dosis,Frecuencia,Instrucciones\n';
    if (record.medicamentosControlados && record.medicamentosControlados.length > 0) {
      record.medicamentosControlados.forEach((m) => {
        detailsSection += `${sanitizeCsvField(m.nombre)},${sanitizeCsvField(m.dosis)},${sanitizeCsvField(m.frecuencia)},${sanitizeCsvField(m.instrucciones)}\n`;
      });
    } else {
      detailsSection += 'Ninguno registrado,,,\n';
    }

    detailsSection += '\nDETALLE_CONTACTOS_EMERGENCIA\nNombre,Relacion,Telefono\n';
    if (record.contactosEmergencia && record.contactosEmergencia.length > 0) {
      record.contactosEmergencia.forEach((c) => {
        detailsSection += `${sanitizeCsvField(c.nombre)},${sanitizeCsvField(c.relacion)},${sanitizeCsvField(c.telefono)}\n`;
      });
    }

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `reporte_aseguradora_${user.id || 'paciente'}.csv`,
      data: `${headers}\n${row}${detailsSection}`,
    };
  }
}

/**
 * Contexto Strategy: Administra y ejecuta la estrategia elegida
 */
class MedicalRecordExporter {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  execute(record, user) {
    if (!this.strategy) {
      throw new Error('Estrategia de exportación no definida.');
    }
    return this.strategy.export(record, user);
  }
}

// Factoría simple de estrategias
const StrategyFactory = {
  create(format) {
    switch (String(format).toLowerCase()) {
      case 'csv':
        return new InsuranceCsvStrategy();
      case 'json':
      default:
        return new MedicalSystemJsonStrategy();
    }
  },
};

module.exports = {
  ExportStrategy,
  MedicalSystemJsonStrategy,
  InsuranceCsvStrategy,
  MedicalRecordExporter,
  StrategyFactory,
};
