/**
 * JWT settings, read from the environment on every access.
 *
 * This used to be a plain object built at import time. `app.module.ts` imports
 * `src/config` before `ConfigModule.forRoot()` has loaded `.env`, so every
 * value fell back to its default and tokens were signed with the public
 * `dev-*` secrets. Getters defer the read until the first token is signed or
 * verified, by which point `.env` is loaded.
 */

const isProduction = () => process.env.MODE === 'PROD';

/** In PROD a missing or weak secret is fatal; in dev a fixed fallback keeps setup simple. */
function secret(name: string, devFallback: string): string {
    const value = process.env[name];
    if (value) return value;
    if (isProduction()) {
        throw new Error(`${name} must be set when MODE=PROD`);
    }
    return devFallback;
}

export const jwtConfig = {
    get accessSecret(): string {
        return secret('JWT_ACCESS_SECRET', 'dev-access-secret');
    },
    get refreshSecret(): string {
        return secret('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    },
    // Short-lived on purpose: role and active status are re-checked on every
    // request, but a stolen token is only useful until it expires.
    get accessExpiration(): string {
        return process.env.JWT_ACCESS_EXPIRATION || '15m';
    },
    get refreshExpiration(): string {
        return process.env.JWT_REFRESH_EXPIRATION || '7d';
    },
};

const MIN_PROD_SECRET_LENGTH = 32;

/**
 * Called once at bootstrap, after `.env` is loaded, so a misconfigured
 * production deploy refuses to start instead of failing on the first login.
 */
export function assertJwtConfig(): void {
    const { accessSecret, refreshSecret } = jwtConfig;
    if (!isProduction()) return;

    if (accessSecret.length < MIN_PROD_SECRET_LENGTH || refreshSecret.length < MIN_PROD_SECRET_LENGTH) {
        throw new Error(`JWT secrets must be at least ${MIN_PROD_SECRET_LENGTH} characters when MODE=PROD`);
    }
    if (accessSecret === refreshSecret) {
        throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
}
