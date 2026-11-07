/**
 * Authentication, OTP Provider Abstraction, and Role-Based Access Control (RBAC)
 * Development mock OTP is explicitly labelled and blocked when NODE_ENV=production.
 */
const crypto = require('node:crypto');
const { UserRole } = require('../../../../packages/shared-types/src/index.js');

/**
 * Roles a caller may ever self-assign at OTP verification time. Privileged roles
 * (CSC_OPERATOR, ADMIN) must be provisioned out of band — never from a request body.
 */
const SELF_ASSIGNABLE_ROLES = Object.freeze([UserRole.FARMER, UserRole.FAMILY_HELPER]);

class AuthService {
  constructor({ env = process.env, auditService, store = null } = {}) {
    this.env = env;
    this.auditService = auditService;
    this.store = store;

    // Secrets are never silently defaulted in production; validateStartupConfig()
    // already fails startup there. In development a per-process random secret is
    // used so a leaked hardcoded constant cannot forge tokens.
    const isProd = env.NODE_ENV === 'production';
    this.accessSecret =
      env.JWT_ACCESS_SECRET || (isProd ? null : crypto.randomBytes(32).toString('hex'));
    this.refreshSecret =
      env.JWT_REFRESH_SECRET || (isProd ? null : crypto.randomBytes(32).toString('hex'));
    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error('JWT_SECRETS_REQUIRED: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
    }

    this.otpStore = new Map();
    this.usersByMobile = new Map(Object.entries(store?.read('users') || {}));
    this.revokedTokens = new Set(store?.read('revokedTokens') || []);

    // Operator/admin provisioning: comma-separated "mobile:ROLE" pairs from env.
    this.privilegedRoles = new Map();
    for (const entry of String(env.PRIVILEGED_USERS || '').split(',')) {
      const [mobile, role] = entry.split(':').map((s) => (s || '').trim());
      if (mobile && role && Object.values(UserRole).includes(role)) {
        this.privilegedRoles.set(mobile, role);
      }
    }
  }

  _persist() {
    if (!this.store) return;
    this.store.write('users', Object.fromEntries(this.usersByMobile));
    this.store.write('revokedTokens', Array.from(this.revokedTokens));
  }

  requestOtp(mobileNumber) {
    const cleaned = String(mobileNumber || '').trim();
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      const err = new Error('INVALID_MOBILE_NUMBER: Enter a valid 10-digit Indian mobile number.');
      err.statusCode = 400;
      throw err;
    }

    const isProd = this.env.NODE_ENV === 'production';
    const devMockEnabled = this.env.ENABLE_DEV_MOCK_OTP !== 'false' && !isProd;

    if (!this.env.OTP_PROVIDER_API_KEY && !devMockEnabled) {
      throw new Error('OTP_PROVIDER_UNAVAILABLE: Real OTP provider key required in production.');
    }

    const otp = devMockEnabled ? '123456' : String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    this.otpStore.set(cleaned, { otp, expiresAt, attempts: 0 });

    return {
      mobileNumberMasked: cleaned.replace(/^(\d{3})\d{3}(\d{4})$/, '$1XXX$2'),
      expiresInSeconds: 300,
      providerMode: this.env.OTP_PROVIDER_API_KEY ? 'LIVE_SMS_GATEWAY' : 'MOCK_DEVELOPMENT_OTP',
      ...(devMockEnabled ? { devOnlyTestOtp: otp } : {}),
    };
  }

  verifyOtp({ mobileNumber, otp, role = UserRole.FARMER, preferredLanguage = 'hi-IN' }) {
    const cleaned = String(mobileNumber || '').trim();

    // Privilege escalation guard: a request body may only ever ask for an
    // unprivileged role. CSC_OPERATOR / ADMIN come from server-side provisioning.
    const requestedRole = SELF_ASSIGNABLE_ROLES.includes(role) ? role : UserRole.FARMER;
    const effectiveRole = this.privilegedRoles.get(cleaned) || requestedRole;

    const record = this.otpStore.get(cleaned);

    if (!record || Date.now() > record.expiresAt) {
      const err = new Error('OTP_EXPIRED_OR_NOT_FOUND');
      err.statusCode = 401;
      throw err;
    }

    if (record.attempts >= 5) {
      this.otpStore.delete(cleaned);
      const err = new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
      err.statusCode = 429;
      throw err;
    }

    record.attempts += 1;
    if (record.otp !== String(otp).trim()) {
      const err = new Error('INVALID_OTP');
      err.statusCode = 401;
      throw err;
    }

    this.otpStore.delete(cleaned);

    let user = this.usersByMobile.get(cleaned);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        mobileNumber: cleaned,
        role: effectiveRole,
        preferredLanguage,
        accountStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      this.usersByMobile.set(cleaned, user);
      this._persist();
    }

    const accessToken = this._signToken(
      { sub: user.id, role: user.role, type: 'access' },
      this.accessSecret,
      15 * 60
    );
    const refreshToken = this._signToken(
      { sub: user.id, role: user.role, type: 'refresh' },
      this.refreshSecret,
      7 * 24 * 60 * 60
    );

    return {
      user: {
        id: user.id,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  verifyAccessToken(token) {
    if (!token || this.revokedTokens.has(token)) {
      const err = new Error('UNAUTHORIZED_TOKEN');
      err.statusCode = 401;
      throw err;
    }
    try {
      return this._verifyToken(token, this.accessSecret, 'access');
    } catch (err) {
      err.statusCode = 401;
      throw err;
    }
  }

  logout(token) {
    if (token) {
      this.revokedTokens.add(token);
      this._persist();
    }
    return { loggedOut: true };
  }

  _signToken(payload, secret, expiresInSec) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresInSec,
      })
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  _verifyToken(token, secret, expectedType = null) {
    const parts = String(token).split('.');
    if (parts.length !== 3) throw new Error('MALFORMED_TOKEN');
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    // Constant-time comparison so signature verification cannot be timed.
    const sigBuf = Buffer.from(String(sig), 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new Error('INVALID_TOKEN_SIGNATURE');
    }

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new Error('MALFORMED_TOKEN');
    }

    // A refresh token must never be accepted where an access token is required.
    if (expectedType && decoded.type !== expectedType) {
      throw new Error(`WRONG_TOKEN_TYPE: expected "${expectedType}" token.`);
    }
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
      throw new Error('TOKEN_EXPIRED');
    }
    return decoded;
  }
}

module.exports = { AuthService, SELF_ASSIGNABLE_ROLES };
