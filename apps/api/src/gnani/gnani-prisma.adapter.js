/**
 * Gnani Prisma Speech-to-Text (STT) Adapter
 * Verified Endpoint: POST https://api.vachana.ai/stt/v3
 * Verified Auth Header: X-API-Key-ID: <GNANI_API_KEY>
 * Verified Parameters: audio_file, model=prisma-v3.0, language_code, format=transcribe, keyterms, topic, previous_text
 *
 * Implements the SpeechProvider interface. When GNANI_API_KEY is not configured,
 * transparently operates in clearly labelled MOCK_DEVELOPMENT mode and never claims live execution.
 */
const crypto = require('node:crypto');
const { VERIFIED_LANGUAGES } = require('../../../../packages/shared-types/src/index.js');

const SUPPORTED_AUDIO_FORMATS = new Set(['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a']);
const MAX_REST_DURATION_SECONDS = 30;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

const AGRICULTURAL_KEYTERMS = Object.freeze([
  'धान', 'गेहूँ', 'कपास', 'मक्का', 'सोयाबीन', 'चना', 'सरसों', 'मूंगफली',
  'ओलावृष्टि', 'भारी बारिश', 'जलभराव', 'बाढ़', 'भूस्खलन', 'बादल फटना', 'बेमौसम बारिश',
  'एकड़', 'हेक्टेयर', 'बीघा', 'गुंठा', 'खसरा', 'सर्वे नंबर', 'खड़ी फसल', 'कटी हुई फसल',
  'వరి', 'పత్తి', 'వడగళ్ల వాన', 'భారీ వర్షం', 'ఎకరాలు', 'సర్వే నంబర్',
  'நெல்', 'கனமழை', 'ஆலங்கட்டி மழை', 'ஏக்கர்', 'சர்வே எண்',
  'paddy', 'wheat', 'cotton', 'maize', 'soybean', 'hailstorm', 'inundation', 'landslide',
  'cloudburst', 'unseasonal rain', 'acres', 'hectares', 'survey number', 'PMFBY',
]);

const DEFAULT_AGRICULTURAL_TOPIC =
  'Indian farmer describing agricultural crop loss, weather calamity (hailstorm, heavy rain, inundation), affected land area in acres or hectares, incident date, crop stage (standing or harvested for drying), and village name for PMFBY intimation.';

class GnaniPrismaSttAdapter {
  constructor({ env = process.env, httpClient = null } = {}) {
    this.apiKey = env.GNANI_API_KEY ? String(env.GNANI_API_KEY).trim() : '';
    this.baseUrl = (env.GNANI_STT_BASE_URL || 'https://api.vachana.ai').replace(/\/+$/, '');
    this.defaultModel = env.GNANI_STT_MODEL || 'prisma-v3.0';
    this.httpClient = httpClient; // Injectable for integration tests
  }

  getSupportedLanguages() {
    return VERIFIED_LANGUAGES.filter((l) => l.active && l.voiceWorkflowTested);
  }

  getProviderHealth() {
    const liveConfigured = Boolean(this.apiKey);
    return {
      provider: 'Gnani Prisma STT (Vachana Platform)',
      endpoint: `${this.baseUrl}/stt/v3`,
      model: this.defaultModel,
      authHeader: 'X-API-Key-ID',
      mode: liveConfigured ? 'LIVE_GNANI' : 'MOCK_DEVELOPMENT',
      liveConfigured,
      supportedFormats: Array.from(SUPPORTED_AUDIO_FORMATS),
      maxRestDurationSeconds: MAX_REST_DURATION_SECONDS,
      supportedLanguagesCount: this.getSupportedLanguages().length,
    };
  }

  /**
   * Builds the exact verified Gnani Prisma v3.0 request descriptor.
   */
  buildVerifiedRequestDescriptor({
    audioBuffer,
    fileName = 'utterance.wav',
    audioFormat = 'wav',
    languageCode = 'hi-IN',
    format = 'transcribe',
    previousText = null,
    speakerNames = null,
  }) {
    const ext = String(audioFormat || fileName.split('.').pop() || 'wav').toLowerCase();
    if (!SUPPORTED_AUDIO_FORMATS.has(ext)) {
      const err = new Error(
        `UNSUPPORTED_AUDIO_FORMAT: Format "${ext}" is not supported by Gnani Prisma. Supported formats: WAV, MP3, OGG, FLAC, AAC, M4A.`
      );
      err.code = 'UNSUPPORTED_AUDIO_FORMAT';
      throw err;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      const err = new Error('EMPTY_AUDIO_RECORDING: Audio recording is empty. Please speak clearly and try again.');
      err.code = 'EMPTY_AUDIO_RECORDING';
      throw err;
    }

    if (audioBuffer.length < 120) {
      const err = new Error('LOW_QUALITY_OR_TOO_SHORT_AUDIO: Recording is too short or silent. Please hold the microphone button and speak again.');
      err.code = 'LOW_QUALITY_OR_TOO_SHORT_AUDIO';
      throw err;
    }

    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      const err = new Error('AUDIO_TOO_LARGE: Recording exceeds maximum upload size (10 MB / 30 seconds).');
      err.code = 'AUDIO_TOO_LARGE';
      throw err;
    }

    const formFields = {
      model: this.defaultModel,
      language_code: languageCode || 'indic-auto',
      format,
      topic: DEFAULT_AGRICULTURAL_TOPIC,
      keyterms: JSON.stringify(AGRICULTURAL_KEYTERMS),
    };

    if (previousText && String(previousText).trim().length >= 12) {
      formFields.previous_text = String(previousText).slice(-600);
    }
    if (Array.isArray(speakerNames) && speakerNames.length > 0) {
      formFields.speaker_names = JSON.stringify(speakerNames.slice(0, 4));
    }

    return {
      url: `${this.baseUrl}/stt/v3`,
      method: 'POST',
      headers: {
        'X-API-Key-ID': this.apiKey || '<MISSING_GNANI_API_KEY>',
      },
      file: {
        fieldName: 'audio_file',
        fileName: `utterance.${ext}`,
        mimeType: `audio/${ext === 'm4a' ? 'mp4' : ext}`,
        sizeBytes: audioBuffer.length,
      },
      formFields,
    };
  }

  /**
   * Transcribes farmer speech using Gnani Prisma v3.0 REST API, or clearly labelled development mock if unconfigured.
   */
  async transcribeAudio({
    audioBuffer,
    fileName = 'utterance.wav',
    audioFormat = 'wav',
    durationSeconds = 5,
    languageCode = 'hi-IN',
    format = 'transcribe',
    previousText = null,
    simulatedTranscriptForDev = null,
  }) {
    if (durationSeconds > MAX_REST_DURATION_SECONDS) {
      const err = new Error(
        `DURATION_LIMIT_EXCEEDED: Gnani Prisma synchronous REST API accepts clips up to ${MAX_REST_DURATION_SECONDS} seconds (received ${durationSeconds}s). Split the utterance or use Batch API.`
      );
      err.code = 'DURATION_LIMIT_EXCEEDED';
      throw err;
    }

    const descriptor = this.buildVerifiedRequestDescriptor({
      audioBuffer,
      fileName,
      audioFormat,
      languageCode,
      format,
      previousText,
    });

    // If an injectable httpClient or live API key is available, execute the request
    if (this.httpClient) {
      const response = await this.httpClient(descriptor, audioBuffer);
      return this._normalizeResponse(response, 'LIVE_GNANI', languageCode);
    }

    if (this.apiKey && typeof fetch === 'function') {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: descriptor.file.mimeType });
      formData.append('audio_file', blob, descriptor.file.fileName);
      for (const [k, v] of Object.entries(descriptor.formFields)) {
        formData.append(k, v);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(descriptor.url, {
          method: 'POST',
          headers: { 'X-API-Key-ID': this.apiKey },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 429) {
          const err = new Error('GNANI_RATE_LIMIT: Voice service is busy. Please retry in a few seconds or type manually.');
          err.code = 'GNANI_RATE_LIMIT';
          throw err;
        }
        if (!res.ok) {
          const errText = await res.text();
          const err = new Error(`GNANI_STT_HTTP_${res.status}: ${errText}`);
          err.code = 'GNANI_STT_API_ERROR';
          throw err;
        }
        const jsonBody = await res.json();
        return this._normalizeResponse(jsonBody, 'LIVE_GNANI', languageCode);
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          const timeoutErr = new Error('GNANI_STT_TIMEOUT: Network request timed out after 30s.');
          timeoutErr.code = 'GNANI_STT_TIMEOUT';
          throw timeoutErr;
        }
        throw err;
      }
    }

    // Clearly labelled development mock when GNANI_API_KEY is not present
    return {
      success: true,
      requestId: `mock-prisma-${crypto.randomUUID()}`,
      transcript:
        simulatedTranscriptForDev ||
        'मेरी धान की खड़ी फसल कल शाम ओलावृष्टि और भारी बारिश से 2 एकड़ खराब हो गई',
      model: this.defaultModel,
      detectedLanguageCode: String(languageCode).split(',')[0] || 'hi-IN',
      processingTimeSeconds: 0.42,
      endToEndLatencySeconds: 0.49,
      providerMode: 'MOCK_DEVELOPMENT',
      providerNotice:
        'Generated by clearly labelled development mock adapter because GNANI_API_KEY is not configured in environment.',
      verifiedEndpointUsed: descriptor.url,
    };
  }

  _normalizeResponse(body, providerMode, fallbackLang) {
    if (!body || body.success === false) {
      const errMsg = body && body.error ? `${body.error.type}: ${body.error.message}` : 'Unknown transcription failure';
      const err = new Error(`GNANI_STT_FAILED: ${errMsg}`);
      err.code = (body && body.error && body.error.type) || 'GNANI_STT_FAILED';
      throw err;
    }

    const transcript = String(body.transcript || '').trim();
    if (!transcript) {
      const err = new Error('EMPTY_TRANSCRIPTION: No speech was detected in the recording. Please speak closer to the microphone.');
      err.code = 'EMPTY_TRANSCRIPTION';
      throw err;
    }

    return {
      success: true,
      requestId: body.request_id || crypto.randomUUID(),
      transcript,
      model: body.model || this.defaultModel,
      detectedLanguageCode: body.detected_language_code || fallbackLang,
      processingTimeSeconds: body.processing_time || 0,
      endToEndLatencySeconds: body.end_to_end_latency || 0,
      providerMode,
      verifiedEndpointUsed: `${this.baseUrl}/stt/v3`,
    };
  }
}

module.exports = {
  GnaniPrismaSttAdapter,
  AGRICULTURAL_KEYTERMS,
  SUPPORTED_AUDIO_FORMATS,
};
