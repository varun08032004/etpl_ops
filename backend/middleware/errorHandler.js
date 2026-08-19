'use strict';

/**
 * Standardized error handling for the API
 * Provides consistent error response format across all endpoints
 */

/**
 * Standard error codes
 */
const ERROR_CODES = {
  // Authentication
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  
  // Business logic
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  OVERPAYMENT: 'OVERPAYMENT',
  CLOSED_PERIOD: 'CLOSED_PERIOD',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // External services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  EMAIL_PROVIDER_ERROR: 'EMAIL_PROVIDER_ERROR',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
};

/**
 * Create a standardized error response
 */
function createErrorResponse(code, message, details = null, requestId = null) {
  const response = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
  
  if (details) {
    response.details = details;
  }
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  return response;
}

/**
 * HTTP status code mapping for error codes
 */
const ERROR_STATUS_MAP = {
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_TOKEN: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSIONS: 403,
  RESOURCE_FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_RESOURCE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INSUFFICIENT_BALANCE: 400,
  OVERPAYMENT: 400,
  CLOSED_PERIOD: 400,
  ACCOUNT_LOCKED: 423,
  RATE_LIMIT_EXCEEDED: 429,
  EXTERNAL_SERVICE_ERROR: 502,
  PAYMENT_PROVIDER_ERROR: 502,
  EMAIL_PROVIDER_ERROR: 502,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  CONFIGURATION_ERROR: 500,
};

/**
 * Get HTTP status code for error code
 */
function getStatusCode(errorCode) {
  return ERROR_STATUS_MAP[errorCode] || 500;
}

/**
 * Error classes for throwing in business logic
 */
class AppError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.statusCode = getStatusCode(code);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource, identifier) {
    super('RESOURCE_NOT_FOUND', `${resource} not found${identifier ? `: ${identifier}` : ''}`);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message, details) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

class IdempotencyConflictError extends AppError {
  constructor(resource, existingId) {
    super('IDEMPOTENCY_CONFLICT', `${resource} with this idempotency key already exists`, { existingId });
    this.name = 'IdempotencyConflictError';
  }
}

class ClosedPeriodError extends AppError {
  constructor(periodLabel) {
    super('CLOSED_PERIOD', `Cannot modify entries in closed fiscal period: ${periodLabel}`);
    this.name = 'ClosedPeriodError';
  }
}

class InsufficientBalanceError extends AppError {
  constructor(available, requested) {
    super('INSUFFICIENT_BALANCE', `Insufficient balance: available ${available}, requested ${requested}`, { available, requested });
    this.name = 'InsufficientBalanceError';
  }
}

class OverpaymentError extends AppError {
  constructor(maxAmount, requested) {
    super('OVERPAYMENT', `Payment amount ${requested} exceeds maximum allowed ${maxAmount}`, { maxAmount, requested });
    this.name = 'OverpaymentError';
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message, details) {
    super('EXTERNAL_SERVICE_ERROR', `${service} error: ${message}`, details);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error with request context
  const logContext = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    staffId: req.staff?.id,
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    },
  };
  
  if (err.statusCode >= 500 || !err.statusCode) {
    console.error('[ERROR]', JSON.stringify(logContext));
  } else {
    console.warn('[ERROR]', JSON.stringify(logContext));
  }
  
  // Handle specific error types
  if (err instanceof AppError) {
    const response = createErrorResponse(err.code, err.message, err.details, req.id);
    return res.status(err.statusCode).json(response);
  }
  
  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
    const response = createErrorResponse('VALIDATION_ERROR', 'Validation failed', details, req.id);
    return res.status(400).json(response);
  }
  
  // Handle PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        const response = createErrorResponse('DUPLICATE_RESOURCE', 'A record with this value already exists', null, req.id);
        return res.status(409).json(response);
      case '23503': // foreign_key_violation
        const fkResponse = createErrorResponse('INVALID_INPUT', 'Referenced resource does not exist', null, req.id);
        return res.status(400).json(fkResponse);
      case '23514': // check_violation
        const checkResponse = createErrorResponse('INVALID_INPUT', 'Value violates a constraint', null, req.id);
        return res.status(400).json(checkResponse);
      case '22P02': // invalid_text_representation (e.g., invalid UUID)
        const uuidResponse = createErrorResponse('INVALID_INPUT', 'Invalid ID format', null, req.id);
        return res.status(400).json(uuidResponse);
      case '57014': // query_canceled (timeout)
        const timeoutResponse = createErrorResponse('SERVICE_UNAVAILABLE', 'Database query timed out', null, req.id);
        return res.status(503).json(timeoutResponse);
      default:
        break;
    }
  }
  
  // Handle multer errors (file upload)
  if (err.name === 'MulterError') {
    const multerResponse = createErrorResponse('INVALID_INPUT', err.message, null, req.id);
    return res.status(400).json(multerResponse);
  }
  
  // Default: internal server error
  const defaultResponse = createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', null, req.id);
  return res.status(500).json(defaultResponse);
}

/**
 * Async handler wrapper to catch async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create error response helper
 */
function createErrorResponse(code, message, details = null, requestId = null) {
  const response = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
  
  if (details) {
    response.details = details;
  }
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  return response;
}

/**
 * Success response helper
 */
function createSuccessResponse(data, message = null, requestId = null) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  
  if (message) {
    response.message = message;
  }
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  return response;
}

/**
 * Paginated response helper
 */
function createPaginatedResponse(data, pagination, requestId = null) {
  const response = {
    success: true,
    data,
    pagination: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + pagination.limit < pagination.total,
    },
    timestamp: new Date().toISOString(),
  };
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  return response;
}

module.exports = {
  ERROR_CODES,
  ERROR_STATUS_MAP,
  getStatusCode,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  IdempotencyConflictError,
  ClosedPeriodError,
  InsufficientBalanceError,
  OverpaymentError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
};