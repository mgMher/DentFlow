const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required in production');
}
if (isProduction && !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required in production');
}

export const jwtConfig = {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '1d',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
};
