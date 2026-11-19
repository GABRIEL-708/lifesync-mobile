'use strict';

const { Router } = require('express');
const { register, login } = require('../controllers/authController');

const router = Router();

/**
 * @route  POST /api/auth/register
 * @desc   Create a new user account
 * @access Public
 * @body   { email, password, nombre, role? }
 * @return { success, token, user: { id, email, nombre, role } }
 */
router.post('/register', register);

/**
 * @route  POST /api/auth/login
 * @desc   Authenticate user and return a JWT
 * @access Public
 * @body   { email, password }
 * @return { success, token, user: { id, email, nombre, role } }
 */
router.post('/login', login);

module.exports = router;
