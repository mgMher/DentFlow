import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (): MongooseModuleOptions => ({
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/dentflow',
});
