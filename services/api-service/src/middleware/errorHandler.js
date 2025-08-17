const { StatusCodes } = require('http-status-codes');
const winston = require('winston');

// Configure logger for error handling
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-service-errors' },
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error class for validation errors
 */
class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(message, StatusCodes.BAD_REQUEST);
    this.errors = errors;
    this.type = 'validation_error';
  }
}

/**
 * Custom error class for authentication errors
 */
class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(message, StatusCodes.UNAUTHORIZED);
    this.type = 'authentication_error';
  }
}

/**
 * Custom error class for authorization errors
 */
class AuthorizationError extends ApiError {
  constructor(message = 'Access denied') {
    super(message, StatusCodes.FORBIDDEN);
    this.type = 'authorization_error';
  }
}

/**
 * Custom error class for not found errors
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, StatusCodes.NOT_FOUND);
    this.type = 'not_found_error';
  }
}

/**
 * Custom error class for service unavailable errors
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
    this.type = 'service_unavailable_error';
  }
}

/**
 * Handle specific error types
 */
const handleSpecificErrors = (error) => {
  // Handle Joi validation errors
  if (error.isJoi) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));
    
    return new ValidationError('Validation failed', errors);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }

  // Handle Axios errors (external service calls)
  if (error.isAxiosError) {
    if (error.code === 'ECONNREFUSED') {
      return new ServiceUnavailableError('External service unavailable');
    }
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'External service error';
      
      if (status >= 500) {
        return new ServiceUnavailableError(message);
      } else if (status === 404) {
        return new NotFoundError(message);
      } else if (status === 401) {
        return new AuthenticationError(message);
      } else if (status === 403) {
        return new AuthorizationError(message);
      }
      
      return new ApiError(message, status);
    }
    
    return new ServiceUnavailableError('Network error occurred');
  }

  // Handle database errors
  if (error.code === 'ECONNREFUSED' && error.port === 5432) {
    return new ServiceUnavailableError('Database connection failed');
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    return new ApiError('Resource already exists', StatusCodes.CONFLICT);
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    return new ApiError('Referenced resource not found', StatusCodes.BAD_REQUEST);
  }

  // Handle file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError('File too large', StatusCodes.PAYLOAD_TOO_LARGE);
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ApiError('Unexpected file field', StatusCodes.BAD_REQUEST);
  }

  return null;
};

/**
 * Determine if error should be reported (not client errors)
 */
const shouldReport = (error) => {
  if (error.statusCode && error.statusCode < 500) {
    return false;
  }
  
  if (!error.isOperational) {
    return true;
  }
  
  return error.statusCode >= 500;
};

/**
 * Format error response
 */
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    error: error.message || 'An error occurred',
    timestamp: error.timestamp || new Date().toISOString(),
    type: error.type || 'unknown_error'
  };

  if (error.errors) {
    response.details = error.errors;
  }

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  if (error.code) {
    response.code = error.code;
  }

  return response;
};

/**
 * Main error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Handle specific error types
  const processedError = handleSpecificErrors(error) || error;

  // Set default status code if not set
  const statusCode = processedError.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  
  // Log error if it should be reported
  if (shouldReport(processedError)) {
    logger.error('Unhandled error:', {
      error: processedError.message,
      stack: processedError.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  // Determine if we should include stack trace
  const includeStack = process.env.NODE_ENV === 'development';

  // Format and send error response
  const errorResponse = formatErrorResponse(processedError, includeStack);
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper - catches async errors and passes them to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServiceUnavailableError
};