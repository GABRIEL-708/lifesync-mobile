# LifeSync Mobile

LifeSync Mobile es una aplicación móvil de gestión personal que permite a los usuarios sincronizar sus hábitos, tareas y metas desde cualquier dispositivo. El proyecto está compuesto por un backend REST en Node.js y una app mobile en Expo (React Native).

---

## 🏗️ Arquitectura General

```
PROYECTO3/
├── backend/          # API REST (Node.js + Express + MongoDB + JWT)
└── mobile/           # App móvil (Expo / React Native + TypeScript)
```

| Capa     | Tecnología                          |
|----------|-------------------------------------|
| Backend  | Node.js, Express, MongoDB, Mongoose |
| Auth     | JWT + bcrypt                        |
| Mobile   | Expo SDK 51, React Native, TypeScript |
| Routing  | Expo Router (file-based)            |
| Estado   | Zustand                             |
| Seguridad| expo-secure-store (JWT en dispositivo) |

---

## 🚀 Instalación

### Requisitos previos
- Node.js 18+
- MongoDB (local o Atlas)
- Expo CLI (`npm install -g expo-cli`)

---

### Backend

```bash
cd backend
cp .env.example .env        # Edita las variables de entorno
npm install
npm run dev                 # Levanta en http://localhost:3000
```

#### Variables de entorno (`backend/.env`)

| Variable        | Descripción                             | Ejemplo                          |
|-----------------|-----------------------------------------|----------------------------------|
| `PORT`          | Puerto del servidor                     | `3000`                           |
| `MONGODB_URI`   | URI de conexión a MongoDB               | `mongodb://localhost:27017/lifesync` |
| `JWT_SECRET`    | Secreto para firmar JWT (mínimo 32 chars) | `tu_secreto_muy_seguro_aqui`    |
| `JWT_EXPIRES_IN`| Expiración del token                    | `7d`                             |
| `BCRYPT_ROUNDS` | Rondas de hashing de bcrypt             | `12`                             |

---

### Mobile

```bash
cd mobile
cp .env.example .env        # Edita la URL del backend
npm install
npx expo start              # Abre en Expo Go o emulador
```

#### Variables de entorno (`mobile/.env`)

| Variable   | Descripción              | Ejemplo                    |
|------------|--------------------------|----------------------------|
| `API_URL`  | URL base del backend     | `http://localhost:3000`    |

---

## 📅 Sprints del Proyecto

### Sprint 1 — Autenticación (semanas 1-2)
Configuración del repositorio, backend de auth (register/login con JWT), app mobile con pantallas de Login y Register, navegación protegida y almacenamiento seguro del token.

### Sprint 2 — Gestión de Hábitos (semanas 3-4)
CRUD completo de hábitos en el backend, pantallas de listado y creación de hábitos, lógica de racha diaria y notificaciones locales.

### Sprint 3 — Tareas y Metas (semanas 5-6)
Módulo de tareas con prioridades y fechas límite, módulo de metas con progreso porcentual, integración de estadísticas en el dashboard.

### Sprint 4 — Pulido y Despliegue (semanas 7-8)
Mejoras de UX/UI, pruebas de integración, optimización de rendimiento, generación de builds (.aab / .ipa) y despliegue en producción.

---

## 🌿 Flujo de Ramas (GitFlow)

Consulta [GITFLOW.md](./GITFLOW.md) para la estrategia completa de ramas, convención de commits y reglas de PR.

---

## 📄 Licencia

MIT © 2024 LifeSync Team
