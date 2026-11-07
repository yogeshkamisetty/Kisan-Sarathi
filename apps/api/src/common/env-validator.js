/**
 * Startup Environment Configuration Validator
 * Ensures production deployments never run with missing secrets or development mock OTPs.
 */

function validateStartupConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const errors = [];
  const warnings = [];

  if (isProd) {
    if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production.');
    if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 24) {
      errors.push('JWT_ACCESS_SECRET must be at least 24 characters in production.');
    }
    if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 24) {
      errors.push('JWT_REFRESH_SECRET must be at least 24 characters in production.');
    }
    if (env.ENABLE_DEV_MOCK_OTP === 'true') {
      errors.push('ENABLE_DEV_MOCK_OTP must be disabled (false) in production.');
    }
    if (env.ENABLE_DEMO_ENDPOINT === 'true') {
      errors.push(
        'ENABLE_DEMO_ENDPOINT must be disabled in production: POST /api/v1/demo/run reseeds demo data.'
      );
    }
    if (String(env.PERSISTENCE || '').toLowerCase() === 'memory') {
      errors.push(
        'PERSISTENCE=memory must not be used in production: farmer crop-loss drafts would be lost on restart.'
      );
    }
  }

  if (!isProd && !env.JWT_ACCESS_SECRET) {
    warnings.push(
      'JWT_ACCESS_SECRET is not set. A random per-process secret will be used, so tokens stop working on restart.'
    );
  }

  const gnaniConfigured = Boolean(env.GNANI_API_KEY && String(env.GNANI_API_KEY).trim().length > 0);
  if (!gnaniConfigured) {
    warnings.push(
      'GNANI_API_KEY is not set. Gnani Prisma STT and Timbre TTS adapters will run in clearly labelled MOCK_DEVELOPMENT mode.'
    );
  }

  return {
    valid: errors.length === 0,
    nodeEnv,
    gnaniMode: gnaniConfigured ? 'LIVE_GNANI' : 'MOCK_DEVELOPMENT',
    gnaniSttBaseUrl: env.GNANI_STT_BASE_URL || 'https://api.vachana.ai',
    gnaniTtsBaseUrl: env.GNANI_TTS_BASE_URL || 'https://api.vachana.ai',
    persistence: String(env.PERSISTENCE || 'file').toLowerCase() === 'memory' ? 'memory' : 'file',
    demoEndpointEnabled: env.ENABLE_DEMO_ENDPOINT === 'true' && !isProd,
    errors,
    warnings,
  };
}

module.exports = { validateStartupConfig };
