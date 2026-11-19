'use strict';

const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const { MedicalRecordExporter, StrategyFactory } = require('../strategies/exportStrategy');

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CONTROLADOR: Historial Clínico de Emergencia
 * Incluye Mitigación Obligatoria de IDOR (Insecure Direct Object Reference)
 * Valida siempre que req.user.id (del token JWT firmado) sea el legítimo dueño.
 * ══════════════════════════════════════════════════════════════════════════════
 */

// GET /api/medical-record/me
// Obtiene el historial clínico del usuario autenticado
const getMyRecord = async (req, res) => {
  try {
    const userId = req.user.id; // Extraído de forma blindada desde authMiddleware (JWT)

    let record = await MedicalRecord.findOne({ userId });

    if (!record) {
      // Si aún no tiene historial, crear uno con valores iniciales
      record = await MedicalRecord.create({
        userId,
        tipoSangre: 'Desconocido',
        alergias: [],
        condicionesCronicas: [],
        medicamentosControlados: [],
        contactosEmergencia: [
          {
            nombre: 'Contacto inicial',
            relacion: 'Familiar',
            telefono: '000-000-0000',
          },
        ],
        notasMedicas: '',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (err) {
    console.error('[getMyRecord]', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// PUT /api/medical-record/me
// Actualiza el historial clínico con datos validados por Zod
const updateMyRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const cleanData = req.cleanBody; // Datos ya validados y sanitizados por Zod

    // ── CONTROL ESTRICTO DE IDOR ─────────────────────────────────────────────
    // Garantiza que la consulta SIEMPRE utilice el userId del token JWT verificado,
    // imposibilitando que un atacante altere datos ajenos mediante IDs en la URL o body.
    const record = await MedicalRecord.findOneAndUpdate(
      { userId },
      {
        $set: {
          tipoSangre: cleanData.tipoSangre,
          alergias: cleanData.alergias,
          condicionesCronicas: cleanData.condicionesCronicas,
          medicamentosControlados: cleanData.medicamentosControlados,
          contactosEmergencia: cleanData.contactosEmergencia,
          notasMedicas: cleanData.notasMedicas,
          ultimaUbicacionIncidente: cleanData.ultimaUbicacionIncidente ?? null,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Historial clínico actualizado exitosamente con esquema blindado.',
      data: record,
    });
  } catch (err) {
    console.error('[updateMyRecord]', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar historial.' });
  }
};

// GET /api/medical-record/:targetUserId
// Endpoint para demostración de IDOR en la Estación 1:
// Si un atacante intenta ver el historial de otro ID pasando un parámetro, se bloquea tajantemente
const getRecordByIdSecured = async (req, res) => {
  try {
    const requestedUserId = req.params.targetUserId;
    const authenticatedUserId = req.user.id;
    const userRole = req.user.role;

    // ── VERIFICACIÓN ANTI-IDOR ───────────────────────────────────────────────
    if (requestedUserId !== authenticatedUserId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'IDOR_VIOLATION_BLOCKED',
        message: 'Acceso Denegado: Violación de IDOR mitigada. No eres el propietario legítimo de este registro de salud.',
        attemptedAccessBy: authenticatedUserId,
        targetResource: requestedUserId,
      });
    }

    const record = await MedicalRecord.findOne({ userId: requestedUserId });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Historial no encontrado.' });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    console.error('[getRecordByIdSecured]', err);
    return res.status(500).json({ success: false, message: 'Error al consultar registro.' });
  }
};

// POST /api/medical-record/location
// Actualiza la ubicación del incidente con Graceful Degradation
const updateIncidentLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitud, longitud } = req.body;

    if (typeof latitud !== 'number' || typeof longitud !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas GPS inválidas (latitud y longitud deben ser números).',
      });
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { userId },
      {
        $set: {
          ultimaUbicacionIncidente: {
            latitud,
            longitud,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Ubicación de emergencia actualizada en la nube.',
      data: record?.ultimaUbicacionIncidente,
    });
  } catch (err) {
    console.error('[updateIncidentLocation]', err);
    return res.status(500).json({ success: false, message: 'Error al guardar ubicación.' });
  }
};

// GET /api/medical-record/export?format=json|csv
// Implementación del Patrón Strategy para exportación bajo demanda
const exportRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const format = req.query.format || 'json';

    const [record, user] = await Promise.all([
      MedicalRecord.findOne({ userId }),
      User.findById(userId),
    ]);

    if (!record || !user) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos clínicos para exportar.',
      });
    }

    // Usar la factoría para instanciar la estrategia correspondiente
    const strategy = StrategyFactory.create(format);
    const exporter = new MedicalRecordExporter(strategy);
    const result = exporter.execute(record, user);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.data);
  } catch (err) {
    console.error('[exportRecord]', err);
    return res.status(500).json({ success: false, message: 'Error al exportar historial.' });
  }
};

module.exports = {
  getMyRecord,
  updateMyRecord,
  getRecordByIdSecured,
  updateIncidentLocation,
  exportRecord,
};
