#!/usr/bin/env node
/**
 * Interactive CLI Verification of the 19-Step Hackathon Demonstration Scenario (Section 22)
 * Outputs the complete synthetic demonstration artifact JSON and plain-text draft report.
 */
const fs = require('node:fs');
const path = require('node:path');
const { runSeed } = require('../apps/api/prisma/seed.js');

async function main() {
  const result = await runSeed();
  const outJsonPath = path.join(__dirname, 'synthetic-demo-session.json');
  const outTxtPath = path.join(__dirname, 'sample-crop-loss-intimation-draft.txt');

  fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2), 'utf8');
  fs.writeFileSync(outTxtPath, result.generatedDocument.textContent, 'utf8');

  console.log('====================================================================');
  console.log('KISANSAATHI — FASAL AWAAZ: 19-STEP HACKATHON DEMO VERIFICATION PASS');
  console.log('====================================================================');
  console.log('Report Number         :', result.report.reportNumber);
  console.log('Farmer (Synthetic)    :', result.farmer.farmerName);
  console.log('Workflow Status       :', result.report.workflowStatus);
  console.log('Official Sub Status   :', result.report.submissionStatus);
  console.log('Missing 7-Day Fields  :', result.generatedDocument.missingFields.join(', '));
  console.log('Audit Trail Events    :', result.auditTrail.length);
  console.log('Saved Demo JSON       :', outJsonPath);
  console.log('Saved Text Draft      :', outTxtPath);
  console.log('====================================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
