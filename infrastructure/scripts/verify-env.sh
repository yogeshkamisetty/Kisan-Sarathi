#!/usr/bin/env bash
set -euo pipefail

echo "[Fasal Awaaz] Validating environment configuration..."
node -e '
const { validateStartupConfig } = require("./apps/api/src/common/env-validator.js");
const report = validateStartupConfig(process.env);
console.log(JSON.stringify(report, null, 2));
'
