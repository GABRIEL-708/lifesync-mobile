'use strict';

const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { validateMedicalRecord } = require('../validators/medicalRecordValidator');
const {
  getMyRecord,
  updateMyRecord,
  getRecordByIdSecured,
  updateIncidentLocation,
  exportRecord,
} = require('../controllers/medicalRecordController');

const router = Router();

// Todas las rutas de historial médico requieren autenticación con JWT
router.use(authMiddleware);

// CRUD de historial médico del usuario autenticado
router.get('/me', getMyRecord);
router.put('/me', validateMedicalRecord, updateMyRecord);

// Exportación mediante Patrón Strategy (JSON / CSV)
router.get('/export', exportRecord);

// Ubicación de incidente (Graceful degradation)
router.post('/location', updateIncidentLocation);

// Endpoint con prueba de mitigación de IDOR para la Estación 1
router.get('/:targetUserId', getRecordByIdSecured);

module.exports = router;
