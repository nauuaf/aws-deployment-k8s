const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { StatusCodes } = require('http-status-codes');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:8080';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           description: User role
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         password:
 *           type: string
 *           minLength: 6
 *           description: User password
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - confirmPassword
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         password:
 *           type: string
 *           minLength: 6
 *           description: User password
 *         confirmPassword:
 *           type: string
 *           minLength: 6
 *           description: Password confirmation
 *         firstName:
 *           type: string
 *           description: User first name
 *         lastName:
 *           type: string
 *           description: User last name
 *     AuthResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT access token
 *         user:
 *           $ref: '#/components/schemas/User'
 *         expiresIn:
 *           type: number
 *           description: Token expiration time in seconds
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.post(`${authServiceUrl}/register`, req.body, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(StatusCodes.CREATED).json({
      message: 'User registered successfully',
      ...response.data
    });
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Registration failed';
      
      if (status === 409) {
        return res.status(StatusCodes.CONFLICT).json({
          error: 'User already exists',
          message
        });
      }
      
      if (status === 400) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid registration data',
          message
        });
      }
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and return JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.post(`${authServiceUrl}/login`, req.body, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(StatusCodes.OK).json({
      message: 'Login successful',
      ...response.data
    });
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Login failed';
      
      if (status === 401) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: 'Invalid credentials',
          message
        });
      }
      
      if (status === 400) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid login data',
          message
        });
      }
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.post(`${authServiceUrl}/refresh`, req.body, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(StatusCodes.OK).json({
      message: 'Token refreshed successfully',
      ...response.data
    });
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Invalid refresh token',
        message: 'Please login again'
      });
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate user token (logout)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: 'Token required',
      message: 'Please provide a valid token'
    });
  }

  try {
    await axios.post(`${authServiceUrl}/logout`, { token }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    res.status(StatusCodes.OK).json({
      message: 'Logout successful'
    });
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Invalid token',
        message: 'Token is not valid or already expired'
      });
    }
    
    // Even if logout fails on auth service, we consider it successful from client perspective
    res.status(StatusCodes.OK).json({
      message: 'Logout completed'
    });
  }
}));

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify token
 *     description: Verify if a JWT token is valid
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: JWT token to verify
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid token
 *       500:
 *         description: Internal server error
 */
router.post('/verify', [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    const response = await axios.post(`${authServiceUrl}/verify`, req.body, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(StatusCodes.OK).json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        valid: false,
        error: 'Invalid token',
        message: 'Token is not valid or has expired'
      });
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /api/auth/health:
 *   get:
 *     summary: Auth service health check
 *     description: Check if the auth service is healthy and accessible
 *     tags: [Authentication, Health]
 *     responses:
 *       200:
 *         description: Auth service is healthy
 *       503:
 *         description: Auth service is unavailable
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${authServiceUrl}/health`, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });

    if (response.status < 400) {
      res.status(StatusCodes.OK).json({
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        details: response.data
      });
    } else {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        error: 'Auth service returned non-2xx status',
        statusCode: response.status
      });
    }
  } catch (error) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}));

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email to user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], asyncHandler(async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    await axios.post(`${authServiceUrl}/forgot-password`, req.body, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Always return success for security reasons, even if user doesn't exist
    res.status(StatusCodes.OK).json({
      message: 'If an account with that email exists, a password reset email has been sent.'
    });
  } catch (error) {
    // Always return success for security reasons
    res.status(StatusCodes.OK).json({
      message: 'If an account with that email exists, a password reset email has been sent.'
    });
  }
}));

module.exports = router;