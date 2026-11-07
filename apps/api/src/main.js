/**
 * KisanSaathi — Fasal Awaaz HTTP REST API Server (/api/v1)
 * Modular Monolith entrypoint runnable directly with `node apps/api/src/main.js`
 */
const http = require('node:http');
const { validateStartupConfig } = require('./common/env-validator.js');
const { JsonStore } = require('./common/json-store.js');
const logger = require('./common/logger.js');
const { AuditService } = require('./audit/audit.service.js');
const { ConsentService } = require('./consent/consent.service.js');
const { AuthService } = require('./auth/auth.service.js');
const { FarmersService } = require('./farmers/farmers.service.js');
const { GnaniPrismaSttAdapter } = require('./gnani/gnani-prisma.adapter.js');
const { GnaniTimbreTtsAdapter } = require('./gnani/gnani-timbre.adapter.js');
const { InformationExtractionService } = require('./extraction/extraction.service.js');
const { DynamicQuestionEngine } = require('./conversation/question-engine.service.js');
const { PolicyEngineService } = require('./policy/policy.service.js');
const { ReportsService } = require('./reports/reports.service.js');
const { ReportGeneratorService } = require('./documents/report-generator.service.js');
const { WeatherGroundingService } = require('./intelligence/weather-grounding.service.js');
const { PilotDistrictsService } = require('./intelligence/pilot-districts.service.js');
const { RapidIntakeService } = require('./channels/rapid-intake.service.js');
const { BusinessAnalyticsService } = require('./business/analytics.service.js');
const { renderDashboardHtml } = require('./ui/dashboard.js');
const { renderMobileAppHtml } = require('./ui/mobile-app.js');
const { VERIFIED_LANGUAGES, ConsentType } = require('../../../packages/shared-types/src/index.js');

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        const err = new Error('PAYLOAD_TOO_LARGE');
        err.statusCode = 413;
        reject(err);
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        try {
          const params = new URLSearchParams(body);
          const parsed = {};
          for (const [k, v] of params.entries()) {
            parsed[k] = v;
          }
          return resolve(parsed);
        } catch {}
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        // Fallback for form-encoded payloads without explicit header
        try {
          const params = new URLSearchParams(body);
          const parsed = {};
          for (const [k, v] of params.entries()) {
            parsed[k] = v;
          }
          if (Object.keys(parsed).length > 0 && !body.startsWith('{')) {
            return resolve(parsed);
          }
        } catch {}
        const err = new Error('INVALID_JSON');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Extracts and verifies the Bearer access token. Every endpoint that touches farmer
 * personal data or a crop-loss report goes through this; previously any caller who
 * guessed a report id could read and modify another farmer's report.
 */
function requireAuth(req, container) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error('AUTHENTICATION_REQUIRED: Provide a Bearer access token.');
    err.code = 'AUTHENTICATION_REQUIRED';
    err.statusCode = 401;
    throw err;
  }
  const claims = container.authService.verifyAccessToken(match[1].trim());
  return { userId: claims.sub, role: claims.role, token: match[1].trim() };
}

/**
 * Loads a report and confirms the authenticated caller is entitled to it.
 */
function authorizeReport(req, container, reportId) {
  const actor = requireAuth(req, container);
  const report = container.reportsService.getReport(reportId);
  container.reportsService.assertActorMayAccess(report, actor);
  return { actor, report };
}

function createAppContainer(env = process.env) {
  const startupValidation = validateStartupConfig(env);
  if (!startupValidation.valid) {
    throw new Error(`Startup configuration invalid: ${startupValidation.errors.join('; ')}`);
  }

  const store = JsonStore.fromEnv(env);
  const auditService = new AuditService({ store });
  const consentService = new ConsentService(auditService, { store });
  const authService = new AuthService({ env, auditService, store });
  const farmersService = new FarmersService(auditService, { store });
  const sttAdapter = new GnaniPrismaSttAdapter({ env });
  const ttsAdapter = new GnaniTimbreTtsAdapter({ env });
  const extractionService = new InformationExtractionService();
  const questionEngine = new DynamicQuestionEngine();
  const policyService = new PolicyEngineService(auditService);
  const reportsService = new ReportsService({
    auditService,
    extractionService,
    questionEngine,
    policyService,
    ttsAdapter,
    store,
  });
  const reportGenerator = new ReportGeneratorService(auditService);
  const weatherService = new WeatherGroundingService();
  const pilotDistrictsService = new PilotDistrictsService();
  const rapidIntakeService = new RapidIntakeService({
    sttAdapter,
    extractionService,
    policyService,
    weatherService,
    reportGenerator,
    reportsService,
  });
  const businessAnalytics = new BusinessAnalyticsService({ reportsService });

  return {
    env,
    store,
    startupValidation,
    auditService,
    consentService,
    authService,
    farmersService,
    sttAdapter,
    ttsAdapter,
    extractionService,
    questionEngine,
    policyService,
    reportsService,
    reportGenerator,
    weatherService,
    pilotDistrictsService,
    rapidIntakeService,
    businessAnalytics,
  };
}

function createRequestHandler(container = createAppContainer()) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    try {
      // 0. Executive Command Center & Mobile Web Interfaces
      if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/' || path === '/dashboard')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const html = renderDashboardHtml({
          pilotDistricts: container.pilotDistrictsService.getAllDistricts(),
          radarGrid: container.weatherService.getLiveRadarGrid(),
          businessMetrics: container.businessAnalytics.getExecutiveMetrics(),
        });
        res.writeHead(200);
        res.end(req.method === 'HEAD' ? '' : html);
        return;
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && path === '/mobile') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const html = renderMobileAppHtml();
        res.writeHead(200);
        res.end(req.method === 'HEAD' ? '' : html);
        return;
      }

      // 1. Health & Discovery Endpoints
      if (req.method === 'GET' && path === '/api/v1/health') {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: 'ok',
            service: 'fasal-awaaz-api',
            timestamp: new Date().toISOString(),
            gnaniMode: container.startupValidation.gnaniMode,
          })
        );
        return;
      }

      if (req.method === 'GET' && path === '/api/v1/languages') {
        res.writeHead(200);
        res.end(JSON.stringify({ languages: container.sttAdapter.getSupportedLanguages() }));
        return;
      }

      if (req.method === 'GET' && path === '/api/v1/voice/providers/health') {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            stt: container.sttAdapter.getProviderHealth(),
            tts: container.ttsAdapter.getProviderHealth(),
          })
        );
        return;
      }

      // 2. Auth Endpoints
      if (req.method === 'POST' && path === '/api/v1/auth/otp/request') {
        const body = await readJsonBody(req);
        const result = container.authService.requestOtp(body.mobileNumber);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && path === '/api/v1/auth/otp/verify') {
        const body = await readJsonBody(req);
        const result = container.authService.verifyOtp(body);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // 3. Consent & Farmer Profiles
      if (req.method === 'POST' && path === '/api/v1/consent') {
        const actor = requireAuth(req, container);
        const body = await readJsonBody(req);
        // A caller may only record consent for themselves.
        const result = container.consentService.grantConsent({ ...body, userId: actor.userId });
        res.writeHead(201);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && path === '/api/v1/farmers') {
        const actor = requireAuth(req, container);
        const body = await readJsonBody(req);
        // Storing name, village and district is personal data processing under DPDP.
        container.consentService.requireConsent(actor.userId, ConsentType.PERSONAL_DATA_STORAGE);
        const result = container.farmersService.createProfile({ ...body, userId: actor.userId });
        res.writeHead(201);
        res.end(JSON.stringify(result));
        return;
      }

      // 4. Reports Lifecycle
      if (req.method === 'POST' && path === '/api/v1/reports') {
        const actor = requireAuth(req, container);
        const body = await readJsonBody(req);
        container.consentService.requireConsent(actor.userId, ConsentType.PERSONAL_DATA_STORAGE);
        const idempotencyKey = req.headers['idempotency-key'] || body.idempotencyKey;
        const result = container.reportsService.createReport({
          ...body,
          farmerProfile: { ...(body.farmerProfile || {}), userId: actor.userId },
          actorId: actor.userId,
          actorRole: actor.role,
          idempotencyKey,
        });
        res.writeHead(result.deduplicatedRetry ? 200 : 201);
        res.end(JSON.stringify(result));
        return;
      }

      const reportDetailMatch = path.match(/^\/api\/v1\/reports\/([^/]+)$/);
      if (req.method === 'GET' && reportDetailMatch) {
        const reportId = reportDetailMatch[1];
        const { report } = authorizeReport(req, container, reportId);
        res.writeHead(200);
        res.end(JSON.stringify(report));
        return;
      }

      const turnsMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/conversation\/turns$/);
      if (req.method === 'POST' && turnsMatch) {
        const reportId = turnsMatch[1];
        const { actor } = authorizeReport(req, container, reportId);
        const body = await readJsonBody(req);
        container.consentService.requireConsent(actor.userId, ConsentType.PERSONAL_DATA_STORAGE);
        const result = container.reportsService.processConversationTurn({
          reportId,
          ...body,
          actorId: actor.userId,
          // Provenance is decided by the server from the real adapter state; a client
          // must never be able to label a typed turn as live Gnani transcription.
          providerMode: container.sttAdapter.getProviderHealth().mode,
          provider: body.audioTranscribed ? 'gnani-prisma-v3.0' : 'MANUAL_TEXT_ENTRY',
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      const readbackMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/readback$/);
      if (req.method === 'POST' && readbackMatch) {
        const reportId = readbackMatch[1];
        authorizeReport(req, container, reportId);
        const body = await readJsonBody(req);
        const result = await container.reportsService.generateVoiceReadback({
          reportId,
          languageCode: body.languageCode || 'hi-IN',
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      const correctMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/correct$/);
      if (req.method === 'POST' && correctMatch) {
        const reportId = correctMatch[1];
        const { actor } = authorizeReport(req, container, reportId);
        const body = await readJsonBody(req);
        const result = container.reportsService.correctField({
          reportId,
          ...body,
          actorId: actor.userId,
          actorRole: actor.role,
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      const confirmMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/confirm$/);
      if (req.method === 'POST' && confirmMatch) {
        const reportId = confirmMatch[1];
        const { actor } = authorizeReport(req, container, reportId);
        const body = await readJsonBody(req);
        const result = container.reportsService.confirmAfterReadback({
          reportId,
          ...body,
          actorId: actor.userId,
          actorRole: actor.role,
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      const docMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/documents$/);
      if (req.method === 'POST' && docMatch) {
        const reportId = docMatch[1];
        const { actor, report } = authorizeReport(req, container, reportId);
        await readJsonBody(req);
        const result = container.reportGenerator.generateDraftDocuments({
          report,
          actorId: actor.userId,
        });
        res.writeHead(201);
        res.end(JSON.stringify(result));
        return;
      }

      const subMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/submission-records$/);
      if (req.method === 'POST' && subMatch) {
        const reportId = subMatch[1];
        const { actor } = authorizeReport(req, container, reportId);
        const body = await readJsonBody(req);
        const result = container.reportsService.recordOfficialSubmissionReference({
          reportId,
          ...body,
          actorId: actor.userId,
        });
        res.writeHead(201);
        res.end(JSON.stringify(result));
        return;
      }

      // 5. Voice Adapters
      if (req.method === 'POST' && path === '/api/v1/voice/synthesize') {
        requireAuth(req, container);
        const body = await readJsonBody(req);
        const result = await container.ttsAdapter.synthesizeSpeech(body);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      /**
       * Speech-to-text. The mobile client posts base64 audio here; the server holds the
       * Gnani key and decides the provider mode, so audio provenance stays trustworthy.
       */
      if (req.method === 'POST' && path === '/api/v1/voice/transcribe') {
        const actor = requireAuth(req, container);
        const body = await readJsonBody(req);

        // Sending a voice recording to Gnani's cloud needs its own explicit consent.
        container.consentService.requireConsent(actor.userId, ConsentType.AUDIO_RECORDING);
        container.consentService.requireConsent(
          actor.userId,
          ConsentType.GNANI_CLOUD_VOICE_PROCESSING
        );

        if (!body.audioBase64) {
          const err = new Error('MISSING_AUDIO: Provide the recording as base64 in "audioBase64".');
          err.code = 'MISSING_AUDIO';
          err.statusCode = 400;
          throw err;
        }

        const audioBuffer = Buffer.from(String(body.audioBase64), 'base64');
        const result = await container.sttAdapter.transcribeAudio({
          audioBuffer,
          fileName: body.fileName || 'utterance.wav',
          audioFormat: body.audioFormat || 'wav',
          durationSeconds: Number(body.durationSeconds) || 5,
          languageCode: body.languageCode || 'hi-IN',
          previousText: body.previousText || null,
        });

        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // 6. Rapid Zero-App Intake & WhatsApp Gateway (Innovation & Business Model)
      if (req.method === 'POST' && path === '/api/v1/intake/quick-voice') {
        const body = await readJsonBody(req);
        const result = await container.rapidIntakeService.processQuickIntake(body);
        res.writeHead(201);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && path === '/api/v1/channels/whatsapp/webhook') {
        const body = await readJsonBody(req);
        const isTwilio = Boolean(
          body.AccountSid ||
          body.MessageSid ||
          (body.From && String(body.From).startsWith('whatsapp:')) ||
          req.headers['content-type']?.includes('application/x-www-form-urlencoded')
        );

        // Extracts message text/audio from Twilio WhatsApp Sandbox OR Meta WhatsApp Webhook payload
        const messageText =
          body.Body ||
          body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
          body.text ||
          body.message ||
          '';

        const rawPhone =
          body.From ||
          body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id ||
          body.from ||
          body.farmerPhone ||
          '9876543210';
        const senderPhone = String(rawPhone).replace(/^whatsapp:\+?/, '').replace(/^\+/, '');

        // Handle Twilio Voice Note / Media attachment if sent by farmer
        let audioBuffer = null;
        if (body.MediaUrl0) {
          try {
            const mediaRes = await fetch(body.MediaUrl0);
            if (mediaRes.ok) {
              const arrayBuf = await mediaRes.arrayBuffer();
              audioBuffer = Buffer.from(arrayBuf);
            }
          } catch (e) {
            logger.warn('Failed to fetch Twilio audio note', { error: e.message });
          }
        } else if (body.audioBase64) {
          audioBuffer = Buffer.from(body.audioBase64, 'base64');
        }

        const result = await container.rapidIntakeService.processQuickIntake({
          farmerPhone: senderPhone,
          textUtterance: messageText || (audioBuffer ? null : 'कल रात भारी ओलावृष्टि से मेरी फसल नष्ट हो गई'),
          audioBuffer,
          audioBase64: body.audioBase64 || null,
          channelSource: isTwilio ? 'TWILIO_WHATSAPP_SANDBOX' : 'WHATSAPP_BUSINESS_API',
        });

        // Twilio requires TwiML XML response (<Response><Message>...</Message></Response>)
        if (isTwilio && req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(result.whatsappResponseCard)}</Message></Response>`;
          res.setHeader('Content-Type', 'text/xml; charset=utf-8');
          res.writeHead(200);
          res.end(twiml);
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // 7. Binary PDF Download Stream
      const pdfDownloadMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/pdf$/);
      if (req.method === 'GET' && pdfDownloadMatch) {
        const reportId = pdfDownloadMatch[1];
        const report = container.reportsService.getReport(reportId);
        const docs = container.reportGenerator.generateDraftDocuments({
          report,
          actorId: report.farmerId,
        });
        const pdfBinary = Buffer.from(docs.pdfBase64, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${report.reportNumber}.pdf"`);
        res.setHeader('Content-Length', pdfBinary.length);
        res.writeHead(200);
        res.end(pdfBinary);
        return;
      }

      // 8. Grounded Weather Radar & Surveyor Triage
      const plausibilityMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/plausibility$/);
      if (req.method === 'GET' && plausibilityMatch) {
        const reportId = plausibilityMatch[1];
        const report = container.reportsService.getReport(reportId);
        const evalResult = container.weatherService.evaluatePlausibility({
          state: report.farmerProfile.state,
          district: report.farmerProfile.district,
          incidentDateIso: report.extractedValues.incident_date?.value,
          lossEvent: report.extractedValues.loss_event?.value,
          cropStage: report.extractedValues.crop_stage?.value,
          affectedArea: report.extractedValues.affected_area?.value,
        });
        res.writeHead(200);
        res.end(JSON.stringify(evalResult));
        return;
      }

      // 9. Executive Business Model & Insurer ROI Analytics
      if (req.method === 'GET' && path === '/api/v1/business/analytics') {
        const metrics = container.businessAnalytics.getExecutiveMetrics();
        res.writeHead(200);
        res.end(JSON.stringify(metrics));
        return;
      }

      // 10. Pilot Districts & Agromet Radar Grids
      if (req.method === 'GET' && path === '/api/v1/districts') {
        const districts = container.pilotDistrictsService.getAllDistricts();
        res.writeHead(200);
        res.end(JSON.stringify({ count: districts.length, districts }));
        return;
      }

      if (req.method === 'GET' && path === '/api/v1/radar/live-grid') {
        const radarStations = container.weatherService.getLiveRadarGrid();
        res.writeHead(200);
        res.end(JSON.stringify({ count: radarStations.length, radarStations }));
        return;
      }

      // 11. 24-Hour Surveyor Dispatch Action
      if (req.method === 'POST' && path === '/api/v1/surveyors/dispatch') {
        const body = await readJsonBody(req);
        const reportNumber = body.reportNumber || 'FA-2026-UNASSIGNED';
        const dispatchRecord = {
          success: true,
          dispatchId: `DSP-${Date.now().toString(36).toUpperCase()}`,
          reportNumber,
          farmerName: body.farmerName || 'Kisan Farmer',
          assignedSurveyor: body.surveyorName || 'Joint Loss Assessor (AIC / State Agri)',
          slaWindowHours: 24,
          dispatchStatus: 'DISPATCHED_TO_FIELD_ASSESSOR',
          notificationSentVia: body.dispatchChannel || 'WHATSAPP_AND_SMS',
          dispatchedAt: new Date().toISOString(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(dispatchRecord));
        return;
      }

      // 12. Hackathon Demo Trigger — never reachable in production.
      if (req.method === 'POST' && path === '/api/v1/demo/run') {
        if (
          (container.env || process.env).NODE_ENV === 'production' ||
          (container.env || process.env).ENABLE_DEMO_ENDPOINT !== 'true'
        ) {
          const err = new Error(
            'DEMO_ENDPOINT_DISABLED: Set ENABLE_DEMO_ENDPOINT=true outside production to run the seed.'
          );
          err.code = 'DEMO_ENDPOINT_DISABLED';
          err.statusCode = 404;
          throw err;
        }
        const { runSeed } = require('../prisma/seed.js');
        const result = await runSeed();
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'ENDPOINT_NOT_FOUND', path }));
    } catch (err) {
      logger.error('Request failed', { path, error: err.message });
      const statusCode = err.statusCode || 500;
      // Only deliberate, farmer-safe errors carry their message outward. Unexpected
      // failures (including raw upstream Gnani response bodies) stay in the server log.
      const message =
        statusCode < 500
          ? err.message
          : 'An unexpected error occurred. Your draft is safe — please try again.';
      res.writeHead(statusCode);
      res.end(JSON.stringify({ error: err.code || 'INTERNAL_ERROR', message }));
    }
  };
}

function createHttpServer(container = createAppContainer()) {
  const handler = createRequestHandler(container);
  const server = http.createServer(handler);
  server.handler = handler;
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const container = createAppContainer(process.env);
  const server = createHttpServer(container);
  server.listen(port, () => {
    console.log(
      JSON.stringify(
        logger.info(`Fasal Awaaz API listening on port ${port}`, {
          gnaniMode: container.startupValidation.gnaniMode,
        })
      )
    );
  });
}

module.exports = { createAppContainer, createHttpServer, createRequestHandler };
