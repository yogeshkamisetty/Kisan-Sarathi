/**
 * Privacy-Conscious Structured Logger
 * Automatically masks mobile numbers and redacts API keys, JWTs, and OTPs.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'otp',
  'accessToken',
  'refreshToken',
  'authorization',
  'x-api-key-id',
  'gnaniApiKey',
  'geminiApiKey',
]);

function maskMobile(value) {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/\b([6-9]\d{2})\d{3}(\d{4})\b/g, '$1XXX$2');
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskMobile(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (k.toLowerCase().includes('mobile')) {
      out[k] = maskMobile(String(v));
    } else {
      out[k] = sanitizeObject(v);
    }
  }
  return out;
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskMobile(message),
    ...sanitizeObject(meta),
  };
  return entry;
}

module.exports = {
  maskMobile,
  sanitizeObject,
  log,
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
};
