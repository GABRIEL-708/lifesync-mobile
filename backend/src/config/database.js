'use strict';

const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Windows / ISP DNS blocking SRV records on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if not permitted
}

/**
 * Database – Singleton pattern.
 * Guarantees a single mongoose connection throughout the process lifetime.
 */
class Database {
  constructor() {
    if (Database._instance) {
      return Database._instance;
    }
    this._connection = null;
    Database._instance = this;
  }

  /**
   * Connect to MongoDB. Idempotent: returns the existing connection when
   * already connected.
   * @returns {Promise<typeof mongoose>}
   */
  async connect() {
    if (this._connection) {
      return this._connection;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    this._connection = await mongoose.connect(uri);

    console.log(`[DB] Connected to MongoDB Atlas successfully!`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] Disconnected from MongoDB.');
      this._connection = null;
    });

    return this._connection;
  }

  /**
   * Gracefully close the connection.
   */
  async disconnect() {
    if (!this._connection) return;
    await mongoose.disconnect();
    this._connection = null;
    console.log('[DB] Connection closed.');
  }
}

Database._instance = null;

module.exports = new Database();
