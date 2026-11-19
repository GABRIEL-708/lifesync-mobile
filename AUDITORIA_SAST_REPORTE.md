# 🛡️ Reporte de Análisis Estático de Seguridad (SAST) — LifeSync Mobile

**Fecha de Ejecución:** Noviembre 2026  
**Auditor:** Equipo DevSecOps / LifeSync Mobile  
**Alcance:** Backend Node.js, Frontend Móvil Expo, Manifiestos de Red y Repositorio de Código.

---

## 1. Detección de Secretos Expuestos (Hardcoded Secrets)
* **Objetivo:** Descartar que claves de API, contraseñas de bases de datos o secretos JWT se encuentren embebidos en el código fuente.
* **Herramientas:** Análisis estático con reglas de detección de entropía y escaneo de patrones regex.
* **Hallazgos:**
  - `backend/server.js`: Utiliza exclusivamente `process.env.JWT_SECRET` y `process.env.MONGODB_URI`.
  - `.gitignore`: Configurado para ignorar de manera estricta `.env`, certificados `.jks`, `.keystore`, `.p8`, `.p12` y carpetas de build.
  - Manifiestos (`app.json`, `AndroidManifest.xml`): No contienen tokens, strings de autenticación ni cadenas de conexión.
* **Resultado:** ✅ **APROBADO (0 secretos en código fuente)**.

---

## 2. Auditoría de Dependencias (SCA / SAST)
* **Comando:** `npm run audit:security` (con umbral crítico).
* **Dependencias Clave Auditadas:**
  - `bcryptjs`: Versión segura con salting de 12 rondas.
  - `jsonwebtoken`: Versión 9.0.2 mitigando vulnerabilidades conocidas de algoritmo `none`.
  - `zod`: Versión 3.23.8 bloqueando inyecciones de prototipo y esquemas NoSQL.
  - `cors`: Configurado de forma restrictiva con preflights explícitos.
* **Resultado:** ✅ **APROBADO (0 vulnerabilidades críticas bloqueantes)**.

---

## 3. Firewall del Sistema Operativo y Políticas de Red
| Plataforma | Mecanismo | Configuración | Estado |
|---|---|---|:---:|
| **Android** | `Network Security Config` | `cleartextTrafficPermitted="false"` en `network_security_config.xml` | ✅ BLINDADO |
| **iOS** | `NSAppTransportSecurity` | `NSAllowsArbitraryLoads: false` en `Info.plist` / `app.json` | ✅ BLINDADO |

---

## 4. Estado de Preparación para Tiendas (Release Artifacts)
* **Google Play Store:** Archivo de configuración `mobile/eas.json` parametrizado con `buildType: "app-bundle"` para generar **Android App Bundle (.aab)** firmado criptográficamente.
* **Apple App Store:** Perfil de producción configurado para empaquetar binario **.ipa** listo para distribución mediante TestFlight / App Store Connect.
