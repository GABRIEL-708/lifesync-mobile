'use strict';

const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a signed JWT for the given user document.
 * @param {import('../models/User')} user
 * @returns {string}
 */
const signToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
};

/**
 * Safe user object to include in API responses.
 * Explicitly excludes passwordHash.
 * @param {import('../models/User')} user
 */
const safeUser = (user) => ({
  id: user._id,
  email: user.email,
  nombre: user.nombre,
  role: user.role,
});

// ─── Validation rules ──────────────────────────────────────────────────────────

const registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Debes ingresar un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre completo es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre no debe superar 100 caracteres.'),
  body('role')
    .optional()
    .isIn(['user', 'admin']).withMessage("El rol debe ser 'user' o 'admin'."),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es obligatorio.')
    .isEmail().withMessage('Debes ingresar un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.'),
];

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
const register = [
  ...registerValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password, nombre, role } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una cuenta registrada con este correo electrónico.',
        });
      }

      const user = new User({ email, nombre, role: role || 'user' });
      await user.setPassword(password); // bcrypt, 12 rounds
      await user.save();

      const token = signToken(user);

      return res.status(201).json({
        success: true,
        token,
        user: safeUser(user),
      });
    } catch (err) {
      console.error('[register]', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
];

/**
 * POST /api/auth/login
 */
const login = [
  ...loginValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // We need passwordHash → use .select('+passwordHash')
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        // Generic message to prevent user enumeration
        return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
      }

      const valid = await user.verifyPassword(password);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
      }

      const token = signToken(user);

      return res.status(200).json({
        success: true,
        token,
        user: safeUser(user),
      });
    } catch (err) {
      console.error('[login]', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
];

module.exports = { register, login };
