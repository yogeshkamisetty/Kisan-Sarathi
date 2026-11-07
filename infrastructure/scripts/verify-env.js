#!/usr/bin/env node
/**
 * Cross-platform Environment Configuration Verifier (Node.js)
 * Works reliably on Windows, macOS, and Linux CI environments.
 */
const { validateStartupConfig } = require('../../apps/api/src/common/env-validator.js');

console.log('[Fasal Awaaz] Validating environment configuration...');
const report = validateStartupConfig(process.env);
console.log(JSON.stringify(report, null, 2));

if (!report.valid) {
  process.exit(1);
}
