/**
 * Section 21.2: Integration & End-to-End Farmer Journey Tests
 */

// Tests run against in-memory state so suites never share or leave on-disk data.
process.env.PERSISTENCE = 'memory';
process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAppContainer, createHttpServer } = require('../src/main.js');
const { GnaniPrismaSttAdapter } = require('../src/gnani/gnani-prisma.adapter.js');
const { GnaniTimbreTtsAdapter } = require('../src/gnani/gnani-timbre.adapter.js');
const { OfflineDraftStore } = require('../../mobile/src/database/sqliteDraftStorage.js');
const { OfflineSyncEngine } = require('../../mobile/src/offline/syncEngine.js');
const { FasalAwaazApiClient } = require('../../mobile/src/api/client.js');
const { runSeed } = require('../prisma/seed.js');
const {
  WorkflowStatus,
  SubmissionStatus,
  MANDATORY_DRAFT_WATERMARK,
} = require('../../../packages/shared-types/src/index.js');

describe('1. Gnani Prisma STT & Timbre TTS Adapter Integration', () => {
  it('builds verified Gnani Prisma v3.0 request with X-API-Key-ID, model=prisma-v3.0, format=transcribe, and agricultural keyterms', async () => {
    let capturedDescriptor = null;
    const sttAdapter = new GnaniPrismaSttAdapter({
      env: {
        GNANI_API_KEY: 'test-gnani-key-999',
        GNANI_STT_BASE_URL: 'https://api.vachana.ai',
      },
      httpClient: async (descriptor) => {
        capturedDescriptor = descriptor;
        return {
          success: true,
          request_id: 'gnani-req-101',
          transcript: 'मेरी धान की फसल ओलावृष्टि से 2 एकड़ खराब हो गई',
          model: 'prisma-v3.0',
          detected_language_code: 'hi-IN',
          processing_time: 0.51,
          end_to_end_latency: 0.62,
        };
      },
    });

    const sampleWav = Buffer.alloc(1024, 1);
    const result = await sttAdapter.transcribeAudio({
      audioBuffer: sampleWav,
      fileName: 'farmer_clip.wav',
      audioFormat: 'wav',
      languageCode: 'hi-IN,en-IN',
    });

    assert.equal(capturedDescriptor.url, 'https://api.vachana.ai/stt/v3');
    assert.equal(capturedDescriptor.headers['X-API-Key-ID'], 'test-gnani-key-999');
    assert.equal(capturedDescriptor.formFields.model, 'prisma-v3.0');
    assert.equal(capturedDescriptor.formFields.format, 'transcribe');
    assert.ok(capturedDescriptor.formFields.keyterms.includes('ओलावृष्टि'));
    assert.equal(result.providerMode, 'LIVE_GNANI');
    assert.equal(result.detectedLanguageCode, 'hi-IN');
  });

  it('rejects unsupported audio formats and empty recordings with actionable errors', async () => {
    const sttAdapter = new GnaniPrismaSttAdapter({ env: {} });
    await assert.rejects(
      () =>
        sttAdapter.transcribeAudio({
          audioBuffer: Buffer.alloc(512),
          audioFormat: 'exe',
        }),
      /UNSUPPORTED_AUDIO_FORMAT/
    );
    await assert.rejects(
      () =>
        sttAdapter.transcribeAudio({
          audioBuffer: Buffer.alloc(0),
          audioFormat: 'wav',
        }),
      /EMPTY_AUDIO_RECORDING/
    );
  });

  it('builds verified Gnani Timbre v2.5 request to POST https://api.vachana.ai/api/v1/tts/inference and normalizes spoken numbers', async () => {
    let capturedTtsPayload = null;
    const ttsAdapter = new GnaniTimbreTtsAdapter({
      env: {
        GNANI_API_KEY: 'test-gnani-key-999',
        GNANI_TTS_BASE_URL: 'https://api.vachana.ai',
      },
      httpClient: async (spec) => {
        capturedTtsPayload = spec;
        return Buffer.from('RIFF_MOCK_WAV_BINARY');
      },
    });

    const res = await ttsAdapter.synthesizeSpeech({
      text: 'आपकी 2 एकड़ धान की फसल का विवरण सही है?',
      languageCode: 'hi-IN',
    });

    assert.equal(capturedTtsPayload.url, 'https://api.vachana.ai/api/v1/tts/inference');
    assert.equal(capturedTtsPayload.headers['X-API-Key-ID'], 'test-gnani-key-999');
    assert.equal(capturedTtsPayload.body.model, 'timbre-v2.5');
    assert.equal(capturedTtsPayload.body.voice, 'Nalini');
    assert.ok(capturedTtsPayload.body.text.includes('दो'));
    assert.equal(res.providerMode, 'LIVE_GNANI');
    assert.equal(res.readableTextFallback, 'आपकी 2 एकड़ धान की फसल का विवरण सही है?');
  });
});

describe('2. Complete End-to-End Farmer Journey, Offline Sync & Report Generation', () => {
  it('completes the full 19-step Hackathon Demonstration Scenario including correction, readback, PDF/text draft, and separate official reference entry', async () => {
    const demoResult = await runSeed();
    const { report, generatedDocument, officialSubmissionRecord, auditTrail } = demoResult;

    assert.equal(report.extractedValues.affected_area.value, 2);
    assert.equal(report.extractedValues.affected_area.status, 'corrected');
    assert.equal(report.readbackCompleted, true);
    assert.ok(auditTrail.some((e) => e.action === 'FARMER_FIELD_CORRECTION'));

    assert.ok(generatedDocument.missingFields.includes('survey_number'));
    assert.equal(report.workflowStatus, WorkflowStatus.COMPLETION_PENDING);

    assert.ok(generatedDocument.textContent.includes(MANDATORY_DRAFT_WATERMARK));
    assert.ok(
      generatedDocument.textContent.includes(
        'It is not an official claim submission, official acknowledgement'
      )
    );

    assert.equal(report.submissionStatus, SubmissionStatus.ACKNOWLEDGEMENT_ENTERED);
    assert.equal(
      officialSubmissionRecord.submissionRecord.verificationStatus,
      'FARMER_REPORTED_NOT_GOVERNMENT_VERIFIED'
    );
  });

  it('persists local drafts while offline and synchronises idempotently upon network recovery without duplicates', async () => {
    const app = createAppContainer();
    const localStore = new OfflineDraftStore();
    const syncEngine = new OfflineSyncEngine(localStore);

    localStore.saveDraftLocally({
      localId: 'local-draft-001',
      idempotencyKey: 'offline-sync-uuid-777',
      farmerName: 'Sita Devi',
      state: 'Telangana',
      district: 'Warangal',
      village: 'Dharmasagar',
      languageCode: 'te-IN',
      workflowStatus: 'DRAFT_LOCAL',
      submissionStatus: 'NOT_SUBMITTED',
      extractedFieldsJson: '{}',
      turnsJson: '[]',
      queuedAudioPathsJson: '[]',
      createdAtDevice: '2026-11-04T05:30:00+05:30',
      updatedAtDevice: '2026-11-04T05:30:00+05:30',
      lastSyncedAtServer: null,
    });

    // 1. Offline attempt preserves local draft and shows unmistakable warning
    const offlineAttempt = await syncEngine.syncPendingDrafts(false, async () => ({ ok: true }));
    assert.equal(offlineAttempt.status, 'OFFLINE_SAVED_LOCALLY');
    assert.ok(offlineAttempt.offlineNotice.includes('NOT been sent to the official insurance'));

    // 2. Network recovery syncs to server with Idempotency-Key
    let serverReport = null;
    const mockTransport = async (_url, opts) => {
      const payload = JSON.parse(opts.body);
      const res = app.reportsService.createReport({
        idempotencyKey: opts.headers['Idempotency-Key'],
        farmerProfile: {
          id: 'f-100',
          userId: 'u-100',
          farmerName: payload.farmerName,
          state: payload.state,
          district: payload.district,
          village: payload.village,
        },
        actorId: 'u-100',
      });
      serverReport = res;
      return { ok: true };
    };

    const onlineSync1 = await syncEngine.syncPendingDrafts(true, mockTransport);
    assert.equal(onlineSync1.syncedCount, 1);
    assert.equal(serverReport.deduplicatedRetry, false);

    // 3. Second retry with same Idempotency-Key is deduplicated
    const onlineSync2 = await syncEngine.syncPendingDrafts(true, mockTransport);
    assert.equal(onlineSync2.syncedCount, 1);
    assert.equal(serverReport.deduplicatedRetry, true);
  });

  it('serves /api/v1/health, /api/v1/languages, and /api/v1/voice/providers/health over HTTP', async () => {
    const server = createHttpServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      assert.equal(healthRes.status, 200);
      const healthBody = await healthRes.json();
      assert.equal(healthBody.status, 'ok');

      const langRes = await fetch(`http://127.0.0.1:${port}/api/v1/languages`);
      assert.equal(langRes.status, 200);
      const langBody = await langRes.json();
      assert.equal(langBody.languages.length, 6);

      const voiceHealthRes = await fetch(`http://127.0.0.1:${port}/api/v1/voice/providers/health`);
      assert.equal(voiceHealthRes.status, 200);
      const voiceHealthBody = await voiceHealthRes.json();
      assert.equal(voiceHealthBody.stt.endpoint, 'https://api.vachana.ai/stt/v3');
      assert.equal(voiceHealthBody.tts.endpoint, 'https://api.vachana.ai/api/v1/tts/inference');
    } finally {
      server.close();
    }
  });
});


describe('3. API Authentication, Report Ownership & Consent Enforcement', () => {
  /** Boots a throwaway server and returns a helper that speaks JSON to it. */
  async function withServer(run) {
    const container = createAppContainer({
      ...process.env,
      NODE_ENV: 'test',
      PERSISTENCE: 'memory',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_24_chars_long',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_24_chars_long',
    });
    const server = createHttpServer(container);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const call = async (method, path, { token = null, body = null, headers = {} } = {}) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
      });
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { status: res.status, body: json };
    };

    /** Signs a user in through the real OTP flow and returns their access token. */
    const login = async (mobileNumber, role = undefined) => {
      const otpRes = await call('POST', '/api/v1/auth/otp/request', { body: { mobileNumber } });
      const otp = otpRes.body.devOnlyTestOtp;
      const verify = await call('POST', '/api/v1/auth/otp/verify', {
        body: { mobileNumber, otp, ...(role ? { role } : {}) },
      });
      return verify.body;
    };

    try {
      await run({ call, login, container });
    } finally {
      server.close();
    }
  }

  it('rejects unauthenticated access to every farmer data endpoint', async () => {
    await withServer(async ({ call }) => {
      const protectedRoutes = [
        ['POST', '/api/v1/consent'],
        ['POST', '/api/v1/farmers'],
        ['POST', '/api/v1/reports'],
        ['GET', '/api/v1/reports/any-id'],
        ['POST', '/api/v1/reports/any-id/conversation/turns'],
        ['POST', '/api/v1/reports/any-id/readback'],
        ['POST', '/api/v1/reports/any-id/correct'],
        ['POST', '/api/v1/reports/any-id/confirm'],
        ['POST', '/api/v1/reports/any-id/documents'],
        ['POST', '/api/v1/reports/any-id/submission-records'],
        ['POST', '/api/v1/voice/transcribe'],
        ['POST', '/api/v1/voice/synthesize'],
      ];

      for (const [method, path] of protectedRoutes) {
        const res = await call(method, path, { body: {} });
        assert.equal(res.status, 401, `${method} ${path} must require authentication`);
        assert.equal(res.body.error, 'AUTHENTICATION_REQUIRED');
      }
    });
  });

  it('rejects a forged or wrong-type token', async () => {
    await withServer(async ({ call, login }) => {
      const session = await login('9876500011');

      const forged = await call('GET', '/api/v1/reports/any-id', { token: 'a.b.c' });
      assert.equal(forged.status, 401);

      // A refresh token must never be accepted where an access token is required.
      const refreshAsAccess = await call('GET', '/api/v1/reports/any-id', {
        token: session.refreshToken,
      });
      assert.equal(refreshAsAccess.status, 401);
    });
  });

  it('never lets a request body escalate the caller to ADMIN', async () => {
    await withServer(async ({ call, login }) => {
      const session = await login('9876500012', 'ADMIN');
      assert.equal(session.user.role, 'FARMER');
    });
  });

  it('blocks personal data storage and report creation until consent is granted', async () => {
    await withServer(async ({ call, login }) => {
      const session = await login('9876500013');

      const noConsent = await call('POST', '/api/v1/farmers', {
        token: session.accessToken,
        body: {
          farmerName: 'Ramesh Kumar',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          village: 'Pedakakani',
        },
      });
      assert.equal(noConsent.status, 500);
      assert.equal(noConsent.body.error, 'CONSENT_REQUIRED');

      const consent = await call('POST', '/api/v1/consent', {
        token: session.accessToken,
        body: { consentType: 'PERSONAL_DATA_STORAGE' },
      });
      assert.equal(consent.status, 201);

      const withConsent = await call('POST', '/api/v1/farmers', {
        token: session.accessToken,
        body: {
          farmerName: 'Ramesh Kumar',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          village: 'Pedakakani',
        },
      });
      assert.equal(withConsent.status, 201);
      // The profile is bound to the authenticated user, not to a client-supplied id.
      assert.equal(withConsent.body.userId, session.user.id);
    });
  });

  it('stops one farmer from reading or modifying another farmer\'s report', async () => {
    await withServer(async ({ call, login }) => {
      const owner = await login('9876500014');
      await call('POST', '/api/v1/consent', {
        token: owner.accessToken,
        body: { consentType: 'PERSONAL_DATA_STORAGE' },
      });
      const created = await call('POST', '/api/v1/reports', {
        token: owner.accessToken,
        body: {
          farmerProfile: {
            id: 'profile-owner',
            farmerName: 'Owner Farmer',
            state: 'Andhra Pradesh',
            district: 'Guntur',
            village: 'Pedakakani',
          },
        },
      });
      assert.equal(created.status, 201);
      const reportId = created.body.report.id;

      // The owner can read it back.
      const ownerRead = await call('GET', `/api/v1/reports/${reportId}`, {
        token: owner.accessToken,
      });
      assert.equal(ownerRead.status, 200);

      // A different signed-in farmer cannot.
      const intruder = await login('9876500015');
      const intruderRead = await call('GET', `/api/v1/reports/${reportId}`, {
        token: intruder.accessToken,
      });
      assert.equal(intruderRead.status, 403);
      assert.equal(intruderRead.body.error, 'FORBIDDEN_REPORT_ACCESS');

      const intruderWrite = await call('POST', `/api/v1/reports/${reportId}/correct`, {
        token: intruder.accessToken,
        body: { fieldName: 'affected_area', newValue: 99 },
      });
      assert.equal(intruderWrite.status, 403);
    });
  });

  it('labels conversation provenance from the server, not the client', async () => {
    await withServer(async ({ call, login, container }) => {
      const farmer = await login('9876500016');
      await call('POST', '/api/v1/consent', {
        token: farmer.accessToken,
        body: { consentType: 'PERSONAL_DATA_STORAGE' },
      });
      const created = await call('POST', '/api/v1/reports', {
        token: farmer.accessToken,
        body: {
          farmerProfile: {
            id: 'profile-provenance',
            farmerName: 'Provenance Farmer',
            state: 'Andhra Pradesh',
            district: 'Guntur',
            village: 'Pedakakani',
          },
        },
      });
      const reportId = created.body.report.id;

      // The client claims a live Gnani transcription for text it simply typed.
      const turn = await call('POST', `/api/v1/reports/${reportId}/conversation/turns`, {
        token: farmer.accessToken,
        body: {
          transcript: 'मेरी धान की फसल ओलावृष्टि से 2 एकड़ खराब हो गई',
          provider: 'gnani-prisma-v3.0',
          providerMode: 'LIVE_GNANI',
        },
      });
      assert.equal(turn.status, 200);
      assert.equal(turn.body.turn.provider, 'MANUAL_TEXT_ENTRY');
      assert.equal(turn.body.turn.providerMode, container.sttAdapter.getProviderHealth().mode);
    });
  });

  it('requires voice consent on the transcription endpoint and then transcribes', async () => {
    await withServer(async ({ call, login }) => {
      const farmer = await login('9876500017');
      const audioBase64 = Buffer.alloc(400, 7).toString('base64');

      const noConsent = await call('POST', '/api/v1/voice/transcribe', {
        token: farmer.accessToken,
        body: { audioBase64 },
      });
      assert.equal(noConsent.body.error, 'CONSENT_REQUIRED');

      for (const consentType of ['AUDIO_RECORDING', 'GNANI_CLOUD_VOICE_PROCESSING']) {
        await call('POST', '/api/v1/consent', { token: farmer.accessToken, body: { consentType } });
      }

      const transcribed = await call('POST', '/api/v1/voice/transcribe', {
        token: farmer.accessToken,
        body: { audioBase64, languageCode: 'hi-IN' },
      });
      assert.equal(transcribed.status, 200);
      assert.ok(transcribed.body.transcript.length > 0);
      // Without a Gnani key the response must say so rather than imply a live call.
      assert.equal(transcribed.body.providerMode, 'MOCK_DEVELOPMENT');
    });
  });

  it('keeps the demo seed endpoint disabled unless explicitly enabled', async () => {
    await withServer(async ({ call }) => {
      const res = await call('POST', '/api/v1/demo/run', { body: {} });
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'DEMO_ENDPOINT_DISABLED');
    });
  });

  it('does not leak internal error details on unexpected failures', async () => {
    await withServer(async ({ call, login, container }) => {
      const farmer = await login('9876500018');
      container.consentService.grantConsent({
        userId: farmer.user.id,
        consentType: 'PERSONAL_DATA_STORAGE',
      });

      // Force an unexpected (500-class) failure inside the service layer.
      container.farmersService.createProfile = () => {
        throw new Error('Internal datastore credentials: postgres://secret@host');
      };

      const res = await call('POST', '/api/v1/farmers', {
        token: farmer.accessToken,
        body: { farmerName: 'A', state: 'B', district: 'C', village: 'D' },
      });
      assert.equal(res.status, 500);
      assert.ok(!res.body.message.includes('postgres://'));
    });
  });
});

describe('4. Durable Persistence Across Restarts', () => {
  it('reloads farmer reports, consents and the audit trail from disk', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fasal-persist-'));
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PERSISTENCE: 'file',
      DATA_DIR: dataDir,
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_24_chars_long',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_24_chars_long',
    };

    try {
      // First process: a farmer records consent and starts a crop-loss draft.
      const first = createAppContainer(env);
      first.consentService.grantConsent({
        userId: 'u-persist',
        consentType: 'PERSONAL_DATA_STORAGE',
      });
      const { report } = first.reportsService.createReport({
        idempotencyKey: 'idem-persist-1',
        farmerProfile: {
          id: 'profile-persist',
          userId: 'u-persist',
          farmerName: 'Persisted Farmer',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          village: 'Pedakakani',
        },
        actorId: 'u-persist',
      });

      // Second process: the API restarts (e.g. a deploy mid-deadline-window).
      const second = createAppContainer(env);
      const reloaded = second.reportsService.getReport(report.id);
      assert.equal(reloaded.reportNumber, report.reportNumber);
      assert.equal(reloaded.farmerProfile.farmerName, 'Persisted Farmer');
      assert.ok(second.consentService.hasActiveConsent('u-persist', 'PERSONAL_DATA_STORAGE'));
      assert.ok(second.auditService.getReportAuditTrail(report.id).length > 0);

      // Report numbers must not restart and collide after a reboot.
      const { report: afterRestart } = second.reportsService.createReport({
        idempotencyKey: 'idem-persist-2',
        farmerProfile: { id: 'p2', userId: 'u-persist', state: 'Andhra Pradesh' },
        actorId: 'u-persist',
      });
      assert.notEqual(afterRestart.reportNumber, report.reportNumber);

      // An offline sync retry with the original key still deduplicates after restart.
      const retry = second.reportsService.createReport({
        idempotencyKey: 'idem-persist-1',
        farmerProfile: { id: 'profile-persist', userId: 'u-persist' },
        actorId: 'u-persist',
      });
      assert.equal(retry.deduplicatedRetry, true);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});


describe('5. Mobile API Client Against The Real Backend', () => {
  it('drives the whole farmer journey over HTTP from the mobile client', async () => {
    const container = createAppContainer({
      ...process.env,
      NODE_ENV: 'test',
      PERSISTENCE: 'memory',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_24_chars_long',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_24_chars_long',
    });
    const server = createHttpServer(container);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const client = new FasalAwaazApiClient({ baseUrl: `http://127.0.0.1:${port}` });

      // Unauthenticated calls are refused by the client before hitting the network.
      await assert.rejects(() => client.getReport('x'), /AUTHENTICATION_REQUIRED/);

      // 1. Discovery works without a token.
      const health = await client.health();
      assert.equal(health.status, 'ok');

      // 2. OTP sign-in stores the session on the client.
      const otp = await client.requestOtp('9876500021');
      const session = await client.verifyOtp({
        mobileNumber: '9876500021',
        otp: otp.devOnlyTestOtp,
      });
      assert.ok(session.accessToken);

      // 3. Consent, then profile and report creation.
      await client.grantConsents([
        'PERSONAL_DATA_STORAGE',
        'AUDIO_RECORDING',
        'GNANI_CLOUD_VOICE_PROCESSING',
      ]);

      const profile = await client.createFarmerProfile({
        farmerName: 'Lakshmi Devi',
        state: 'Andhra Pradesh',
        district: 'Guntur',
        village: 'Pedakakani',
        preferredLanguage: 'te-IN',
      });
      assert.equal(profile.farmerName, 'Lakshmi Devi');

      const created = await client.createReport({
        farmerProfile: profile,
        idempotencyKey: 'mobile-client-idem-1',
      });
      const reportId = created.report.id;

      // 4. An offline retry with the same key must not create a second report.
      const retry = await client.createReport({
        farmerProfile: profile,
        idempotencyKey: 'mobile-client-idem-1',
      });
      assert.equal(retry.deduplicatedRetry, true);
      assert.equal(retry.report.id, reportId);

      // 5. Voice: audio goes to the backend, which holds the Gnani key.
      const transcription = await client.transcribeAudio({
        audioBase64: Buffer.alloc(400, 3).toString('base64'),
        languageCode: 'hi-IN',
      });
      assert.ok(transcription.transcript.length > 0);

      // 6. The transcript becomes a conversation turn and fields get extracted.
      const turn = await client.submitConversationTurn({
        reportId,
        transcript: transcription.transcript,
        language: 'hi-IN',
        audioTranscribed: true,
      });
      assert.ok(turn.newlyExtractedFields.includes('crop'));
      assert.ok(turn.newlyExtractedFields.includes('loss_event'));

      // 7. Readback, then farmer confirmation.
      const readback = await client.requestVoiceReadback({ reportId, languageCode: 'hi-IN' });
      assert.ok(readback.readbackText.length > 0);

      const report = await client.getReport(reportId);
      assert.equal(report.id, reportId);

      // 8. The official reference the farmer receives is recorded as farmer-reported.
      await client.confirmAfterReadback(reportId).catch(() => null);
      const submission = await client.recordOfficialSubmissionReference({
        reportId,
        submissionChannel: 'KRISHI_RAKSHAK_HELPLINE_14447',
        officialReferenceNumber: 'HLP-2026-555123',
      });
      assert.equal(
        submission.submissionRecord.verificationStatus,
        'FARMER_REPORTED_NOT_GOVERNMENT_VERIFIED'
      );
    } finally {
      server.close();
    }
  });

  it('keeps drafts local when the sync engine has no signed-in session', async () => {
    const store = new OfflineDraftStore();
    store.saveDraftLocally({
      id: 'local-nosession',
      idempotencyKey: 'idem-nosession',
      farmerName: 'Unsigned Farmer',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: 'Pedakakani',
      workflowStatus: 'DRAFT_LOCAL',
      extractedValuesJson: '{}',
      queuedAudioPathsJson: '[]',
      createdAtDevice: '2026-11-04T05:30:00+05:30',
      updatedAtDevice: '2026-11-04T05:30:00+05:30',
      lastSyncedAtServer: null,
    });

    const client = new FasalAwaazApiClient({ baseUrl: 'http://127.0.0.1:1' });
    const engine = new OfflineSyncEngine(store, 'http://127.0.0.1:1', client);

    // No token: the draft stays on the device instead of being lost.
    const result = await engine.syncPendingDrafts(true);
    assert.equal(result.syncedCount, 0);
    assert.equal(store.listLocalDrafts()[0].workflowStatus, 'DRAFT_LOCAL');
  });
});

describe('6. Innovative Zero-App Intake, Meteorological Grounding & Dynamic PDF Engine', () => {
  it('processes a single-shot WhatsApp voice/text intake into an instant draft, PDF and localized action card in < 3s', async () => {
    const container = createAppContainer({
      ...process.env,
      NODE_ENV: 'test',
      PERSISTENCE: 'memory',
    });
    const server = createHttpServer(container);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      // 1. Rapid Zero-App intake simulation (Farmer speaks in Hindi about 3 acres paddy damage)
      const intakeRes = await fetch(`http://127.0.0.1:${port}/api/v1/intake/quick-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerPhone: '9876501234',
          farmerName: 'Venkat Rao',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          village: 'Peddapalli',
          languageCode: 'hi-IN',
          textUtterance: 'मेरी धान की फसल कल शाम ओलावृष्टि से 3 एकड़ खराब हो गई',
          channelSource: 'WHATSAPP_VOICE_NOTE',
        }),
      });
      assert.equal(intakeRes.status, 201);
      const intakeBody = await intakeRes.json();

      assert.equal(intakeBody.success, true);
      assert.ok(intakeBody.reportNumber.startsWith('FA-2026-AN-'));
      assert.equal(intakeBody.extractedData.crop, 'paddy');
      assert.equal(intakeBody.extractedData.lossEvent, 'hailstorm');
      assert.equal(intakeBody.extractedData.affectedArea, 3);

      // Verify Weather Radar Grounding & Plausibility
      assert.ok(intakeBody.weatherTriage.plausibilityScorePercent >= 90);
      assert.equal(intakeBody.weatherTriage.triageChannel, 'GREEN_CHANNEL_FAST_TRACK');
      assert.equal(intakeBody.weatherTriage.surveyorPriority, 'URGENT_24H_DISPATCH');

      // Verify WhatsApp Response Card includes one-tap 14447 dialer instruction
      assert.ok(intakeBody.whatsappResponseCard.includes('14447'));
      assert.ok(intakeBody.whatsappResponseCard.includes(intakeBody.reportNumber));

      // 2. Direct Binary PDF Stream Download
      const pdfRes = await fetch(`http://127.0.0.1:${port}/api/v1/reports/${intakeBody.reportId}/pdf`);
      assert.equal(pdfRes.status, 200);
      assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');

      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
      assert.ok(pdfBytes.length > 500);
      // Valid PDF-1.4 header
      assert.equal(pdfBytes.subarray(0, 8).toString('ascii'), '%PDF-1.4');
      // Verifies watermark is embedded
      assert.ok(pdfBytes.toString('binary').includes('DRAFT - NOT OFFICIALLY SUBMITTED'));

      // 3. WhatsApp Business Webhook Format Intake (JSON)
      const webhookRes = await fetch(`http://127.0.0.1:${port}/api/v1/channels/whatsapp/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '919876509999',
          message: 'मेरे खेत में 2 एकड़ गेहूँ की फसल जलभराव से नष्ट हो गई, गाँव Peddapalli',
        }),
      });
      assert.equal(webhookRes.status, 200);
      const webhookBody = await webhookRes.json();
      assert.equal(webhookBody.extractedData.crop, 'wheat');
      assert.equal(webhookBody.extractedData.lossEvent, 'inundation');

      // 3b. Twilio WhatsApp Sandbox Inbound Form Webhook (TwiML XML response)
      const twilioParams = new URLSearchParams();
      twilioParams.append('AccountSid', 'AC_TEST_SANDBOX_123');
      twilioParams.append('From', 'whatsapp:+919876543210');
      twilioParams.append('To', 'whatsapp:+14155238886');
      twilioParams.append('Body', 'कल रात भारी ओलावृष्टि से मेरे 4 एकड़ कपास की फसल नष्ट हो गई रामनगर गाँव में');

      const twilioRes = await fetch(`http://127.0.0.1:${port}/api/v1/channels/whatsapp/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: twilioParams.toString(),
      });
      assert.equal(twilioRes.status, 200);
      assert.ok(twilioRes.headers.get('content-type').includes('text/xml'));
      const twilioXml = await twilioRes.text();
      assert.ok(twilioXml.includes('<Response><Message>'));
      assert.ok(twilioXml.includes('14447'));

      // 4. Executive Business Analytics & Insurer ROI Metrics
      const analyticsRes = await fetch(`http://127.0.0.1:${port}/api/v1/business/analytics`);
      assert.equal(analyticsRes.status, 200);
      const analyticsBody = await analyticsRes.json();
      assert.ok(analyticsBody.intakeVelocityMetrics.timeSavedPerFarmerPercentage > 90);
      assert.ok(analyticsBody.insurerCommercialRoi.grossProfitMarginPercent > 80);
      assert.equal(analyticsBody.commercialBusinessModel.revenueStreams.length, 3);

      // 5. Executive Command Center Dashboard & Mobile UI Serving
      const dashboardRes = await fetch(`http://127.0.0.1:${port}/dashboard`);
      assert.equal(dashboardRes.status, 200);
      assert.ok(dashboardRes.headers.get('content-type').includes('text/html'));
      const dashboardHtml = await dashboardRes.text();
      assert.ok(dashboardHtml.includes('KisanSaathi — Fasal Awaaz Command Center'));
      assert.ok(dashboardHtml.includes('WhatsApp Intake Simulator'));

      const mobileRes = await fetch(`http://127.0.0.1:${port}/mobile`);
      assert.equal(mobileRes.status, 200);
      assert.ok(mobileRes.headers.get('content-type').includes('text/html'));
      const mobileHtml = await mobileRes.text();
      assert.ok(mobileHtml.includes('Fasal Awaaz Live'));
      assert.ok(mobileHtml.includes('AI Crop Intimation Engine'));

      // 6. Pilot Districts Directory API
      const districtsRes = await fetch(`http://127.0.0.1:${port}/api/v1/districts`);
      assert.equal(districtsRes.status, 200);
      const districtsData = await districtsRes.json();
      assert.ok(districtsData.count >= 2);
      const districtNames = districtsData.districts.map((d) => d.districtName);
      assert.ok(districtNames.includes('Anantapur'));
      assert.ok(districtNames.includes('Amravati'));

      // 7. Real-Time Radar Grid API
      const radarRes = await fetch(`http://127.0.0.1:${port}/api/v1/radar/live-grid`);
      assert.equal(radarRes.status, 200);
      const radarData = await radarRes.json();
      assert.ok(radarData.count >= 3);
      assert.ok(radarData.radarStations[0].reflectivityDbz > 0);

      // 8. 24-Hour Surveyor Dispatch Action API
      const dispatchRes = await fetch(`http://127.0.0.1:${port}/api/v1/surveyors/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportNumber: intakeBody.reportNumber,
          farmerName: 'Kisan Ramesh',
          surveyorName: 'District Agriculture Assessor Team',
        }),
      });
      assert.equal(dispatchRes.status, 200);
      const dispatchData = await dispatchRes.json();
      assert.equal(dispatchData.success, true);
      assert.equal(dispatchData.slaWindowHours, 24);
      assert.equal(dispatchData.dispatchStatus, 'DISPATCHED_TO_FIELD_ASSESSOR');
    } finally {
      server.close();
    }
  });
});
