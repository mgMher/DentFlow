import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (): MongooseModuleOptions => ({
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/dentflow',
    // Building indexes on every boot is a foot-gun against a shared database:
    // a failure is only logged, so the app runs on silently without the index.
    // Manage them explicitly in production instead.
    autoIndex: process.env.MODE !== 'PROD',
});
