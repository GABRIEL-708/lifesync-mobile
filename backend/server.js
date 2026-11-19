'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const db = require('./src/config/database');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    // Connect via Singleton — subsequent calls to db.connect() return the
    // same connection without opening a new one.
    await db.connect();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] LifeSync API running on port ${PORT} (0.0.0.0)`);
      console.log(`[Server] Local LAN URL: http://192.168.68.101:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
})();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully…`);
  await db.disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
