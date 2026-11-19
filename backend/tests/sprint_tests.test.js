'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { medicalRecordSchema } = require('../src/validators/medicalRecordValidator');
const {
  MedicalSystemJsonStrategy,
  InsuranceCsvStrategy,
  MedicalRecordExporter,
  StrategyFactory,
} = require('../src/strategies/exportStrategy');

describe('=== SUITE DE PRUEBAS UNITARIAS: LIFESYNC MOBILE ===', () => {
  // ─── 1. CRIPTOGRAFÍA Y VALIDACIÓN DE TOKENS (Sprint 1) ──────────────────────
  describe('1. Criptografía y Seguridad de Identidad', () => {
    const rawPassword = 'SecurePassword2026!';
    const secret = 'super-secret-jwt-key-for-unit-testing-32chars';

    it('Debe generar hash bcrypt con al menos 12 rondas y verificarlo correctamente', async () => {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(rawPassword, salt);

      // Verificación de que no esté en texto plano
      expect(hash).not.toBe(rawPassword);
      expect(hash).toMatch(/^\$2[aby]\$12\$/); // Identificador de bcrypt costo 12

      // Verificación de contraseña válida e inválida
      const isValid = await bcrypt.compare(rawPassword, hash);
      const isInvalid = await bcrypt.compare('WrongPassword', hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('Debe firmar y validar criptográficamente tokens JWT con expiración', () => {
      const payload = { id: 'user_12345', email: 'test@lifesync.com', role: 'user' };
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Header.Payload.Signature

      const decoded = jwt.verify(token, secret);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });

    it('Debe rechazar tokens alterados o con firma inválida', () => {
      const token = jwt.sign({ id: 'victim_user' }, secret);
      const forgedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        jwt.verify(forgedToken, secret);
      }).toThrow();
    });
  });

  // ─── 2. VALIDACIÓN DE ESQUEMAS ZOD Y ANTI-INYECCIÓN (Sprint 2) ──────────────
  describe('2. Validación de Esquemas Zod y Mitigación de Inyecciones', () => {
    it('Debe aceptar payloads válidos de historial médico', () => {
      const validPayload = {
        tipoSangre: 'O+',
        alergias: ['Penicilina', 'Mariscos'],
        condicionesCronicas: ['Hipertensión arterial'],
        medicamentosControlados: [
          {
            nombre: 'Enalapril',
            dosis: '10mg',
            frecuencia: 'Cada 24 horas',
            instrucciones: 'Tomar por la mañana',
          },
        ],
        contactosEmergencia: [
          {
            nombre: 'Dra. María González',
            relacion: 'Médico de cabecera',
            telefono: '+52 999 123 4567',
          },
        ],
        notasMedicas: 'Paciente alérgico a medios de contraste yodados.',
      };

      const result = medicalRecordSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('Debe bloquear operadores de inyección NoSQL ($gt, $ne, $where)', () => {
      const maliciousPayload = {
        tipoSangre: { $ne: null }, // Ataque típico de bypass NoSQL
        contactosEmergencia: [],
      };

      const result = medicalRecordSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      // Falla por tipo de sangre inválido y contactos de emergencia vacíos
      expect(result.error.issues.length).toBeGreaterThan(0);
    });

    it('Debe exigir al menos un contacto de emergencia', () => {
      const payloadWithoutContacts = {
        tipoSangre: 'A+',
        contactosEmergencia: [], // Inválido: mínimo 1
      };

      const result = medicalRecordSchema.safeParse(payloadWithoutContacts);
      expect(result.success).toBe(false);
      const contactError = result.error.issues.find((i) => i.path.includes('contactosEmergencia'));
      expect(contactError).toBeDefined();
    });
  });

  // ─── 3. PATRÓN DE DISEÑO STRATEGY (Sprint 3) ────────────────────────────────
  describe('3. Patrón de Diseño Strategy para Exportación Médica', () => {
    const mockRecord = {
      tipoSangre: 'AB+',
      alergias: ['Polen', 'Ácaros'],
      condicionesCronicas: ['Asma leve'],
      medicamentosControlados: [
        { nombre: 'Salbutamol', dosis: '100mcg', frecuencia: 'SOS', instrucciones: 'Inhalación' },
      ],
      contactosEmergencia: [
        { nombre: 'Carlos Ruiz', relacion: 'Hermano', telefono: '9998887766' },
      ],
    };

    const mockUser = {
      id: 'patient_abc123',
      nombre: 'Carlos Ruiz Jr',
      email: 'carlos@lifesync.org',
    };

    it('Estrategia JSON: Debe exportar en estructura estándar para sistemas clínicos', () => {
      const strategy = StrategyFactory.create('json');
      const exporter = new MedicalRecordExporter(strategy);
      const output = exporter.execute(mockRecord, mockUser);

      expect(output.contentType).toBe('application/json');
      expect(output.filename).toContain('.json');

      const parsed = JSON.parse(output.data);
      expect(parsed.standard).toBe('LifeSync-HealthRecord-v1.0');
      expect(parsed.patient.id).toBe(mockUser.id);
      expect(parsed.clinicalData.tipoSangre).toBeUndefined(); // Se ubica en patient
      expect(parsed.patient.tipoSangre).toBe('AB+');
    });

    it('Estrategia CSV: Debe exportar en formato tabular sanitizado para aseguradoras', () => {
      const strategy = StrategyFactory.create('csv');
      const exporter = new MedicalRecordExporter(strategy);
      const output = exporter.execute(mockRecord, mockUser);

      expect(output.contentType).toContain('text/csv');
      expect(output.filename).toContain('.csv');
      expect(output.data).toContain('ID_PACIENTE,NOMBRE,EMAIL,TIPO_SANGRE');
      expect(output.data).toContain('"patient_abc123"');
      expect(output.data).toContain('"Carlos Ruiz Jr"');
      expect(output.data).toContain('DETALLE_MEDICAMENTOS_CONTROLADOS');
    });

    it('El Contexto Exporter debe permitir intercambiar la estrategia en tiempo de ejecución', () => {
      const exporter = new MedicalRecordExporter(new MedicalSystemJsonStrategy());
      const res1 = exporter.execute(mockRecord, mockUser);
      expect(res1.contentType).toBe('application/json');

      exporter.setStrategy(new InsuranceCsvStrategy());
      const res2 = exporter.execute(mockRecord, mockUser);
      expect(res2.contentType).toContain('text/csv');
    });
  });

  // ─── 4. MITIGACIÓN DE IDOR (Sprint 2) ──────────────────────────────────────
  describe('4. Mitigación Obligatoria de IDOR (Insecure Direct Object Reference)', () => {
    it('Debe bloquear acceso cuando el usuario autenticado intenta leer el ID de otra persona', () => {
      const authenticatedUser = { id: 'victim_user_999', role: 'user' };
      const requestedUserId = 'target_user_888';

      // Simulación de la regla del middleware / controlador
      const isAuthorized =
        requestedUserId === authenticatedUser.id || authenticatedUser.role === 'admin';

      expect(isAuthorized).toBe(false);
    });

    it('Debe permitir acceso únicamente cuando el UID coincide con el recurso solicitado', () => {
      const authenticatedUser = { id: 'legit_user_123', role: 'user' };
      const requestedUserId = 'legit_user_123';

      const isAuthorized =
        requestedUserId === authenticatedUser.id || authenticatedUser.role === 'admin';

      expect(isAuthorized).toBe(true);
    });
  });
});
