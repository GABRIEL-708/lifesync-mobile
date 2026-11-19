'use strict';

const { z } = require('zod');

// Esquema Zod estricto para mitigar NoSQL Injection y sanitizar tipos
const bloodTypeEnum = z.enum([
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Desconocido'
]);

const emergencyContactSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre del contacto debe tener al menos 2 caracteres.').max(100),
  relacion: z.string().trim().min(2, 'La relación o parentesco es obligatoria.').max(50),
  telefono: z.string().trim().regex(/^[\d\s+\-()]{7,20}$/, 'Teléfono de contacto inválido.'),
});

const controlledMedicationSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre del medicamento es obligatorio.').max(100),
  dosis: z.string().trim().min(1, 'La dosis es obligatoria.').max(50),
  frecuencia: z.string().trim().min(1, 'La frecuencia es obligatoria.').max(50),
  instrucciones: z.string().trim().max(200).optional().default(''),
});

const medicalRecordSchema = z.object({
  tipoSangre: bloodTypeEnum.default('Desconocido'),
  alergias: z.array(z.string().trim().min(1).max(100)).default([]),
  condicionesCronicas: z.array(z.string().trim().min(1).max(100)).default([]),
  medicamentosControlados: z.array(controlledMedicationSchema).default([]),
  contactosEmergencia: z.array(emergencyContactSchema).min(1, 'Debes registrar al menos un contacto de emergencia.'),
  notasMedicas: z.string().trim().max(1000).optional().default(''),
  ultimaUbicacionIncidente: z
    .object({
      latitud: z.number().min(-90).max(90),
      longitud: z.number().min(-180).max(180),
      timestamp: z.string().or(z.date()).optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Middleware para validar el payload de historial médico con Zod.
 * Bloquea operadores maliciosos de MongoDB ($gt, $ne, $where, etc.)
 */
function validateMedicalRecord(req, res, next) {
  try {
    const validatedData = medicalRecordSchema.parse(req.body);
    // Asignar el payload sanitizado y validado
    req.cleanBody = validatedData;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validación de esquema fallida (bloqueo contra inyección).',
        errors: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Payload inválido.',
    });
  }
}

module.exports = {
  medicalRecordSchema,
  validateMedicalRecord,
};
