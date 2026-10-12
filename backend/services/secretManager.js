/**
 * Secret Validation & Management Module
 * Runs at startup to validate all required secrets are present and properly formatted
 */

'use strict';

const crypto = require('crypto');

/**
 * Required secrets configuration
 * Each secret has: name, required, format validator, description
 */
const REQUIRED_SECRETS = [
  {
    name: 'INTERNAL_OPS_DATABASE_URL',
    required: true,
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    description: 'PostgreSQL connection string (Supabase session pooler)',
    sensitive: true
  },
  {
    name: 'INTERNAL_OPS_JWT_SECRET',
    required: true,
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'JWT signing secret (64-char hex)',
    sensitive: true
  },
  {
    name: 'INTERNAL_OPS_REFRESH_SECRET',
    required: true,
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Refresh token signing secret (64-char hex)',
    sensitive: true
  },
  {
    name: 'INTERNAL_OPS_ALLOWED_ORIGIN',
    required: true,
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'Frontend origin for CORS',
    sensitive: false
  },
  {
    name: 'SUPABASE_URL',
    required: true,
    validator: (v) => v.startsWith('https://') && v.includes('.supabase.co'),
    description: 'Supabase project URL',
    sensitive: false
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    validator: (v) => v.startsWith('eyJ') && v.split('.').length === 3,
    description: 'Supabase service role JWT',
    sensitive: true
  },
  {
    name: 'RESEND_API_KEY',
    required: false, // optional for dev
    validator: (v) => v.startsWith('re_'),
    description: 'Resend email API key',
    sensitive: true
  },
  {
    name: 'RESEND_FROM_EMAIL',
    required: false,
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    description: 'From email for Resend',
    sensitive: false
  },
  {
    name: 'PLATFORM_SYNC_SERVICE_TOKEN',
    required: process.env.NODE_ENV === 'production',
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Platform sync service token (64-char hex)',
    sensitive: true
  },
  {
    name: 'PLATFORM_SYNC_SERVICE_TOKEN',
    required: false,
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Platform sync service token (64-char hex)',
    sensitive: true
  },
  {
    name: 'PLATFORM_SYNC_CORPORATE_WRITE_TOKEN',
    required: process.env.NODE_ENV === 'production',
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Platform corporate write token',
    sensitive: true
  },
  {
    name: 'PLATFORM_SYNC_COUPON_WRITE_TOKEN',
    required: false,
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Platform coupon write token',
    sensitive: true
  },
  {
    name: 'PLATFORM_SYNC_PRICING_WRITE_TOKEN',
    required: false,
    validator: (v) => v.length >= 64 && /^[a-f0-9]{64}$/i.test(v),
    description: 'Platform pricing write token',
    sensitive: true
  },
  {
    name: 'TWO_FA_ENCRYPTION_KEY',
    required: true,
    validator: (v) => v.length === 64 && /^[a-f0-9]{64}$/i.test(v),
    description: '2FA encryption key (64-char hex, used for AES-256-GCM)',
    sensitive: true
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    validator: (v) => v.startsWith('re_'),
    description: 'Resend email API key',
    sensitive: true
  },
  {
    name: 'RESEND_FROM_EMAIL',
    required: false,
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    description: 'From email for Resend',
    sensitive: false
  },
  {
    name: 'NVIDIA_API_KEY',
    required: process.env.NODE_ENV === 'production',
    validator: (v) => v.startsWith('nvapi-'),
    description: 'NVIDIA API key',
    sensitive: true
  },
  {
    name: 'NVIDIA_EMBED_URL',
    required: false,
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'NVIDIA embedding endpoint',
    sensitive: false
  },
  {
    name: 'NVIDIA_CHAT_URL',
    required: false,
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'NVIDIA chat endpoint',
    sensitive: false
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    validator: (v) => v.startsWith('sk-') || v === 'ollama',
    description: 'OpenAI or Ollama API key',
    sensitive: true
  },
  {
    name: 'NVIDIA_API_KEY',
    required: false,
    validator: (v) => v.startsWith('nvapi-'),
    description: 'NVIDIA API key',
    sensitive: true
  }
];

const OPTIONAL_SECRETS = [
  {
    name: 'RAZORPAYX_KEY_ID',
    required: false,
    validator: (v) => v.startsWith('rzp_'),
    description: 'RazorpayX key ID',
    sensitive: true
  },
  {
    name: 'RAZORPAYX_KEY_SECRET',
    required: false,
    validator: (v) => v.length >= 32,
    description: 'RazorpayX key secret',
    sensitive: true
  },
  {
    name: 'RAZORPAYX_ACCOUNT_NUMBER',
    required: false,
    validator: (v) => v.length > 0,
    description: 'RazorpayX account number',
    sensitive: false
  },
  {
    name: 'RAZORPAYX_WEBHOOK_SECRET',
    required: false,
    validator: (v) => v.length >= 32,
    description: 'RazorpayX webhook secret',
    sensitive: true
  },
  {
    name: 'TRACKPILOT_API_KEY',
    required: false,
    validator: (v) => v.length > 0,
    description: 'TrackPilot API key',
    sensitive: true
  },
  {
    name: 'TRACKPILOTS_API_KEY',
    required: false,
    validator: (v) => v.length > 0,
    description: 'TrackPilots API key',
    sensitive: true
  },
  {
    name: 'TRACKPILOTS_WEBHOOK_SECRET',
    required: false,
    validator: (v) => v.length >= 32,
    description: 'TrackPilots webhook secret',
    sensitive: true
  },
  {
    name: 'INSTAGRAM_ACCESS_TOKEN',
    required: false,
    validator: (v) => v.length > 0,
    description: 'Instagram access token',
    sensitive: true
  },
  {
    name: 'TWITTER_BEARER_TOKEN',
    required: false,
    validator: (v) => v.length > 0,
    description: 'Twitter/X bearer token',
    sensitive: true
  },
  {
    name: 'YOUTUBE_API_KEY',
    required: false,
    validator: (v) => v.startsWith('AIza'),
    description: 'YouTube API key',
    sensitive: true
  },
  {
    name: 'GOOGLE_SERVICE_ACCOUNT_KEY',
    required: false,
    validator: (v) => v.startsWith('{') && v.includes('private_key'),
    description: 'Google service account JSON',
    sensitive: true
  },
  {
    name: 'GOOGLE_SEARCH_CONSOLE_SITE_URL',
    required: false,
    validator: (v) => v.startsWith('https://') || v.startsWith('sc-domain:'),
    description: 'Google Search Console site URL',
    sensitive: false
  },
  {
    name: 'GOOGLE_GA4_PROPERTY_ID',
    required: false,
    validator: (v) => /^G-[A-Z0-9]{10}$/.test(v),
    description: 'Google Analytics 4 property ID',
    sensitive: false
  },
  {
    name: 'INSTAGRAM_ACCESS_TOKEN',
    required: false,
    validator: (v) => v.length > 0,
    description: 'Instagram access token',
    sensitive: true
  },
  {
    name: 'TWITTER_BEARER_TOKEN',
    required: false,
    validator: (v) => v.length > 0,
    description: 'Twitter/X bearer token',
    sensitive: true
  },
  {
    name: 'YOUTUBE_API_KEY',
    required: false,
    validator: (v) => v.startsWith('AIza'),
    description: 'YouTube API key',
    sensitive: true
  },
  {
    name: 'GOOGLE_SERVICE_ACCOUNT_KEY',
    required: false,
    validator: (v) => v.startsWith('{') && v.includes('private_key'),
    description: 'Google service account JSON',
    sensitive: true
  },
  {
    name: 'GOOGLE_SEARCH_CONSOLE_SITE_URL',
    required: false,
    validator: (v) => v.startsWith('https://') || v.startsWith('sc-domain:'),
    description: 'Google Search Console site URL',
    sensitive: false
  },
  {
    name: 'GOOGLE_GA4_PROPERTY_ID',
    required: false,
    validator: (v) => /^G-[A-Z0-9]{10}$/.test(v),
    description: 'Google Analytics 4 property ID',
    sensitive: false
  }
];

/**
 * Validate all secrets at startup
 * @returns {Object} Validation result with errors and warnings
 */
function validateSecrets() {
  const errors = [];
  const warnings = [];
  const missing = [];
  const invalid = [];

  // Check required secrets
  for (const secret of REQUIRED_SECRETS) {
    const value = process.env[secret.name];
    
    if (!value || value.trim() === '') {
      if (secret.required) {
        missing.push({
          name: secret.name,
          description: secret.description
        });
      } else {
        warnings.push(`${secret.name}: not set (optional)`);
      }
      continue;
    }

    // Validate format
    if (!secret.validator(value)) {
      invalid.push({
        name: secret.name,
        description: secret.description,
        reason: 'Invalid format'
      });
    }

    // Check for placeholder values
    if (isPlaceholder(value)) {
      warnings.push(`${secret.name}: appears to be a placeholder value`);
    }
  }

  // Check optional secrets
  for (const secret of OPTIONAL_SECRETS) {
    const value = process.env[secret.name];
    if (value && value.trim() !== '') {
      if (!secret.validator(value)) {
        warnings.push(`${secret.name}: invalid format`);
      }
    }
  }

  // Check for placeholder values in required secrets
  function isPlaceholder(value) {
    const placeholders = [
      'change-me',
      'your-password',
      'your-password-here',
      'your-key-here',
      'your-secret-here',
      'your-api-key-here',
      'your-token-here',
      'change-me',
      'replace-me',
      'todo',
      'xxx',
      '...',
      'TODO',
      'FIXME'
    ];
    const lower = value.toLowerCase();
    return placeholders.some(p => lower.includes(p.toLowerCase()));
  }

  return {
    valid: errors.length === 0 && invalid.length === 0,
    errors,
    warnings,
    missing,
    invalid,
    summary: {
      requiredTotal: REQUIRED_SECRETS.filter(s => s.required).length,
      requiredSet: REQUIRED_SECRETS.filter(s => s.required && process.env[s.name] && !isPlaceholder(process.env[s.name])).length,
      optionalTotal: OPTIONAL_SECRETS.length,
      optionalSet: OPTIONAL_SECRETS.filter(s => process.env[s.name] && !isPlaceholder(process.env[s.name])).length
    }
  };
}

/**
 * Check for hardcoded secrets in codebase
 * @returns {Array} Array of findings
 */
async function scanForHardcodedSecrets() {
  const findings = [];
  // This would be implemented to scan the codebase
  // For now, return empty - would be implemented with proper AST parsing
  return findings;
}

/**
 * Generate a secure random secret
 * @param {number} bytes - Number of bytes
 * @returns {string} Hex string
 */
function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Rotate a secret
 * @param {string} name - Secret name
 * @param {string} newValue - New secret value
 * @returns {Promise<Object>} Rotation result
 */
async function rotateSecret(name, newValue) {
  // This would integrate with your secret store (Vault, AWS Secrets Manager, etc.)
  // For now, return instructions
  return {
    success: false,
    message: 'Secret rotation requires manual update in environment/secrets manager',
    instructions: [
      `1. Generate new secret: ${generateSecret(32)}`,
      `2. Update in your secrets manager (Vault, AWS Secrets Manager, etc.)`,
      `3. Update in deployment environment (Render, Vercel, etc.)`,
      `4. Restart application to pick up new secret`,
      `5. Verify application works with new secret`,
      `6. Revoke old secret after verification`
    ]
  };
}

/**
 * Get secret rotation schedule
 * @returns {Array} Array of secrets with rotation recommendations
 */
function getRotationSchedule() {
  return [
    { name: 'INTERNAL_OPS_JWT_SECRET', frequency: '90 days', criticality: 'CRITICAL' },
    { name: 'INTERNAL_OPS_REFRESH_SECRET', frequency: '90 days', criticality: 'CRITICAL' },
    { name: 'INTERNAL_OPS_JWT_SECRET', frequency: '90 days', criticality: 'CRITICAL' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', frequency: '180 days', criticality: 'CRITICAL' },
    { name: 'PLATFORM_SYNC_SERVICE_TOKEN', frequency: '180 days', criticality: 'HIGH' },
    { name: 'PLATFORM_SYNC_CORPORATE_WRITE_TOKEN', frequency: '180 days', criticality: 'HIGH' },
    { name: 'PLATFORM_SYNC_COUPON_WRITE_TOKEN', frequency: '180 days', criticality: 'HIGH' },
    { name: 'PLATFORM_SYNC_PRICING_WRITE_TOKEN', frequency: '180 days', criticality: 'HIGH' },
    { name: 'RESEND_API_KEY', frequency: '365 days', criticality: 'MEDIUM' },
    { name: 'TWO_FA_ENCRYPTION_KEY', frequency: '365 days', criticality: 'CRITICAL' },
    { name: 'NVIDIA_API_KEY', frequency: '365 days', criticality: 'HIGH' },
    { name: 'RESEND_API_KEY', frequency: '365 days', criticality: 'MEDIUM' }
  ];
}

module.exports = {
  REQUIRED_SECRETS,
  OPTIONAL_SECRETS,
  validateSecrets,
  scanForHardcodedSecrets,
  generateSecret,
  rotateSecret,
  getRotationSchedule
};