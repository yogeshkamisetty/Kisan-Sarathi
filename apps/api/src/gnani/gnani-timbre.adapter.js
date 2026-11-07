/**
 * Gnani Timbre Text-to-Speech (TTS) Adapter
 * Verified Endpoint: POST https://api.vachana.ai/api/v1/tts/inference
 * Verified Auth Header: X-API-Key-ID: <GNANI_API_KEY>
 * Verified Models: timbre-v2.5 (42 voices, recommended) and timbre-v3.0 (13 multilingual voices)
 *
 * Includes spoken-number normalization per Gnani TTS documentation ("Pass numbers, dates,
 * and currency as spoken words to avoid mispronunciations") and always returns a readable
 * text fallback alongside audio.
 */
const crypto = require('node:crypto');
const { VERIFIED_LANGUAGES } = require('../../../../packages/shared-types/src/index.js');

const { normalizeHindiNumbersInText } = require('./hindi-number-words.js');

class GnaniTimbreTtsAdapter {
  constructor({ env = process.env, httpClient = null } = {}) {
    this.apiKey = env.GNANI_API_KEY ? String(env.GNANI_API_KEY).trim() : '';
    this.baseUrl = (env.GNANI_TTS_BASE_URL || 'https://api.vachana.ai').replace(/\/+$/, '');
    this.defaultModel = env.GNANI_TTS_MODEL || 'timbre-v2.5';
    this.httpClient = httpClient;
  }

  getSupportedVoices() {
    return VERIFIED_LANGUAGES.map((lang) => ({
      languageCode: lang.code,
      languageName: lang.nameEnglish,
      model: this.defaultModel,
      voice: lang.defaultVoice,
      v3MultilingualVoice: lang.fallbackVoiceV3,
    }));
  }

  getProviderHealth() {
    const liveConfigured = Boolean(this.apiKey);
    return {
      provider: 'Gnani Timbre TTS (Vachana Platform)',
      endpoint: `${this.baseUrl}/api/v1/tts/inference`,
      model: this.defaultModel,
      authHeader: 'X-API-Key-ID',
      mode: liveConfigured ? 'LIVE_GNANI' : 'MOCK_DEVELOPMENT',
      liveConfigured,
      supportedVoices: this.getSupportedVoices(),
    };
  }

  /**
   * Normalizes numbers for clearer TTS pronunciation while preserving exact original text for UI display.
   */
  normalizeTextForSpeech(text, languageCode = 'hi-IN') {
    const normalized = String(text || '').trim();
    // Only Hindi has a verified spoken-number table here. For the other languages the
    // digits are left as-is: Timbre reads digits in-language acceptably, whereas an
    // unverified transliteration would be read out wrongly with full confidence.
    if (languageCode.startsWith('hi')) {
      return normalizeHindiNumbersInText(normalized);
    }
    return normalized;
  }

  buildVerifiedRequestPayload({
    text,
    languageCode = 'hi-IN',
    voice = null,
    model = null,
    speed = 0.95,
    sampleRate = 24000,
    container = 'wav',
  }) {
    if (!text || String(text).trim().length === 0) {
      throw new Error('EMPTY_TTS_TEXT: Cannot synthesize empty text.');
    }

    const clampedSpeed = Math.min(1.15, Math.max(0.85, Number(speed) || 1.0));
    const langEntry =
      VERIFIED_LANGUAGES.find((l) => l.code === languageCode) || VERIFIED_LANGUAGES[0];
    const selectedModel = model || this.defaultModel;
    const selectedVoice =
      voice || (selectedModel === 'timbre-v3.0' ? langEntry.fallbackVoiceV3 : langEntry.defaultVoice);

    return {
      url: `${this.baseUrl}/api/v1/tts/inference`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': this.apiKey || '<MISSING_GNANI_API_KEY>',
      },
      body: {
        text: this.normalizeTextForSpeech(text, languageCode),
        voice: selectedVoice,
        model: selectedModel,
        language: langEntry.code,
        speed: clampedSpeed,
        audio_config: {
          sample_rate: sampleRate,
          num_channels: 1,
          sample_width: 2,
          encoding: 'linear_pcm',
          container,
        },
      },
    };
  }

  async synthesizeSpeech({
    text,
    languageCode = 'hi-IN',
    voice = null,
    speed = 0.95,
  }) {
    const requestSpec = this.buildVerifiedRequestPayload({
      text,
      languageCode,
      voice,
      speed,
    });

    if (this.httpClient) {
      const audioBuffer = await this.httpClient(requestSpec);
      return {
        success: true,
        audioBase64: Buffer.from(audioBuffer).toString('base64'),
        mimeType: 'audio/wav',
        readableTextFallback: text,
        spokenNormalizedText: requestSpec.body.text,
        voiceUsed: requestSpec.body.voice,
        modelUsed: requestSpec.body.model,
        languageCode: requestSpec.body.language,
        providerMode: 'LIVE_GNANI',
      };
    }

    if (this.apiKey && typeof fetch === 'function') {
      try {
        const res = await fetch(requestSpec.url, {
          method: 'POST',
          headers: requestSpec.headers,
          body: JSON.stringify(requestSpec.body),
        });
        if (!res.ok) {
          throw new Error(`GNANI_TTS_HTTP_${res.status}`);
        }
        const arrayBuf = await res.arrayBuffer();
        return {
          success: true,
          audioBase64: Buffer.from(arrayBuf).toString('base64'),
          mimeType: 'audio/wav',
          readableTextFallback: text,
          spokenNormalizedText: requestSpec.body.text,
          voiceUsed: requestSpec.body.voice,
          modelUsed: requestSpec.body.model,
          languageCode: requestSpec.body.language,
          providerMode: 'LIVE_GNANI',
        };
      } catch (err) {
        // Graceful text fallback so the farmer is never blocked by a TTS outage
        return {
          success: false,
          audioBase64: null,
          mimeType: null,
          readableTextFallback: text,
          spokenNormalizedText: requestSpec.body.text,
          voiceUsed: requestSpec.body.voice,
          modelUsed: requestSpec.body.model,
          languageCode: requestSpec.body.language,
          providerMode: 'TEXT_FALLBACK_ON_ERROR',
          errorReason: err.message,
        };
      }
    }

    // Generate a minimal valid RIFF WAV header for mock audio playback testing
    const mockWavBuffer = this._createSilentWavHeader(24000, 1);
    return {
      success: true,
      requestId: `mock-timbre-${crypto.randomUUID()}`,
      audioBase64: mockWavBuffer.toString('base64'),
      mimeType: 'audio/wav',
      readableTextFallback: text,
      spokenNormalizedText: requestSpec.body.text,
      voiceUsed: requestSpec.body.voice,
      modelUsed: requestSpec.body.model,
      languageCode: requestSpec.body.language,
      providerMode: 'MOCK_DEVELOPMENT',
      providerNotice:
        'Generated by clearly labelled development mock adapter because GNANI_API_KEY is not configured.',
      verifiedEndpointUsed: requestSpec.url,
    };
  }

  _createSilentWavHeader(sampleRate = 24000, durationSeconds = 1) {
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * 2;
    const buf = Buffer.alloc(44 + 64); // compact valid WAV header + sample frame
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + 64, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // Mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(64, 40);
    return buf;
  }
}

module.exports = { GnaniTimbreTtsAdapter };
