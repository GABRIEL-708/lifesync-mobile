# LifeSync Backend

REST API for the **LifeSync Mobile** app — Sprint 1.  
Stack: **Node.js 18+ · Express 4 · MongoDB (Mongoose 8) · JWT**

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm / pnpm | any recent |
| MongoDB | local 6+ **or** Atlas cluster |

---

## Setup

```bash
# 1. Install dependencies
cd backend
npm install          # or: pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in MONGODB_URI and JWT_SECRET

# 3. Generate a strong JWT secret (paste the output into .env)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 4. Start the server
npm start            # production
npm run dev          # development (nodemon, auto-reload)
```

The API is available at `http://localhost:4000` (or the `PORT` you set in `.env`).

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js        # MongoDB Singleton connection
│   ├── models/
│   │   └── User.js            # Mongoose User schema
│   ├── middleware/
│   │   └── authMiddleware.js  # JWT Bearer token guard
│   ├── routes/
│   │   └── authRoutes.js      # /api/auth/*  route declarations
│   ├── controllers/
│   │   └── authController.js  # Register & login business logic
│   └── app.js                 # Express app (CORS, middleware, routes)
├── server.js                  # Entry point – DB connect + server listen
├── .env.example               # Environment variable template
├── package.json
└── README.md
```

---

## API Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Returns `{ status: "ok" }` |

---

### Authentication

Base path: `/api/auth`

#### `POST /api/auth/register`

Create a new user account.

**Request body** (JSON):

```json
{
  "email": "user@example.com",
  "password": "strongPassword123",
  "nombre": "María García",
  "role": "user"
}
```

> `role` is optional — defaults to `"user"`. Accepted values: `"user"`, `"admin"`.

**Success response** `201 Created`:

```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "664f...",
    "email": "user@example.com",
    "nombre": "María García",
    "role": "user"
  }
}
```

**Error responses:**

| Status | Reason |
|--------|--------|
| 409 | Email already registered |
| 422 | Validation errors (missing/invalid fields) |
| 500 | Internal server error |

---

#### `POST /api/auth/login`

Authenticate and receive a JWT.

**Request body** (JSON):

```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

**Success response** `200 OK`:

```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "664f...",
    "email": "user@example.com",
    "nombre": "María García",
    "role": "user"
  }
}
```

**Error responses:**

| Status | Reason |
|--------|--------|
| 401 | Invalid credentials |
| 422 | Validation errors |
| 500 | Internal server error |

---

### Using the JWT on protected routes

Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The `authMiddleware` will verify the token and attach `req.user` to the request:

```json
{ "id": "...", "email": "...", "role": "user", "iat": 0, "exp": 0 }
```

---

## Security Notes

- Passwords are hashed with **bcrypt at 12 rounds** — never stored in plain text.
- The `passwordHash` field is hidden from all API responses via Mongoose `select: false` and `toJSON` transform.
- JWTs expire after **7 days** and are signed with a 64-byte random secret.
- Login uses a **generic error message** ("Invalid credentials") to prevent user enumeration.
- CORS is restricted to `ALLOWED_ORIGINS` defined in `.env`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` or `production` (default: `development`) |
| `PORT` | No | Port to listen on (default: `4000`) |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Secret used to sign JWTs (min 32 chars, recommended 64) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `localhost:3000,8081`) |
