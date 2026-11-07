/**
 * Fasal Awaaz Backend API Client (CommonJS twin of client.ts)
 *
 * Until now the mobile screens were UI-only: nothing in apps/mobile ever called the
 * backend, so no farmer voice, consent or crop-loss draft reached the server. This is
 * the single place the app talks to /api/v1, and it is responsible for:
 *   - attaching the Bearer access token the API now requires on every data endpoint
 *   - sending Idempotency-Key on report creation so offline retries never duplicate
 *   - surfacing farmer-readable error messages instead of raw HTTP failures
 *
 * The Gnani API key is NEVER held by the client; audio is posted to the backend, which
 * holds the key and decides the provider mode.
 */

const DEFAULT_TIMEOUT_MS = 30000;

/** Error carrying the API's machine-readable code alongside a farmer-facing message. */
class ApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

class FasalAwaazApiClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl Backend origin, e.g. https://api.fasalawaaz.in
   * @param {object|null} options.tokenStore Optional { getToken(), setSession(), clear() }
   * @param {Function|null} options.fetchImpl Injectable fetch (tests / older runtimes)
   */
  constructor({ baseUrl, tokenStore = null, fetchImpl = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!baseUrl) throw new Error('API_BASE_URL_REQUIRED: Configure the backend base URL.');
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.tokenStore = tokenStore;
    this.fetchImpl = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.timeoutMs = timeoutMs;
    this.accessToken = null;
    this.refreshToken = null;
  }

  setSession({ accessToken = null, refreshToken = null } = {}) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (this.tokenStore && this.tokenStore.setSession) {
      this.tokenStore.setSession({ accessToken, refreshToken });
    }
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    if (this.tokenStore && this.tokenStore.clear) this.tokenStore.clear();
  }

  async _token() {
    if (this.accessToken) return this.accessToken;
    if (this.tokenStore && this.tokenStore.getToken) {
      const stored = await this.tokenStore.getToken();
      if (stored) this.accessToken = stored;
    }
    return this.accessToken;
  }

  /**
   * Performs one JSON request. `auth: true` attaches the Bearer token.
   */
  async request(method, path, { body = null, auth = true, headers = {}, idempotencyKey = null } = {}) {
    if (!this.fetchImpl) {
      throw new ApiError('NETWORK_UNAVAILABLE: No fetch implementation available.', {
        code: 'NETWORK_UNAVAILABLE',
      });
    }

    const requestHeaders = { Accept: 'application/json', ...headers };
    if (body !== null) requestHeaders['Content-Type'] = 'application/json';
    if (idempotencyKey) requestHeaders['Idempotency-Key'] = idempotencyKey;

    if (auth) {
      const token = await this._token();
      if (!token) {
        throw new ApiError('AUTHENTICATION_REQUIRED: Please verify your mobile number again.', {
          code: 'AUTHENTICATION_REQUIRED',
          status: 401,
        });
      }
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

    let res;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        ...(body !== null ? { body: JSON.stringify(body) } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new ApiError(
          'REQUEST_TIMEOUT: The network is slow. Your draft is saved on this device — we will retry.',
          { code: 'REQUEST_TIMEOUT' }
        );
      }
      throw new ApiError(
        'NETWORK_ERROR: Could not reach the server. Your draft is saved on this device.',
        { code: 'NETWORK_ERROR' }
      );
    } finally {
      if (timer) clearTimeout(timer);
    }

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      if (res.status === 401) this.clearSession();
      throw new ApiError(
        (payload && payload.message) || `Request failed with status ${res.status}.`,
        { code: (payload && payload.error) || 'API_ERROR', status: res.status }
      );
    }

    return payload;
  }

  // ---- Discovery -----------------------------------------------------------
  health() {
    return this.request('GET', '/api/v1/health', { auth: false });
  }

  listLanguages() {
    return this.request('GET', '/api/v1/languages', { auth: false });
  }

  voiceProviderHealth() {
    return this.request('GET', '/api/v1/voice/providers/health', { auth: false });
  }

  // ---- Authentication ------------------------------------------------------
  requestOtp(mobileNumber) {
    return this.request('POST', '/api/v1/auth/otp/request', {
      auth: false,
      body: { mobileNumber },
    });
  }

  /** Verifies the OTP and stores the returned session for all later calls. */
  async verifyOtp({ mobileNumber, otp, preferredLanguage = 'hi-IN' }) {
    const session = await this.request('POST', '/api/v1/auth/otp/verify', {
      auth: false,
      body: { mobileNumber, otp, preferredLanguage },
    });
    this.setSession(session);
    return session;
  }

  // ---- Consent (DPDP) ------------------------------------------------------
  grantConsent(consentType) {
    return this.request('POST', '/api/v1/consent', { body: { consentType } });
  }

  /** Grants every consent the farmer ticked on the welcome screen. */
  async grantConsents(consentTypes) {
    const granted = [];
    for (const consentType of consentTypes) {
      granted.push(await this.grantConsent(consentType));
    }
    return granted;
  }

  // ---- Farmer profile ------------------------------------------------------
  createFarmerProfile(profile) {
    return this.request('POST', '/api/v1/farmers', { body: profile });
  }

  // ---- Reports -------------------------------------------------------------
  createReport({ farmerProfile, createdAtDevice = null, idempotencyKey }) {
    if (!idempotencyKey) {
      throw new Error('IDEMPOTENCY_KEY_REQUIRED: Offline retries must reuse one stable key.');
    }
    return this.request('POST', '/api/v1/reports', {
      idempotencyKey,
      body: { farmerProfile, createdAtDevice, idempotencyKey },
    });
  }

  getReport(reportId) {
    return this.request('GET', `/api/v1/reports/${encodeURIComponent(reportId)}`);
  }

  /**
   * Submits one farmer turn. `audioTranscribed` tells the server this text came from a
   * Gnani transcription rather than the keyboard; the server still decides the label.
   */
  submitConversationTurn({ reportId, transcript, language = 'hi-IN', audioTranscribed = false }) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/conversation/turns`, {
      body: { transcript, language, audioTranscribed },
    });
  }

  correctField({ reportId, fieldName, newValue, unit = null, reason }) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/correct`, {
      body: { fieldName, newValue, unit, reason },
    });
  }

  requestVoiceReadback({ reportId, languageCode = 'hi-IN' }) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/readback`, {
      body: { languageCode },
    });
  }

  confirmAfterReadback(reportId) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/confirm`, {
      body: {},
    });
  }

  generateDraftDocuments(reportId) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/documents`, {
      body: {},
    });
  }

  recordOfficialSubmissionReference({
    reportId,
    submissionChannel,
    officialReferenceNumber = null,
    submissionDateIso = null,
  }) {
    return this.request('POST', `/api/v1/reports/${encodeURIComponent(reportId)}/submission-records`, {
      body: { submissionChannel, officialReferenceNumber, submissionDateIso },
    });
  }

  // ---- Voice ---------------------------------------------------------------
  /**
   * Sends a recording to the backend for Gnani Prisma transcription.
   * @param {object} params
   * @param {string} params.audioBase64 Recording bytes, base64-encoded.
   */
  transcribeAudio({
    audioBase64,
    languageCode = 'hi-IN',
    audioFormat = 'wav',
    durationSeconds = 5,
    previousText = null,
  }) {
    return this.request('POST', '/api/v1/voice/transcribe', {
      body: { audioBase64, languageCode, audioFormat, durationSeconds, previousText },
    });
  }

  synthesizeSpeech({ text, languageCode = 'hi-IN' }) {
    return this.request('POST', '/api/v1/voice/synthesize', { body: { text, languageCode } });
  }
}

module.exports = { FasalAwaazApiClient, ApiError };
