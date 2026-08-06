import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserProfile, UserProfileSchema } from './user.schema';
import { User, UserSchema } from '../auth/auth.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UserProfile.name, schema: UserProfileSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService, MongooseModule],
})
export class UsersModule {}
