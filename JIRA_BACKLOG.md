# 📊 LifeSync Mobile — Tablero Scrum y Backlog de Historias de Usuario (Jira)

Este documento contiene el desglose oficial de las **Historias de Usuario (HU)** organizadas por los 4 Sprints, con criterios de aceptación en formato **Gherkin (Given-When-Then)** y asignación de roles para proyectar en la **Estación 3 (Scrum Master y QA)**.

---

## 🏃 Sprint 1: Planeación, Arquitectura e Identidad Blindada
**Objetivo:** Establecer el marco de versionamiento, arquitectura en capas, conexión singleton y autenticación blindada con JWT.

### HU-01: Autenticación Asíncrona con JWT y Criptografía de Hardware
* **Como:** Paciente de LifeSync Mobile
* **Quiero:** Iniciar sesión con mi correo y contraseña y mantener mi sesión activa de forma segura
* **Para:** Acceder inmediatamente a mis datos clínicos en situaciones de emergencia sin comprometer mis credenciales
* **Story Points:** 8 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - **Escenario 1 (Registro con Hashing Seguro):**
    - *Dado que* un nuevo usuario ingresa sus datos con una contraseña de al menos 8 caracteres
    - *Cuando* presiona "Crear cuenta segura"
    - *Entonces* el backend genera un hash mediante `bcrypt` con 12 rondas de salting y jamás almacena la contraseña en texto plano.
  - **Escenario 2 (Persistencia en Contenedor Seguro):**
    - *Dado que* el usuario se autentica exitosamente
    - *Cuando* el servidor retorna el token JWT firmado
    - *Entonces* la app móvil almacena el token exclusivamente en `Expo SecureStore` (Keystore de Android / Keychain de iOS).

---

## 🏃 Sprint 2: Core de Historial Clínico y Protección contra Inyecciones
**Objetivo:** CRUD de expediente médico con validación estricta Zod e interceptor HTTP global con mitigación de IDOR.

### HU-02: Consulta y Gestión del Expediente Vital
* **Como:** Paramédico o Paciente
* **Quiero:** Consultar y actualizar tipo de sangre, alergias, condiciones crónicas y contactos
* **Para:** Brindar la atención médica correcta durante un triage de urgencia
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* el usuario tiene una sesión válida
  - *Cuando* la app realiza una petición a `/api/medical-record/me`
  - *Entonces* el Interceptor HTTP Global inyecta automáticamente la cabecera `Authorization: Bearer <JWT>`.

### HU-03: Mitigación Estricta de IDOR y Bloqueo de Inyecciones
* **Como:** DevSecOps / Auditor de Seguridad
* **Quiero:** Que el backend valide la legitimidad del titular de cada expediente y rechace operadores NoSQL
* **Para:** Garantizar la confidencialidad de los datos médicos sensibles según regulaciones de salud
* **Story Points:** 8 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - **Escenario 1 (Bloqueo de IDOR):**
    - *Dado que* un usuario autenticado intenta consultar el expediente con un ID ajeno
    - *Cuando* envía la petición a `/api/medical-record/:targetUserId`
    - *Entonces* el servidor rechaza la petición con `HTTP 403 Forbidden` y código `IDOR_VIOLATION_BLOCKED`.
  - **Escenario 2 (Validación con Zod):**
    - *Dado que* un atacante envía un payload con operadores maliciosos (`$ne`, `$gt`)
    - *Cuando* el middleware de validación procesa el cuerpo
    - *Entonces* Zod detiene la ejecución retornando `HTTP 400 Bad Request` antes de tocar la base de datos.

---

## 🏃 Sprint 3: Alertas, Sensores Nativos y Manejo de Estados
**Objetivo:** Patrón Observer para alertas locales, Patrón Strategy para exportación y Máquina de Estados para degradación gradual.

### HU-04: Alertas Médicas Locales Reactivas (Patrón Observer)
* **Como:** Paciente dependiente de medicamentos controlados
* **Quiero:** Recibir recordatorios críticos inmediatos en el teléfono
* **Para:** No omitir tomas de medicamentos vitales (ej. insulina o inhaladores)
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* el sujeto de alertas médicas detecta la hora de toma
  - *Cuando* se invoca el método `notify()`
  - *Entonces* todos los observadores de la interfaz se actualizan en tiempo real mostrando el banner flotante de emergencia.

### HU-05: Exportación Multiformato Bajo Demanda (Patrón Strategy)
* **Como:** Administrador hospitalario o Ajustador de aseguradora
* **Quiero:** Exportar el historial clínico en formato JSON hospitalario o CSV aseguradora
* **Para:** Integrar los datos en sistemas clínicos o tramitar coberturas de pólizas médicas
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* se solicita la exportación con el parámetro `?format=json`
  - *Cuando* el `MedicalRecordExporter` ejecuta la estrategia
  - *Entonces* genera un archivo JSON conforme al estándar `LifeSync-HealthRecord-v1.0`. Si el parámetro es `?format=csv`, genera un archivo tabular sanitizado.

### HU-06: Gestión de Permisos y Degradación Gradual (Graceful Degradation)
* **Como:** Usuario que cuida su privacidad
* **Quiero:** Que la app siga funcionando aunque yo deniegue el permiso de GPS
* **Para:** Poder consultar mi historial clínico sin que la aplicación se cierre o crashee
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* el usuario deniega el permiso de GPS en el sistema operativo
  - *Cuando* la Máquina de Estados transiciona a `DENIED_SOFT`
  - *Entonces* la app deshabilita únicamente la geolocalización en la nube, manteniendo el expediente clínico 100% operativo sin crasheos.

---

## 🏃 Sprint 4: Suite de Pruebas, Hardening y Paquetes Release
**Objetivo:** Suite Jest automatizada, firewall del SO con bloqueo cleartext y empaquetado para tiendas.

### HU-07: Cobertura de Pruebas Automatizadas (Jest)
* **Como:** QA Engineer
* **Quiero:** Ejecutar una suite automatizada de pruebas unitarias
* **Para:** Verificar la integridad lógica del sistema antes de cada liberación
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* se ejecuta `npm test` en el backend
  - *Cuando* Jest procesa `sprint_tests.test.js`
  - *Entonces* las 11 pruebas unitarias (bcrypt, JWT, Zod, Strategy, IDOR) pasan exitosamente en verde.

### HU-08: Hardening de Red y Configuración Release para Tiendas
* **Como:** DevSecOps
* **Quiero:** Bloquear tráfico HTTP no cifrado y preparar el build para tiendas virtuales
* **Para:** Cumplir con las políticas de Google Play Store y Apple App Store
* **Story Points:** 5 | **Estado:** `DONE`
* **Criterios de Aceptación:**
  - *Dado que* la app intenta realizar una conexión HTTP insegura en texto plano
  - *Cuando* el sistema operativo evalúa la política de red
  - *Entonces* Android (`network_security_config.xml` con `cleartextTrafficPermitted="false"`) e iOS (`NSAppTransportSecurity`) rechazan tajantemente la petición.
  - *Y* el archivo `eas.json` está listo para compilar en modo `production` generando `.aab` e `.ipa`.

---

## 📈 Métricas del Proyecto
* **Total Story Points:** 41 SP
* **Velocidad de Equipo:** 10.25 SP / Sprint
* **Porcentaje de Finalización:** 100%
