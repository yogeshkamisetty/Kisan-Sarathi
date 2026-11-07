/**
 * Durable JSON Collection Store
 *
 * The Prisma/PostgreSQL schema remains the target production datastore, but until the
 * Prisma client is wired in, every domain service kept its state in process memory —
 * meaning a restart destroyed every farmer's in-flight crop-loss draft. That is
 * unacceptable for a 72-hour deadline workflow, so state is now written through to disk.
 *
 * Writes are synchronous and atomic (write to a temp file, then rename), which is safe
 * for the single-process modular monolith. Set DATA_DIR to relocate the files, or
 * PERSISTENCE=memory to opt out (used by the test suite for isolation).
 */
const fs = require('node:fs');
const path = require('node:path');

class JsonStore {
  /**
   * @param {object} options
   * @param {string|null} options.dataDir Directory for collection files, or null for memory-only.
   */
  constructor({ dataDir = null } = {}) {
    this.dataDir = dataDir;
    this.cache = new Map();

    if (this.dataDir) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  static fromEnv(env = process.env) {
    if (String(env.PERSISTENCE || '').toLowerCase() === 'memory') {
      return new JsonStore({ dataDir: null });
    }
    const defaultDataDir = env.VERCEL ? '/tmp/.data' : path.join(process.cwd(), '.data');
    const dataDir = env.DATA_DIR || defaultDataDir;
    return new JsonStore({ dataDir });
  }

  get enabled() {
    return Boolean(this.dataDir);
  }

  _fileFor(collection) {
    // Collection names come from code, never user input, but sanitise anyway.
    const safe = String(collection).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safe}.json`);
  }

  /**
   * Reads a collection. Returns null when nothing has been stored yet, so callers can
   * fall back to their own empty default.
   */
  read(collection) {
    if (!this.enabled) return null;
    if (this.cache.has(collection)) return this.cache.get(collection);

    const file = this._fileFor(collection);
    if (!fs.existsSync(file)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.cache.set(collection, parsed);
      return parsed;
    } catch {
      // A corrupt file must not stop the API from starting; quarantine and start fresh.
      try {
        fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
      } catch {
        /* best effort */
      }
      return null;
    }
  }

  write(collection, value) {
    if (!this.enabled) return value;
    this.cache.set(collection, value);

    const file = this._fileFor(collection);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return value;
  }
}

module.exports = { JsonStore };
