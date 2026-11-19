'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../src/config/database');
const User = require('../src/models/User');

async function seed() {
  try {
    await db.connect();
    const email = 'demo@lifesync.com';
    const password = 'Password123!';
    const nombre = 'Luis Gabriel';

    await User.deleteOne({ email });

    const user = new User({ email, nombre, role: 'user' });
    await user.setPassword(password);
    await user.save();

    console.log('--- USUARIO REGISTRADO EXITOSAMENTE ---');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Nombre:', nombre);
    console.log('ID en MongoDB:', user._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('Error registrando usuario:', err);
    process.exit(1);
  }
}

seed();
