'use strict';

const { z } = require('zod');

/**
 * Validation middleware using Zod schemas
 * Provides consistent request validation across all endpoints
 */

// Common reusable schemas
const schemas = {
  // UUID validation
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),
  
  // Pagination
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  
  // Date strings (YYYY-MM-DD)
  dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  
  // ISO timestamp
  isoTimestamp: z.string().datetime({ offset: true }),
  
  // Positive amount (paise precision)
  positiveAmount: z.number().positive().multipleOf(0.01),
  
  // Non-negative amount
  nonNegativeAmount: z.number().min(0).multipleOf(0.01),
  
  // Email
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
  
  // Phone (Indian format)
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  
  // PAN (Indian)
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, 'Invalid PAN format').toUpperCase(),
  
  // GSTIN (Indian)
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, 'Invalid GSTIN format').toUpperCase(),
  
  // IFSC (Indian)
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC format').toUpperCase(),
  
  // Money (numeric string or number, 2 decimal places)
  money: z.union([z.number(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return Math.round(num * 100) / 100;
  }).refine((val) => val >= 0 && val === Math.round(val * 100) / 100, {
    message: 'Amount must be non-negative with max 2 decimal places',
  }),
  
  // Positive integer
  positiveInt: z.coerce.number().int().positive(),
  
  // Non-negative integer
  nonNegativeInt: z.coerce.number().int().min(0),
  
  // Boolean (accepts string 'true'/'false' or boolean)
  boolean: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return val;
  }),
  
  // ISO date string
  isoDate: z.string().date(),
  
  // Month (1-12)
  month: z.coerce.number().int().min(1).max(12),
  
  // Year (4 digits)
  year: z.coerce.number().int().min(2000).max(2100),
  
  // Search query
  searchQuery: z.string().max(200).optional(),
  
  // File upload (base64)
  base64File: z.object({
    file_content_base64: z.string().min(1, 'File content required'),
    file_name: z.string().min(1).max(255),
    mime_type: z.string().min(1).max(100),
  }),
};

/**
 * Create a validation middleware for a specific schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }
    
    // Replace with validated/transformed data
    req[source] = result.data;
    next();
  };
}

/**
 * Validate request body
 */
function validateBody(schema) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
function validateQuery(schema) {
  return validate(schema, 'query');
}

/**
 * Validate URL parameters
 */
function validateParams(schema) {
  return validate(schema, 'params');
}

/**
 * Combine multiple validations
 */
function validateAll(validations) {
  return (req, res, next) => {
    const errors = [];
    
    for (const { schema, source } of validations) {
      const data = req[source];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => ({
          source,
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })));
      } else {
        req[source] = result.data;
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }
    
    next();
  };
}

/**
 * Pre-defined validation chains for common patterns
 */
const commonValidations = {
  // Pagination
  pagination: validateQuery(z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  
  // ID parameter
  idParam: validateParams(z.object({
    id: z.string().uuid({ message: 'Invalid ID format' }),
  })),
  
  // Date range query
  dateRange: validateQuery(z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }).refine((data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, { message: 'from date must be before or equal to to date' })),
  
  // Date single
  singleDate: validateQuery(z.object({
    date: z.string().date({ message: 'Date must be YYYY-MM-DD' }),
  })),
  
  // Search with pagination
  search: validateQuery(z.object({
    search: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })),
  
  // Date range with pagination
  dateRangePagination: validateQuery(z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }).refine((data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, { message: 'from date must be before or equal to to date' })),
};

module.exports = {
  schemas,
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  commonValidations,
};