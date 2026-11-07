/**
 * Vercel Serverless Function Entry Point for Kisan Sarathi
 * Routes incoming serverless HTTP invocations to the modular monolith request handler.
 */
const { createAppContainer, createRequestHandler } = require('../apps/api/src/main.js');

let cachedHandler = null;

module.exports = async (req, res) => {
  if (!cachedHandler) {
    // Vercel serverless environment overrides
    process.env.PERSISTENCE = process.env.PERSISTENCE || 'file';
    process.env.DATA_DIR = process.env.DATA_DIR || '/tmp/.data';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || 'fasal-awaaz-production-jwt-access-secret-32-chars-min';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'fasal-awaaz-production-jwt-refresh-secret-32-chars-min';

    const container = createAppContainer(process.env);
    cachedHandler = createRequestHandler(container);
  }

  return cachedHandler(req, res);
};
