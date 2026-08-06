import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role } from 'src/common/decorators';
import { User, UserDocument } from '../auth/auth.schema';
import { UserProfile, UserProfileDocument } from './user.schema';
import { CreateUserDto, UpdateUserDto } from './dto';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
        @InjectModel(User.name) private readonly authModel: Model<UserDocument>,
    ) {}

    /**
     * Create a new user within a clinic.
     * Creates both the auth record (User) and the profile record (UserProfile).
     */
    async create(clinicId: string, dto: CreateUserDto): Promise<UserProfileDocument> {
        // Check for existing auth record with the same email
        const existingAuth = await this.authModel.findOne({
            email: dto.email.toLowerCase(),
        });
        if (existingAuth) {
            throw new ConflictException('A user with this email already exists');
        }

        // Check for existing profile within this clinic
        const existingProfile = await this.userProfileModel.findOne({
            clinicId: new Types.ObjectId(clinicId),
            email: dto.email.toLowerCase(),
        });
        if (existingProfile) {
            throw new ConflictException('A user with this email already exists in this clinic');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        // Create the auth record
        const authRecord = await this.authModel.create({
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            clinicId: new Types.ObjectId(clinicId),
            role: dto.role,
            firstName: dto.firstName,
            lastName: dto.lastName,
            patronymic: dto.patronymic || '',
            isActive: true,
        });

        // Create the user profile
        const profile = await this.userProfileModel.create({
            clinicId: new Types.ObjectId(clinicId),
            authId: authRecord._id,
            firstName: dto.firstName,
            lastName: dto.lastName,
            patronymic: dto.patronymic || '',
            email: dto.email.toLowerCase(),
            phone: dto.phone || '',
            role: dto.role,
            specialization: dto.specialization || '',
            licenseNumber: dto.licenseNumber || '',
            avatar: dto.avatar || '',
            isActive: true,
            schedule: {
                defaultAvailability: dto.defaultAvailability || [],
            },
        });

        return profile;
    }

    /**
     * List all users in a clinic with pagination and optional search.
     * Search matches against firstName, lastName, email, and specialization.
     */
    async findAll(
        clinicId: string,
        filters?: { page?: number; limit?: number; search?: string; role?: Role },
    ): Promise<PaginatedResult<UserProfileDocument>> {
        const page = Math.max(1, filters?.page || 1);
        const limit = Math.min(100, Math.max(1, filters?.limit || 20));
        const skip = (page - 1) * limit;

        const query: Record<string, any> = {
            clinicId: new Types.ObjectId(clinicId),
            isActive: true,
        };

        if (filters?.role) {
            query.role = filters.role;
        }

        if (filters?.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { specialization: searchRegex },
            ];
        }

        const [data, total] = await Promise.all([
            this.userProfileModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.userProfileModel.countDocuments(query),
        ]);

        return {
            data: data as UserProfileDocument[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Find a single user by ID within a clinic.
     */
    async findById(clinicId: string, userId: string): Promise<UserProfileDocument> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user ID');
        }

        const profile = await this.userProfileModel
            .findOne({
                _id: new Types.ObjectId(userId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .lean();

        if (!profile) {
            throw new NotFoundException('User not found');
        }

        return profile as UserProfileDocument;
    }

    /**
     * Update a user's profile within a clinic.
     * Also syncs relevant fields back to the auth record.
     */
    async update(
        clinicId: string,
        userId: string,
        dto: UpdateUserDto,
    ): Promise<UserProfileDocument> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user ID');
        }

        const existingProfile = await this.userProfileModel.findOne({
            _id: new Types.ObjectId(userId),
            clinicId: new Types.ObjectId(clinicId),
        });

        if (!existingProfile) {
            throw new NotFoundException('User not found');
        }

        // If changing email, check for uniqueness
        if (dto.email && dto.email.toLowerCase() !== existingProfile.email) {
            const emailTaken = await this.authModel.findOne({
                email: dto.email.toLowerCase(),
                _id: { $ne: existingProfile.authId },
            });
            if (emailTaken) {
                throw new ConflictException('A user with this email already exists');
            }
        }

        // Build profile update payload
        const profileUpdate: Record<string, any> = {};
        if (dto.firstName !== undefined) profileUpdate.firstName = dto.firstName;
        if (dto.lastName !== undefined) profileUpdate.lastName = dto.lastName;
        if (dto.patronymic !== undefined) profileUpdate.patronymic = dto.patronymic;
        if (dto.email !== undefined) profileUpdate.email = dto.email.toLowerCase();
        if (dto.phone !== undefined) profileUpdate.phone = dto.phone;
        if (dto.role !== undefined) profileUpdate.role = dto.role;
        if (dto.specialization !== undefined) profileUpdate.specialization = dto.specialization;
        if (dto.licenseNumber !== undefined) profileUpdate.licenseNumber = dto.licenseNumber;
        if (dto.avatar !== undefined) profileUpdate.avatar = dto.avatar;
        if (dto.defaultAvailability !== undefined) {
            profileUpdate['schedule.defaultAvailability'] = dto.defaultAvailability;
        }

        const updatedProfile = await this.userProfileModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(userId), clinicId: new Types.ObjectId(clinicId) },
                { $set: profileUpdate },
                { new: true, runValidators: true },
            )
            .lean();

        // Sync fields that also live on the auth record
        const authUpdate: Record<string, any> = {};
        if (dto.firstName !== undefined) authUpdate.firstName = dto.firstName;
        if (dto.lastName !== undefined) authUpdate.lastName = dto.lastName;
        if (dto.patronymic !== undefined) authUpdate.patronymic = dto.patronymic;
        if (dto.email !== undefined) authUpdate.email = dto.email.toLowerCase();
        if (dto.role !== undefined) authUpdate.role = dto.role;

        if (Object.keys(authUpdate).length > 0) {
            await this.authModel.findByIdAndUpdate(existingProfile.authId, { $set: authUpdate });
        }

        return updatedProfile as UserProfileDocument;
    }

    /**
     * Soft-delete a user by setting isActive to false.
     * Also deactivates the corresponding auth record.
     */
    async deactivate(clinicId: string, userId: string): Promise<{ message: string }> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user ID');
        }

        const profile = await this.userProfileModel.findOne({
            _id: new Types.ObjectId(userId),
            clinicId: new Types.ObjectId(clinicId),
        });

        if (!profile) {
            throw new NotFoundException('User not found');
        }

        if (!profile.isActive) {
            throw new BadRequestException('User is already deactivated');
        }

        await this.userProfileModel.findByIdAndUpdate(userId, {
            $set: { isActive: false },
        });

        // Also deactivate the auth record
        await this.authModel.findByIdAndUpdate(profile.authId, {
            $set: { isActive: false },
        });

        return { message: 'User deactivated successfully' };
    }

    /**
     * Find all active dentists within a clinic.
     */
    async findDentists(clinicId: string): Promise<UserProfileDocument[]> {
        const dentists = await this.userProfileModel
            .find({
                clinicId: new Types.ObjectId(clinicId),
                role: Role.DENTIST,
                isActive: true,
            })
            .sort({ lastName: 1, firstName: 1 })
            .lean();

        return dentists as UserProfileDocument[];
    }
}
