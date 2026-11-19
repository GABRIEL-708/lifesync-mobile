# 🎓 LifeSync Mobile — Guion para Demostración Técnica Presencial (100%)

Este documento contiene el protocolo exacto y las pruebas en vivo para defender el proyecto en las **3 Estaciones Físicas Obligatorias** ante el docente.

---

## 💻 Estación 1: Backend, Nube y Seguridad del Servidor (Laptop 1)
**Responsable:** Lead Backend Engineer  
**Entorno:** Terminal con backend activo (`npm start`) + Postman + MongoDB Compass / Atlas Web.

### 1.1 Demostración de Base de Datos y Criptografía
1. Abrir MongoDB Compass o Atlas en la colección `users`.
2. Mostrar que el campo `passwordHash` **NO es legible** y utiliza el algoritmo `bcrypt` con costo de 12 rondas (`$2a$12$...`).
3. Intentar hacer un `GET /api/auth/me` y verificar que la contraseña jamás es devuelta en ninguna respuesta JSON (protegido con `select: false` y método `toJSON`).

### 1.2 Demostración de Bloqueo contra Inyecciones (Zod)
1. En Postman, enviar `PUT /api/medical-record/me` con un payload malicioso (operador NoSQL):
   ```json
   {
     "tipoSangre": { "$ne": null },
     "contactosEmergencia": []
   }
   ```
2. **Resultado esperado:** El servidor responde con `HTTP 400 Bad Request` y mensaje claro:
   `"Validación de esquema fallida (bloqueo contra inyección)"`.

### 1.3 Demostración de Mitigación Obligatoria de IDOR
1. Obtener el token JWT de un usuario normal (ej: `demo@lifesync.com`).
2. En Postman, enviar `GET /api/medical-record/6aff4dee61c92ba1b8dc9999` (intentando consultar el historial de otro usuario).
3. **Resultado esperado:** El servidor responde con `HTTP 403 Forbidden`:
   ```json
   {
     "success": false,
     "code": "IDOR_VIOLATION_BLOCKED",
     "message": "Acceso Denegado: Violación de IDOR mitigada. No eres el propietario legítimo de este registro de salud."
   }
   ```

### 1.4 Demostración del Patrón de Diseño Strategy
1. En Postman enviar con el Bearer Token:
   - `GET /api/medical-record/export?format=json` ➔ Devuelve JSON estructurado estándar para hospitales (`LifeSync-HealthRecord-v1.0`).
   - `GET /api/medical-record/export?format=csv` ➔ Devuelve archivo tabular `.csv` sanitizado para aseguradoras con detalle de medicamentos y contactos.

---

## 📱 Estación 2: App Móvil, Interfaz y Simulación de Fallas (Laptop 2 y Smartphones)
**Responsables:** Lead Frontend & Diseñador UI  
**Entorno:** Smartphone físico con la app cargada vía Expo Go / Navegador web.

### 2.1 Demostración de Fluidez y Persistencia Cifrada
1. Iniciar sesión con `demo@lifesync.com` / `Password123!`.
2. Mostrar el guardado del token en hardware seguro (`expo-secure-store`).
3. Navegación fluida por el Dashboard con tipo de sangre, alergias, condiciones y medicamentos.

### 2.2 Prueba de Fuego en Vivo: "Modo Avión" (Desconexión Asíncrona)
> **Orden del Docente:** "Activen Modo Avión en el teléfono".
1. Activar el **Modo Avión** en el dispositivo.
2. Hacer scroll y navegar por el historial clínico:
   - **Resultado:** La app **NO crashea**. El interceptor global detecta la falta de red y sirve el historial clínico desde el contenedor seguro offline.
   - La pantalla muestra el badge: `✈️ Modo Avión (Offline)`.

### 2.3 Demostración de Sensores y Degradación Gradual (Graceful Degradation)
1. Presionar el botón **"✗ Denegar GPS (Degradación)"**.
2. **Resultado:** La app no sufre ningún fallo; la Máquina de Estados pasa a `DENIED_SOFT` y despliega:
   `"[DEGRADACIÓN GRADUAL ACTIVA]: Rastreo en la nube deshabilitado; el historial clínico continúa funcionando 100% offline"`.
3. Presionar **"✓ Conceder GPS"**: el estado cambia a `GRANTED` y se habilita la geolocalización de incidentes.

### 2.4 Demostración del Patrón de Diseño Observer
1. Presionar el botón **"+ Simular Alerta"**.
2. Los observadores suscritos se disparan en tiempo real desplegando la tarjeta de alerta médica local de medicamento crítico (`CRITICAL_MEDICATION: Salbutamol`) con hora y prioridad alta.

---

## 📋 Estación 3: Scrum Master, QA y Auditoría de Código (Laptop 3)
**Responsable:** DevSecOps / QA  
**Entorno:** Terminal + Repositorio GitHub con GitFlow.

### 3.1 Ejecución en Vivo de la Suite de Pruebas Unitarias
En la terminal del backend, ejecutar frente al profesor:
```bash
npm test
```
**Resultado esperado:**
```
PASS tests/sprint_tests.test.js
  === SUITE DE PRUEBAS UNITARIAS: LIFESYNC MOBILE ===
    1. Criptografía y Seguridad de Identidad
      ✓ Debe generar hash bcrypt con al menos 12 rondas (1221 ms)
      ✓ Debe firmar y validar criptográficamente tokens JWT (4 ms)
      ✓ Debe rechazar tokens alterados o con firma inválida (27 ms)
    2. Validación de Esquemas Zod y Mitigación de Inyecciones
      ✓ Debe aceptar payloads válidos de historial médico
      ✓ Debe bloquear operadores de inyección NoSQL ($gt, $ne, $where)
      ✓ Debe exigir al menos un contacto de emergencia
    3. Patrón de Diseño Strategy para Exportación Médica
      ✓ Estrategia JSON: Formato hospitalario estándar
      ✓ Estrategia CSV: Formato aseguradoras sanitizado
      ✓ Contexto Exporter dinámico en tiempo de ejecución
    4. Mitigación Obligatoria de IDOR
      ✓ Bloqueo de ID ajeno no autorizado (403)
      ✓ Acceso permitido únicamente al legítimo titular

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

### 3.2 Reporte de Auditoría Estática de Seguridad (SAST)
En la terminal del backend, ejecutar:
```bash
npm run audit:security
```
Demostrar que no existen llaves expuestas (hardcoded secrets) ni vulnerabilidades críticas en librerías de terceros.

### 3.3 Verificación de GitFlow y Manifiestos de Hardening
1. Mostrar el árbol de ramas de Git:
   - `master` / `main`
   - `develop`
   - `feature/sprint1-auth`
   - `feature/sprint2-clinical-core`
   - `feature/sprint3-alerts-sensors`
   - `feature/sprint4-hardening-release`
2. Mostrar los archivos de hardening del firewall del sistema operativo:
   - `mobile/network_security_config.xml`: `<base-config cleartextTrafficPermitted="false">` (Android)
   - `mobile/app.json`: `NSAppTransportSecurity` con `NSAllowsArbitraryLoads: false` (iOS)
3. Mostrar el archivo `mobile/eas.json` listo para compilar en modo Release:
   - Android App Bundle (`.aab`) para Google Play Store
   - Paquete `.ipa` para Apple App Store

---

## 🏆 Checklist de Cumplimiento de Rúbrica (100% Garantizado)

| Rúbrica | Criterio | Estado | Archivos de Evidencia |
|---|---|:---:|---|
| **25%** | Arquitectura, Patrones y Flujo Ágil | ✅ CUMPLIDO | Singleton (`database.js`), Strategy (`exportStrategy.js`), Observer (`MedicalAlertObserver.ts`), GitFlow (`GITFLOW.md`) |
| **25%** | Codificación Segura y Criptografía | ✅ CUMPLIDO | bcrypt 12 rondas (`User.js`), Hardware Secure Storage (`secureStorage.ts`), Anti-Cleartext (`network_security_config.xml`), Anti-IDOR (`medicalRecordController.js`) |
| **20%** | Core de Negocio y Sensores Nativos | ✅ CUMPLIDO | CRUD clínico (`medicalService.ts`), FSM de permisos (`PermissionStateMachine.ts`), Graceful Degradation y Prueba Modo Avión |
| **15%** | Suite de Pruebas y Calidad | ✅ CUMPLIDO | 11/11 tests unitarios pasando (`sprint_tests.test.js`), principios SOLID y cero secrets hardcodeados |
| **15%** | Plan de Liberación y Artefactos | ✅ CUMPLIDO | Manifiestos de producción, auditoría SAST y configuración Release para `.aab` / `.ipa` (`eas.json`) |
