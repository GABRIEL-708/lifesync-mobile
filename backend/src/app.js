'use strict';

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// En desarrollo permite cualquier origen (túneles de Expo *.exp.direct, localhost, etc.)
app.use(
  cors({
    origin: (origin, callback) => {
      // Permite sin origen (mobile apps nativas, curl, Postman) y cualquier origen en dev
      if (!origin || process.env.NODE_ENV !== 'production' || (origin && origin.endsWith('.exp.direct'))) {
        return callback(null, true);
      }
      const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      callback(null, true); // Permisivo para pruebas del integrador
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Responder a preflight requests
app.options('*', cors());

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    project: 'LifeSync Mobile API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/medical-record', medicalRecordRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada en el servidor LifeSync.' });
});

// ─── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error Global]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Error interno del servidor.',
  });
});

module.exports = app;
