/**
 * Runs before each e2e file is loaded. Values set here win over `.env`
 * (ConfigModule never overrides a variable that is already set), so the tests
 * can never reach the database or secrets a developer's `.env` points at.
 */
import { randomBytes } from 'crypto';

const base = (process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');
const host = new URL(base).hostname;

// Every file drops its database when it finishes; make sure that is never a real one.
if (!['127.0.0.1', 'localhost', '::1', 'mongodb'].includes(host) && process.env.E2E_ALLOW_REMOTE_MONGO !== '1') {
    throw new Error(`E2E tests refuse to run against ${host}. Point E2E_MONGO_URI at a local MongoDB.`);
}

process.env.MONGO_URI = `${base}/dentflow_e2e_${randomBytes(4).toString('hex')}`;
process.env.MODE = 'TEST';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
process.env.JWT_ACCESS_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';
delete process.env.TRUST_PROXY;
