const axios = require('axios');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:8080';

/**
 * Middleware to verify JWT tokens by calling the auth service
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Authorization header is required',
        message: 'Please provide a valid JWT token in the Authorization header'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Token is required',
        message: 'Please provide a valid JWT token'
      });
    }

    // Call auth service to verify token
    try {
      const response = await axios.post(`${authServiceUrl}/verify`, {
        token
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.valid) {
        // Add user information to request object
        req.user = {
          id: response.data.user.id,
          email: response.data.user.email,
          role: response.data.user.role || 'user'
        };
        next();
      } else {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: 'Invalid token',
          message: 'The provided token is not valid'
        });
      }
    } catch (authServiceError) {
      // If auth service is down, try to verify locally (fallback)
      if (authServiceError.code === 'ECONNREFUSED' || authServiceError.code === 'ETIMEDOUT') {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
          req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role || 'user'
          };
          next();
        } catch (jwtError) {
          return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Authentication service unavailable',
            message: 'Unable to verify token - service temporarily unavailable'
          });
        }
      } else {
        throw authServiceError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication error',
      message: 'An error occurred while verifying authentication'
    });
  }
};

/**
 * Middleware to check if user has required role
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: 'Insufficient permissions',
        message: `This action requires ${requiredRole} role`
      });
    }

    next();
  };
};

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }

  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth
};